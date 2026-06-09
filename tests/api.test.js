const test = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");

process.env.NODE_ENV = "test";
const { createServer } = require("../server");

let server;
let origin;
let authCookie;

async function login(loginId = "HoangDinh", password = "1") {
  const response = await fetch(`${origin}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ loginId, password })
  });
  if (response.status !== 200) return { response };
  authCookie = response.headers.get("set-cookie").split(";")[0];
  return { response, body: await response.json(), cookie: authCookie };
}

function authed(url, options = {}) {
  return fetch(url, { ...options, headers: { ...(options.headers || {}), cookie: authCookie } });
}

function zipBuffer(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name);
    const raw = Buffer.from(content);
    const deflated = zlib.deflateRawSync(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuffer, deflated);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + deflated.length;
  }
  const centralStart = offset;
  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBuffer, end]);
}

function rar4Buffer(entries) {
  const chunks = [Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00])];
  const main = Buffer.alloc(7);
  main.writeUInt16LE(0, 0);
  main.writeUInt8(0x73, 2);
  main.writeUInt16LE(0, 3);
  main.writeUInt16LE(7, 5);
  chunks.push(main);
  for (const [name, content] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name);
    const raw = Buffer.from(content);
    const headerSize = 32 + nameBuffer.length;
    const header = Buffer.alloc(headerSize);
    header.writeUInt16LE(0, 0);
    header.writeUInt8(0x74, 2);
    header.writeUInt16LE(0x8000, 3);
    header.writeUInt16LE(headerSize, 5);
    header.writeUInt32LE(raw.length, 7);
    header.writeUInt32LE(raw.length, 11);
    header.writeUInt8(2, 15);
    header.writeUInt32LE(0, 16);
    header.writeUInt32LE(0, 20);
    header.writeUInt8(20, 24);
    header.writeUInt8(0x30, 25);
    header.writeUInt16LE(nameBuffer.length, 26);
    header.writeUInt32LE(0, 28);
    nameBuffer.copy(header, 32);
    chunks.push(header, raw);
  }
  const end = Buffer.alloc(7);
  end.writeUInt16LE(0, 0);
  end.writeUInt8(0x7b, 2);
  end.writeUInt16LE(0, 3);
  end.writeUInt16LE(7, 5);
  chunks.push(end);
  return Buffer.concat(chunks);
}

test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  await login();
});

test.after(() => server.close());

test("health endpoint reports ready", async () => {
  const response = await fetch(`${origin}/api/v1/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
});

test("auth supports login, me and logout", async () => {
  const { response, body, cookie } = await login();
  assert.equal(response.status, 200);
  assert.equal(body.account.loginId, "HoangDINH");
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.match(response.headers.get("set-cookie"), /SameSite=Lax/);
  assert.match(response.headers.get("set-cookie"), /Max-Age=43200/);

  const me = await fetch(`${origin}/api/v1/auth/me`, { headers: { cookie } }).then((res) => res.json());
  assert.equal(me.account.loginId, "HoangDINH");

  const logout = await fetch(`${origin}/api/v1/auth/logout`, { method: "POST", headers: { cookie } });
  assert.equal(logout.status, 200);
  await login();
});

