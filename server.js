const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const { URL } = require("node:url");
const { dashboard, dashboardProjects, insight, projects, projectDetail, navigation } = require("./src/demo-data");

const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";
const positiveNumber = (value, fallback) => {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
};
const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, "data"));
const backupsDir = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, "backups"));
const dataPath = (...segments) => path.join(dataDir, ...segments);
const runtimeDataFile = dataPath("runtime-projects.json");
const runtimeProjectUpdatesFile = dataPath("runtime-project-updates.json");
const runtimeDeletedProjectsFile = dataPath("runtime-deleted-projects.json");
const attendanceDataFile = dataPath("runtime-attendance.json");
const contractFilesDir = dataPath("contract-files");
const vendorContractFilesDir = dataPath("vendor-contract-files");
const supplierInvoiceFilesDir = dataPath("supplier-invoice-files");
const existingFilesDir = dataPath("existing-files");
const design3dFilesDir = dataPath("design-3d-files");
const design3dMetaFile = dataPath("runtime-design-3d-meta.json");
const technicalFilesDir = dataPath("technical-files");
const technicalMetaFile = dataPath("runtime-technical-meta.json");
const accountsFile = dataPath("runtime-accounts.json");
const diaryReportsFile = dataPath("runtime-diary-reports.json");
const partnersFile = dataPath("runtime-partners.json");
const catalogFile = dataPath("runtime-catalog.json");
const financeFile = dataPath("runtime-finance.json");
const personalFinanceFile = dataPath("runtime-personal-finance.json");
const driveFile = dataPath("runtime-drive.json");
const driveFilesDir = dataPath("drive-files");
const orgStaffFile = dataPath("runtime-org-staff.json");
const sessionCookie = "ledome_session";
const sessions = new Map();
let testAccounts = null;
let testStores = {};
let testBackups = [];
const uploadMaxBytes = positiveNumber(process.env.UPLOAD_MAX_BYTES, 25 * 1024 * 1024);
const sessionTtlMs = positiveNumber(process.env.SESSION_TTL_HOURS, 12) * 60 * 60 * 1000;
const driveRetentionMs = positiveNumber(process.env.DRIVE_RETENTION_DAYS, 7) * 24 * 60 * 60 * 1000;
const allowedUploadExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".ppt", ".pptx", ".txt", ".md", ".note", ".dwg", ".zip"]);

// New Dossier configurations for stages
const dossierConfigs = {
  "technical": {
    dir: dataPath("technical-files"),
    metaFile: dataPath("runtime-technical-meta.json")
  },
  "design-construction": {
    dir: dataPath("design-construction-files"),
    metaFile: dataPath("runtime-design-construction-meta.json")
  },
  "technical-construction": {
    dir: dataPath("technical-construction-files"),
    metaFile: dataPath("runtime-technical-construction-meta.json")
  },
  "owner-request": {
    dir: dataPath("owner-request-files"),
    metaFile: dataPath("runtime-owner-request-meta.json")
  },
  "other": {
    dir: dataPath("other-files"),
    metaFile: dataPath("runtime-other-meta.json")
  }
};

const attendanceSites = [
  { id: "green-city", name: "Green City - Cổng A", latitude: 21.028511, longitude: 105.804817, radiusMeters: 250 },
  { id: "ledome-office", name: "Văn phòng Le Dome", latitude: 21.022739, longitude: 105.819454, radiusMeters: 180 },
  { id: "riverside-me", name: "Riverside - Khu M&E", latitude: 21.037376, longitude: 105.788135, radiusMeters: 220 }
];
const attendanceEmployees = [
  { id: "NV001", name: "Nguyễn Minh Anh" },
  { id: "NV002", name: "Trần Thanh Hà" },
  { id: "NV003", name: "Lê Hoàng Nam" },
  { id: "NV004", name: "Phạm Thu Trang" },
  { id: "NV005", name: "Vũ Quốc Bảo" },
  { id: "NV006", name: "Đỗ Mạnh Hùng" }
];

const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",

  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".note": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json"
};

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function readJsonFile(file, fallback) {
  if (process.env.NODE_ENV === "test") return structuredClone(Object.hasOwn(testStores, file) ? testStores[file] : fallback);
  if (!fs.existsSync(file)) return structuredClone(fallback);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return structuredClone(fallback);
  }
}

function writeJsonAtomic(file, data) {
  if (process.env.NODE_ENV === "test") {
    testStores[file] = structuredClone(data);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function copyDirSync(source, target) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const src = path.join(source, entry.name);
    const dst = path.join(target, entry.name);
    if (entry.isDirectory()) copyDirSync(src, dst);
    else if (entry.isFile()) fs.copyFileSync(src, dst);
  }
}

function backupDataNow() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  if (process.env.NODE_ENV === "test") {
    const item = { id: stamp, path: path.join(backupsDir, stamp), createdAt: new Date().toISOString() };
    testBackups.unshift(item);
    return item;
  }
  const target = path.join(backupsDir, stamp);
  copyDirSync(dataDir, path.join(target, "data"));
  return { id: stamp, path: target, createdAt: new Date().toISOString() };
}

function listBackups() {
  if (process.env.NODE_ENV === "test") return testBackups;
  if (!fs.existsSync(backupsDir)) return [];
  return fs.readdirSync(backupsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ id: entry.name, path: path.join(backupsDir, entry.name) }))
    .sort((a, b) => b.id.localeCompare(a.id));
}

function setSessionCookie(res, token) {
  const secure = isProduction ? "; Secure" : "";
  const maxAge = token ? `; Max-Age=${Math.floor(sessionTtlMs / 1000)}` : "; Max-Age=0";
  const value = token
    ? `${sessionCookie}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}${maxAge}`
    : `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax${secure}${maxAge}`;
  const existing = res.getHeader?.("set-cookie");
  res.setHeader("set-cookie", existing ? [existing, value].flat() : value);
}

function createSession(account) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  sessions.set(token, {
    staffCode: account.staffCode,
    loginId: account.loginId,
    createdAt: now,
    expiresAt: now + sessionTtlMs
  });
  return token;
}

function deleteExpiredSessions(now = Date.now()) {
  for (const [token, session] of sessions.entries()) {
    if (!session.expiresAt || session.expiresAt <= now) sessions.delete(token);
  }
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map((part) => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function accountLoginId(name, used = new Set()) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const raw = `${parts.at(-1) || "User"}${parts[0] || ""}`;
  const base = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^\w]/g, "");
  let id = base || `user${used.size + 1}`;
  let count = 2;
  while (used.has(id.toLowerCase())) id = `${base}${count++}`;
  used.add(id.toLowerCase());
  return id;
}

const orgStaffSeed = [
  ["NS001","DINH Công Hoàng","Giám đốc","Ban lãnh đạo"],
  ["NS002","Bùi Xuân Dũng","Phó giám đốc","Ban lãnh đạo"],
  ["NS003","Bùi Xuân Dũng","Trưởng phòng thiết kế","Phòng thiết kế"],
  ["NS004","Nguyễn Hoàng Hải","Kiến trúc sư","Phòng thiết kế"],
  ["NS005","Bùi Vũ Kiên","Kiến trúc sư","Phòng thiết kế"],
  ["NS006","DINH Công Hoàng","Trưởng phòng thi công","Phòng thi công"],
  ["NS007","Hồ Quang Chiến","Giám sát thi công","Phòng thi công"],
  ["NS008","Hoàng Thu Mai","Hành chính","Khối văn phòng"],
  ["NS009","Trần Văn Đức","Kế toán","Khối văn phòng"],
  ["NS010","Nguyễn Tuấn Anh","Nhân sự","Khối văn phòng"],
  ["NS011","Nguyễn Hà Vân","Marketing & Sale","Khối kinh doanh"]
];

function personKey(name) {
  return String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^\w]/g, "").toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const passwordHash = crypto.pbkdf2Sync(String(password || ""), salt, 120000, 32, "sha256").toString("hex");
  return { passwordSalt: salt, passwordHash };
}

function verifyPassword(account, password) {
  if (account.passwordHash && account.passwordSalt) {
    const next = hashPassword(password, account.passwordSalt).passwordHash;
    return crypto.timingSafeEqual(Buffer.from(next, "hex"), Buffer.from(account.passwordHash, "hex"));
  }
  return String(account.password || "").trim() === String(password || "").trim();
}

const ACCOUNT_PERMISSION_KEYS = [
  "projects.view",
  "projects.edit",
  "projects.upload",
  "projects.download",
  "projects.delete",
  "partners.view",
  "partners.edit",
  "partners.delete",
  "hrm.view",
  "hrm.edit",
  "hrm.approve",
  "finance.view",
  "finance.edit",
  "finance.delete",
  "config.accounts",
  "private",
  "personalFinance.view",
  "personalFinance.edit"
];

const ACCOUNT_ACCESS_LEVELS = {
  admin: {
    rank: 1,
    label: "Admin",
    scope: "Toàn hệ thống",
    permissions: ACCOUNT_PERMISSION_KEYS
  },
  leadership: {
    rank: 2,
    label: "Lãnh đạo",
    scope: "Toàn hệ thống trừ Cấu hình",
    permissions: ACCOUNT_PERMISSION_KEYS.filter((key) => !key.startsWith("config.") && !key.startsWith("personalFinance."))
  },
  manager: {
    rank: 3,
    label: "Trưởng phòng",
    scope: "Theo phòng ban / dự án phụ trách",
    permissions: ["projects.view", "projects.edit", "projects.upload", "projects.download", "partners.view", "partners.edit", "hrm.view"]
  },
  staff: {
    rank: 4,
    label: "Nhân viên",
    scope: "Theo công việc được giao",
    permissions: ["projects.view", "projects.edit", "projects.upload", "projects.download", "partners.view"]
  },
  guest: {
    rank: 5,
    label: "Guest",
    scope: "Chỉ xem giới hạn",
    permissions: ["projects.view", "partners.view"]
  }
};

const LEGACY_MODULE_ACTIONS = {
  projects: ["view", "edit", "upload", "download"],
  partners: ["view", "edit"],
  hrm: ["view", "edit", "approve"],
  finance: ["view", "edit", "delete"],
  personalFinance: ["view", "edit"]
};

function knownAccessLevel(level) {
  return Object.hasOwn(ACCOUNT_ACCESS_LEVELS, String(level || ""));
}

