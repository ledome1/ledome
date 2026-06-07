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
    "overtimeVoucherTypes",
    "paymentVoucherTypes",
    "attendanceVoucherTypes",
    "inventoryReceiptTypes",
    "warehouseList",
    "cdtChangeRequestTypes",
    "cdtNoteRequestTypes",
    "cdtApprovalRequestTypes",
    "incidentIssueTypes"
  ].forEach((key) => assert.ok(Array.isArray(catalog.data[key]), `${key} should be a catalog list`));

  const marker = `TEST-${Date.now()}`;
  const overtimeMarker = `OT-${Date.now()}`;
  const data = {
    ...catalog.data,
    projectList: [marker, ...catalog.data.projectList],
    overtimeVoucherTypes: [overtimeMarker, ...catalog.data.overtimeVoucherTypes]
  };
  const saved = await authed(`${origin}/api/v1/catalog`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data })
  }).then((res) => res.json());
  assert.equal(saved.data.projectList[0], marker);
  assert.equal(saved.data.overtimeVoucherTypes[0], overtimeMarker);

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

  const approved = await authed(`${origin}/api/v1/attendance/records/${outside.id}/approve`, { method: "POST" }).then((res) => res.json());
  assert.equal(approved.status, "Hợp lệ");
  assert.equal(approved.gpsStatus, "Không đạt");
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
  assert.match(appScript, /data-my-task-view="week"/);
  assert.match(appScript, /data-project-view/);
  assert.match(appScript, /data-action="create-project"/);
  assert.match(appScript, /Khởi tạo từ dự án mẫu/);
  assert.match(appScript, /Mẫu Kiến trúc Nội thất/);

  const html = await fetch(`${origin}/constructions/detail/p1/`).then((res) => res.text());
  assert.match(html, /project-app/);

  const script = await fetch(`${origin}/construction.js`).then((res) => res.text());
  assert.match(script, /data-project-info-delete/);
  assert.match(script, /Dòng tiền dự án/);
  assert.match(script, /Truy cập nhanh/);
  assert.match(script, /Theo dõi chi phí dự án/);
  assert.match(script, /Vật liệu nhập vượt/);
  assert.match(script, /Nhân công cần dùng trong 7 ngày tới/);
  assert.match(script, /data-view-link="debt-owner"/);
  assert.match(script, /showView\(view\)/);
  assert.match(script, /ganttView/);
  assert.match(script, /taskFormModal/);
  assert.match(script, /diaryResourceDetail/);
  assert.match(script, /Lập phiếu thu/);
  assert.match(script, /Lập phiếu chi/);
});