test("protected APIs require login", async () => {
  const projectList = await fetch(`${origin}/api/v1/projects`);
  assert.equal(projectList.status, 401);

  const dashboard = await fetch(`${origin}/api/v1/dashboard/projects`);
  assert.equal(dashboard.status, 401);

  const materials = await fetch(`${origin}/api/v1/materials`);
  assert.equal(materials.status, 401);

  const navigation = await fetch(`${origin}/api/v1/navigation`);
  assert.equal(navigation.status, 401);

  const response = await fetch(`${origin}/api/v1/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Unauthorized project" })
  });
  assert.equal(response.status, 401);
});

test("accounts API hides password material and supports password reset", async () => {
  const accounts = await authed(`${origin}/api/v1/accounts`).then((res) => res.json());
  assert.ok(accounts.data.length > 0);
  assert.equal(accounts.data.some((account) => account.password || account.passwordHash || account.passwordSalt), false);
  assert.ok(accounts.data.every((account) => account.positionCode));
  const accountsByPerson = accounts.data.reduce((map, account) => {
    const key = account.personKey || account.staffName;
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
  assert.ok([...accountsByPerson.values()].some((count) => count >= 2));

  const target = accounts.data.find((account) => account.loginId.toLowerCase() === "hoangdinh");
  target.newPassword = "2";
  const saved = await authed(`${origin}/api/v1/accounts`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accounts: accounts.data })
  });
  assert.equal(saved.status, 200);

  const oldLogin = await fetch(`${origin}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ loginId: "HoangDinh", password: "1" })
  });
  assert.equal(oldLogin.status, 401);

  const newLogin = await fetch(`${origin}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ loginId: "HoangDinh", password: "2" })
  });
  assert.equal(newLogin.status, 200);

  target.newPassword = "1";
  await authed(`${origin}/api/v1/accounts`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accounts: accounts.data })
  });
  await login();
});

test("account access levels apply the config boundary", async () => {
  const accounts = await authed(`${origin}/api/v1/accounts`).then((res) => res.json());
  const admin = accounts.data.find((account) => account.loginId.toLowerCase() === "hoangdinh");
  const leader = accounts.data.find((account) => account.loginId.toLowerCase() === "dungbui");
  assert.equal(admin.accessLevel, "admin");
  assert.equal(admin.permissions["config.accounts"], true);
  assert.equal(leader.accessLevel, "leadership");
  assert.equal(leader.permissions["projects.delete"], true);
  assert.equal(leader.permissions["config.accounts"], false);

  const { response } = await login(leader.loginId, "1");
  assert.equal(response.status, 200);
  const denied = await authed(`${origin}/api/v1/accounts`);
  assert.equal(denied.status, 403);
  await login();
});

test("accounts API persists custom permission toggles", async () => {
  const accounts = await authed(`${origin}/api/v1/accounts`).then((res) => res.json());
  const original = structuredClone(accounts.data);
  const leader = accounts.data.find((account) => account.loginId.toLowerCase() === "dungbui");
  const updatedAccounts = accounts.data.map((account) => account.staffCode === leader.staffCode
    ? { ...account, permissions: { ...account.permissions, "projects.delete": false } }
    : account);

  const saved = await authed(`${origin}/api/v1/accounts`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accounts: updatedAccounts })
  });
  assert.equal(saved.status, 200);

  try {
    const current = await authed(`${origin}/api/v1/accounts`).then((res) => res.json());
    const customLeader = current.data.find((account) => account.staffCode === leader.staffCode);
    assert.equal(customLeader.permissions["projects.delete"], false);
    assert.equal(customLeader.permissions.projects, true);

    const { response } = await login(leader.loginId, "1");
    assert.equal(response.status, 200);
    const deniedDelete = await authed(`${origin}/api/v1/projects/not-real`, { method: "DELETE" });
    assert.equal(deniedDelete.status, 403);
  } finally {
    await login();
    await authed(`${origin}/api/v1/accounts`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accounts: original })
    });
    await login();
  }
});

test("catalog API includes and persists project list", async () => {
  const catalog = await authed(`${origin}/api/v1/catalog`).then((res) => res.json());
  assert.ok(Array.isArray(catalog.data.projectList));
  assert.ok(catalog.data.projectList.length > 0);
  [
    "voucherTypes",
    "overtimeVoucherTypes",
    "paymentVoucherTypes",
    "attendanceVoucherTypes",
    "constructionCategoryGroups",
    "designCategories",
    "materialCategories",
    "materialCategoryGroups",
    "designContractTypes",
    "constructionContractTypes",
    "subcontractTypes",
    "inventoryReceiptTypes",
    "inventoryIssueTypes",
    "warehouseList",
    "cdtChangeRequestTypes",
    "cdtNoteRequestTypes",
    "cdtApprovalRequestTypes",
    "incidentIssueTypes"
  ].forEach((key) => assert.ok(Array.isArray(catalog.data[key]), `${key} should be a catalog list`));

  const marker = `TEST-${Date.now()}`;
  const overtimeMarker = `OT-${Date.now()}`;
  const titleMarker = `Danh sách test ${Date.now()}`;
  const data = {
    ...catalog.data,
    projectList: [marker, ...catalog.data.projectList],
    overtimeVoucherTypes: [overtimeMarker, ...catalog.data.overtimeVoucherTypes],
    listTitles: { ...(catalog.data.listTitles || {}), overtimeVoucherTypes: titleMarker }
  };
  const saved = await authed(`${origin}/api/v1/catalog`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data })
  }).then((res) => res.json());
  assert.equal(saved.data.projectList[0], marker);
  assert.equal(saved.data.overtimeVoucherTypes[0], overtimeMarker);
  assert.equal(saved.data.listTitles.overtimeVoucherTypes, titleMarker);
  assert.ok(Array.isArray(saved.data.constructionCategoryGroups));
  assert.equal(saved.data.constructionCategoryGroups.length, 5);
  const roughGroup = saved.data.constructionCategoryGroups.find((group) => group.id === "rough");
  const completionGroup = saved.data.constructionCategoryGroups.find((group) => group.id === "completion");
  const movedConstructionItem = roughGroup.items[0];
  const customConstructionGroups = saved.data.constructionCategoryGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => item !== movedConstructionItem)
  }));
  customConstructionGroups.find((group) => group.id === "completion").items.unshift(movedConstructionItem);
  const grouped = await authed(`${origin}/api/v1/catalog`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: { ...saved.data, constructionCategoryGroups: customConstructionGroups } })
  }).then((res) => res.json());
  assert.ok(grouped.data.constructionCategoryGroups.find((group) => group.id === "completion").items.includes(movedConstructionItem));
  assert.ok(!grouped.data.constructionCategoryGroups.find((group) => group.id === "rough").items.includes(movedConstructionItem));
  assert.ok(completionGroup);
  assert.ok(saved.data.constructionCategoryGroups.some((group) => group.title.includes("Nhóm 5") && group.items.includes("DEFECT CHẤM VÁ")));
  assert.ok(Array.isArray(saved.data.materialCategoryGroups));
  assert.equal(saved.data.materialCategoryGroups.length, 4);
  assert.ok(saved.data.materialCategoryGroups.some((group) => group.title.includes("Nhóm 3") && group.items.includes("THIẾT BỊ BẾP")));

  await authed(`${origin}/api/v1/catalog`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: catalog.data })
  });
});

test("server-side business stores persist through API", async () => {
  const partners = await authed(`${origin}/api/v1/partners/customers`).then((res) => res.json());
  const marker = `KH${Date.now()}`;
  partners.data.unshift([marker, "Khách hàng test", "Liên hệ", "0900000000", "Tiềm năng", "HN", 1, 2, ["Demo"], "Ghi chú"]);
  const savedPartners = await authed(`${origin}/api/v1/partners/customers`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rows: partners.data })
  }).then((res) => res.json());
  assert.equal(savedPartners.data[0][0], marker);

  const finance = await authed(`${origin}/api/v1/finance/overview`).then((res) => res.json());
  finance.data.transactions.unshift(["2026-06-04", "Thu", "LE DOME", "TEST", "", "", "Test", 123, "", "", ""]);
  const savedFinance = await authed(`${origin}/api/v1/finance/overview`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: finance.data })
  }).then((res) => res.json());
  assert.equal(savedFinance.data.transactions[0][7], 123);

  const materials = await authed(`${origin}/api/v1/materials`).then((res) => res.json());
  const materialMarker = `VT${Date.now()}`;
  const materialRows = [{ id: materialMarker, date: "2026-06-06", item: "Vat tu test", category: "THIET BI", supplier: "NCC test", quantity: 2, unit: "cai", locationType: "Kho VP", location: "VP", project: "", status: "Đã nhận", note: "Test" }, ...materials.data];
  const savedMaterials = await authed(`${origin}/api/v1/materials`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rows: materialRows })
  }).then((res) => res.json());
  assert.equal(savedMaterials.data[0].id, materialMarker);

  const drive = await authed(`${origin}/api/v1/drive`).then((res) => res.json());
  drive.data.unshift(["DRV999", "File test.pdf", "PDF", "Công ty", "Test", "HoangDinh", "2026-06-04", 1, "Toàn công ty", ""]);
  const savedDrive = await authed(`${origin}/api/v1/drive`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ files: drive.data })
  }).then((res) => res.json());
  assert.equal(savedDrive.data[0][0], "DRV999");
});

test("personal finance is blocked for non-HoangDinh accounts", async () => {
  const accounts = await authed(`${origin}/api/v1/accounts`).then((res) => res.json());
  const other = accounts.data.find((account) => account.active && account.loginId.toLowerCase() !== "hoangdinh");
  const { response } = await login(other.loginId, "1");
  assert.equal(response.status, 200);
  const responsePersonal = await authed(`${origin}/api/v1/personal-finance`);
  assert.equal(responsePersonal.status, 403);
  await login();
});

test("file uploads reject unsupported extensions", async () => {
  const response = await authed(`${origin}/api/v1/projects/p1/design-3d-files?kind=concept&name=malware.exe`, {
    method: "POST",
    body: Buffer.from("bad")
  });
  assert.equal(response.status, 400);
});

test("contract files keep variation uploads in the phát sinh bucket", async () => {
  for (const kind of ["variation", "variation-confirm", "variation-quote"]) {
    const upload = await authed(`${origin}/api/v1/projects/p1/contract-files?kind=${kind}&name=${kind}-test.txt`, {
      method: "POST",
      body: Buffer.from(kind)
    });
    assert.equal(upload.status, 201);
    const stored = await upload.json();
    assert.equal(stored.kind, kind);
    assert.equal(stored.name, `${kind}-test.txt`);
  }

  const files = await authed(`${origin}/api/v1/projects/p1/contract-files`).then((res) => res.json());
  for (const kind of ["variation", "variation-confirm", "variation-quote"]) {
    assert.ok(files.data.some((file) => file.kind === kind && file.name === `${kind}-test.txt`));
  }
});

test("contract files can be duplicated without overwriting the source", async () => {
  const upload = await authed(`${origin}/api/v1/projects/p1/contract-files?kind=quote&name=bao-gia-copy-test.txt`, {
    method: "POST",
    body: Buffer.from("quote copy source")
  });
  assert.equal(upload.status, 201);
  const source = await upload.json();

  const duplicated = await authed(`${origin}/api/v1/projects/p1/contract-files`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storedName: source.storedName })
  });
  assert.equal(duplicated.status, 201);
  const copy = await duplicated.json();
  assert.equal(copy.kind, "quote");
  assert.notEqual(copy.storedName, source.storedName);
  assert.match(copy.name, /copy/i);

  const opened = await authed(`${origin}/api/v1/projects/p1/contract-files/download?storedName=${encodeURIComponent(copy.storedName)}`);
  assert.equal(opened.status, 200);
  assert.equal(await opened.text(), "quote copy source");
});

test("contract files can be marked as signed approved and unmarked", async () => {
  const upload = await authed(`${origin}/api/v1/projects/p1/contract-files?kind=contract&name=signed-approved-test.txt`, {
    method: "POST",
    body: Buffer.from("signed contract")
  });
  assert.equal(upload.status, 201);
  const source = await upload.json();

  const marked = await authed(`${origin}/api/v1/projects/p1/contract-files/signed-approved`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storedName: source.storedName, signedApproved: true })
  }).then((res) => res.json());
  assert.equal(marked.signedApproved, true);
  assert.ok(marked.signedApprovedAt);

  const files = await authed(`${origin}/api/v1/projects/p1/contract-files`).then((res) => res.json());
  assert.equal(files.data.find((file) => file.storedName === source.storedName).signedApproved, true);

  const unmarked = await authed(`${origin}/api/v1/projects/p1/contract-files/signed-approved`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storedName: source.storedName, signedApproved: false })
  }).then((res) => res.json());
  assert.equal(unmarked.signedApproved, false);

  const firstUpload = await authed(`${origin}/api/v1/projects/p1/contract-files?kind=contract&name=signed-approved-first.txt`, {
    method: "POST",
    body: Buffer.from("first signed contract")
  }).then((res) => res.json());
  const secondUpload = await authed(`${origin}/api/v1/projects/p1/contract-files?kind=contract&name=signed-approved-second.txt`, {
    method: "POST",
    body: Buffer.from("second signed contract")
  }).then((res) => res.json());
  await authed(`${origin}/api/v1/projects/p1/contract-files/signed-approved`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storedName: firstUpload.storedName, signedApproved: true })
  });
  await authed(`${origin}/api/v1/projects/p1/contract-files/signed-approved`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storedName: secondUpload.storedName, signedApproved: true })
  });
  const afterSecondApproval = await authed(`${origin}/api/v1/projects/p1/contract-files`).then((res) => res.json());
  assert.equal(afterSecondApproval.data.find((file) => file.storedName === firstUpload.storedName).signedApproved, true);
  assert.equal(afterSecondApproval.data.find((file) => file.storedName === secondUpload.storedName).signedApproved, true);
});

test("vendor contract files can be marked as signed approved and unmarked", async () => {
  const upload = await authed(`${origin}/api/v1/projects/p1/vendor-contract-files?kind=contract&name=vendor-signed-approved-test.txt`, {
    method: "POST",
    body: Buffer.from("signed vendor contract")
  });
  assert.equal(upload.status, 201);
  const source = await upload.json();

  const marked = await authed(`${origin}/api/v1/projects/p1/vendor-contract-files/signed-approved`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storedName: source.storedName, signedApproved: true })
  }).then((res) => res.json());
  assert.equal(marked.signedApproved, true);
  assert.ok(marked.signedApprovedAt);

  const files = await authed(`${origin}/api/v1/projects/p1/vendor-contract-files`).then((res) => res.json());
  assert.equal(files.data.find((file) => file.storedName === source.storedName).signedApproved, true);

  const unmarked = await authed(`${origin}/api/v1/projects/p1/vendor-contract-files/signed-approved`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storedName: source.storedName, signedApproved: false })
  }).then((res) => res.json());
  assert.equal(unmarked.signedApproved, false);

  const firstUpload = await authed(`${origin}/api/v1/projects/p1/vendor-contract-files?kind=contract&name=vendor-signed-approved-first.txt`, {
    method: "POST",
    body: Buffer.from("first signed vendor contract")
  }).then((res) => res.json());
  const secondUpload = await authed(`${origin}/api/v1/projects/p1/vendor-contract-files?kind=contract&name=vendor-signed-approved-second.txt`, {
    method: "POST",
    body: Buffer.from("second signed vendor contract")
  }).then((res) => res.json());
  await authed(`${origin}/api/v1/projects/p1/vendor-contract-files/signed-approved`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storedName: firstUpload.storedName, signedApproved: true })
  });
  await authed(`${origin}/api/v1/projects/p1/vendor-contract-files/signed-approved`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storedName: secondUpload.storedName, signedApproved: true })
  });
  const afterSecondApproval = await authed(`${origin}/api/v1/projects/p1/vendor-contract-files`).then((res) => res.json());
  assert.equal(afterSecondApproval.data.find((file) => file.storedName === firstUpload.storedName).signedApproved, true);
  assert.equal(afterSecondApproval.data.find((file) => file.storedName === secondUpload.storedName).signedApproved, true);
});

test("deleted contract files are moved to HỢP ĐỒNG NHÁP drive for seven days", async () => {
  const upload = await authed(`${origin}/api/v1/projects/p1/contract-files?kind=contract&name=deleted-contract-draft.pdf`, {
    method: "POST",
    body: Buffer.from("deleted contract draft")
  });
  assert.equal(upload.status, 201);
  const source = await upload.json();

  const removed = await authed(`${origin}/api/v1/projects/p1/contract-files?storedName=${encodeURIComponent(source.storedName)}`, { method: "DELETE" });
  assert.equal(removed.status, 200);
  const body = await removed.json();
  assert.equal(body.archived[3], "HỢP ĐỒNG NHÁP");
  assert.match(body.archived[1], /^HỢP ĐỒNG NHÁP\//);
  assert.ok(body.archived[10]);
  const expiresAt = Date.parse(body.archived[12]);
  assert.ok(expiresAt > Date.now() + 6 * 86400000);
  assert.ok(expiresAt <= Date.now() + 8 * 86400000);

  const files = await authed(`${origin}/api/v1/projects/p1/contract-files`).then((res) => res.json());
  assert.ok(!files.data.some((file) => file.storedName === source.storedName));

  const drive = await authed(`${origin}/api/v1/drive`).then((res) => res.json());
  const archived = drive.data.find((row) => row[10] === body.archived[10]);
  assert.equal(archived[3], "HỢP ĐỒNG NHÁP");
  assert.match(archived[1], /deleted-contract-draft\.pdf$/);

  const downloaded = await authed(`${origin}/api/v1/drive-files/download?storedName=${encodeURIComponent(body.archived[10])}`);
  assert.equal(downloaded.status, 200);
  assert.equal(await downloaded.text(), "deleted contract draft");

  const vendorUpload = await authed(`${origin}/api/v1/projects/p1/vendor-contract-files?kind=contract&name=deleted-vendor-contract-draft.pdf`, {
    method: "POST",
    body: Buffer.from("deleted vendor contract draft")
  });
  assert.equal(vendorUpload.status, 201);
  const vendorSource = await vendorUpload.json();
  const vendorRemoved = await authed(`${origin}/api/v1/projects/p1/vendor-contract-files?storedName=${encodeURIComponent(vendorSource.storedName)}`, { method: "DELETE" });
  assert.equal(vendorRemoved.status, 200);
  const vendorBody = await vendorRemoved.json();
  assert.equal(vendorBody.archived[3], "HỢP ĐỒNG NHÁP");
  assert.match(vendorBody.archived[4], /\/NCC$/);
});

test("project dossier files can be marked as signed approved", async () => {
  const upload = await authed(`${origin}/api/v1/projects/p1/dossiers/technical?kind=main&name=approved-design-drawing.pdf`, {
    method: "POST",
    body: Buffer.from("approved design drawing")
  });
  assert.equal(upload.status, 201);
  const source = await upload.json();

  const marked = await authed(`${origin}/api/v1/projects/p1/dossiers/technical/signed-approved`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storedName: source.storedName, signedApproved: true })
  });
  assert.equal(marked.status, 200);
  const markedBody = await marked.json();
  assert.equal(markedBody.signedApproved, true);
  assert.ok(markedBody.signedApprovedAt);

  const list = await authed(`${origin}/api/v1/projects/p1/dossiers/technical`).then((res) => res.json());
  assert.equal(list.data.find((file) => file.storedName === source.storedName).signedApproved, true);

  const preview = await authed(`${origin}/api/v1/projects/p1/dossiers/technical/download?storedName=${encodeURIComponent(source.storedName)}`);
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get("content-type"), /application\/pdf/);
  assert.match(preview.headers.get("content-disposition"), /^inline/);

  const download = await authed(`${origin}/api/v1/projects/p1/dossiers/technical/download?storedName=${encodeURIComponent(source.storedName)}&download=1`);
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition"), /^attachment/);
});

test("contract quote drafts and PDF exports are stored for later editing", async () => {
  const draft = {
    estimateNo: "BG-TEST",
    projectName: "PN An Dinh",
    rows: [{ groupId: "rough", name: "Khao sat", task: "Do dac", unit: "goi", qty: 1, price: 1000 }]
  };
  const savedDraft = await authed(`${origin}/api/v1/projects/p1/contract-drafts/quote`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: draft })
  }).then((res) => res.json());
  assert.equal(savedDraft.data.type, "quote");
  assert.match(savedDraft.data.data.estimateNo, /^\d{4}\/BG\/MNT$/);

  const loadedDraft = await authed(`${origin}/api/v1/projects/p1/contract-drafts/quote`).then((res) => res.json());
  assert.equal(loadedDraft.data.data.rows[0].task, "Do dac");

  const exported = await authed(`${origin}/api/v1/projects/p1/contract-files/pdf`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "quote",
      name: "bao-gia-test.pdf",
      html: "<!doctype html><html><body><h1>Bao gia test</h1></body></html>"
    })
  });
  assert.equal(exported.status, 201);
  const file = await exported.json();
  assert.equal(file.kind, "quote");
  assert.equal(file.name, "bao-gia-test.pdf");

  const opened = await authed(`${origin}/api/v1/projects/p1/contract-files/download?storedName=${encodeURIComponent(file.storedName)}`);
  assert.equal(opened.headers.get("content-type"), "application/pdf");
  assert.match(opened.headers.get("content-disposition"), /^inline/);
  const pdf = Buffer.from(await opened.arrayBuffer());
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
});

test("contract draft clones persist separately from the original draft", async () => {
  const clone = await authed(`${origin}/api/v1/projects/p1/contract-draft-clones/quote`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      cloneId: "copy-001",
      data: { estimateNo: "BG-COPY", rows: [{ name: "Copy row", qty: 1, price: 2000 }] }
    })
  }).then((res) => res.json());
  assert.equal(clone.data.cloneId, "copy-001");
  assert.match(clone.data.data.estimateNo, /^\d{4}\/BG\/MNT$/);

  const list = await authed(`${origin}/api/v1/projects/p1/contract-draft-clones/quote`).then((res) => res.json());
  assert.ok(list.data.some((item) => item.cloneId === "copy-001" && /^\d{4}\/BG\/MNT$/.test(item.data.estimateNo)));

  const removed = await authed(`${origin}/api/v1/projects/p1/contract-draft-clones/quote?cloneId=copy-001`, { method: "DELETE" });
  assert.equal(removed.status, 200);
});

test("contract draft templates can be reused across projects", async () => {
  const draft = {
    estimateNo: "BG-MAU-TAM",
    projectName: "Project source",
    location: "Source location",
    rows: [{ groupId: "rough", name: "Che phu", task: "Lot san", unit: "goi", qty: 2, price: 1500 }],
    total: 3000
  };
  await authed(`${origin}/api/v1/projects/p1/contract-drafts/quote`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: draft })
  });

  const savedTemplate = await authed(`${origin}/api/v1/contract-draft-templates`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectId: "p1", type: "quote", data: draft })
  });
  assert.equal(savedTemplate.status, 201);
  const template = await savedTemplate.json();
  assert.equal(template.data.type, "quote");
  assert.equal(template.data.sourceProjectId, "p1");
  assert.equal(template.data.persistent, true);

  const drive = await authed(`${origin}/api/v1/drive`).then((res) => res.json());
  assert.ok(!drive.data.some((row) => row[11] === "contract-template" || row[0] === `DRV-TPL-${template.data.id}`));

  const imported = await authed(`${origin}/api/v1/contract-draft-templates/${template.data.id}/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectId: "p2" })
  });
  assert.equal(imported.status, 201);
  const importedBody = await imported.json();
  assert.equal(importedBody.data.projectId, "p2");
  assert.match(importedBody.data.data.estimateNo, /^\d{4}\/BG\/MAK70$/);
  assert.notEqual(importedBody.data.data.estimateNo, "BG-MAU-TAM");
  assert.equal(importedBody.data.data.projectName, "THI CÔNG NHÀ ANH KHÁNH 70M2 - LẠC LONG QUÂN");
  assert.equal(importedBody.data.data.rows[0].task, "Lot san");

  const afterImport = await authed(`${origin}/api/v1/contract-draft-templates`).then((res) => res.json());
  assert.ok(afterImport.data.some((item) => item.id === template.data.id));
});