function accountSearchText(account) {
  const parts = [
    account.staffName,
    account.role,
    account.department,
    account.title,
    ...(account.roles || []),
    ...(account.departments || []),
    ...(account.positions || [])
  ];
  return parts.join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function inferAccessLevel(account = {}) {
  const loginId = String(account.loginId || "").trim().toLowerCase();
  const text = accountSearchText(account);
  if (loginId === "hoangdinh" || account.staffCode === "NS001" || account.permissions?.personalFinance) return "admin";
  if (loginId === "dungbui" || text.includes("ban lanh") || text.includes("pho giam")) return "leadership";
  if (text.includes("truong phong")) return "manager";
  return "staff";
}

function hasPermission(account, permission) {
  if (!permission) return true;
  const permissions = account?.permissions || {};
  if (permissions[permission]) return true;
  const [module] = permission.split(".");
  return Boolean(permissions[module]);
}

function expandPermissions(permissions = {}) {
  const source = permissions && typeof permissions === "object" ? permissions : {};
  const next = {};
  ACCOUNT_PERMISSION_KEYS.forEach((key) => { next[key] = Boolean(source[key]); });
  Object.entries(LEGACY_MODULE_ACTIONS).forEach(([module, actions]) => {
    if (source[module]) actions.forEach((action) => { next[`${module}.${action}`] = true; });
  });
  if (source.config) {
    next["config.accounts"] = true;
    next["projects.delete"] = true;
    next["partners.delete"] = true;
  }
  next.projects = ["view", "edit", "upload", "download", "delete"].some((action) => next[`projects.${action}`]);
  next.partners = ["view", "edit", "delete"].some((action) => next[`partners.${action}`]);
  next.hrm = ["view", "edit", "approve"].some((action) => next[`hrm.${action}`]);
  next.finance = ["view", "edit", "delete"].some((action) => next[`finance.${action}`]);
  next.config = Boolean(next["config.accounts"]);
  next.private = Boolean(next.private || source.private);
  next.personalFinance = ["view", "edit"].some((action) => next[`personalFinance.${action}`]);
  return next;
}

function permissionsForAccessLevel(accessLevel) {
  const config = ACCOUNT_ACCESS_LEVELS[knownAccessLevel(accessLevel) ? accessLevel : "staff"];
  const allowed = new Set(config.permissions);
  const permissions = {};
  ACCOUNT_PERMISSION_KEYS.forEach((key) => { permissions[key] = allowed.has(key); });
  return expandPermissions(permissions);
}

function normalizeAccountAccess(account = {}) {
  const accessLevel = knownAccessLevel(account.accessLevel) ? account.accessLevel : inferAccessLevel(account);
  return {
    accessLevel,
    accessScope: ACCOUNT_ACCESS_LEVELS[accessLevel].scope,
    permissions: permissionsForAccessLevel(accessLevel)
  };
}

function defaultAccountPermissions(person) {
  return permissionsForAccessLevel(inferAccessLevel(person));
}

function defaultAccounts() {
  const people = new Map();
  orgStaffSeed.forEach((staff) => {
    const key = personKey(staff[1]) || staff[0];
    const person = people.get(key) || { staffCode: staff[0], staffName: staff[1], roles: [], departments: [], positions: [] };
    person.roles.push(staff[2]);
    person.departments.push(staff[3]);
    person.positions.push(`${staff[2]} - ${staff[3]}`);
    people.set(key, person);
  });
  const used = new Set();
  return [...people.values()].map((person) => {
    const loginId = accountLoginId(person.staffName, used);
    const account = {
      staffCode: person.staffCode,
      staffName: person.staffName,
      role: person.roles[0],
      department: person.departments[0],
      title: person.departments.includes("Ban lãnh đạo") ? person.roles.find((role) => ["Giám đốc", "Phó giám đốc"].includes(role)) : "",
      positions: [...new Set(person.positions)],
      loginId,
      password: "1",
      active: true
    };
    Object.assign(account, normalizeAccountAccess(account));
    return account;
  });
}

function readAccounts() {
  const source = process.env.NODE_ENV === "test"
    ? (testAccounts || defaultAccounts())
    : fs.existsSync(accountsFile)
      ? readJsonFile(accountsFile, [])
      : defaultAccounts();
  const accounts = Array.isArray(source) && source.length ? source : defaultAccounts();
  let migrated = false;
  const secure = accounts.map((account) => {
    const normalized = normalizeAccountAccess(account);
    const next = { ...account, ...normalized };
    if (
      account.accessLevel !== next.accessLevel ||
      account.accessScope !== next.accessScope ||
      JSON.stringify(account.permissions || {}) !== JSON.stringify(next.permissions)
    ) {
      migrated = true;
    }
    if (!next.passwordHash || !next.passwordSalt) {
      Object.assign(next, hashPassword(next.password || "1"));
      delete next.password;
      migrated = true;
    }
    return next;
  });
  if (migrated) {
    writeAccounts(secure);
  }
  return secure;
}

function writeAccounts(accounts) {
  if (process.env.NODE_ENV === "test") {
    testAccounts = structuredClone(accounts);
    return;
  }
  writeJsonAtomic(accountsFile, accounts);
}

function publicAccount(account) {
  if (!account) return null;
  const { password, passwordHash, passwordSalt, ...safe } = account;
  return safe;
}

function currentUser(req) {
  const token = parseCookies(req)[sessionCookie];
  const session = token && sessions.get(token);
  if (session?.expiresAt && session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  if (!session) return null;
  const account = readAccounts().find((item) => item.active && item.staffCode === session.staffCode && item.loginId === session.loginId);
  return account || null;
}

function requireAccount(req, res, permission) {
  const account = currentUser(req);
  if (!account) {
    json(res, 401, { error: "Chưa đăng nhập" });
    return null;
  }
  if (permission && !hasPermission(account, permission)) {
    json(res, 403, { error: "Không có quyền truy cập" });
    return null;
  }
  return account;
}

function permissionForRequest(pathname, method = "GET") {
  if (pathname.includes("/attendance/records/") && pathname.endsWith("/approve")) return "hrm.approve";
  if (method === "DELETE" && /^\/api\/v1\/projects\/[^/]+$/.test(pathname)) return "projects.delete";
  if (pathname.includes("/upload") || pathname.includes("-files") || pathname.includes("/dossiers/")) {
    if (pathname.endsWith("/download")) return "projects.download";
    return "projects.upload";
  }
  if (pathname.includes("/projects/") || pathname === "/api/v1/projects") return method === "GET" ? "projects.view" : "projects.edit";
  return null;
}

function isPublicApi(pathname, method) {
  if (pathname === "/api/v1/health") return true;
  if (pathname === "/api/v1/auth/login" && method === "POST") return true;
  if (pathname === "/api/v1/auth/logout" && method === "POST") return true;
  if (pathname === "/api/v1/auth/me" && method === "GET") return true;
  return false;
}

function addProject(project) {
  projects.unshift(project);
  dashboardProjects.unshift({
    id: project.id,
    name: project.name,
    progress: project.progress,
    budget: project.budget,
    extraIncome: 0,
    extraCost: 0,
    numbers: Array(12).fill(0)
  });
  projectDetail[project.id] = project;
}

function loadRuntimeProjects() {
  if (process.env.NODE_ENV === "test" || !fs.existsSync(runtimeDataFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(runtimeDataFile, "utf8"));
  } catch {
    return [];
  }
}

function persistRuntimeProjects(projectsToPersist) {
  if (process.env.NODE_ENV === "test") return;
  writeJsonAtomic(runtimeDataFile, projectsToPersist);
}

// Persist updates
function loadRuntimeProjectUpdates() {
  if (process.env.NODE_ENV === "test" || !fs.existsSync(runtimeProjectUpdatesFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(runtimeProjectUpdatesFile, "utf8"));
  } catch {
    return {};
  }
}

function persistRuntimeProjectUpdates(updates) {
  if (process.env.NODE_ENV === "test") return;
  writeJsonAtomic(runtimeProjectUpdatesFile, updates);
}

function loadRuntimeDeletedProjects() {
  if (process.env.NODE_ENV === "test" || !fs.existsSync(runtimeDeletedProjectsFile)) return [];
  try {
    const value = JSON.parse(fs.readFileSync(runtimeDeletedProjectsFile, "utf8"));
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function persistRuntimeDeletedProjects(ids) {
  if (process.env.NODE_ENV === "test") return;
  writeJsonAtomic(runtimeDeletedProjectsFile, [...new Set(ids.map(String))]);
}

function updateProject(id, input) {
  const detail = projectDetail[id] || dashboardProjects.find((item) => item.id === id);
  if (!detail) return null;
  const allowed = ["name", "code", "type", "buildingType", "group", "owner", "client", "location", "manager", "commander", "qs", "accountant", "startDate", "endDate", "duration", "description", "projectStageMode", "projectStage"];
  const changes = {};
  allowed.forEach((key) => {
    if (Object.hasOwn(input, key)) changes[key] = String(input[key] ?? "").trim();
  });
  if (Object.hasOwn(changes, "name") && !changes.name) return null;
  Object.assign(detail, changes);
  const project = projects.find((item) => item.id === id);
  if (project && project !== detail) Object.assign(project, changes);
  const dashboardProject = dashboardProjects.find((item) => item.id === id);
  if (dashboardProject && dashboardProject !== detail) Object.assign(dashboardProject, changes);
  return changes;
}

function removeProjectFromMemory(id) {
  const projectId = String(id || "");
  let removed = false;
  const removeFrom = (list) => {
    let index = list.findIndex((item) => item.id === projectId);
    while (index >= 0) {
      list.splice(index, 1);
      removed = true;
      index = list.findIndex((item) => item.id === projectId);
    }
  };
  removeFrom(projects);
  removeFrom(dashboardProjects);
  if (projectDetail[projectId]) {
    delete projectDetail[projectId];
    removed = true;
  }
  return removed;
}

function deleteProject(id) {
  const projectId = String(id || "");
  const existing = projectDetail[projectId] || projects.find((item) => item.id === projectId) || dashboardProjects.find((item) => item.id === projectId);
  if (!existing) return null;
  removeProjectFromMemory(projectId);
  const runtimeIndex = runtimeProjects.findIndex((item) => item.id === projectId);
  if (runtimeIndex >= 0) {
    runtimeProjects.splice(runtimeIndex, 1);
    persistRuntimeProjects(runtimeProjects);
  }
  if (runtimeProjectUpdates[projectId]) {
    delete runtimeProjectUpdates[projectId];
    persistRuntimeProjectUpdates(runtimeProjectUpdates);
  }
  runtimeDeletedProjects.add(projectId);
  persistRuntimeDeletedProjects([...runtimeDeletedProjects]);
  return existing;
}

function activeProjectList(list) {
  return list.filter((project) => String(project.projectStage || "").trim() !== "final-settlement");
}

function loadAttendanceRecords() {
  if (process.env.NODE_ENV === "test" || !fs.existsSync(attendanceDataFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(attendanceDataFile, "utf8"));
  } catch {
    return [];
  }
}

function persistAttendanceRecords(records) {
  if (process.env.NODE_ENV === "test") return;
  writeJsonAtomic(attendanceDataFile, records);
}

function distanceMeters(from, to) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const earthRadius = 6371000;
  const latDistance = toRadians(to.latitude - from.latitude);
  const lonDistance = toRadians(to.longitude - from.longitude);
  const a = Math.sin(latDistance / 2) ** 2
    + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude))
    * Math.sin(lonDistance / 2) ** 2;
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function readJson(req, callback) {
  let raw = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => raw += chunk);
  req.on("end", () => {
    let parsed;
    try {
      parsed = JSON.parse(raw || "{}");
    } catch (error) {
      return callback(new Error("Invalid JSON body"));
    }
    return callback(null, parsed);
  });
}

function safeFileName(value) {
  return path.basename(String(value || "").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")).slice(0, 180);
}

function validateUploadName(name) {
  const ext = path.extname(name).toLowerCase();
  if (!ext || !allowedUploadExtensions.has(ext)) return `Loại file ${ext || "không rõ"} chưa được phép tải lên`;
  return "";
}

function handleUpload(req, res, target, onFinish) {
  const length = Number(req.headers["content-length"] || 0);
  if (length && length > uploadMaxBytes) return json(res, 413, { error: `File vượt quá giới hạn ${Math.round(uploadMaxBytes / 1024 / 1024)} MB` });
  let received = 0;
  let finished = false;
  const stream = fs.createWriteStream(target);
  const abort = (status, message) => {
    if (finished) return;
    finished = true;
    req.destroy();
    stream.destroy();
    fs.rm(target, { force: true }, () => {});
    json(res, status, { error: message });
  };
  req.on("data", (chunk) => {
    received += chunk.length;
    if (received > uploadMaxBytes) abort(413, `File vượt quá giới hạn ${Math.round(uploadMaxBytes / 1024 / 1024)} MB`);
  });
  req.pipe(stream);
  stream.on("finish", () => {
    if (finished) return;
    finished = true;
    onFinish();
  });
  stream.on("error", () => abort(500, "Unable to store file"));
  return undefined;
}

function contractProjectDir(projectId) {
  return path.join(contractFilesDir, safeFileName(projectId));
}

function vendorContractProjectDir(projectId) {
  return path.join(vendorContractFilesDir, safeFileName(projectId));
}

function existingProjectDir(projectId) {
  return path.join(existingFilesDir, safeFileName(projectId));
}

function design3dProjectDir(projectId) {
  return path.join(design3dFilesDir, safeFileName(projectId));
}

function technicalProjectDir(projectId) {
  return path.join(technicalFilesDir, safeFileName(projectId));
}

function driveFileDisplayName(storedName) {
  const parts = String(storedName || "").split("__");
  return parts.length > 2 ? parts.slice(2).join("__") : String(storedName || "");
}

function loadDesign3dMeta() {
  if (process.env.NODE_ENV === "test" || !fs.existsSync(design3dMetaFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(design3dMetaFile, "utf8"));
  } catch {
    return {};
  }
}

function loadTechnicalMeta() {
  if (process.env.NODE_ENV === "test" || !fs.existsSync(technicalMetaFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(technicalMetaFile, "utf8"));
  } catch {
    return {};
  }
}

function persistDesign3dMeta(meta) {
  if (process.env.NODE_ENV === "test") return;
  writeJsonAtomic(design3dMetaFile, meta);
}

function persistTechnicalMeta(meta) {
  if (process.env.NODE_ENV === "test") return;
  writeJsonAtomic(technicalMetaFile, meta);
}

// Generic Dossier helpers
function getDossierConfig(type) {
  return dossierConfigs[type] || dossierConfigs["technical"];
}

function loadDossierMeta(type) {
  const config = getDossierConfig(type);
  if (process.env.NODE_ENV === "test" || !fs.existsSync(config.metaFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(config.metaFile, "utf8"));
  } catch {
    return {};
  }
}

function persistDossierMeta(type, meta) {
  const config = getDossierConfig(type);
  if (process.env.NODE_ENV === "test") return;
  writeJsonAtomic(config.metaFile, meta);
}

function dossierProjectDir(type, projectId) {
  const config = getDossierConfig(type);
  return path.join(config.dir, safeFileName(projectId));
}

function listDossierFiles(type, projectId) {
  const dir = dossierProjectDir(type, projectId);
  if (!fs.existsSync(dir)) return [];
  const meta = loadDossierMeta(type)[projectId] || {};
  const sentInfo = meta.sent || {};
  return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => {
    const filename = entry.name;
    const stats = fs.statSync(path.join(dir, filename));
    const parts = filename.split("__");
    const kind = parts.length > 2 ? parts[0] : "main";
    const name = parts.length > 2 ? parts.slice(2).join("__") : filename;
    return {
      storedName: filename,
      kind,
      name,
      category: fileCategory(name),
      size: stats.size,
      sent: sentInfo[filename] || null,
      updatedAt: stats.mtime.toISOString()
    };
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function fileCategory(filename) {
  const ext = path.extname(filename).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"].includes(ext)) return "image";
  if ([".mp4", ".mov", ".webm", ".avi", ".mkv"].includes(ext)) return "video";
  return "file";
}

function listDriveStoredFiles() {
  purgeExpiredDriveFiles();
  if (!fs.existsSync(driveFilesDir)) return [];
  return fs.readdirSync(driveFilesDir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => {
    const filename = entry.name;
    const name = driveFileDisplayName(filename);
    const stats = fs.statSync(path.join(driveFilesDir, filename));
    return {
      storedName: filename,
      name,
      category: fileCategory(name),
      size: stats.size,
      updatedAt: stats.mtime.toISOString(),
      expiresAt: new Date(stats.mtime.getTime() + driveRetentionMs).toISOString()
    };
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function purgeExpiredDriveFiles() {
  if (!fs.existsSync(driveFilesDir)) return;
  const cutoff = Date.now() - driveRetentionMs;
  for (const entry of fs.readdirSync(driveFilesDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const target = path.join(driveFilesDir, entry.name);
    try {
      if (fs.statSync(target).mtimeMs < cutoff) fs.unlinkSync(target);
    } catch {
      // Another request may have removed the file already.
    }
  }
}

function pruneExpiredDriveRows(rows) {
  purgeExpiredDriveFiles();
  if (!Array.isArray(rows)) return [];
  const stored = new Set(listDriveStoredFiles().map((file) => file.storedName));
  const now = Date.now();
  return rows.filter((row) => {
    const storedName = row && row[10];
    if (!storedName) return true;
    const expiresAt = Date.parse(row[12] || "");
    if (Number.isFinite(expiresAt) && expiresAt <= now) return false;
    return stored.has(storedName);
  });
}

function driveStoredTarget(storedName) {
  const clean = safeFileName(storedName);
  if (!clean) return null;
  const target = path.join(driveFilesDir, clean);
  if (!fs.existsSync(target)) return null;
  return { storedName: clean, target, displayName: driveFileDisplayName(clean) };
}

function sendDriveStoredFile(res, info, disposition = "attachment") {
  res.writeHead(200, {
    "content-type": mime[path.extname(info.displayName).toLowerCase()] || "application/octet-stream",
    "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(info.displayName)}`,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  return fs.createReadStream(info.target).pipe(res);
}

function xmlDecode(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function xmlTexts(xml, tag) {
  const text = [];
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g");
  for (const match of String(xml || "").matchAll(re)) text.push(xmlDecode(match[1]));
  return text;
}

function readZipEntries(buffer) {
  const entries = new Map();
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 66000); offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) return entries;
  const total = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < total && offset + 46 <= buffer.length; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength).replace(/\\/g, "/");
    if (localOffset + 30 <= buffer.length && buffer.readUInt32LE(localOffset) === 0x04034b50) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd <= buffer.length) entries.set(name, { method, data: buffer.subarray(dataStart, dataEnd) });
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function zipText(entries, name) {
  const entry = entries.get(name);
  if (!entry) return "";
  if (entry.method === 0) return entry.data.toString("utf8");
  if (entry.method === 8) return zlib.inflateRawSync(entry.data).toString("utf8");
  return "";
}

function sortNumberedXmlName(a, b) {
  const left = Number((a.match(/(\d+)\.xml$/) || [])[1] || 0);
  const right = Number((b.match(/(\d+)\.xml$/) || [])[1] || 0);
  return left - right || a.localeCompare(b);
}

function previewDocx(entries) {
  const xml = zipText(entries, "word/document.xml");
  const paragraphs = String(xml || "").split(/<\/w:p>/).map((part) => xmlTexts(part, "w:t").join("").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 120);
  return { kind: "word", title: "Word", sections: [{ title: "Nội dung", lines: paragraphs }] };
}

function previewXlsx(entries) {
  const shared = [];
  const sharedXml = zipText(entries, "xl/sharedStrings.xml");
  for (const match of String(sharedXml || "").matchAll(/<si\b[\s\S]*?<\/si>/g)) shared.push(xmlTexts(match[0], "t").join(""));
  const names = [];
  for (const match of String(zipText(entries, "xl/workbook.xml") || "").matchAll(/<sheet\b[^>]*name="([^"]+)"/g)) names.push(xmlDecode(match[1]));
  const sheetNames = [...entries.keys()].filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort(sortNumberedXmlName);
  const sheets = sheetNames.slice(0, 8).map((name, sheetIndex) => {
    const xml = zipText(entries, name);
    const rows = [];
    for (const rowMatch of String(xml || "").matchAll(/<row\b[\s\S]*?<\/row>/g)) {
      const row = [];
      for (const cellMatch of rowMatch[0].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = cellMatch[1];
        const body = cellMatch[2];
        const raw = (body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/) || [])[1] || "";
        const inline = xmlTexts(body, "t").join("");
        row.push(/\bt="s"/.test(attrs) ? (shared[Number(raw)] || "") : inline || xmlDecode(raw));
      }
      if (row.some((cell) => String(cell).trim())) rows.push(row.slice(0, 16));
      if (rows.length >= 80) break;
    }
    return { title: names[sheetIndex] || `Sheet ${sheetIndex + 1}`, rows };
  });
  return { kind: "excel", title: "Excel", sheets };
}

function previewPptx(entries) {
  const slides = [...entries.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort(sortNumberedXmlName).slice(0, 80).map((name, index) => ({
    title: `Slide ${index + 1}`,
    lines: xmlTexts(zipText(entries, name), "a:t").map((line) => line.trim()).filter(Boolean)
  }));
  return { kind: "powerpoint", title: "PowerPoint", sections: slides };
}

function previewOfficeFile(info) {
  const ext = path.extname(info.displayName).toLowerCase();
  if ([".txt", ".md", ".note", ".csv"].includes(ext)) {
    const content = fs.readFileSync(info.target, "utf8").slice(0, 200000);
    return { kind: ext === ".csv" ? "csv" : "text", title: info.displayName, text: content };
  }
  if (![".docx", ".xlsx", ".pptx"].includes(ext)) {
    return { kind: "office", title: info.displayName, message: "Trình đọc nhanh hỗ trợ nội dung trực tiếp cho DOCX, XLSX và PPTX. File DOC/XLS/PPT cũ vẫn có thể tải hoặc mở bản gốc." };
  }
  const entries = readZipEntries(fs.readFileSync(info.target));
  if (ext === ".docx") return previewDocx(entries);
  if (ext === ".xlsx") return previewXlsx(entries);
  return previewPptx(entries);
}

function listExistingFiles(projectId) {
  const dir = existingProjectDir(projectId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => {
    const filename = entry.name;
    const stats = fs.statSync(path.join(dir, filename));
    const separator = filename.indexOf("__");
    const name = separator > 0 ? filename.slice(separator + 2) : filename;
    return {
      storedName: filename,
      name,
      category: fileCategory(name),
      size: stats.size,
      updatedAt: stats.mtime.toISOString()
    };
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

const design3dMeta = loadDesign3dMeta();
const technicalMeta = loadTechnicalMeta();

function listDesign3dFiles(projectId) {
  const dir = design3dProjectDir(projectId);
  if (!fs.existsSync(dir)) return [];
  const finalStoredName = design3dMeta[projectId]?.final || "";
  return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => {
    const filename = entry.name;
    const stats = fs.statSync(path.join(dir, filename));
    const parts = filename.split("__");
    const kind = parts.length > 2 ? parts[0] : "concept";
    const name = parts.length > 2 ? parts.slice(2).join("__") : filename;
    return {
      storedName: filename,
      kind,
      name,
      category: fileCategory(name),
      size: stats.size,
      final: filename === finalStoredName,
      updatedAt: stats.mtime.toISOString()
    };
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function listTechnicalFiles(projectId) {
  return listDossierFiles("technical", projectId);
}

function listContractFiles(projectId) {
  const dir = contractProjectDir(projectId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => {
    const filename = entry.name;
    const stats = fs.statSync(path.join(dir, filename));
    const separator = filename.indexOf("__");
    return {
      storedName: filename,
      kind: separator > 0 ? filename.slice(0, separator) : "contract",
      name: separator > 0 ? filename.slice(separator + 2) : filename,
      size: stats.size,
      updatedAt: stats.mtime.toISOString()
    };
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function listVendorContractFiles(projectId) {
  const dir = vendorContractProjectDir(projectId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => {
    const filename = entry.name;
    const stats = fs.statSync(path.join(dir, filename));
    const separator = filename.indexOf("__");
    return {
      storedName: filename,
      kind: separator > 0 ? filename.slice(0, separator) : "contract",
      name: separator > 0 ? filename.slice(separator + 2) : filename,
      size: stats.size,
      updatedAt: stats.mtime.toISOString()
    };
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

const debtsDir = path.join(__dirname, "data", "debts");

function debtProjectFile(type, projectId) {
  return path.join(debtsDir, `${type}-${safeFileName(projectId)}.json`);
}

function debtProjectDir(type, projectId) {
  return path.join(debtsDir, `${type}-files`, safeFileName(projectId));
}

function loadDebtData(type, projectId) {
  const file = debtProjectFile(type, projectId);
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return [];
    }
  }
  if (type === "owner") {
    return [
      {
        id: "d1",
        phase: "Tạm ứng hợp đồng",
        description: "Tạm ứng ban đầu khi ký kết hợp đồng",
        amountRequested: 42461974,
        dateRequested: "2026-01-15",
        amountCollected: 42461974,
        dateCollected: "2026-01-20",
        status: "collected",
        invoiceFile: ""
      },
      {
        id: "d2",
        phase: "Thanh toán đợt 1 - Nghiệm thu đợt 1",
        description: "Thanh toán theo khối lượng nghiệm thu đợt 1",
        amountRequested: 2000000000,
        dateRequested: "2026-05-15",
        amountCollected: 0,
        dateCollected: "",
        status: "pending",
        invoiceFile: ""
      }
    ];
  } else if (type === "supplier") {
    return [
      {
        id: "s1",
        phase: "Tạm ứng đợt 1",
        description: "Thực hiện tạm ứng đợt 1 cho Nhà cung cấp vật tư",
        amountRequested: 200179000,
        dateRequested: "2026-02-10",
        amountCollected: 200179000,
        dateCollected: "2026-02-15",
        status: "collected",
        invoiceFile: ""
      },
      {
        id: "s2",
        phase: "Thanh toán đợt 2",
        description: "Thanh toán đợt 2 theo khối lượng cấp hàng",
        amountRequested: 1700150517,
        dateRequested: "2026-05-25",
        amountCollected: 0,
        dateCollected: "",
        status: "pending",
        invoiceFile: ""
      }
    ];
  } else {
    return [
      {
        id: "v1",
        phase: "Thanh toán đợt 1",
        description: "Đề nghị thanh toán đợt 1 cho Nhà thầu",
        amountRequested: 258279892,
        dateRequested: "2026-05-20",
        amountCollected: 0,
        dateCollected: "",
        status: "pending",
        invoiceFile: ""
      }
    ];
  }
}

function saveDebtData(type, projectId, data) {
  writeJsonAtomic(debtProjectFile(type, projectId), data);
}

const catalogSeed = {
  constructionCategories: [
    "KHẢO SÁT - ĐO ĐẠC",
    "CHE PHỦ",
    "PHÁ DỠ",
    "VẬN CHUYỂN",
    "XÂY TRÁT",
    "CHỐNG THẤM",
    "ĐIỆN NƯỚC",
    "PCCC / AN TOÀN KỸ THUẬT",
    "ĐIỀU HÒA",
    "THIẾT BỊ THÔNG MINH - MẠNG - CAMERA",
    "THẠCH CAO",
    "ỐP LÁT",
    "ĐÁ",
    "SƠN BẢ",
    "SÀN GỖ - SÀN NHỰA",
    "CỬA",
    "NHÔM KÍNH",
    "SẮT",
    "GỖ NỘI THẤT",
    "RÈM",
    "CÂY - TIỂU CẢNH",
    "BIỂN BẢNG LOGO",
    "DEFECT CHẤM VÁ",
    "VỆ SINH CN",
    "KHÁC"
  ],
  materialCategories: [
    "VẬT LIỆU HOÀN THIỆN",
    "PHỤ KIỆN ĐỒ NỘI THẤT",
    "THIẾT BỊ CHIẾU SÁNG",
    "THIẾT BỊ BẾP",
    "THIẾT BỊ VỆ SINH",
    "ĐÈN DECOR",
    "ĐỒ DECOR",
    "ĐỒ DECOR BẾP",
    "CHĂN GA ĐỆM",
    "ĐỒ THỦ CÔNG",
    "KHÁC"
  ],
  contractTypes: [
    "Hợp đồng thiết kế",
    "Hợp đồng thi công",
    "Hợp đồng thiết kế thi công",
    "Hợp đồng phát sinh"
  ]
};

function catalogList(input, fallback) {
  const source = Array.isArray(input) ? input : fallback;
  return [...new Set(source.map((item) => String(item || "").trim()).filter(Boolean))];
}

function normalizeCatalog(input = {}) {
  return {
    constructionCategories: catalogList(input.constructionCategories, catalogSeed.constructionCategories),
    materialCategories: catalogList(input.materialCategories, catalogSeed.materialCategories),
    contractTypes: catalogList(input.contractTypes, catalogSeed.contractTypes)
  };
}

function readCatalog() { return normalizeCatalog(readJsonFile(catalogFile, catalogSeed)); }
function writeCatalog(data) { writeJsonAtomic(catalogFile, normalizeCatalog(data)); }

const partnersSeed = {
  customers: [
    ["KH001","Công ty CP Đầu tư An Phú","Nguyễn Minh Anh","0901 234 567","Đang hợp tác","Hà Nội",1850000000,320000000,["Green City","Le Dome Office"],"Ưu tiên đối soát cuối tháng"],
    ["KH002","Công ty TNHH Kiến trúc Việt","Trần Thanh Hà","0987 456 321","Tiềm năng","TP. Hồ Chí Minh",0,0,["Nội thất Le Dome"],"Đang hoàn thiện báo giá"],
    ["KH003","Ban quản lý dự án Green City","Lê Hoàng Nam","0912 884 299","Đang hợp tác","Đà Nẵng",2760000000,0,["Green City"],"Thanh toán theo tiến độ nghiệm thu"]
  ],
  contractors: [
    ["NT001","Công ty Xây dựng Hưng Thịnh","Vũ Quốc Bảo","0903 411 225","Đang hợp tác","Xây dựng",0,1680000000,["Green City","Riverside"],"Đối tác thi công phần thô"],
    ["NT002","Cơ điện M&E Thành Công","Đỗ Mạnh Hùng","0918 762 901","Đang hợp tác","Cơ điện",85000000,920000000,["M&E Riverside"],"Cần chốt khối lượng phát sinh"]
  ],
  suppliers: [
    ["NCC001","Vật liệu xây dựng Hòa Phát","Trần Văn Đức","0905 778 812","Đang hợp tác","Vật liệu",0,780000000,["Green City","Riverside"],"Giao vật tư định kỳ hàng tuần"],
    ["NCC002","Thiết bị điện Ánh Dương","Hoàng Thu Mai","0934 100 568","Đang hợp tác","Thiết bị",65000000,460000000,["M&E Riverside","Le Dome Office"],"Có bảo hành thiết bị 24 tháng"]
  ]
};

const driveSeed = [
  ["DRV001","Hồ sơ pháp lý công ty.pdf","PDF","Công ty","Hành chính","DINH Công Hoàng","2026-06-03",2450,"Ban lãnh đạo","Tài liệu dùng chung nội bộ"],
  ["DRV002","Mẫu hợp đồng thiết kế.docx","Word","Mẫu biểu","Hợp đồng","Trần Văn Đức","2026-06-02",820,"Toàn công ty","Mẫu cập nhật 2026"],
  ["DRV003","Báo giá vật liệu hoàn thiện.xlsx","Excel","Dự án","Vật liệu","Hoàng Thu Mai","2026-06-01",1260,"Thi công, Kế toán","Bảng tham khảo NCC"]
];
const driveSeedById = new Map(driveSeed.map((row) => [row[0], row]));
function repairDriveSeedRow(row) {
  const seed = driveSeedById.get(row?.[0]);
  if (!seed || row?.[10]) return row;
  const text = [row[1], row[3], row[4], row[5], row[8], row[9]].join(" ");
  return /�|\?/.test(text) ? [...seed] : row;
}

const financeSeed = {
  transactions: [
    ["2026-01-15","Thu","DỰ ÁN","38TQK","HỢP ĐỒNG THI CÔNG","LE DOME","",60348000,"","",""],
    ["2026-01-15","Chi","LE DOME","LƯƠNG","LƯƠNG","LE DOME","Lương nhân viên T12",108128000,"","",""],
    ["2026-05-18","Thu","DỰ ÁN","HDT 17T5","HỢP ĐỒNG THIẾT KẾ","Anh Việt","Thu thiết kế",15000000,"","",""]
  ],
  projects: [
    ["HDT 17T5","Cải tạo Căn hộ","Anh Việt, bác Thảo","Thiết kế + thi công nội thất","Đang thiết kế","Hoàng",0,0,15000000,0,15000000,0,0,"Ổn"],
    ["MG D608","Căn hộ duplex Mandarine","Anh Kiên","Thiết kế + thi công nội thất","Đang thiết kế","Hoàng",0,0,0,0,0,0,0,"Theo dõi"]
  ],
  budgets: [],
  debts: []
};

const personalFinanceSeed = {
  transactions: [
    ["2026-05-01","Thu","Lương","LeDome","Lương tháng",30000000,""],
    ["2026-05-02","Chi","ĂN UỐNG","ĂN","Ăn trưa",120000,""]
  ],
  budgets: [[5,"ĂN UỐNG","ĂN",3500000]],
  categories: { Thu: [["Lương","LeDome"]], Chi: [["ĂN UỐNG","ĂN"]] }
};

function readPartners() { return readJsonFile(partnersFile, partnersSeed); }
function writePartners(data) { writeJsonAtomic(partnersFile, data); }
function readFinance() { return readJsonFile(financeFile, financeSeed); }
function writeFinance(data) { writeJsonAtomic(financeFile, data); }
function readPersonalFinance() { return readJsonFile(personalFinanceFile, personalFinanceSeed); }
function writePersonalFinance(data) { writeJsonAtomic(personalFinanceFile, data); }
function readDrive() {
  const rows = pruneExpiredDriveRows(readJsonFile(driveFile, driveSeed).map(repairDriveSeedRow));
  if (process.env.NODE_ENV !== "test") writeJsonAtomic(driveFile, rows);
  return rows;
}
function writeDrive(data) { writeJsonAtomic(driveFile, pruneExpiredDriveRows(data)); }
function readOrgStaff() { return readJsonFile(orgStaffFile, orgStaffSeed); }
function writeOrgStaff(data) { writeJsonAtomic(orgStaffFile, data); }
function readDiaryReports() { return readJsonFile(diaryReportsFile, {}); }
function writeDiaryReports(data) { writeJsonAtomic(diaryReportsFile, data); }

const runtimeProjects = loadRuntimeProjects();
const runtimeProjectUpdates = loadRuntimeProjectUpdates();
const runtimeDeletedProjects = new Set(loadRuntimeDeletedProjects());
const attendanceRecords = loadAttendanceRecords();
runtimeDeletedProjects.forEach((id) => removeProjectFromMemory(id));
runtimeProjects.slice().reverse().forEach((project) => {
  if (!runtimeDeletedProjects.has(project.id) && !projects.some((item) => item.id === project.id)) addProject(project);
});
Object.entries(runtimeProjectUpdates).forEach(([id, changes]) => {
  if (!runtimeDeletedProjects.has(id)) updateProject(id, changes);
});

function api(req, res, pathname) {
  if (pathname === "/api/v1/health") return json(res, 200, { ok: true, service: "ledome-mgmt-api" });
  if (pathname === "/api/v1/auth/login" && req.method === "POST") {
    return readJson(req, (error, input) => {
      if (error) return json(res, 400, { error: error.message });
      const loginId = String(input.loginId || "").trim().toLowerCase();
      const password = String(input.password || "").trim();
      const account = readAccounts().find((item) => item.active && String(item.loginId || "").toLowerCase() === loginId && verifyPassword(item, password));
      if (!account) return json(res, 401, { error: "Sai ID, mật khẩu hoặc tài khoản đang bị khóa." });
      deleteExpiredSessions();
      const token = createSession(account);
      setSessionCookie(res, token);
      return json(res, 200, { account: publicAccount(account) });
    });
  }
  if (pathname === "/api/v1/auth/logout" && req.method === "POST") {
    const token = parseCookies(req)[sessionCookie];
    if (token) sessions.delete(token);
    setSessionCookie(res, "");
    return json(res, 200, { ok: true });
  }
  if (pathname === "/api/v1/auth/me" && req.method === "GET") {
    const account = currentUser(req);
    return account ? json(res, 200, { account: publicAccount(account) }) : json(res, 401, { error: "Chưa đăng nhập" });
  }
  if (pathname.startsWith("/api/v1/") && !isPublicApi(pathname, req.method) && !requireAccount(req, res)) return;
  if (pathname === "/api/v1/accounts" && req.method === "GET") {
    if (!requireAccount(req, res, "config.accounts")) return;
    return json(res, 200, { data: readAccounts().map(publicAccount) });
  }
  if (pathname === "/api/v1/accounts" && req.method === "PATCH") {
    if (!requireAccount(req, res, "config.accounts")) return;
    return readJson(req, (error, input) => {
      if (error) return json(res, 400, { error: error.message });
      const currentByStaff = new Map(readAccounts().map((account) => [account.staffCode, account]));
      const accounts = Array.isArray(input.accounts) ? input.accounts.map((account) => {
        const current = currentByStaff.get(account.staffCode) || {};
        const raw = {
          ...current,
          ...account,
          loginId: String(account.loginId || "").trim(),
          active: Boolean(account.active)
        };
        const next = { ...raw, ...normalizeAccountAccess(raw) };
        if (String(account.newPassword || "").trim()) Object.assign(next, hashPassword(account.newPassword));
        delete next.password;
        delete next.newPassword;
        return next;
      }).filter((account) => account.staffCode && account.loginId) : [];
      if (!accounts.length) return json(res, 400, { error: "Danh sách tài khoản không hợp lệ" });
      writeAccounts(accounts);
      return json(res, 200, { data: accounts.map(publicAccount) });
    });
  }
  if (pathname === "/api/v1/accounts/reset" && req.method === "POST") {
    if (!requireAccount(req, res, "config.accounts")) return;
    const accounts = defaultAccounts().map((account) => {
      const next = { ...account, ...normalizeAccountAccess(account) };
      Object.assign(next, hashPassword(next.password || "1"));
      delete next.password;
      return next;
    });
    writeAccounts(accounts);
    return json(res, 200, { data: accounts.map(publicAccount) });
  }
  if (pathname === "/api/v1/admin/backup" && req.method === "POST") {
    if (!requireAccount(req, res, "config.accounts")) return;
    return json(res, 201, backupDataNow());
  }
  if (pathname === "/api/v1/admin/backups" && req.method === "GET") {
    if (!requireAccount(req, res, "config.accounts")) return;
    return json(res, 200, { data: listBackups() });
  }
  if (pathname === "/api/v1/catalog") {
    if (req.method === "GET") {
      if (!requireAccount(req, res)) return;
      return json(res, 200, { data: readCatalog() });
    }
    if (req.method === "PATCH") {
      if (!requireAccount(req, res, "config")) return;
      return readJson(req, (error, input) => {
        if (error) return json(res, 400, { error: error.message });
        const data = normalizeCatalog(input.data || input);
        writeCatalog(data);
        return json(res, 200, { data });
      });
    }
  }
  const partnerMatch = pathname.match(/^\/api\/v1\/partners\/(customers|contractors|suppliers)$/);
  if (partnerMatch) {
    if (req.method === "GET") {
      if (!requireAccount(req, res, "partners.view")) return;
      return json(res, 200, { data: readPartners()[partnerMatch[1]] || [] });
    }
    if (req.method === "PATCH") {
      if (!requireAccount(req, res, "partners.edit")) return;
      return readJson(req, (error, input) => {
        if (error) return json(res, 400, { error: error.message });
        const data = readPartners();
        data[partnerMatch[1]] = Array.isArray(input.rows) ? input.rows : [];
        writePartners(data);
        return json(res, 200, { data: data[partnerMatch[1]] });
      });
    }
  }
  const financeMatch = pathname.match(/^\/api\/v1\/finance\/(overview|ledome|projects)$/);
  if (financeMatch) {
    if (req.method === "GET") {
      if (!requireAccount(req, res, "finance.view")) return;
      return json(res, 200, { data: readFinance() });
    }
    if (req.method === "PATCH") {
      if (!requireAccount(req, res, "finance.edit")) return;
      return readJson(req, (error, input) => {
        if (error) return json(res, 400, { error: error.message });
        const data = input.data && typeof input.data === "object" ? input.data : financeSeed;
        writeFinance(data);
        return json(res, 200, { data });
      });
    }
  }
  if (pathname === "/api/v1/personal-finance") {
    if (req.method === "GET") {
      if (!requireAccount(req, res, "personalFinance.view")) return;
      return json(res, 200, { data: readPersonalFinance() });
    }
    if (req.method === "PATCH") {
      if (!requireAccount(req, res, "personalFinance.edit")) return;
      return readJson(req, (error, input) => {
        if (error) return json(res, 400, { error: error.message });
        const data = input.data && typeof input.data === "object" ? input.data : personalFinanceSeed;
        writePersonalFinance(data);
        return json(res, 200, { data });
      });
    }
  }
  if (pathname === "/api/v1/drive") {
    if (req.method === "GET") {
      if (!requireAccount(req, res, "projects.view")) return;
      return json(res, 200, { data: readDrive() });
    }
    if (req.method === "PATCH") {
      if (!requireAccount(req, res, "projects.edit")) return;
      return readJson(req, (error, input) => {
        if (error) return json(res, 400, { error: error.message });
        const data = Array.isArray(input.files) ? input.files : [];
        writeDrive(data);
        return json(res, 200, { data });
      });
    }
  }
  if (pathname === "/api/v1/drive-files") {
    if (req.method === "GET") {
      if (!requireAccount(req, res, "projects.view")) return;
      return json(res, 200, { data: listDriveStoredFiles() });
    }
    if (req.method === "POST") {
      if (!requireAccount(req, res, "projects.upload")) return;
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const name = safeFileName(url.searchParams.get("name"));
      if (!name) return json(res, 400, { error: "File name is required" });
      const uploadError = validateUploadName(name);
      if (uploadError) return json(res, 400, { error: uploadError });
      fs.mkdirSync(driveFilesDir, { recursive: true });
      const storedName = `drive__${Date.now()}-${crypto.randomBytes(4).toString("hex")}__${name}`;
      const target = path.join(driveFilesDir, storedName);
      return handleUpload(req, res, target, () => json(res, 201, listDriveStoredFiles().find((item) => item.storedName === storedName)));
    }
    if (req.method === "DELETE") {
      if (!requireAccount(req, res, "projects.edit")) return;
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const storedName = safeFileName(url.searchParams.get("storedName"));
      const target = path.join(driveFilesDir, storedName);
      if (storedName && fs.existsSync(target)) fs.unlinkSync(target);
      return json(res, 200, { ok: true });
    }
  }
  if (pathname === "/api/v1/drive-files/view" && req.method === "GET") {
    if (!requireAccount(req, res, "projects.download")) return;
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const info = driveStoredTarget(url.searchParams.get("storedName"));
    if (!info) return json(res, 404, { error: "File not found" });
    return sendDriveStoredFile(res, info, "inline");
  }
  if (pathname === "/api/v1/drive-files/preview" && req.method === "GET") {
    if (!requireAccount(req, res, "projects.download")) return;
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const info = driveStoredTarget(url.searchParams.get("storedName"));
    if (!info) return json(res, 404, { error: "File not found" });
    try {
      return json(res, 200, { data: previewOfficeFile(info) });
    } catch {
      return json(res, 422, { error: "Unable to preview this file" });
    }
  }
  if (pathname === "/api/v1/drive-files/download" && req.method === "GET") {
    if (!requireAccount(req, res, "projects.download")) return;
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const info = driveStoredTarget(url.searchParams.get("storedName"));
    if (!info) return json(res, 404, { error: "File not found" });
    return sendDriveStoredFile(res, info, "attachment");
  }
  if (pathname === "/api/v1/hrm/staff") {
    if (req.method === "GET") {
      if (!requireAccount(req, res, "hrm.view")) return;
      return json(res, 200, { data: readOrgStaff() });
    }
    if (req.method === "PATCH") {
      if (!requireAccount(req, res, "hrm.edit")) return;
      return readJson(req, (error, input) => {
        if (error) return json(res, 400, { error: error.message });
        const data = Array.isArray(input.rows) ? input.rows : [];
        writeOrgStaff(data);
        return json(res, 200, { data });
      });
    }
  }
  const diaryReportsMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/diary-reports$/);
  if (diaryReportsMatch) {
    const projectId = diaryReportsMatch[1];
    if (req.method === "GET") {
      if (!requireAccount(req, res, "projects.view")) return;
      return json(res, 200, { data: readDiaryReports()[projectId] || {} });
    }
    if (req.method === "PATCH") {
      const account = requireAccount(req, res, "projects.edit");
      if (!account) return;
      return readJson(req, (error, input) => {
        if (error) return json(res, 400, { error: error.message });
        const reports = readDiaryReports();
        reports[projectId] = input.reports && typeof input.reports === "object" ? input.reports : {};
        writeDiaryReports(reports);
        return json(res, 200, { data: reports[projectId] });
      });
    }
  }
  const mutatingRequest = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  const requiredPermission = permissionForRequest(pathname, req.method);
  if (mutatingRequest && requiredPermission && !requireAccount(req, res, requiredPermission)) return;
  if (/\/download$/.test(pathname) && requiredPermission && !requireAccount(req, res, requiredPermission)) return;
  if (pathname === "/api/v1/navigation") return json(res, 200, navigation);
  if (pathname === "/api/v1/dashboard") return json(res, 200, dashboard);
  if (pathname === "/api/v1/dashboard/projects") return json(res, 200, { data: activeProjectList(dashboardProjects) });
  if (pathname === "/api/v1/insight") return json(res, 200, insight);
  if (pathname === "/api/v1/attendance/config" && req.method === "GET") {
    if (!requireAccount(req, res)) return;
    return json(res, 200, { sites: attendanceSites, employees: attendanceEmployees });
  }
  if (pathname === "/api/v1/attendance/records" && req.method === "GET") {
    const account = requireAccount(req, res);
    if (!account) return;
    const data = hasPermission(account, "hrm.view") || !account.employeeId ? attendanceRecords : attendanceRecords.filter((record) => record.employeeId === account.employeeId);
    return json(res, 200, { data, total: data.length });
  }
  if (pathname === "/api/v1/attendance/check" && req.method === "POST") {
    const account = requireAccount(req, res);
    if (!account) return;
    readJson(req, (error, input) => {
      if (error) return json(res, 400, { error: error.message });
      const employee = attendanceEmployees.find((item) => item.id === input.employeeId);
      const site = attendanceSites.find((item) => item.id === input.siteId);
      const latitude = Number(input.latitude);
      const longitude = Number(input.longitude);
      const accuracy = Number(input.accuracy);
      const type = input.type === "check-out" ? "check-out" : "check-in";
      if (account.employeeId && account.employeeId !== input.employeeId && !hasPermission(account, "hrm.approve")) return json(res, 403, { error: "Không có quyền chấm công cho nhân sự khác" });
      if (!employee) return json(res, 400, { error: "Nhân sự không hợp lệ" });
      if (!site) return json(res, 400, { error: "Công trình không hợp lệ" });
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return json(res, 400, { error: "Thiếu tọa độ GPS" });
      if (!Number.isFinite(accuracy) || accuracy > 150) return json(res, 400, { error: "GPS chưa đủ chính xác. Hãy bật định vị chính xác và thử lại." });
      if (!input.hasFacePhoto) return json(res, 400, { error: "Hãy chụp ảnh xác thực tại công trình." });
      const distance = distanceMeters({ latitude, longitude }, site);
      const insideGeofence = distance <= site.radiusMeters;
      const record = {
        id: `cc-${Date.now()}`,
        employeeId: employee.id,
        employeeName: employee.name,
        siteId: site.id,
        siteName: site.name,
        type,
        latitude,
        longitude,
        accuracy: Math.round(accuracy),
        distanceMeters: distance,
        insideGeofence,
        status: insideGeofence ? "Hợp lệ" : "Cần duyệt",
        faceEvidence: "Đã chụp ảnh",
        capturedAt: new Date().toISOString(),
        device: String(input.device || req.headers["user-agent"] || "Điện thoại")
      };
      attendanceRecords.unshift(record);
      persistAttendanceRecords(attendanceRecords);
      return json(res, 201, record);
    });
    return;
  }
  const attendanceApproveMatch = pathname.match(/^\/api\/v1\/attendance\/records\/([^/]+)\/approve$/);
  if (attendanceApproveMatch && req.method === "POST") {
    if (!requireAccount(req, res, "hrm.approve")) return;
    const record = attendanceRecords.find((item) => item.id === attendanceApproveMatch[1]);
    if (!record) return json(res, 404, { error: "Không tìm thấy bản ghi chấm công" });
    record.status = "Hợp lệ";
    record.approvedAt = new Date().toISOString();
    persistAttendanceRecords(attendanceRecords);
    return json(res, 200, record);
  }
  if (pathname === "/api/v1/projects" && req.method === "GET") return json(res, 200, { data: projects, total: projects.length });
  if (pathname === "/api/v1/projects" && req.method === "POST") {
    let raw = "";
    req.on("data", (chunk) => raw += chunk);
    req.on("end", () => {
      try {
        const input = JSON.parse(raw || "{}");
        if (!String(input.name || "").trim()) return json(res, 400, { error: "Project name is required" });
        const id = `p${Date.now()}`;
        const project = {
          id,
          code: String(input.code || `DA-${projects.length + 1}`).trim(),
          name: String(input.name).trim(),
          type: String(input.type || "Xây dựng"),
          group: String(input.group || "Thi công"),
          manager: String(input.manager || "Chưa phân công"),
          progress: 0,
          status: String(input.status || "Kế hoạch"),
          health: "Bình thường",
          budget: 0,
          spent: 0,
          description: String(input.description || "Dự án mới khởi tạo")
        };
        addProject(project);
        runtimeProjects.unshift(project);
        persistRuntimeProjects(runtimeProjects);
        return json(res, 201, project);
      } catch {
        return json(res, 400, { error: "Invalid JSON body" });
      }
    });
    return;
  }

  const debtMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/debts\/(owner|vendor|supplier)$/);
  if (debtMatch) {
    const projectId = debtMatch[1];
    const type = debtMatch[2];
    if (req.method === "GET") {
      return json(res, 200, { data: loadDebtData(type, projectId) });
    }
    if (req.method === "POST") {
      return readJson(req, (error, input) => {
        if (error) return json(res, 400, { error: error.message });
        const list = loadDebtData(type, projectId);
        let item;
        if (input.id) {
          item = list.find(x => x.id === input.id);
        }
        if (!item) {
          item = { id: `d-${Date.now()}` };
          list.push(item);
        }
        item.phase = String(input.phase || "Đợt mới").trim();
        item.description = String(input.description || "").trim();
        item.amountRequested = Number(input.amountRequested || 0);
        item.dateRequested = String(input.dateRequested || "").trim();
        item.amountCollected = Number(input.amountCollected || 0);
        item.dateCollected = String(input.dateCollected || "").trim();
        item.status = ["collected", "pending", "overdue"].includes(input.status) ? input.status : "pending";
        item.invoiceFile = String(input.invoiceFile || item.invoiceFile || "").trim();

        saveDebtData(type, projectId, list);
        return json(res, 200, { ok: true, data: item });
      });
    }
  }

  const debtDeleteMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/debts\/(owner|vendor|supplier)\/([^/]+)$/);
  if (debtDeleteMatch && req.method === "DELETE") {
    const projectId = debtDeleteMatch[1];
    const type = debtDeleteMatch[2];
    const phaseId = debtDeleteMatch[3];
    const list = loadDebtData(type, projectId);
    const index = list.findIndex(x => x.id === phaseId);
    if (index !== -1) {
      const item = list[index];
      if (item.invoiceFile) {
        try {
          const target = path.join(debtProjectDir(type, projectId), item.invoiceFile);
          if (fs.existsSync(target)) fs.unlinkSync(target);
        } catch {}
      }
      list.splice(index, 1);
      saveDebtData(type, projectId, list);
    }
    return json(res, 200, { ok: true });
  }

  const debtUploadMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/debts\/(owner|vendor|supplier)\/([^/]+)\/upload$/);
  if (debtUploadMatch && req.method === "POST") {
    const projectId = debtUploadMatch[1];
    const type = debtUploadMatch[2];
    const phaseId = debtUploadMatch[3];
    
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const name = safeFileName(url.searchParams.get("name"));
    if (!name) return json(res, 400, { error: "File name is required" });
    const uploadError = validateUploadName(name);
    if (uploadError) return json(res, 400, { error: uploadError });
    
    const dir = debtProjectDir(type, projectId);
    fs.mkdirSync(dir, { recursive: true });
    
    const storedName = `${phaseId}__${name}`;
    const target = path.join(dir, storedName);
    return handleUpload(req, res, target, () => {
      const list = loadDebtData(type, projectId);
      const item = list.find(x => x.id === phaseId);
      if (item) {
        if (item.invoiceFile && item.invoiceFile !== storedName) {
          try {
            const oldTarget = path.join(dir, item.invoiceFile);
            if (fs.existsSync(oldTarget)) fs.unlinkSync(oldTarget);
          } catch {}
        }
        item.invoiceFile = storedName;
        saveDebtData(type, projectId, list);
      }
      return json(res, 201, { ok: true, file: storedName });
    });
  }

  const debtDownloadMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/debts\/(owner|vendor|supplier)\/download$/);
  if (debtDownloadMatch && req.method === "GET") {
    const projectId = debtDownloadMatch[1];
    const type = debtDownloadMatch[2];
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const file = safeFileName(url.searchParams.get("file"));
    const target = path.join(debtProjectDir(type, projectId), file);
    if (!file || !fs.existsSync(target)) return json(res, 404, { error: "File not found" });
    res.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.includes("__") ? file.slice(file.indexOf("__") + 2) : file)}`,
      "cache-control": "no-store"
    });
    return fs.createReadStream(target).pipe(res);
  }

  const vendorContractFileMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/vendor-contract-files$/);
  if (vendorContractFileMatch) {
    const projectId = vendorContractFileMatch[1];
    if (req.method === "GET") return json(res, 200, { data: listVendorContractFiles(projectId) });
    if (req.method === "POST") {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const requestedKind = url.searchParams.get("kind");
      const kind = ["contract", "quote", "estimate", "drawing", "settlement"].includes(requestedKind) ? requestedKind : "contract";
      const name = safeFileName(url.searchParams.get("name"));
      if (!name) return json(res, 400, { error: "File name is required" });
      const uploadError = validateUploadName(name);
      if (uploadError) return json(res, 400, { error: uploadError });
      const dir = vendorContractProjectDir(projectId);
      fs.mkdirSync(dir, { recursive: true });
      const storedName = `${kind}__${name}`;
      const target = path.join(dir, storedName);
      return handleUpload(req, res, target, () => json(res, 201, listVendorContractFiles(projectId).find((item) => item.storedName === storedName)));
    }
    if (req.method === "DELETE") {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const storedName = safeFileName(url.searchParams.get("storedName"));
      const target = path.join(vendorContractProjectDir(projectId), storedName);
      if (storedName && fs.existsSync(target)) fs.unlinkSync(target);
      return json(res, 200, { ok: true });
    }
  }

  const vendorContractDownloadMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/vendor-contract-files\/download$/);
  if (vendorContractDownloadMatch && req.method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const storedName = safeFileName(url.searchParams.get("storedName"));
    const target = path.join(vendorContractProjectDir(vendorContractDownloadMatch[1]), storedName);
    if (!storedName || !fs.existsSync(target)) return json(res, 404, { error: "File not found" });
    res.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(storedName.includes("__") ? storedName.slice(storedName.indexOf("__") + 2) : storedName)}`,
      "cache-control": "no-store"
    });
    return fs.createReadStream(target).pipe(res);
  }

  const contractFileMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/contract-files$/);
  if (contractFileMatch) {
    const projectId = contractFileMatch[1];
    if (req.method === "GET") return json(res, 200, { data: listContractFiles(projectId) });
    if (req.method === "POST") {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const requestedKind = url.searchParams.get("kind");
      const kind = ["contract", "quote", "estimate", "drawing", "settlement"].includes(requestedKind) ? requestedKind : "contract";
      const name = safeFileName(url.searchParams.get("name"));
      if (!name) return json(res, 400, { error: "File name is required" });
      const uploadError = validateUploadName(name);
      if (uploadError) return json(res, 400, { error: uploadError });
      const dir = contractProjectDir(projectId);
      fs.mkdirSync(dir, { recursive: true });
      const storedName = `${kind}__${name}`;
      const target = path.join(dir, storedName);
      return handleUpload(req, res, target, () => json(res, 201, listContractFiles(projectId).find((item) => item.storedName === storedName)));
    }
    if (req.method === "DELETE") {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const storedName = safeFileName(url.searchParams.get("storedName"));
      const target = path.join(contractProjectDir(projectId), storedName);
      if (storedName && fs.existsSync(target)) fs.unlinkSync(target);
      return json(res, 200, { ok: true });
    }
  }

  const contractDownloadMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/contract-files\/download$/);
  if (contractDownloadMatch && req.method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const storedName = safeFileName(url.searchParams.get("storedName"));
    const target = path.join(contractProjectDir(contractDownloadMatch[1]), storedName);
    if (!storedName || !fs.existsSync(target)) return json(res, 404, { error: "File not found" });
    res.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(storedName.includes("__") ? storedName.slice(storedName.indexOf("__") + 2) : storedName)}`,
      "cache-control": "no-store"
    });
    return fs.createReadStream(target).pipe(res);
  }

  const existingFileMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/existing-files$/);
  if (existingFileMatch) {
    const projectId = existingFileMatch[1];
    if (req.method === "GET") return json(res, 200, { data: listExistingFiles(projectId) });
    if (req.method === "POST") {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const name = safeFileName(url.searchParams.get("name"));
      if (!name) return json(res, 400, { error: "File name is required" });
      const uploadError = validateUploadName(name);
      if (uploadError) return json(res, 400, { error: uploadError });
      const dir = existingProjectDir(projectId);
      fs.mkdirSync(dir, { recursive: true });
      const storedName = `${Date.now()}__${name}`;
      const target = path.join(dir, storedName);
      return handleUpload(req, res, target, () => json(res, 201, listExistingFiles(projectId).find((item) => item.storedName === storedName)));
    }
    if (req.method === "DELETE") {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const storedName = safeFileName(url.searchParams.get("storedName"));
      const target = path.join(existingProjectDir(projectId), storedName);
      if (storedName && fs.existsSync(target)) fs.unlinkSync(target);
      return json(res, 200, { ok: true });
    }
  }

  const existingDownloadMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/existing-files\/download$/);
  if (existingDownloadMatch && req.method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const storedName = safeFileName(url.searchParams.get("storedName"));
    const target = path.join(existingProjectDir(existingDownloadMatch[1]), storedName);
    if (!storedName || !fs.existsSync(target)) return json(res, 404, { error: "File not found" });
    const displayName = storedName.includes("__") ? storedName.slice(storedName.indexOf("__") + 2) : storedName;
    res.writeHead(200, {
      "content-type": mime[path.extname(displayName)] || "application/octet-stream",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(displayName)}`,
      "cache-control": "no-store"
    });
    return fs.createReadStream(target).pipe(res);
  }

  const design3dFileMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/design-3d-files$/);
  if (design3dFileMatch) {
    const projectId = design3dFileMatch[1];
    if (req.method === "GET") return json(res, 200, { data: listDesign3dFiles(projectId) });
    if (req.method === "POST") {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const name = safeFileName(url.searchParams.get("name"));
      const kind = url.searchParams.get("kind") === "proposal" ? "proposal" : "concept";
      if (!name) return json(res, 400, { error: "File name is required" });
      const uploadError = validateUploadName(name);
      if (uploadError) return json(res, 400, { error: uploadError });
      const dir = design3dProjectDir(projectId);
      fs.mkdirSync(dir, { recursive: true });
      const storedName = `${kind}__${Date.now()}__${name}`;
      const target = path.join(dir, storedName);
      return handleUpload(req, res, target, () => json(res, 201, listDesign3dFiles(projectId).find((item) => item.storedName === storedName)));
    }
    if (req.method === "DELETE") {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const storedName = safeFileName(url.searchParams.get("storedName"));
      const target = path.join(design3dProjectDir(projectId), storedName);
      if (storedName && fs.existsSync(target)) fs.unlinkSync(target);
      if (design3dMeta[projectId]?.final === storedName) {
        delete design3dMeta[projectId].final;
        persistDesign3dMeta(design3dMeta);
      }
      return json(res, 200, { ok: true });
    }
  }

  const design3dFinalMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/design-3d-files\/final$/);
  if (design3dFinalMatch && req.method === "PATCH") {
    return readJson(req, (error, input) => {
      if (error) return json(res, 400, { error: error.message });
      const projectId = design3dFinalMatch[1];
      const storedName = safeFileName(input.storedName);
      const target = path.join(design3dProjectDir(projectId), storedName);
      if (!storedName || !fs.existsSync(target)) return json(res, 404, { error: "File not found" });
      
      const currentFinal = design3dMeta[projectId]?.final;
      if (currentFinal === storedName) {
        delete design3dMeta[projectId].final;
      } else {
        design3dMeta[projectId] = { ...(design3dMeta[projectId] || {}), final: storedName };
      }
      persistDesign3dMeta(design3dMeta);
      return json(res, 200, { data: listDesign3dFiles(projectId) });
    });
  }

  const design3dDownloadMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/design-3d-files\/download$/);
  if (design3dDownloadMatch && req.method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const storedName = safeFileName(url.searchParams.get("storedName"));
    const target = path.join(design3dProjectDir(design3dDownloadMatch[1]), storedName);
    if (!storedName || !fs.existsSync(target)) return json(res, 404, { error: "File not found" });
    const parts = storedName.split("__");
    const displayName = parts.length > 2 ? parts.slice(2).join("__") : storedName;
    res.writeHead(200, {
      "content-type": mime[path.extname(displayName)] || "application/octet-stream",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(displayName)}`,
      "cache-control": "no-store"
    });
    return fs.createReadStream(target).pipe(res);
  }

  // IMPORT APPROVED 3D DESIGN DOSSIER ENDPOINT
  const importApproved3dMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/dossiers\/design-construction\/import-approved-3d$/);
  if (importApproved3dMatch && req.method === "POST") {
    const projectId = importApproved3dMatch[1];
    const freshMeta = loadDesign3dMeta();
    const finalStoredName = freshMeta[projectId]?.final;
    if (!finalStoredName) {
      return json(res, 400, { error: "Chưa có Hồ sơ thiết kế 3D nào được duyệt." });
    }
    const sourceDir = design3dProjectDir(projectId);
    const sourcePath = path.join(sourceDir, finalStoredName);
    if (!fs.existsSync(sourcePath)) {
      return json(res, 400, { error: "Không tìm thấy tệp thiết kế 3D gốc." });
    }

    // Parse the original file name
    const parts = finalStoredName.split("__");
    const originalName = parts.length > 2 ? parts.slice(2).join("__") : finalStoredName;

    // Target details
    const targetDir = dossierProjectDir("design-construction", projectId);
    fs.mkdirSync(targetDir, { recursive: true });

    // Save it as a main file
    const newStoredName = `main__${Date.now()}__${originalName}`;
    const targetPath = path.join(targetDir, newStoredName);

    try {
      fs.copyFileSync(sourcePath, targetPath);
      return json(res, 200, { ok: true, data: listDossierFiles("design-construction", projectId) });
    } catch (err) {
      return json(res, 500, { error: "Không thể sao chép tệp sang Hồ sơ thiết kế thi công." });
    }
  }

  // GENERIC DOSSIER ENDPOINTS
  const dossierFileMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/dossiers\/([^/]+)$/);
  if (dossierFileMatch) {
    const projectId = dossierFileMatch[1];
    const dossierType = dossierFileMatch[2];
    if (req.method === "GET") return json(res, 200, { data: listDossierFiles(dossierType, projectId) });
    if (req.method === "POST") {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const name = safeFileName(url.searchParams.get("name"));
      const kind = url.searchParams.get("kind") === "child" ? "child" : "main";
      if (!name) return json(res, 400, { error: "File name is required" });
      const uploadError = validateUploadName(name);
      if (uploadError) return json(res, 400, { error: uploadError });
      const dir = dossierProjectDir(dossierType, projectId);
      fs.mkdirSync(dir, { recursive: true });
      const storedName = `${kind}__${Date.now()}__${name}`;
      const target = path.join(dir, storedName);
      return handleUpload(req, res, target, () => json(res, 201, listDossierFiles(dossierType, projectId).find((item) => item.storedName === storedName)));
    }
    if (req.method === "DELETE") {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const storedName = safeFileName(url.searchParams.get("storedName"));
      const target = path.join(dossierProjectDir(dossierType, projectId), storedName);
      if (storedName && fs.existsSync(target)) fs.unlinkSync(target);
      const meta = loadDossierMeta(dossierType);
      if (meta[projectId]?.sent?.[storedName]) {
        delete meta[projectId].sent[storedName];
        persistDossierMeta(dossierType, meta);
      }
      return json(res, 200, { ok: true });
    }
  }

  const dossierExtractMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/dossiers\/([^/]+)\/extract$/);
  if (dossierExtractMatch && req.method === "POST") {
    return readJson(req, (error, input) => {
      if (error) return json(res, 400, { error: error.message });
      const projectId = dossierExtractMatch[1];
      const dossierType = dossierExtractMatch[2];
      const storedName = safeFileName(input.storedName);
      const dir = dossierProjectDir(dossierType, projectId);
      const source = path.join(dir, storedName);
      if (!storedName || !fs.existsSync(source)) return json(res, 404, { error: "File not found" });

      const originalName = storedName.includes("__") ? storedName.slice(storedName.indexOf("__") + 2) : storedName;
      const ext = path.extname(originalName);
      const baseName = path.basename(originalName, ext);

      const childTypes = [
        { suffix: "_Xay_dung", label: "Xây dựng" },
        { suffix: "_Co_dien_ME", label: "Cơ điện M&E" },
        { suffix: "_Noi_that", label: "Hoàn thiện Nội thất" }
      ];

      fs.mkdirSync(dir, { recursive: true });
      const ts = Date.now();
      childTypes.forEach((child, i) => {
        const childName = `${baseName}${child.suffix}${ext}`;
        const storedChildName = `child__${ts + i}__${childName}`;
        const target = path.join(dir, storedChildName);
        fs.writeFileSync(target, `Simulated split section for ${child.label} extracted from ${originalName}`);
      });

      return json(res, 200, { data: listDossierFiles(dossierType, projectId) });
    });
  }

  const dossierSendMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/dossiers\/([^/]+)\/send$/);
  if (dossierSendMatch && req.method === "POST") {
    return readJson(req, (error, input) => {
      if (error) return json(res, 400, { error: error.message });
      const projectId = dossierSendMatch[1];
      const dossierType = dossierSendMatch[2];
      const storedName = safeFileName(input.storedName);
      const contractorName = String(input.contractor || "").trim();
      if (!contractorName) return json(res, 400, { error: "Contractor name is required" });

      const dir = dossierProjectDir(dossierType, projectId);
      const target = path.join(dir, storedName);
      if (!storedName || !fs.existsSync(target)) return json(res, 404, { error: "File not found" });

      const meta = loadDossierMeta(dossierType);
      if (!meta[projectId]) meta[projectId] = {};
      if (!meta[projectId].sent) meta[projectId].sent = {};

      meta[projectId].sent[storedName] = {
        contractor: contractorName,
        sentAt: new Date().toISOString()
      };

      persistDossierMeta(dossierType, meta);
      return json(res, 200, { data: listDossierFiles(dossierType, projectId) });
    });
  }

  const dossierDownloadMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/dossiers\/([^/]+)\/download$/);
  if (dossierDownloadMatch && req.method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const projectId = dossierDownloadMatch[1];
    const dossierType = dossierDownloadMatch[2];
    const storedName = safeFileName(url.searchParams.get("storedName"));
    const target = path.join(dossierProjectDir(dossierType, projectId), storedName);
    if (!storedName || !fs.existsSync(target)) return json(res, 404, { error: "File not found" });
    const parts = storedName.split("__");
    const displayName = parts.length > 2 ? parts.slice(2).join("__") : storedName;
    res.writeHead(200, {
      "content-type": mime[path.extname(displayName)] || "application/octet-stream",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(displayName)}`,
      "cache-control": "no-store"
    });
    return fs.createReadStream(target).pipe(res);
  }

  // TECHNICAL DOSSIER ENDPOINTS
  const technicalFileMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/technical-files$/);
  if (technicalFileMatch) {
    const projectId = technicalFileMatch[1];
    if (req.method === "GET") return json(res, 200, { data: listTechnicalFiles(projectId) });
    if (req.method === "POST") {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const name = safeFileName(url.searchParams.get("name"));
      const kind = url.searchParams.get("kind") === "child" ? "child" : "main";
      if (!name) return json(res, 400, { error: "File name is required" });
      const uploadError = validateUploadName(name);
      if (uploadError) return json(res, 400, { error: uploadError });
      const dir = technicalProjectDir(projectId);
      fs.mkdirSync(dir, { recursive: true });
      const storedName = `${kind}__${Date.now()}__${name}`;
      const target = path.join(dir, storedName);
      return handleUpload(req, res, target, () => json(res, 201, listTechnicalFiles(projectId).find((item) => item.storedName === storedName)));
    }
    if (req.method === "DELETE") {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const storedName = safeFileName(url.searchParams.get("storedName"));
      const target = path.join(technicalProjectDir(projectId), storedName);
      if (storedName && fs.existsSync(target)) fs.unlinkSync(target);
      if (technicalMeta[projectId]?.sent?.[storedName]) {
        delete technicalMeta[projectId].sent[storedName];
        persistTechnicalMeta(technicalMeta);
      }
      return json(res, 200, { ok: true });
    }
  }

  const technicalExtractMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/technical-files\/extract$/);
  if (technicalExtractMatch && req.method === "POST") {
    return readJson(req, (error, input) => {
      if (error) return json(res, 400, { error: error.message });
      const projectId = technicalExtractMatch[1];
      const storedName = safeFileName(input.storedName);
      const dir = technicalProjectDir(projectId);
      const source = path.join(dir, storedName);
      if (!storedName || !fs.existsSync(source)) return json(res, 404, { error: "File not found" });

      const originalName = storedName.includes("__") ? storedName.slice(storedName.indexOf("__") + 2) : storedName;
      const ext = path.extname(originalName);
      const baseName = path.basename(originalName, ext);

      const childTypes = [
        { suffix: "_Xay_dung", label: "Xây dựng" },
        { suffix: "_Co_dien_ME", label: "Cơ điện M&E" },
        { suffix: "_Noi_that", label: "Hoàn thiện Nội thất" }
      ];

      fs.mkdirSync(dir, { recursive: true });
      const ts = Date.now();
      childTypes.forEach((child, i) => {
        const childName = `${baseName}${child.suffix}${ext}`;
        const storedChildName = `child__${ts + i}__${childName}`;
        const target = path.join(dir, storedChildName);
        fs.writeFileSync(target, `Simulated split section for ${child.label} extracted from ${originalName}`);
      });

      return json(res, 200, { data: listTechnicalFiles(projectId) });
    });
  }

  const technicalSendMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/technical-files\/send$/);
  if (technicalSendMatch && req.method === "POST") {
    return readJson(req, (error, input) => {
      if (error) return json(res, 400, { error: error.message });
      const projectId = technicalSendMatch[1];
      const storedName = safeFileName(input.storedName);
      const contractorName = String(input.contractor || "").trim();
      if (!contractorName) return json(res, 400, { error: "Contractor name is required" });

      const dir = technicalProjectDir(projectId);
      const target = path.join(dir, storedName);
      if (!storedName || !fs.existsSync(target)) return json(res, 404, { error: "File not found" });

      if (!technicalMeta[projectId]) technicalMeta[projectId] = {};
      if (!technicalMeta[projectId].sent) technicalMeta[projectId].sent = {};

      technicalMeta[projectId].sent[storedName] = {
        contractor: contractorName,
        sentAt: new Date().toISOString()
      };

      persistTechnicalMeta(technicalMeta);
      return json(res, 200, { data: listTechnicalFiles(projectId) });
    });
  }

  const technicalDownloadMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/technical-files\/download$/);
  if (technicalDownloadMatch && req.method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const storedName = safeFileName(url.searchParams.get("storedName"));
    const target = path.join(technicalProjectDir(technicalDownloadMatch[1]), storedName);
    if (!storedName || !fs.existsSync(target)) return json(res, 404, { error: "File not found" });
    const parts = storedName.split("__");
    const displayName = parts.length > 2 ? parts.slice(2).join("__") : storedName;
    res.writeHead(200, {
      "content-type": mime[path.extname(displayName)] || "application/octet-stream",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(displayName)}`,
      "cache-control": "no-store"
    });
    return fs.createReadStream(target).pipe(res);
  }

  const projectMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)$/);
  if (projectMatch) {
    if (req.method === "DELETE") {
      const deleted = deleteProject(projectMatch[1]);
      return deleted ? json(res, 200, { ok: true, data: deleted }) : json(res, 404, { error: "Project not found" });
    }
    if (req.method === "PATCH") {
      return readJson(req, (error, input) => {
        if (error) return json(res, 400, { error: error.message });
        const changes = updateProject(projectMatch[1], input);
        if (!changes) return json(res, 404, { error: "Project not found or project name is empty" });
        runtimeProjectUpdates[projectMatch[1]] = { ...(runtimeProjectUpdates[projectMatch[1]] || {}), ...changes };
        persistRuntimeProjectUpdates(runtimeProjectUpdates);
        return json(res, 200, projectDetail[projectMatch[1]] || dashboardProjects.find((item) => item.id === projectMatch[1]));
      });
    }
    const project = projectDetail[projectMatch[1]] || dashboardProjects.find((item) => item.id === projectMatch[1]);
    return project ? json(res, 200, project) : json(res, 404, { error: "Project not found" });
  }

  return json(res, 404, { error: "Endpoint not found" });
}

function staticFile(req, res, pathname) {
  const requested = pathname.match(/^\/constructions\/detail\/[^/]+\/$/)
    ? "/constructions/detail/index.html"
    : pathname === "/"
      ? "/index.html"
      : pathname.endsWith("/")
        ? `${pathname}index.html`
        : pathname;
  if (/\.(orig|recovered|reconstructed|fetched)$/i.test(requested) || requested.includes("recovered_temp") || requested.includes("cache_candidate")) {
    return json(res, 404, { error: "File not found" });
  }
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
  const filename = path.resolve(publicDir, safePath);
  const publicRoot = path.resolve(publicDir);
  if (!(filename === publicRoot || filename.startsWith(publicRoot + path.sep)) || !fs.existsSync(filename) || fs.statSync(filename).isDirectory()) {
    return fs.createReadStream(path.join(publicDir, "index.html"))
      .on("open", () => res.writeHead(200, { "content-type": mime[".html"], "cache-control": "no-cache" }))
      .pipe(res);
  }
  if (requested === "/constructions/detail/index.html") {
    const html = fs.readFileSync(filename, "utf8").replace(/\/construction\.js(?:\?v=\d+)?/g, "/construction.js?v=165");
    res.writeHead(200, { "content-type": mime[".html"], "cache-control": "no-cache" });
    return res.end(html);
  }
  res.writeHead(200, { "content-type": mime[path.extname(filename)] || "application/octet-stream", "cache-control": "no-cache" });
  fs.createReadStream(filename).pipe(res);
}

function createServer() {
  return http.createServer((req, res) => {
    const { pathname } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (pathname.startsWith("/api/")) return api(req, res, pathname);
    return staticFile(req, res, pathname);
  });
}

if (require.main === module) {
  createServer().listen(port, () => console.log(`Ledome-MGMT running at http://localhost:${port}`));
}

module.exports = { createServer };