test("drive files support inline view and quick Office preview", async () => {
  const docx = zipBuffer({
    "word/document.xml": `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Drive quick preview works</w:t></w:r></w:p></w:body></w:document>`
  });
  const upload = await authed(`${origin}/api/v1/drive-files?name=quick-preview.docx`, {
    method: "POST",
    body: docx
  });
  assert.equal(upload.status, 201);
  const stored = await upload.json();
  assert.ok(stored.storedName);

  const view = await authed(`${origin}/api/v1/drive-files/view?storedName=${encodeURIComponent(stored.storedName)}`);
  assert.equal(view.status, 200);
  assert.match(view.headers.get("content-disposition"), /^inline/);

  const preview = await authed(`${origin}/api/v1/drive-files/preview?storedName=${encodeURIComponent(stored.storedName)}`).then((res) => res.json());
  assert.equal(preview.data.kind, "word");
  assert.equal(preview.data.sections[0].lines[0], "Drive quick preview works");

  const legacyNamedUpload = await authed(`${origin}/api/v1/drive-files?name=legacy-name.doc`, {
    method: "POST",
    body: docx
  });
  assert.equal(legacyNamedUpload.status, 201);
  const legacyNamed = await legacyNamedUpload.json();
  const legacyNamedPreview = await authed(`${origin}/api/v1/drive-files/preview?storedName=${encodeURIComponent(legacyNamed.storedName)}`).then((res) => res.json());
  assert.equal(legacyNamedPreview.data.kind, "word");
  assert.equal(legacyNamedPreview.data.sections[0].lines[0], "Drive quick preview works");
});

test("config documents store metadata and support Office preview", async () => {
  const docs = await authed(`${origin}/api/v1/config-documents`).then((res) => res.json());
  docs.data.unshift(["GT999", "Quy chế test.docx", "Word", "Giấy tờ", "Test", "HoangDinh", "2026-06-08", 1, "Toàn công ty", "Test"]);
  const savedDocs = await authed(`${origin}/api/v1/config-documents`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ files: docs.data })
  }).then((res) => res.json());
  assert.equal(savedDocs.data[0][0], "GT999");

  const docx = zipBuffer({
    "word/document.xml": `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Config document preview works</w:t></w:r></w:p></w:body></w:document>`
  });
  const upload = await authed(`${origin}/api/v1/config-document-files?name=config-preview.docx`, {
    method: "POST",
    body: docx
  });
  assert.equal(upload.status, 201);
  const stored = await upload.json();
  assert.match(stored.storedName, /^configdoc__/);

  const view = await authed(`${origin}/api/v1/config-document-files/view?storedName=${encodeURIComponent(stored.storedName)}`);
  assert.equal(view.status, 200);
  assert.match(view.headers.get("content-disposition"), /^inline/);

  const preview = await authed(`${origin}/api/v1/config-document-files/preview?storedName=${encodeURIComponent(stored.storedName)}`).then((res) => res.json());
  assert.equal(preview.data.kind, "word");
  assert.equal(preview.data.sections[0].lines[0], "Config document preview works");
});

test("drive files preview ZIP and RAR archive folders", async () => {
  const zip = zipBuffer({
    "docs/readme.txt": "hello",
    "docs/sub/note.txt": "nested"
  });
  const zipUpload = await authed(`${origin}/api/v1/drive-files?name=archive-test.zip`, {
    method: "POST",
    body: zip
  });
  assert.equal(zipUpload.status, 201);
  const storedZip = await zipUpload.json();
  const zipPreview = await authed(`${origin}/api/v1/drive-files/preview?storedName=${encodeURIComponent(storedZip.storedName)}`).then((res) => res.json());
  assert.equal(zipPreview.data.kind, "archive");
  assert.equal(zipPreview.data.archiveType, "ZIP");
  assert.ok(zipPreview.data.entries.some((entry) => entry.type === "folder" && entry.path === "docs/"));
  assert.ok(zipPreview.data.entries.some((entry) => entry.type === "file" && entry.path === "docs/sub/note.txt"));

  const rar = rar4Buffer({
    "contract/readme.txt": "rar hello"
  });
  const rarUpload = await authed(`${origin}/api/v1/drive-files?name=archive-test.rar`, {
    method: "POST",
    body: rar
  });
  assert.equal(rarUpload.status, 201);
  const storedRar = await rarUpload.json();
  const rarPreview = await authed(`${origin}/api/v1/drive-files/preview?storedName=${encodeURIComponent(storedRar.storedName)}`).then((res) => res.json());
  assert.equal(rarPreview.data.kind, "archive");
  assert.equal(rarPreview.data.archiveType, "RAR");
  assert.ok(rarPreview.data.entries.some((entry) => entry.type === "folder" && entry.path === "contract/"));
  assert.ok(rarPreview.data.entries.some((entry) => entry.type === "file" && entry.path === "contract/readme.txt"));
});

test("backup endpoint creates a backup record", async () => {
  const response = await authed(`${origin}/api/v1/admin/backup`, { method: "POST" });
  assert.equal(response.status, 201);
  const backup = await response.json();
  assert.ok(backup.id);
  const list = await authed(`${origin}/api/v1/admin/backups`).then((res) => res.json());
  assert.ok(list.data.some((item) => item.id === backup.id));
});

test("attendance GPS check-in validates site distance and supports approval", async () => {
  const config = await authed(`${origin}/api/v1/attendance/config`).then((res) => res.json());
  assert.ok(config.sites.some((site) => site.name === "VP Le Dome"));
  assert.ok(config.sites.some((site) => site.name === "Khác"));
  assert.ok(config.sites.some((site) => site.projectId === "p1"));
  assert.equal(config.employees[0].id, "NS001");
  const ledome = config.sites.find((site) => site.id === "ledome");

  const weakGps = await authed(`${origin}/api/v1/attendance/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ employeeId: "NS001", siteId: ledome.id, latitude: ledome.latitude, longitude: ledome.longitude, accuracy: 300, hasFacePhoto: true })
  });
  assert.equal(weakGps.status, 400);

  const valid = await authed(`${origin}/api/v1/attendance/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ employeeId: "NS001", siteId: ledome.id, latitude: ledome.latitude, longitude: ledome.longitude, accuracy: 12, hasFacePhoto: true })
  }).then((res) => res.json());
  assert.equal(valid.status, "Hợp lệ");
  assert.equal(valid.distanceMeters, 0);
  assert.equal(valid.geofenceRadiusMeters, ledome.radiusMeters);
  assert.equal(valid.insideGeofence, true);
  assert.equal(valid.gpsStatus, "Đạt");
  assert.equal(valid.gpsNote, "GPS chuẩn vị trí trong phạm vi cho phép");
  assert.equal(valid.faceStatus, "Đạt");
  assert.equal(valid.faceNote, "Ảnh xác thực đạt");
  assert.equal(valid.approvedAt, undefined);

  const starlake = await authed(`${origin}/api/v1/attendance/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ employeeId: "NS001", siteId: ledome.id, latitude: 21.052696700805544, longitude: 105.78997996655893, accuracy: 15, hasFacePhoto: true })
  }).then((res) => res.json());
  assert.equal(starlake.status, "Cần duyệt");
  assert.equal(starlake.insideGeofence, false);
  assert.equal(starlake.gpsStatus, "Không đạt");
  assert.ok(starlake.distanceMeters > ledome.radiusMeters);

  const forbiddenOtherEmployee = await authed(`${origin}/api/v1/attendance/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ employeeId: "NS002", siteId: ledome.id, latitude: ledome.latitude + 0.01, longitude: ledome.longitude, accuracy: 15, hasFacePhoto: true })
  });
  assert.equal(forbiddenOtherEmployee.status, 403);

  const outside = await authed(`${origin}/api/v1/attendance/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ employeeId: "NS001", siteId: ledome.id, latitude: ledome.latitude + 0.01, longitude: ledome.longitude, accuracy: 15, hasFacePhoto: true })
  }).then((res) => res.json());
  assert.equal(outside.status, "Cần duyệt");
  assert.equal(outside.insideGeofence, false);
  assert.equal(outside.gpsStatus, "Không đạt");
  assert.equal(outside.gpsNote, "GPS ngoài phạm vi cho phép");
  assert.equal(outside.faceStatus, "Đạt");

  const approved = await authed(`${origin}/api/v1/attendance/records/${outside.id}/approve`, { method: "POST" }).then((res) => res.json());
  assert.equal(approved.status, "Hợp lệ");
  assert.equal(approved.gpsStatus, "Không đạt");
  assert.ok(approved.approvedAt);

  const recordDate = Date.parse(valid.capturedAt);
  const setTime = test.mock.method(Date, "now", () => recordDate + 61 * 24 * 60 * 60 * 1000);
  try {
    await login();
    const expiredList = await authed(`${origin}/api/v1/attendance/records`).then((res) => res.json());
    assert.equal(expiredList.data.some((record) => record.id === valid.id), false);
    assert.equal(expiredList.data.some((record) => record.id === approved.id), false);
  } finally {
    setTime.mock.restore();
  }
});

test("project APIs expose demo and runtime projects", async () => {
  const inventory = await authed(`${origin}/api/v1/projects`).then((res) => res.json());
  assert.equal(inventory.total, 2);
  assert.equal(inventory.data[0].id, "p1");
  assert.equal(inventory.data[0].name, "[Mẫu] Nội thất");

  const detail = await authed(`${origin}/api/v1/projects/p1`).then((res) => res.json());
  assert.equal(detail.schedule.length, 5);
  assert.equal(detail.inventory.length, 3);

  const dashboard = await authed(`${origin}/api/v1/dashboard/projects`).then((res) => res.json());
  assert.equal(dashboard.data.length, 2);
  assert.equal(dashboard.data[0].name, "[Mẫu] Nội thất");

  const body = await authed(`${origin}/api/v1/projects/p2`).then((res) => res.json());
  assert.equal(body.name, "THI CÔNG NHÀ ANH KHÁNH 70M2 - LẠC LONG QUÂN");
});

test("unknown project returns 404", async () => {
  const response = await authed(`${origin}/api/v1/projects/missing`);
  assert.equal(response.status, 404);
});

test("new project starts without sample classification or progress data", async () => {
  const response = await authed(`${origin}/api/v1/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: `Blank project ${Date.now()}` })
  });
  assert.equal(response.status, 201);
  const project = await response.json();
  assert.equal(project.progress, 0);
  assert.equal(project.type, "");
  assert.equal(project.buildingType, "");
  assert.equal(project.group, "");
  assert.equal(project.status, "");
  assert.equal(project.health, "");
  assert.equal(project.description, "");

  const config = await authed(`${origin}/api/v1/attendance/config`).then((res) => res.json());
  const site = config.sites.find((item) => item.projectId === project.id);
  assert.ok(site);
  assert.equal(site.latitude, undefined);
  assert.equal(site.longitude, undefined);

  const latitude = 21.052701;
  const longitude = 105.789981;
  const checkIn = await authed(`${origin}/api/v1/attendance/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ employeeId: "NS001", siteId: site.id, latitude, longitude, accuracy: 20, hasFacePhoto: true })
  }).then((res) => res.json());
  assert.equal(checkIn.status, "Cần duyệt");
  assert.equal(checkIn.distanceMeters, null);
  assert.equal(checkIn.geofenceRadiusMeters, null);
  assert.equal(checkIn.insideGeofence, false);
  assert.equal(checkIn.gpsStatus, "Không đạt");
  assert.equal(checkIn.gpsNote, "Điểm chấm công chưa có phạm vi GPS");

  const nextConfig = await authed(`${origin}/api/v1/attendance/config`).then((res) => res.json());
  const savedSite = nextConfig.sites.find((item) => item.projectId === project.id);
  assert.equal(savedSite.latitude, undefined);
  assert.equal(savedSite.longitude, undefined);

  const deleted = await authed(`${origin}/api/v1/projects/${project.id}`, { method: "DELETE" });
  assert.equal(deleted.status, 200);
});

test("created, updated and deleted projects stay in sync across project APIs", async () => {
  const name = `Dự án mới ${Date.now()}`;
  const createInput = {
    name,
    code: "DA-NEW",
    owner: "CDT Test",
    location: "Ha Noi",
    type: "Noi that",
    buildingType: "Can ho",
    group: "Thi cong",
    status: "Ke hoach",
    health: "Binh thuong",
    manager: "DINH Cong Hoang",
    commander: "Ho Quang Chien",
    qs: "Nguyen Hoang Hai",
    accountant: "Y",
    startDate: "01/07/2026",
    endDate: "30/07/2026",
    duration: "30 ngay"
  };
  const response = await authed(`${origin}/api/v1/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(createInput)
  });
  assert.equal(response.status, 201);
  const project = await response.json();
  assert.equal(project.owner, createInput.owner);
  assert.equal(project.location, createInput.location);
  assert.equal(project.buildingType, createInput.buildingType);
  assert.equal(project.commander, createInput.commander);
  assert.equal(project.qs, createInput.qs);
  assert.equal(project.accountant, createInput.accountant);
  assert.equal(project.startDate, createInput.startDate);
  assert.equal(project.endDate, createInput.endDate);
  assert.equal(project.duration, createInput.duration);

  const patch = await authed(`${origin}/api/v1/projects/${project.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Updated project name" })
  });
  assert.equal(patch.status, 200);

  const inventory = await authed(`${origin}/api/v1/projects`).then((res) => res.json());
  assert.equal(inventory.data.find((item) => item.id === project.id).name, "Updated project name");

  const dashboard = await authed(`${origin}/api/v1/dashboard/projects`).then((res) => res.json());
  assert.equal(dashboard.data.find((item) => item.id === project.id).name, "Updated project name");

  const detail = await authed(`${origin}/api/v1/projects/${project.id}`).then((res) => res.json());
  assert.equal(detail.name, "Updated project name");

  const deleted = await authed(`${origin}/api/v1/projects/${project.id}`, { method: "DELETE" });
  assert.equal(deleted.status, 200);

  const afterDeleteInventory = await authed(`${origin}/api/v1/projects`).then((res) => res.json());
  assert.equal(afterDeleteInventory.data.some((item) => item.id === project.id), false);

  const afterDeleteDashboard = await authed(`${origin}/api/v1/dashboard/projects`).then((res) => res.json());
  assert.equal(afterDeleteDashboard.data.some((item) => item.id === project.id), false);

  const afterDeleteDetail = await authed(`${origin}/api/v1/projects/${project.id}`);
  assert.equal(afterDeleteDetail.status, 404);
});

test("project group chat stores shared messages", async () => {
  const text = `Tin nhắn chung ${Date.now()}`;
  const created = await authed(`${origin}/api/v1/projects/p1/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text })
  });
  assert.equal(created.status, 201);
  const message = await created.json();
  assert.equal(message.projectId, "p1");
  assert.equal(message.text, text);
  assert.ok(message.author);

  const list = await authed(`${origin}/api/v1/projects/p1/chat`).then((res) => res.json());
  assert.ok(list.data.some((item) => item.id === message.id && item.text === text));

  const uploaded = await authed(`${origin}/api/v1/projects/p1/chat/files?name=chat-photo.jpg`, {
    method: "POST",
    body: Buffer.from("chat-image")
  });
  assert.equal(uploaded.status, 201);
  const fileMessage = await uploaded.json();
  assert.equal(fileMessage.projectId, "p1");
  assert.equal(fileMessage.attachments.length, 1);
  assert.equal(fileMessage.attachments[0].category, "image");
  assert.ok(fileMessage.attachments[0].expiresAt);

  const opened = await authed(`${origin}${fileMessage.attachments[0].url}`);
  assert.equal(opened.status, 200);
  assert.match(opened.headers.get("content-type"), /image\/jpeg/);

  const revoked = await authed(`${origin}/api/v1/projects/p1/chat/${message.id}`, { method: "DELETE" }).then((res) => res.json());
  assert.ok(revoked.data.revokedAt);
  assert.equal(revoked.data.text, "");

  const empty = await authed(`${origin}/api/v1/projects/p1/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: "   " })
  });
  assert.equal(empty.status, 400);
});

test("team chat stores dashboard messages", async () => {
  const text = `Chat dashboard ${Date.now()}`;
  const created = await authed(`${origin}/api/v1/team-chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text })
  });
  assert.equal(created.status, 201);
  const message = await created.json();
  assert.equal(message.channel, "dashboard");
  assert.equal(message.source, "member");
  assert.equal(message.text, text);
  assert.ok(message.author);

  const list = await authed(`${origin}/api/v1/team-chat`).then((res) => res.json());
  assert.ok(list.data.some((item) => item.id === message.id && item.text === text));

  const empty = await authed(`${origin}/api/v1/team-chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: "   " })
  });
  assert.equal(empty.status, 400);
});

test("3D design files support proposal, concept and final marker", async () => {
  const projectId = `design-${Date.now()}`;
  const proposal = await authed(`${origin}/api/v1/projects/${projectId}/design-3d-files?kind=proposal&name=proposal.jpg`, {
    method: "POST",
    body: Buffer.from("proposal")
  }).then((res) => res.json());
  assert.equal(proposal.kind, "proposal");

  const concept = await authed(`${origin}/api/v1/projects/${projectId}/design-3d-files?kind=concept&name=concept-a.jpg`, {
    method: "POST",
    body: Buffer.from("concept")
  }).then((res) => res.json());
  assert.equal(concept.kind, "concept");

  const marked = await authed(`${origin}/api/v1/projects/${projectId}/design-3d-files/final`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storedName: concept.storedName })
  }).then((res) => res.json());
  assert.equal(marked.data.find((file) => file.storedName === concept.storedName).final, true);
});

test("landing page and project detail clients expose expected workflows", async () => {
  const appScript = await fetch(`${origin}/app.js`).then((res) => res.text());
  assert.match(appScript, /dashboardMyTasksPanel/);
  assert.match(appScript, /dashboardVoucherCards/);
  assert.match(appScript, /dashboardQuickAccessPanel/);
  assert.match(appScript, /dashboard-quick-access-columns/);
  assert.match(appScript, /dashboardVoucherFormModal/);
  assert.match(appScript, /handleGlobalVoucherClose/);
  assert.match(appScript, /document\.body\.addEventListener\("click", handleGlobalVoucherClose, true\)/);
  assert.match(appScript, /data-dashboard-voucher-form/);
  assert.match(appScript, /id: "attendance"/);
  assert.match(appScript, /Phiếu nhiệm vụ/);
  assert.match(appScript, /dashboardVoucherFullCdtChange/);
  assert.match(appScript, /Hạng mục thi công và phạm vi/);
  assert.match(appScript, /dashboardVoucherApprovalFlow/);
  assert.match(appScript, /orgPeoplePool/);
  assert.match(appScript, /data-drop-position/);
  assert.match(appScript, /account-position-table/);
  assert.match(appScript, /data-catalog-group-drop/);
  assert.match(appScript, /assignCatalogItemToGroup/);
  assert.match(appScript, /catalog-category-group-drag-over/);
  assert.match(appScript, /positionCode/);
  assert.match(appScript, /Hành động xử lý/);
  assert.doesNotMatch(appScript, /Thêm phiếu nhật ký thi công/);
  assert.match(appScript, /dashboardTeamChatPanel/);
  assert.match(appScript, /team-chat-form/);
  assert.match(appScript, /\/team-chat/);
  assert.match(appScript, /data-voucher-toggle/);
  assert.match(appScript, /data-voucher-approve/);
  assert.match(appScript, /data-my-task-view="week"/);
  assert.match(appScript, /data-project-view/);
  assert.match(appScript, /data-action="create-project"/);
  assert.match(appScript, /Khởi tạo từ dự án mẫu/);
  assert.match(appScript, /Mẫu Kiến trúc Nội thất/);
  assert.match(appScript, /attendanceEvidenceDetail/);
  assert.match(appScript, /Danh sách chấm công/);
  assert.match(appScript, /2 tháng/);
  assert.match(appScript, /attendanceRecordListTable/);
  assert.match(appScript, /evidence-map-frame/);
  assert.match(appScript, /attendanceDeviceLabel/);
  assert.match(appScript, /gpsInfo,\s*record/);
  assert.match(appScript, /attendanceApprovedRecordsByStaffDay/);
  assert.match(appScript, /record\.status !== "Hợp lệ"/);
  assert.match(appScript, /attendanceMonthlyRows\(runtime\.data\)/);
  assert.match(appScript, /Check-in/);
  assert.match(appScript, /Check-out/);
  assert.match(appScript, /Tổng công/);
  assert.match(appScript, /ATTENDANCE_PUBLIC_HOLIDAYS_BY_YEAR/);
  assert.match(appScript, /Gợi ý ngày lễ Việt Nam/);
  assert.match(appScript, /attendanceEditHoliday/);

  const dashboardHtml = await fetch(`${origin}/`).then((res) => res.text());
  assert.match(dashboardHtml, /styles\.css\?v=67/);
  assert.match(dashboardHtml, /app\.js\?v=91/);

  const html = await fetch(`${origin}/constructions/detail/p1/`).then((res) => res.text());
  assert.match(html, /project-app/);
  assert.match(html, /construction-overrides\.css\?v=223/);
  assert.match(html, /construction\.js\?v=257/);

  const attendanceHtml = await fetch(`${origin}/attendance/`).then((res) => res.text());
  assert.match(attendanceHtml, /mobile\.js\?v=12/);

  const attendanceScript = await fetch(`${origin}/attendance/mobile.js`).then((res) => res.text());
  assert.match(attendanceScript, /startAutoCamera/);
  assert.match(attendanceScript, /pendingSubmitType/);
  assert.match(attendanceScript, /openCameraCapture\("submit"\)/);

  const script = await fetch(`${origin}/construction.js`).then((res) => res.text());
  assert.match(script, /data-project-info-delete/);
  assert.match(script, /Dòng tiền dự án/);
  assert.match(script, /Truy cập nhanh/);
  assert.doesNotMatch(script, /Thêm phiếu nhật ký thi công/);
  assert.doesNotMatch(script, /data-form="diary"/);
  assert.match(script, /Theo dõi chi phí dự án/);
  assert.match(script, /Vật liệu nhập vượt/);
  assert.match(script, /Nhân công cần dùng trong 7 ngày tới/);
  assert.match(script, /data-project-voucher="overtime"/);
  assert.match(script, /data-project-voucher="leave"/);
  assert.match(script, /data-project-voucher="slip-in"/);
  assert.match(script, /data-project-voucher="slip-out"/);
  assert.match(script, /data-project-voucher="expense"/);
  assert.match(script, /openProjectVoucherForm/);
  assert.match(script, /project-voucher-modal/);
  assert.doesNotMatch(script, /data-form=/);
  assert.doesNotMatch(script, /showCashModal/);
  assert.match(script, /data-view-link="rfi"/);
  assert.match(script, /showView\(view\)/);
  assert.match(script, /ganttView/);
  assert.match(script, /taskFormModal/);
  assert.match(script, /diaryResourceDetail/);
  assert.doesNotMatch(script, /data-contract-group|data-contract-variation-group|data-vendor-contract-group|contractQuoteSidebar/);
  assert.match(script, /contractMaterialSectionOptions\(\)/);
  assert.doesNotMatch(script, /contractDropZone\("design-contract","Hợp đồng thiết kế","PDF, Word hoặc Excel",contractDesignTypeOptions\(\)\)/);
  assert.doesNotMatch(script, /function contractVariationFiles\(\)\{const types=contractConstructionTypeOptions\(\)/);
  assert.match(script, /contractSubcontractTypeOptions\(\)/);
  assert.match(script, /contractApprovedDossierBox/);
  assert.match(script, /data-approved-dossier-types="\$\{apiTypes\}"/);
  assert.match(script, /data-project-doc-status/);
  assert.match(script, /projectDocStoreInstallDropGuard/);
  assert.match(script, /projectDocStoreDropFiles/);
  assert.match(script, /stopPropagation\(\)/);
  assert.match(script, /response\.ok/);
  assert.match(script, /function fileDownloadUrl\(url\)/);
  assert.match(script, /fileDownloadUrl\(url\)/);
  assert.match(script, /data-dossier-signed-action="approve">Ký duyệt/);
  assert.match(script, /dataset\.dossierSignedAction==="approve"/);
  assert.match(script, /Hồ sơ bản vẽ hợp đồng thiết kế/);
  assert.match(script, /Hồ sơ bản vẽ hợp đồng thi công/);
  assert.doesNotMatch(script, /contractDropZone\("drawing"/);
  assert.match(script, /setDossierSignedApproved/);
  assert.match(script, /async function contractVendorView\(\)\{\s*await loadProjectCatalog\(\)/);
  assert.match(script, /data-contract-export-word/);
  assert.match(script, /data-contract-export-pdf/);
  assert.match(script, /contractDesignExportDocument/);
  assert.match(script, /contract-pdf-preview/);
  assert.match(script, /contract-preview-sheet/);
  assert.match(script, /contractRenderPdfPreview/);
  assert.match(script, /contractDesignDocumentHtml\(data\)/);
  assert.match(script, /contractConstructionDocumentHtml\(data\)/);
  assert.match(script, /contractApplyVat/);
  assert.match(script, /data-contract-field="vatMode"/);
  assert.match(script, /Có VAT/);
  assert.match(script, /Giá trị HĐTC trước VAT/);
  assert.match(script, /data-contract-vat-summary/);
  assert.match(script, /data-contract-field="bankAccount"/);
  assert.match(script, /contractBankHtml/);
  assert.match(script, /contractDesignContractNumber\(files=contractFilesCache\)\{const token=contractCodeDateToken\(\);return `\$\{token\}\/HĐTK\/\$\{contractProjectCode\(\)\}`/);
  assert.match(script, /contractConstructionContractNumber\(files=contractFilesCache\)\{const token=contractCodeDateToken\(\);return `\$\{token\}\/HĐTC\/\$\{contractProjectCode\(\)\}`/);
  assert.doesNotMatch(script, /return `\$\{token\}\/HĐT[KC]\/LEDOME_/);
  assert.doesNotMatch(script, /contractDesignContractNumber\(files=contractFilesCache\)\{const year=new Date\(\)\.getFullYear\(\)/);
  assert.doesNotMatch(script, /contractConstructionContractNumber\(files=contractFilesCache\)\{const year=new Date\(\)\.getFullYear\(\)/);
  assert.doesNotMatch(script, /contractDesignContractNumber[\s\S]{0,220}String\(next\)\.padStart/);
  assert.doesNotMatch(script, /contractConstructionContractNumber[\s\S]{0,220}String\(next\)\.padStart/);
  assert.match(script, /contractLooksLikeOldYearToken/);
  assert.match(script, /\^202\\d\$/);
  assert.match(script, /contractCodeDateTokenForValue\(file\?\.updatedAt \|\| file\?\.createdAt \|\| file\?\.date\)/);
  assert.match(script, /contractNormalizeLinkedContractNo/);
  assert.match(script, /contractNormalizeEstimateNo/);
  assert.match(script, /contractCreateButton\("quote"/);
  assert.match(script, /contractVariationFiles/);
  assert.match(script, /contractVariationQuoteFiles/);
  assert.match(script, /contractVariationQuoteManager/);
  assert.match(script, /data-contract-kind-list="variation"/);
  assert.match(script, /data-contract-kind-list="variation-confirm"/);
  assert.match(script, /data-contract-kind-list="variation-quote"/);
  assert.match(script, /function contractQuoteManager\(\)\{return `<section class="contract-quotes">\$\{contractQuoteTable\(\)\}<\/section>`\}/);
  assert.match(script, /function contractVariationQuoteManager\(\)\{return `<section class="contract-quotes contract-variation-quotes">\$\{contractVariationQuoteTable\(\)\}<\/section>`\}/);
  assert.match(script, /return `<section class="contract-quotes">\$\{contractQuoteTableVendor\(\)\}<\/section>`/);
  assert.match(script, /contract-variation-block/);
  assert.match(script, /contract-variation-quotes/);
  assert.match(script, /data-contract-extra-create/);
  assert.match(script, /variation-quote/);
  assert.match(script, /BAO_GIA_PHAT_SINH/);
  assert.match(script, /rfi-variation-page variation-tone/);
  assert.match(script, /contractEstimateTitle\(type="quote"\)/);
  assert.match(script, /contractEstimateGroupDefinitions/);
  assert.match(script, /Báo giá Hạng mục thi công/);
  assert.match(script, /Báo Giá Hạng mục Thiết bị vật tư/);
  assert.match(script, /contractEstimateSidebarSections/);
  assert.match(script, /data-estimate-group-summary="construction"/);
  assert.match(script, /data-estimate-group-summary="material"/);
  assert.match(script, /contractEstimateEnsureCatalogRows/);
  assert.match(script, /contractEstimateGroupIdForItemName/);
  assert.match(script, /contractEstimateGroupIdForDraftRow/);
  assert.match(script, /contractMaterialEstimateGroups/);
  assert.match(script, /contractEstimateLabels/);
  assert.match(script, /taskHead:material\?"Tên":"Nhiệm vụ"/);
  assert.match(script, /descriptionHead:material\?"Thương hiệu \/ NCC":"Mô tả"/);
  assert.match(script, /addTask:material\?"\+":"\+ Nhiệm vụ"/);
  assert.match(script, /materialCategoryGroups/);
  assert.match(script, /contractNormalizeCategoryGroups/);
  assert.match(script, /contractNormalizeConstructionCategoryGroups/);
  assert.match(script, /loadProjectCatalog\(true\)/);
  assert.match(script, /Nhóm 1: Phần thô/);
  assert.match(script, /Nhóm 5: Hoàn thiện/);
  assert.match(script, /data-estimate-group/);
  assert.match(script, /data-estimate-task/);
  assert.match(script, /data-estimate-description/);
  assert.match(script, /data-estimate-location/);
  assert.match(script, /data-estimate-image-drop/);
  assert.match(script, /data-estimate-preview/);
  assert.match(script, /data-estimate-export-excel/);
  assert.match(script, /data-estimate-export-pdf/);
  assert.match(script, /data-estimate-undo/);
  assert.match(script, /data-estimate-redo/);
  assert.match(script, /contractEstimateHistoryUndo/);
  assert.match(script, /contractEstimateHistoryRedo/);
  assert.match(script, /data-estimate-duplicate/);
  assert.match(script, /data-estimate-drag/);
  assert.match(script, /data-estimate-add-task/);
  assert.match(script, /contractLoadDraftTemplates/);
  assert.match(script, /data-contract-draft-template/);
  assert.match(script, /data-contract-draft-template-import/);
  assert.match(script, /contractEstimateNormalizeTaskRows/);
  assert.match(script, /data-estimate-resize/);
  assert.match(script, /ledome\.contractEstimateColumnWidths/);
  assert.match(script, /contractAutosizeEstimateTextareas/);
  assert.match(script, /data-estimate-prev/);
  assert.match(script, /data-estimate-next/);
  assert.match(script, /data-estimate-group-summary/);
  assert.match(script, /STT","Nhóm","Hạng mục","Nhiệm vụ","Mô tả","Vị trí","Hình ảnh"/);
  assert.match(script, /contractEstimateUnitOptions=\["gói","m2","md","cái","bộ","vị trí"\]/);
  assert.match(script, /formType==="quote"\|\|formType==="variation-quote"/);
  assert.match(script, /type==="variation-quote"\?"BAO_GIA_PHAT_SINH":"BAO_GIA"/);
  assert.match(script, /type==="variation-quote"\?"variation-quote":"quote"/);
  assert.match(script, /BAO_GIA/);
  assert.match(script, /<title><\/title>/);
  assert.match(script, /@page\{size:A4;margin:0\}/);
  assert.match(script, /history\.replaceState\(null,"",/);
  assert.match(script, /Lưu PDF \/ In hợp đồng/);
});
