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
const contractDraftsFile = dataPath("runtime-contract-drafts.json");
const supplierInvoiceFilesDir = dataPath("supplier-invoice-files");
const existingFilesDir = dataPath("existing-files");
const design3dFilesDir = dataPath("design-3d-files");
const design3dMetaFile = dataPath("runtime-design-3d-meta.json");
const technicalFilesDir = dataPath("technical-files");
const technicalMetaFile = dataPath("runtime-technical-meta.json");
const accountsFile = dataPath("runtime-accounts.json");
const diaryReportsFile = dataPath("runtime-diary-reports.json");
const projectChatFile = dataPath("runtime-project-chat.json");
const teamChatFile = dataPath("runtime-team-chat.json");
const projectChatFilesDir = dataPath("project-chat-files");
const teamChatFilesDir = dataPath("team-chat-files");
const partnersFile = dataPath("runtime-partners.json");
const catalogFile = dataPath("runtime-catalog.json");
const materialsFile = dataPath("runtime-materials.json");
const financeFile = dataPath("runtime-finance.json");
const personalFinanceFile = dataPath("runtime-personal-finance.json");
const driveFile = dataPath("runtime-drive.json");
const driveFilesDir = dataPath("drive-files");
const configDocumentsFile = dataPath("runtime-config-documents.json");
const configDocumentFilesDir = dataPath("config-document-files");
const orgStaffFile = dataPath("runtime-org-staff.json");
const sessionCookie = "ledome_session";
const sessions = new Map();
let testAccounts = null;
let testStores = {};
let testBackups = [];
const uploadMaxBytes = positiveNumber(process.env.UPLOAD_MAX_BYTES, 25 * 1024 * 1024);
const sessionTtlMs = positiveNumber(process.env.SESSION_TTL_HOURS, 12) * 60 * 60 * 1000;
const driveRetentionMs = positiveNumber(process.env.DRIVE_RETENTION_DAYS, 7) * 24 * 60 * 60 * 1000;
const chatFileRetentionMs = positiveNumber(process.env.CHAT_FILE_RETENTION_DAYS, 7) * 24 * 60 * 60 * 1000;
const allowedUploadExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".mov", ".webm", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".ppt", ".pptx", ".txt", ".md", ".note", ".dwg", ".zip", ".rar"]);

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

const attendanceFixedSites = [
  { id: "ledome", name: "VP Le Dome", latitude: 21.052696, longitude: 105.789988, radiusMeters: 180, fixed: true },
  { id: "other", name: "Khác", radiusMeters: 0, fixed: true, requiresReview: true }
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
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
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
  ["NS008","X","Hành chính","Khối văn phòng"],
  ["NS009","Y","Kế toán","Khối văn phòng"],
  ["NS010","Z","Nhân sự","Khối văn phòng"],
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
  "materials.view",
  "materials.edit",
  "materials.delete",
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
    permissions: ["projects.view", "projects.edit", "projects.upload", "projects.download", "partners.view", "partners.edit", "materials.view", "materials.edit", "hrm.view"]
  },
  staff: {
    rank: 4,
    label: "Nhân viên",
    scope: "Theo công việc được giao",
    permissions: ["projects.view", "projects.edit", "projects.upload", "projects.download", "partners.view", "materials.view", "materials.edit"]
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
  materials: ["view", "edit", "delete"],
  hrm: ["view", "edit", "approve"],
  finance: ["view", "edit", "delete"],
  personalFinance: ["view", "edit"]
};
const LEGACY_PERMISSION_KEYS = [...Object.keys(LEGACY_MODULE_ACTIONS), "config", "private"];

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
  if (Object.hasOwn(permissions, permission)) return Boolean(permissions[permission]);
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
  next.materials = ["view", "edit", "delete"].some((action) => next[`materials.${action}`]);
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

function hasExplicitPermissions(permissions = {}) {
  const source = permissions && typeof permissions === "object" ? permissions : {};
  return ACCOUNT_PERMISSION_KEYS.some((key) => Object.hasOwn(source, key)) ||
    LEGACY_PERMISSION_KEYS.some((key) => Object.hasOwn(source, key));
}

function permissionsForAccount(account, accessLevel) {
  return hasExplicitPermissions(account.permissions)
    ? expandPermissions(account.permissions)
    : permissionsForAccessLevel(accessLevel);
}

function normalizeAccountAccess(account = {}) {
  const accessLevel = knownAccessLevel(account.accessLevel) ? account.accessLevel : inferAccessLevel(account);
  return {
    accessLevel,
    accessScope: ACCOUNT_ACCESS_LEVELS[accessLevel].scope,
    permissions: permissionsForAccount(account, accessLevel)
  };
}

function defaultAccountPermissions(person) {
  return permissionsForAccessLevel(inferAccessLevel(person));
}

function orgAccountRows() {
  try {
    const rows = typeof readOrgStaff === "function" ? readOrgStaff() : orgStaffSeed;
    return Array.isArray(rows) && rows.length ? rows : orgStaffSeed;
  } catch {
    return orgStaffSeed;
  }
}

function accountRecordKey(account = {}) {
  return String(account.positionCode || account.staffCode || account.loginId || "").trim().toLowerCase();
}

function orgPositionAccountMeta() {
  const map = new Map();
  orgAccountRows().forEach((staff) => {
    map.set(String(staff[0] || "").trim().toLowerCase(), {
      staffCode: staff[0],
      positionCode: staff[0],
      personKey: personKey(staff[1]) || staff[0],
      staffName: staff[1],
      role: staff[2],
      position: staff[2],
      department: staff[3],
      title: /ban lanh|giam/.test(accountSearchText({ role: staff[2], department: staff[3] })) ? staff[2] : "",
      positions: [`${staff[2]} - ${staff[3]}`]
    });
  });
  return map;
}

function defaultAccounts() {
  const used = new Set();
  return orgAccountRows().map((staff) => {
    const loginId = accountLoginId(staff[1], used);
    const person = { departments: [staff[3]], roles: [staff[2]] };
    const account = {
      staffCode: staff[0],
      positionCode: staff[0],
      personKey: personKey(staff[1]) || staff[0],
      staffName: staff[1],
      role: staff[2],
      position: staff[2],
      department: staff[3],
      title: person.departments.includes("Ban lãnh đạo") ? person.roles.find((role) => ["Giám đốc", "Phó giám đốc"].includes(role)) : "",
      positions: [`${staff[2]} - ${staff[3]}`],
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
  const defaults = defaultAccounts();
  const accounts = Array.isArray(source) && source.length ? source : defaults;
  let migrated = false;
  const accountList = [...accounts];
  const existingKeys = new Set(accountList.map(accountRecordKey));
  defaults.forEach((account) => {
    const key = accountRecordKey(account);
    if (!key || existingKeys.has(key)) return;
    accountList.push(account);
    existingKeys.add(key);
    migrated = true;
  });
  const orgMeta = orgPositionAccountMeta();
  const secure = accountList.map((account) => {
    const meta = orgMeta.get(accountRecordKey(account));
    if (meta && JSON.stringify({
      staffName: account.staffName,
      role: account.role,
      department: account.department,
      personKey: account.personKey,
      position: account.position
    }) !== JSON.stringify({
      staffName: meta.staffName,
      role: meta.role,
      department: meta.department,
      personKey: meta.personKey,
      position: meta.position
    })) migrated = true;
    account = meta ? { ...account, ...meta } : account;
    const normalized = normalizeAccountAccess(account);
    const next = { ...account, ...normalized };
    if (!next.positionCode) {
      next.positionCode = next.staffCode;
      migrated = true;
    }
    if (!next.personKey) {
      next.personKey = personKey(next.staffName) || next.staffCode;
      migrated = true;
    }
    if (!next.position) {
      next.position = next.role || "";
      migrated = true;
    }
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
  if (pathname.startsWith("/api/v1/team-chat/")) return null;
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

function attendanceSiteId(project) {
  const raw = String(project.id || project.code || project.name || "").trim();
  const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `project-${normalized || crypto.createHash("sha1").update(raw || project.name || "project").digest("hex").slice(0, 8)}`;
}

function attendanceProjectSite(project) {
  const latitude = Number(project.latitude ?? project.lat ?? project.gpsLatitude);
  const longitude = Number(project.longitude ?? project.lng ?? project.gpsLongitude);
  const radiusMeters = positiveNumber(project.radiusMeters ?? project.attendanceRadiusMeters, 250);
  return {
    id: attendanceSiteId(project),
    projectId: project.id,
    name: String(project.name || project.code || "Dự án").trim(),
    radiusMeters,
    ...(Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : {})
  };
}

function attendanceSiteOptions() {
  const projectSites = activeProjectList(projects).map(attendanceProjectSite);
  return [...projectSites, attendanceFixedSites[0], attendanceFixedSites[1]];
}

function attendanceSiteHasGeofence(site) {
  return Boolean(site && Number.isFinite(Number(site.latitude)) && Number.isFinite(Number(site.longitude)) && Number(site.radiusMeters) > 0);
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

function contractAllowedFileKind(requestedKind, fallback = "contract") {
  return ["design-contract", "contract", "quote", "estimate", "drawing", "settlement", "variation", "variation-confirm", "variation-quote"].includes(requestedKind) ? requestedKind : fallback;
}

function projectChatProjectDir(projectId) {
  return path.join(projectChatFilesDir, safeFileName(projectId));
}

function teamChatDir() {
  return teamChatFilesDir;
}

function driveFileDisplayName(storedName) {
  const parts = String(storedName || "").split("__");
  return parts.length > 2 ? parts.slice(2).join("__") : String(storedName || "");
}

function projectChatFileDisplayName(storedName) {
  const parts = String(storedName || "").split("__");
  return parts.length > 2 ? parts.slice(2).join("__") : String(storedName || "");
}

function teamChatFileDisplayName(storedName) {
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

function listConfigDocumentStoredFiles() {
  if (!fs.existsSync(configDocumentFilesDir)) return [];
  return fs.readdirSync(configDocumentFilesDir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => {
    const filename = entry.name;
    const name = driveFileDisplayName(filename);
    const stats = fs.statSync(path.join(configDocumentFilesDir, filename));
    return {
      storedName: filename,
      name,
      category: fileCategory(name),
      size: stats.size,
      updatedAt: stats.mtime.toISOString()
    };
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function configDocumentStoredTarget(storedName) {
  const clean = safeFileName(storedName);
  if (!clean) return null;
  const target = path.join(configDocumentFilesDir, clean);
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

function projectChatFileUrl(projectId, storedName) {
  return `/api/v1/projects/${encodeURIComponent(projectId)}/chat/file?storedName=${encodeURIComponent(storedName)}`;
}

function projectChatPreviewUrl(projectId, storedName) {
  return `/api/v1/projects/${encodeURIComponent(projectId)}/chat/file/preview?storedName=${encodeURIComponent(storedName)}`;
}

function teamChatFileUrl(storedName) {
  return `/api/v1/team-chat/file?storedName=${encodeURIComponent(storedName)}`;
}

function teamChatPreviewUrl(storedName) {
  return `/api/v1/team-chat/file/preview?storedName=${encodeURIComponent(storedName)}`;
}

function purgeExpiredProjectChatFiles(projectId) {
  const dirs = projectId ? [projectChatProjectDir(projectId)] : fs.existsSync(projectChatFilesDir)
    ? fs.readdirSync(projectChatFilesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(projectChatFilesDir, entry.name))
    : [];
  const cutoff = Date.now() - chatFileRetentionMs;
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const target = path.join(dir, entry.name);
      try {
        if (fs.statSync(target).mtimeMs < cutoff) fs.unlinkSync(target);
      } catch {
        // Another request may have removed the file already.
      }
    }
  });
}

function purgeExpiredTeamChatFiles() {
  if (!fs.existsSync(teamChatFilesDir)) return;
  const cutoff = Date.now() - chatFileRetentionMs;
  for (const entry of fs.readdirSync(teamChatFilesDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const target = path.join(teamChatFilesDir, entry.name);
    try {
      if (fs.statSync(target).mtimeMs < cutoff) fs.unlinkSync(target);
    } catch {
      // Another request may have removed the file already.
    }
  }
}

function projectChatFileTarget(projectId, storedName) {
  purgeExpiredProjectChatFiles(projectId);
  const clean = safeFileName(storedName);
  if (!clean) return null;
  const target = path.join(projectChatProjectDir(projectId), clean);
  if (!fs.existsSync(target)) return null;
  const stats = fs.statSync(target);
  if (stats.mtimeMs + chatFileRetentionMs <= Date.now()) {
    try { fs.unlinkSync(target); } catch {}
    return null;
  }
  const displayName = projectChatFileDisplayName(clean);
  return { storedName: clean, target, displayName, size: stats.size, category: fileCategory(displayName), updatedAt: stats.mtime.toISOString(), expiresAt: new Date(stats.mtimeMs + chatFileRetentionMs).toISOString() };
}

function teamChatFileTarget(storedName) {
  purgeExpiredTeamChatFiles();
  const clean = safeFileName(storedName);
  if (!clean) return null;
  const target = path.join(teamChatDir(), clean);
  if (!fs.existsSync(target)) return null;
  const stats = fs.statSync(target);
  if (stats.mtimeMs + chatFileRetentionMs <= Date.now()) {
    try { fs.unlinkSync(target); } catch {}
    return null;
  }
  const displayName = teamChatFileDisplayName(clean);
  return { storedName: clean, target, displayName, size: stats.size, category: fileCategory(displayName), updatedAt: stats.mtime.toISOString(), expiresAt: new Date(stats.mtimeMs + chatFileRetentionMs).toISOString() };
}

function sendProjectChatFile(res, info, disposition = "inline") {
  res.writeHead(200, {
    "content-type": mime[path.extname(info.displayName).toLowerCase()] || "application/octet-stream",
    "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(info.displayName)}`,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  return fs.createReadStream(info.target).pipe(res);
}

function sendTeamChatFile(res, info, disposition = "inline") {
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

function archiveEntriesFromNames(names) {
  const rows = [];
  const seen = new Set();
  const add = (pathValue, type) => {
    const clean = String(pathValue || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!clean || seen.has(`${type}:${clean}`)) return;
    const parts = clean.replace(/\/$/, "").split("/").filter(Boolean);
    if (!parts.length) return;
    const name = parts.at(-1) || clean;
    const ext = type === "folder" ? "DIR" : (path.extname(name).replace(".", "").toUpperCase() || "FILE");
    seen.add(`${type}:${clean}`);
    rows.push({ type, path: clean, name: type === "folder" ? `${name}/` : name, ext, level: Math.max(0, parts.length - 1) });
  };
  for (const rawName of names || []) {
    const clean = String(rawName || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!clean || clean.includes("\0")) continue;
    const parts = clean.split("/").filter(Boolean);
    let current = "";
    parts.forEach((part, index) => {
      current = current ? `${current}/${part}` : part;
      const isFolder = index < parts.length - 1 || clean.endsWith("/");
      add(isFolder ? `${current}/` : current, isFolder ? "folder" : "file");
    });
  }
  return rows.sort((a, b) => {
    const parentA = a.path.replace(/[^/]+\/?$/, "");
    const parentB = b.path.replace(/[^/]+\/?$/, "");
    if (parentA === parentB && a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.path.localeCompare(b.path, "vi", { numeric: true, sensitivity: "base" });
  });
}

function readRarVint(buffer, offset) {
  let value = 0;
  let shift = 0;
  for (let count = 0; offset < buffer.length && count < 10; count += 1) {
    const byte = buffer[offset];
    value += (byte & 0x7f) * (2 ** shift);
    offset += 1;
    if ((byte & 0x80) === 0) return { value, offset };
    shift += 7;
  }
  return null;
}

function decodeRarName(buffer) {
  const raw = Buffer.from(buffer || []);
  const end = raw.indexOf(0);
  const source = end >= 0 ? raw.subarray(0, end) : raw;
  const utf8 = source.toString("utf8");
  return utf8.includes("\uFFFD") ? source.toString("latin1") : utf8;
}

function readRar4Entries(buffer) {
  const names = [];
  let offset = 7;
  while (offset + 7 <= buffer.length) {
    const type = buffer[offset + 2];
    const flags = buffer.readUInt16LE(offset + 3);
    const headerSize = buffer.readUInt16LE(offset + 5);
    if (headerSize < 7 || offset + headerSize > buffer.length) break;
    let dataSize = 0;
    if (type === 0x74 && offset + 32 <= buffer.length) {
      const packSize = buffer.readUInt32LE(offset + 7);
      const nameSize = buffer.readUInt16LE(offset + 26);
      const attr = buffer.readUInt32LE(offset + 28);
      const highSizeOffset = offset + 32;
      const nameOffset = highSizeOffset + ((flags & 0x0100) ? 8 : 0);
      dataSize = packSize + ((flags & 0x0100) && highSizeOffset + 8 <= buffer.length ? buffer.readUInt32LE(highSizeOffset) * 0x100000000 : 0);
      if (nameOffset + nameSize <= offset + headerSize) {
        const name = decodeRarName(buffer.subarray(nameOffset, nameOffset + nameSize)).replace(/\\/g, "/");
        if (name) names.push((attr & 0x10) && !name.endsWith("/") ? `${name}/` : name);
      }
    } else if (flags & 0x8000 && offset + headerSize + 4 <= buffer.length) {
      dataSize = buffer.readUInt32LE(offset + 7);
    }
    if (type === 0x7b) break;
    offset += headerSize + ((flags & 0x8000) ? dataSize : 0);
  }
  return names;
}

function readRar5Entries(buffer) {
  const names = [];
  let offset = 8;
  while (offset + 5 < buffer.length) {
    const sizeInfo = readRarVint(buffer, offset + 4);
    if (!sizeInfo) break;
    const headerStart = sizeInfo.offset;
    const headerEnd = headerStart + sizeInfo.value;
    if (headerEnd > buffer.length || headerEnd <= headerStart) break;
    let cursor = headerStart;
    const typeInfo = readRarVint(buffer, cursor); if (!typeInfo) break;
    cursor = typeInfo.offset;
    const flagsInfo = readRarVint(buffer, cursor); if (!flagsInfo) break;
    cursor = flagsInfo.offset;
    let extraSize = 0;
    let dataSize = 0;
    if (flagsInfo.value & 0x0001) {
      const extraInfo = readRarVint(buffer, cursor); if (!extraInfo) break;
      extraSize = extraInfo.value;
      cursor = extraInfo.offset;
    }
    if (flagsInfo.value & 0x0002) {
      const dataInfo = readRarVint(buffer, cursor); if (!dataInfo) break;
      dataSize = dataInfo.value;
      cursor = dataInfo.offset;
    }
    if (typeInfo.value === 2) {
      const fileFlags = readRarVint(buffer, cursor); if (!fileFlags) break;
      cursor = fileFlags.offset;
      const unpacked = readRarVint(buffer, cursor); if (!unpacked) break;
      cursor = unpacked.offset;
      const attrs = readRarVint(buffer, cursor); if (!attrs) break;
      cursor = attrs.offset;
      if (fileFlags.value & 0x0002) cursor += 4;
      if (fileFlags.value & 0x0004) cursor += 4;
      const compression = readRarVint(buffer, cursor); if (!compression) break;
      cursor = compression.offset;
      const hostOs = readRarVint(buffer, cursor); if (!hostOs) break;
      cursor = hostOs.offset;
      const nameSize = readRarVint(buffer, cursor); if (!nameSize) break;
      cursor = nameSize.offset;
      if (cursor + nameSize.value <= headerEnd - extraSize) {
        const name = decodeRarName(buffer.subarray(cursor, cursor + nameSize.value)).replace(/\\/g, "/");
        if (name) names.push((fileFlags.value & 0x0001) && !name.endsWith("/") ? `${name}/` : name);
      }
    }
    offset = headerEnd + dataSize;
  }
  return names;
}

function readRarEntries(buffer) {
  if (buffer.length >= 7 && buffer.subarray(0, 7).equals(Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]))) return readRar4Entries(buffer);
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00]))) return readRar5Entries(buffer);
  return [];
}

function previewArchive(info, archiveType, names) {
  const entries = archiveEntriesFromNames(names);
  return {
    kind: "archive",
    title: info.displayName,
    archiveType,
    total: entries.length,
    entries: entries.slice(0, 1000),
    message: entries.length ? "" : "Khong doc duoc danh sach file trong goi nen."
  };
}

function sortNumberedXmlName(a, b) {
  const left = Number((a.match(/(\d+)\.xml$/) || [])[1] || 0);
  const right = Number((b.match(/(\d+)\.xml$/) || [])[1] || 0);
  return left - right || a.localeCompare(b);
}

const CFB_FREE_SECTOR = 0xffffffff;
const CFB_END_OF_CHAIN = 0xfffffffe;

function cfbIsValidSector(value, count = Number.MAX_SAFE_INTEGER) {
  return Number.isInteger(value) && value >= 0 && value < count && value !== CFB_FREE_SECTOR && value !== CFB_END_OF_CHAIN;
}

function cfbSectorOffset(sector, sectorSize) {
  return (sector + 1) * sectorSize;
}

function cfbReadRegularStream(buffer, fat, startSector, sectorSize, size = Number.MAX_SAFE_INTEGER) {
  if (!cfbIsValidSector(startSector, fat.length)) return Buffer.alloc(0);
  const chunks = [];
  const seen = new Set();
  let sector = startSector;
  let total = 0;
  while (cfbIsValidSector(sector, fat.length) && !seen.has(sector)) {
    seen.add(sector);
    const offset = cfbSectorOffset(sector, sectorSize);
    if (offset < 0 || offset >= buffer.length) break;
    const slice = buffer.subarray(offset, Math.min(offset + sectorSize, buffer.length));
    chunks.push(slice);
    total += slice.length;
    if (total >= size) break;
    sector = fat[sector];
  }
  return Buffer.concat(chunks).subarray(0, Math.min(total, size));
}

function cfbReadMiniStream(rootStream, miniFat, startSector, miniSectorSize, size) {
  if (!rootStream.length || !cfbIsValidSector(startSector, miniFat.length)) return Buffer.alloc(0);
  const chunks = [];
  const seen = new Set();
  let sector = startSector;
  let total = 0;
  while (cfbIsValidSector(sector, miniFat.length) && !seen.has(sector)) {
    seen.add(sector);
    const offset = sector * miniSectorSize;
    if (offset < 0 || offset >= rootStream.length) break;
    const slice = rootStream.subarray(offset, Math.min(offset + miniSectorSize, rootStream.length));
    chunks.push(slice);
    total += slice.length;
    if (total >= size) break;
    sector = miniFat[sector];
  }
  return Buffer.concat(chunks).subarray(0, Math.min(total, size));
}

function readCfbStreams(buffer) {
  const streams = new Map();
  if (!Buffer.isBuffer(buffer) || buffer.length < 512 || !buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return streams;
  const sectorSize = 1 << buffer.readUInt16LE(30);
  const miniSectorSize = 1 << buffer.readUInt16LE(32);
  const fatSectorCount = buffer.readUInt32LE(44);
  const firstDirSector = buffer.readUInt32LE(48);
  const miniCutoff = buffer.readUInt32LE(56) || 4096;
  const firstMiniFatSector = buffer.readUInt32LE(60);
  const miniFatSectorCount = buffer.readUInt32LE(64);
  let firstDifatSector = buffer.readUInt32LE(68);
  let difatSectorCount = buffer.readUInt32LE(72);
  const difat = [];
  for (let offset = 76; offset < 512; offset += 4) {
    const value = buffer.readUInt32LE(offset);
    if (value !== CFB_FREE_SECTOR) difat.push(value);
  }
  const difatSeen = new Set();
  while (cfbIsValidSector(firstDifatSector) && difatSectorCount > 0 && !difatSeen.has(firstDifatSector)) {
    difatSeen.add(firstDifatSector);
    const offset = cfbSectorOffset(firstDifatSector, sectorSize);
    if (offset + sectorSize > buffer.length) break;
    const entries = (sectorSize / 4) - 1;
    for (let index = 0; index < entries; index += 1) {
      const value = buffer.readUInt32LE(offset + (index * 4));
      if (value !== CFB_FREE_SECTOR) difat.push(value);
    }
    firstDifatSector = buffer.readUInt32LE(offset + sectorSize - 4);
    difatSectorCount -= 1;
  }
  const fat = [];
  difat.slice(0, fatSectorCount).forEach((sector) => {
    if (!cfbIsValidSector(sector)) return;
    const offset = cfbSectorOffset(sector, sectorSize);
    if (offset + sectorSize > buffer.length) return;
    for (let item = 0; item < sectorSize / 4; item += 1) fat.push(buffer.readUInt32LE(offset + (item * 4)));
  });
  const directory = cfbReadRegularStream(buffer, fat, firstDirSector, sectorSize);
  if (!directory.length) return streams;
  const entries = [];
  for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
    const nameLength = directory.readUInt16LE(offset + 64);
    const type = directory.readUInt8(offset + 66);
    if (nameLength < 2 || !type) continue;
    const name = directory.toString("utf16le", offset, offset + nameLength - 2).trim();
    const startSector = directory.readUInt32LE(offset + 116);
    const sizeLow = directory.readUInt32LE(offset + 120);
    entries.push({ name, type, startSector, size: sizeLow });
  }
  const root = entries.find((entry) => entry.type === 5);
  const rootStream = root ? cfbReadRegularStream(buffer, fat, root.startSector, sectorSize, root.size) : Buffer.alloc(0);
  const miniFatData = cfbReadRegularStream(buffer, fat, firstMiniFatSector, sectorSize, miniFatSectorCount * sectorSize);
  const miniFat = [];
  for (let offset = 0; offset + 4 <= miniFatData.length; offset += 4) miniFat.push(miniFatData.readUInt32LE(offset));
  entries.filter((entry) => entry.type === 2 && entry.name).forEach((entry) => {
    const data = entry.size > 0 && entry.size < miniCutoff
      ? cfbReadMiniStream(rootStream, miniFat, entry.startSector, miniSectorSize, entry.size)
      : cfbReadRegularStream(buffer, fat, entry.startSector, sectorSize, entry.size);
    streams.set(entry.name.toLowerCase(), data);
  });
  return streams;
}

function legacyOfficeStringRuns(buffer, mode = "utf16le") {
  const runs = [];
  const source = buffer.length > 10000000 ? buffer.subarray(0, 10000000) : buffer;
  if (mode === "utf16le") {
    for (const start of [0, 1]) {
      let current = "";
      for (let offset = start; offset + 1 < source.length; offset += 2) {
        const code = source.readUInt16LE(offset);
        const valid = code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd);
        if (valid) current += String.fromCharCode(code);
        else {
          if (current.trim().length >= 4) runs.push(current);
          current = "";
        }
      }
      if (current.trim().length >= 4) runs.push(current);
    }
    return runs;
  }
  let current = "";
  for (const byte of source) {
    const valid = byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126) || byte >= 160;
    if (valid) current += String.fromCharCode(byte);
    else {
      if (current.trim().length >= 6) runs.push(current);
      current = "";
    }
  }
  if (current.trim().length >= 6) runs.push(current);
  return runs;
}

function cleanLegacyOfficeLines(strings, limit = 260) {
  const lines = [];
  const seen = new Set();
  for (const raw of strings) {
    const chunks = String(raw || "")
      .replace(/\u0000/g, "")
      .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
      .replace(/\r/g, "\n")
      .split(/\n| {3,}/);
    for (const chunk of chunks) {
      const line = chunk.replace(/\s+/g, " ").trim();
      if (line.length < 2 || line.length > 300) continue;
      if (!/[0-9A-Za-zÀ-ỹ]/.test(line)) continue;
      const useful = (line.match(/[0-9A-Za-zÀ-ỹ]/g) || []).length / Math.max(1, line.length);
      if (useful < 0.3) continue;
      const key = line.toLocaleLowerCase("vi-VN");
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(line);
      if (lines.length >= limit) return lines;
    }
  }
  return lines;
}

function legacyOfficeCandidateBuffers(buffer, ext) {
  const streams = readCfbStreams(buffer);
  if (!streams.size) return [buffer];
  const preferred = ext === ".doc"
    ? ["worddocument", "0table", "1table"]
    : ext === ".xls"
      ? ["workbook", "book"]
      : ["powerpoint document", "current user"];
  const candidates = preferred.map((name) => streams.get(name)).filter((data) => data?.length);
  if (candidates.length) return candidates;
  return [...streams.values()].filter((data) => data?.length).slice(0, 8);
}

function previewLegacyOffice(info, ext, buffer) {
  const candidates = legacyOfficeCandidateBuffers(buffer, ext);
  const strings = candidates.flatMap((candidate) => [
    ...legacyOfficeStringRuns(candidate, "utf16le"),
    ...legacyOfficeStringRuns(candidate, "latin1")
  ]);
  const lines = cleanLegacyOfficeLines(strings);
  if (!lines.length) {
    return { kind: "office", title: info.displayName, message: "Không bóc được nội dung xem nhanh từ file Office đời cũ này. Dùng nút Mở tab hoặc Tải file để xem bản gốc." };
  }
  const notice = "Nội dung này được trích xuất best-effort từ file Office đời cũ, bố cục có thể không giống bản gốc.";
  if (ext === ".xls") {
    return { kind: "excel", title: "Excel", notice, sheets: [{ title: "Trích xuất nội dung", columns: ["Nội dung"], rowNumbers: lines.map((_, index) => index + 1), rows: lines.map((line) => [line]) }] };
  }
  if (ext === ".ppt") {
    return { kind: "powerpoint", title: "PowerPoint", notice, sections: [{ title: "Trích xuất nội dung", lines }] };
  }
  return { kind: "word", title: "Word", notice, sections: [{ title: "Trích xuất nội dung", lines }], blocks: lines.map((line) => ({ type: "p", text: line, runs: [{ text: line }] })), legacy: true };
}

function docxTagAttr(xml, tag, attr) {
  const match = String(xml || "").match(new RegExp(`<w:${tag}\\b[^>]*\\b(?:w:)?${attr}="([^"]+)"`));
  return match ? xmlDecode(match[1]) : "";
}

function docxRunText(runXml) {
  const parts = [];
  const pattern = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/g;
  for (const match of String(runXml || "").matchAll(pattern)) {
    if (match[1] !== undefined) parts.push(xmlDecode(match[1]));
    else if (match[0].startsWith("<w:tab")) parts.push("\t");
    else parts.push("\n");
  }
  return parts.join("");
}

function docxParagraphRuns(paragraphXml) {
  const runs = [];
  for (const match of String(paragraphXml || "").matchAll(/<w:r\b[\s\S]*?<\/w:r>/g)) {
    const runXml = match[0];
    const text = docxRunText(runXml);
    if (!text) continue;
    const run = { text };
    if (/<w:b\b/.test(runXml)) run.bold = true;
    if (/<w:i\b/.test(runXml)) run.italic = true;
    if (/<w:u\b/.test(runXml)) run.underline = true;
    runs.push(run);
  }
  if (!runs.length) {
    const text = docxRunText(paragraphXml);
    if (text) runs.push({ text });
  }
  return runs;
}

function docxParagraphText(paragraphXml) {
  return docxParagraphRuns(paragraphXml)
    .map((run) => run.text)
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function docxParagraphRole(text, style, align) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (/title/i.test(style)) return "title";
  if (/subtitle/i.test(style)) return "subtitle";
  if (/heading/i.test(style) || /^(ĐIỀU|Điều|DIEU|Dieu)\s+\d+/.test(normalized)) return "heading";
  const upper = normalized.toLocaleUpperCase("vi-VN");
  if (align === "center" && normalized.length <= 100 && normalized === upper) return "title";
  return "";
}

function docxParagraphBlock(paragraphXml) {
  const runs = docxParagraphRuns(paragraphXml);
  const text = runs.map((run) => run.text).join("").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").trim();
  if (!text) return null;
  const pPr = (String(paragraphXml || "").match(/<w:pPr\b[\s\S]*?<\/w:pPr>/) || [])[0] || "";
  const align = docxTagAttr(pPr, "jc", "val");
  const style = docxTagAttr(pPr, "pStyle", "val");
  const block = { type: "p", text, runs };
  if (align) block.align = align;
  const role = docxParagraphRole(text, style, align);
  if (role) block.role = role;
  if (style) block.style = style;
  return block;
}

function docxTableBlock(tableXml) {
  const rows = [];
  for (const rowMatch of String(tableXml || "").matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)) {
    const cells = [];
    for (const cellMatch of rowMatch[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)) {
      const paragraphs = [];
      for (const paragraphMatch of cellMatch[0].matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)) {
        const text = docxParagraphText(paragraphMatch[0]);
        if (text) paragraphs.push(text);
      }
      cells.push(paragraphs.join("\n"));
    }
    if (cells.some((cell) => String(cell || "").trim())) rows.push(cells);
  }
  return rows.length ? { type: "table", rows } : null;
}

function previewDocx(entries) {
  const xml = zipText(entries, "word/document.xml");
  const source = String(xml || "");
  const body = (source.match(/<w:body\b[\s\S]*?<\/w:body>/) || [])[0] || source;
  const blocks = [];
  let truncated = false;
  for (const match of body.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/g)) {
    const raw = match[0];
    const block = raw.startsWith("<w:tbl") ? docxTableBlock(raw) : docxParagraphBlock(raw);
    if (block) blocks.push(block);
    if (blocks.length >= 260) {
      truncated = true;
      break;
    }
  }
  const lines = blocks.flatMap((block) => block.type === "table" ? block.rows.flatMap((row) => row) : [block.text]).filter(Boolean).slice(0, 260);
  return { kind: "word", title: "Word", sections: [{ title: "Nội dung", lines }], blocks, truncated };
}

function excelColumnIndex(ref) {
  const letters = (String(ref || "").match(/[A-Z]+/i) || [])[0] || "";
  if (!letters) return -1;
  return letters.toUpperCase().split("").reduce((sum, char) => (sum * 26) + char.charCodeAt(0) - 64, 0) - 1;
}

function excelColumnLabel(index) {
  let value = Number(index) + 1;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label || "A";
}

function xlsxCellValue(attrs, body, sharedStrings) {
  const raw = (body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/) || [])[1] || "";
  const inline = xmlTexts(body, "t").join("");
  if (/\bt="s"/.test(attrs)) return sharedStrings[Number(raw)] || "";
  return inline || xmlDecode(raw);
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
    const rowLimit = 180;
    const columnLimit = 48;
    const rawRows = [];
    let maxColumn = 0;
    let truncatedColumns = false;
    let truncatedRows = false;
    for (const rowMatch of String(xml || "").matchAll(/<row\b[\s\S]*?<\/row>/g)) {
      const rowAttrs = (rowMatch[0].match(/<row\b([^>]*)>/) || [])[1] || "";
      const rowNumber = Number((rowAttrs.match(/\br="(\d+)"/) || [])[1]) || rawRows.length + 1;
      const cells = [];
      let fallbackColumn = 0;
      for (const cellMatch of rowMatch[0].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = cellMatch[1];
        const body = cellMatch[2];
        const ref = (attrs.match(/\br="([^"]+)"/) || [])[1] || "";
        const indexedColumn = excelColumnIndex(ref);
        const columnIndex = indexedColumn >= 0 ? indexedColumn : fallbackColumn;
        fallbackColumn = columnIndex + 1;
        if (columnIndex >= columnLimit) {
          truncatedColumns = true;
          continue;
        }
        cells[columnIndex] = xlsxCellValue(attrs, body, shared);
        maxColumn = Math.max(maxColumn, columnIndex);
      }
      if (cells.some((cell) => String(cell || "").trim())) rawRows.push({ number: rowNumber, cells });
      if (rawRows.length >= rowLimit) {
        truncatedRows = true;
        break;
      }
    }
    const columnCount = Math.min(columnLimit, Math.max(1, maxColumn + 1));
    const rows = rawRows.map((row) => Array.from({ length: columnCount }, (_, index) => row.cells[index] || ""));
    const rowNumbers = rawRows.map((row) => row.number);
    const columns = Array.from({ length: columnCount }, (_, index) => excelColumnLabel(index));
    return { title: names[sheetIndex] || `Sheet ${sheetIndex + 1}`, columns, rowNumbers, rows, truncatedColumns, truncatedRows };
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
  const buffer = fs.readFileSync(info.target);
  if ([".txt", ".md", ".note", ".csv"].includes(ext)) {
    const content = buffer.toString("utf8").slice(0, 200000);
    return { kind: ext === ".csv" ? "csv" : "text", title: info.displayName, text: content };
  }
  if (ext === ".zip") {
    const entries = readZipEntries(buffer);
    return previewArchive(info, "ZIP", [...entries.keys()]);
  }
  if (ext === ".rar") {
    return previewArchive(info, "RAR", readRarEntries(buffer));
  }
  if ([".doc", ".xls", ".ppt"].includes(ext)) {
    const zipped = readZipEntries(buffer);
    if (zipped.size) {
      if (ext === ".doc" && zipped.has("word/document.xml")) return previewDocx(zipped);
      if (ext === ".xls" && zipped.has("xl/workbook.xml")) return previewXlsx(zipped);
      if (ext === ".ppt" && [...zipped.keys()].some((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))) return previewPptx(zipped);
    }
    return previewLegacyOffice(info, ext, buffer);
  }
  if (![".docx", ".xlsx", ".pptx"].includes(ext)) {
    return { kind: "office", title: info.displayName, message: "Trình đọc nhanh hỗ trợ nội dung trực tiếp cho DOCX, XLSX và PPTX. File DOC/XLS/PPT cũ vẫn có thể tải hoặc mở bản gốc." };
  }
  const entries = readZipEntries(buffer);
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

function contractDraftType(value) {
  const type = String(value || "");
  return ["estimate", "quote", "variation-quote"].includes(type) ? type : "";
}

function contractDraftKey(projectId, type) {
  return `${safeFileName(projectId)}::${type}`;
}

function readContractDrafts() {
  return readJsonFile(contractDraftsFile, {});
}

function writeContractDraft(projectId, type, payload) {
  const drafts = readContractDrafts();
  const key = contractDraftKey(projectId, type);
  drafts[key] = {
    projectId: safeFileName(projectId),
    type,
    updatedAt: new Date().toISOString(),
    data: payload && typeof payload === "object" ? payload : {}
  };
  writeJsonAtomic(contractDraftsFile, drafts);
  return drafts[key];
}

function readContractDraft(projectId, type) {
  return readContractDrafts()[contractDraftKey(projectId, type)] || null;
}

function deleteContractDraft(projectId, type) {
  const drafts = readContractDrafts();
  delete drafts[contractDraftKey(projectId, type)];
  writeJsonAtomic(contractDraftsFile, drafts);
}

function contractFileResponseItem(projectId, storedName) {
  return listContractFiles(projectId).find((item) => item.storedName === storedName) || null;
}

function contractFallbackPdfText(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "d")
    .replace(/[^\x20-\x7E\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Bao gia";
}

function contractPdfEscapeText(value) {
  return String(value || "").replace(/[\\()]/g, "\\$&");
}

function contractSimplePdfBuffer(html) {
  const source = contractFallbackPdfText(html);
  const words = source.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > 88) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
    if (lines.length >= 54) break;
  }
  if (line && lines.length < 55) lines.push(line);
  const content = `BT\n/F1 10 Tf\n50 790 Td\n${lines.map((item, index) => `${index ? "0 -14 Td\n" : ""}(${contractPdfEscapeText(item)}) Tj`).join("\n")}\nET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream\nendobj\n`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}

async function contractHtmlToPdfBuffer(html) {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    return contractSimplePdfBuffer(html);
  }
  const launchAttempts = [{}, { channel: "msedge" }, { channel: "chrome" }];
  let browser;
  let lastError;
  for (const options of launchAttempts) {
    try {
      browser = await chromium.launch({ ...options, headless: true });
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!browser) return contractSimplePdfBuffer(html);
  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    await page.setContent(String(html || ""), { waitUntil: "networkidle" });
    return Buffer.from(await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" }
    }));
  } catch {
    return contractSimplePdfBuffer(html);
  } finally {
    await browser.close().catch(() => {});
  }
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
  projectList: [],
  staffList: [],
  constructionCategories: [
    "KHẢO SÁT - ĐO ĐẠC",
    "CHE PHỦ",
    "PHÁ DỠ",
    "VẬN CHUYỂN",
    "XÂY TRÁT",
    "CHỐNG THẤM",
    "ĐIỆN NƯỚC",
    "PCCC / AN TOÀN KỸ THUẬT",
    "THIẾT BỊ THÔNG MINH - MẠNG - CAMERA",
    "THẠCH CAO",
    "ỐP LÁT",
    "ĐÁ",
    "SƠN BẢ",
    "TẤM ỐP NHỰA - THAN TRE",
    "SÀN GỖ - SÀN NHỰA",
    "CỬA",
    "GỖ NỘI THẤT",
    "RÈM",
    "NHÔM KÍNH",
    "SẮT",
    "ĐIỀU HÒA",
    "VỆ SINH CN",
    "DEFECT CHẤM VÁ",
    "DECOR TRANG TRÍ",
    "CÂY - TIỂU CẢNH",
    "BIỂN BẢNG LOGO",
    "KHÁC"
  ],
  constructionCategoryGroups: [
    {
      id: "rough",
      title: "Nhóm 1: Phần thô & Xây dựng cơ bản",
      role: "Nhà thầu xây dựng",
      desc: "Kết cấu, xây tô, cán nền, chống thấm, phá dỡ và chuẩn bị mặt bằng.",
      items: ["KHẢO SÁT - ĐO ĐẠC", "CHE PHỦ", "PHÁ DỠ", "VẬN CHUYỂN", "XÂY TRÁT", "CHỐNG THẤM"]
    },
    {
      id: "surface-mep",
      title: "Nhóm 2: Phần hoàn thiện bề mặt & Cơ điện",
      role: "Nhà thầu hoàn thiện / Điện nước",
      desc: "Đi dây điện, ống nước, thạch cao, ốp lát, đá, sơn bả và hệ kỹ thuật âm tường.",
      items: ["ĐIỆN NƯỚC", "PCCC / AN TOÀN KỸ THUẬT", "THIẾT BỊ THÔNG MINH - MẠNG - CAMERA", "THẠCH CAO", "ỐP LÁT", "ĐÁ", "SƠN BẢ", "TẤM ỐP NHỰA - THAN TRE"]
    },
    {
      id: "wood-interior",
      title: "Nhóm 3: Phần gỗ & Nội thất",
      role: "Xưởng sản xuất nội thất",
      desc: "Gia công tại xưởng và lắp ráp tại công trình: tủ, giường, vách ốp, sàn gỗ, cửa gỗ.",
      items: ["SÀN GỖ - SÀN NHỰA", "CỬA", "GỖ NỘI THẤT", "RÈM"]
    },
    {
      id: "metal-equipment",
      title: "Nhóm 4: Phần cơ khí, nhôm kính & Thiết bị chuyên dụng",
      role: "Đội thầu phụ chuyên dụng",
      desc: "Nhôm kính, sắt, lan can, điều hòa và các hệ thiết bị chuyên môn.",
      items: ["NHÔM KÍNH", "SẮT", "ĐIỀU HÒA"]
    },
    {
      id: "completion",
      title: "Nhóm 5: Hoàn thiện",
      role: "Đội hoàn thiện cuối kỳ",
      desc: "Vệ sinh CN, defect chấm vá, decor trang trí, cây cảnh, logo và các đầu mục hoàn thiện cuối.",
      items: ["VỆ SINH CN", "DEFECT CHẤM VÁ", "DECOR TRANG TRÍ", "CÂY - TIỂU CẢNH", "BIỂN BẢNG LOGO", "KHÁC"]
    }
  ],
  designCategories: [
    "KHẢO SÁT HIỆN TRẠNG",
    "MẶT BẰNG CÔNG NĂNG",
    "CONCEPT / Ý TƯỞNG",
    "THIẾT KẾ 3D",
    "HỒ SƠ KỸ THUẬT",
    "BỔ KỸ THUẬT",
    "VẬT LIỆU / MÀU SẮC",
    "DỰ TOÁN THIẾT KẾ",
    "TRÌNH DUYỆT CDT",
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
  materialCategoryGroups: [
    {
      id: "material-finishing",
      title: "Nhóm 1: Vật liệu hoàn thiện",
      role: "Nhà cung cấp vật liệu hoàn thiện",
      desc: "Keo, nẹp, phào, sơn, đá, vật liệu ốp lát và hoàn thiện bề mặt.",
      items: ["VẬT LIỆU HOÀN THIỆN"]
    },
    {
      id: "material-interior",
      title: "Nhóm 2: Phụ kiện & Nội thất",
      role: "NCC phụ kiện nội thất",
      desc: "Phụ kiện đồ nội thất, đồ decor, đồ decor bếp, chăn ga đệm và đồ thủ công.",
      items: ["PHỤ KIỆN ĐỒ NỘI THẤT", "ĐỒ DECOR", "ĐỒ DECOR BẾP", "CHĂN GA ĐỆM", "ĐỒ THỦ CÔNG"]
    },
    {
      id: "material-equipment",
      title: "Nhóm 3: Thiết bị công trình",
      role: "NCC thiết bị chuyên dụng",
      desc: "Thiết bị chiếu sáng, thiết bị bếp, thiết bị vệ sinh và đèn decor.",
      items: ["THIẾT BỊ CHIẾU SÁNG", "THIẾT BỊ BẾP", "THIẾT BỊ VỆ SINH", "ĐÈN DECOR"]
    },
    {
      id: "material-other",
      title: "Nhóm 4: Khác",
      role: "NCC bổ sung",
      desc: "Các nhóm vật tư chưa phân loại hoặc phát sinh theo dự án.",
      items: ["KHÁC"]
    }
  ],
  contractTypes: [
    "Hợp đồng thiết kế",
    "Hợp đồng thi công",
    "Hợp đồng thiết kế thi công",
    "Hợp đồng phát sinh"
  ],
  designContractTypes: [
    "Hợp đồng thiết kế",
    "Phụ lục hợp đồng thiết kế",
    "Biên bản nghiệm thu thiết kế",
    "Thanh lý hợp đồng thiết kế"
  ],
  constructionContractTypes: [
    "Hợp đồng thi công",
    "Phụ lục hợp đồng thi công",
    "Báo giá hợp đồng",
    "Hồ sơ bản vẽ hợp đồng",
    "Phát sinh hợp đồng thi công",
    "Quyết toán hợp đồng thi công"
  ],
  subcontractTypes: [
    "Hợp đồng giao thầu",
    "Phụ lục hợp đồng giao thầu",
    "Báo giá nhà thầu",
    "Hồ sơ bản vẽ giao thầu",
    "Phát sinh hợp đồng giao thầu",
    "Quyết toán hợp đồng giao thầu"
  ],
  voucherTypes: [
    "Phiếu chấm công",
    "Phiếu Overtime",
    "Phiếu xin nghỉ phép",
    "Phiếu nhiệm vụ",
    "Phiếu Nhật ký thi công",
    "Phiếu nhập kho",
    "Phiếu xuất kho",
    "Phiếu chi",
    "Phiếu Yêu cầu Phát sinh của CDT",
    "Phiếu Yêu cầu ghi chú của CDT",
    "Phiếu Yêu cầu cần CDT phê duyệt",
    "Phiếu Vấn đề sự cố"
  ],
  overtimeVoucherTypes: ["Phiếu OT ngày thường", "Phiếu OT cuối tuần", "Phiếu OT ngày lễ", "Phiếu OT bổ sung"],
  paymentVoucherTypes: ["Phiếu chi dự án", "Phiếu chi vận hành", "Phiếu chi tạm ứng", "Phiếu chi hoàn ứng", "Phiếu chi khác"],
  attendanceVoucherTypes: ["Check-in", "Check-out", "Phiếu bổ sung công", "Phiếu điều chỉnh công"],
  inventoryReceiptTypes: ["Nhập mua mới", "Nhập hoàn trả", "Nhập điều chuyển", "Nhập tồn đầu kỳ"],
  inventoryIssueTypes: ["Xuất dùng thi công", "Xuất điều chuyển", "Xuất trả NCC", "Xuất hao hụt / hủy"],
  warehouseList: ["Kho VP", "Kho dự án", "Kho công trình", "Kho tạm"],
  cdtChangeRequestTypes: ["Phát sinh khối lượng", "Thay đổi vật liệu", "Thay đổi thiết kế", "Bổ sung hạng mục"],
  cdtNoteRequestTypes: ["Ghi chú hiện trạng", "Ghi chú nghiệm thu", "Ghi chú vật tư", "Ghi chú tiến độ"],
  cdtApprovalRequestTypes: ["Duyệt báo giá", "Duyệt phương án", "Duyệt vật liệu", "Duyệt tiến độ", "Duyệt phát sinh"],
  incidentIssueTypes: ["Sự cố kỹ thuật", "Sự cố vật tư", "Sự cố an toàn", "Sự cố tiến độ", "Sự cố chất lượng"]
};

function catalogList(input, fallback) {
  const source = Array.isArray(input) ? input : fallback;
  return [...new Set(source.map((item) => String(item || "").trim()).filter(Boolean))];
}

function catalogListTitles(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return Object.fromEntries(Object.entries(source)
    .map(([key, value]) => [key, String(value || "").replace(/\s+/g, " ").trim()])
    .filter(([, value]) => value));
}

function catalogTextKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase();
}

function constructionCategoryGroupIdForName(name) {
  const text = catalogTextKey(name);
  if (/VE SINH|DEFECT|CHAM VA|DECOR|TRANG TRI|CAY|TIEU CANH|BIEN BANG|LOGO|DO THU CONG|CHAN GA|KHAC/.test(text)) return "completion";
  if (/NHOM KINH|SAT|CO KHI|LAN CAN|THANG MAY|DIEU HOA|MAY LANH|THIET BI VE SINH|THIET BI BEP/.test(text)) return "metal-equipment";
  if (/GO|NOI THAT|SAN GO|SAN NHUA|CUA|REM|PHU KIEN/.test(text)) return "wood-interior";
  if (/DIEN|NUOC|PCCC|AN TOAN|THONG MINH|MANG|CAMERA|THACH CAO|OP LAT|DA|SON|TAM OP|THAN TRE|VAT LIEU HOAN THIEN|THIET BI CHIEU SANG|DEN/.test(text)) return "surface-mep";
  if (/KHAO SAT|DO DAC|CHE PHU|PHA DO|VAN CHUYEN|XAY|TRAT|CHONG THAM|CAN NEN|BE TONG/.test(text)) return "rough";
  return "completion";
}

function materialCategoryGroupIdForName(name) {
  const text = catalogTextKey(name);
  if (/PHU KIEN|NOI THAT|DO DECOR|DECOR BEP|CHAN GA|DO THU CONG/.test(text)) return "material-interior";
  if (/THIET BI|CHIEU SANG|DEN|BEP|VE SINH/.test(text)) return "material-equipment";
  if (/VAT LIEU|HOAN THIEN|OP LAT|DA|SON|KEO|NEP|PHAO/.test(text)) return "material-finishing";
  return "material-other";
}

function normalizeCatalogCategoryGroups(input, categories, fallbackGroups, fallbackCategories, groupIdForName) {
  const categoryItems = catalogList(categories, fallbackCategories);
  const categoryByKey = new Map(categoryItems.map((item) => [catalogTextKey(item), item]));
  const metadata = new Map(fallbackGroups.map((group) => [group.id, { ...group, items: [] }]));
  if (Array.isArray(input)) {
    input.forEach((group) => {
      if (!group?.id || !metadata.has(group.id)) return;
      metadata.set(group.id, { ...metadata.get(group.id), ...group, items: [] });
    });
  }
  const definitions = fallbackGroups.map((group) => ({ ...metadata.get(group.id), items: [] }));
  const byId = new Map(definitions.map((group) => [group.id, group]));
  const seen = new Set();
  if (Array.isArray(input)) {
    input.forEach((group) => {
      const target = byId.get(group?.id);
      if (!target) return;
      (Array.isArray(group.items) ? group.items : []).forEach((item) => {
        const key = catalogTextKey(item);
        const canonical = categoryByKey.get(key);
        if (!canonical || seen.has(key)) return;
        target.items.push(canonical);
        seen.add(key);
      });
    });
  }
  categoryItems.forEach((item) => {
    const key = catalogTextKey(item);
    if (seen.has(key)) return;
    const target = byId.get(groupIdForName(item)) || definitions[definitions.length - 1];
    target.items.push(item);
    seen.add(key);
  });
  return definitions;
}

function normalizeConstructionCategoryGroups(input, categories) {
  return normalizeCatalogCategoryGroups(input, categories, catalogSeed.constructionCategoryGroups, catalogSeed.constructionCategories, constructionCategoryGroupIdForName);
}

function normalizeMaterialCategoryGroups(input, categories) {
  return normalizeCatalogCategoryGroups(input, categories, catalogSeed.materialCategoryGroups, catalogSeed.materialCategories, materialCategoryGroupIdForName);
}

function financeProjectCodeDefaults() {
  const finance = readJsonFile(financeFile, financeSeed);
  const projectRows = Array.isArray(finance.projects) ? finance.projects : [];
  const projectTransactions = (Array.isArray(finance.transactions) ? finance.transactions : [])
    .filter((row) => row?.[2] === "DỰ ÁN")
    .map((row) => row?.[3]);
  const financeCodes = catalogList([...projectRows.map((row) => row?.[0]), ...projectTransactions], catalogSeed.projectList);
  if (financeCodes.length) return financeCodes;
  return catalogList(activeProjectList(projects).map((project) => project.code || project.name), catalogSeed.projectList);
}

function staffCatalogList() {
  const people = new Map();
  readOrgStaff().forEach((staff) => {
    const id = String(staff?.[0] || "").trim();
    const name = String(staff?.[1] || "").replace(/\s+/g, " ").trim();
    if (!name) return;
    const key = personKey(name) || id;
    if (!people.has(key)) people.set(key, name);
  });
  return [...people.values()];
}

function normalizeCatalog(input = {}) {
  const projectDefaults = financeProjectCodeDefaults();
  const constructionCategories = catalogList(input.constructionCategories, catalogSeed.constructionCategories);
  const materialCategories = catalogList(input.materialCategories, catalogSeed.materialCategories);
  return {
    projectList: catalogList(Array.isArray(input.projectList) && input.projectList.length ? input.projectList : null, projectDefaults),
    staffList: staffCatalogList(),
    constructionCategories,
    constructionCategoryGroups: normalizeConstructionCategoryGroups(input.constructionCategoryGroups, constructionCategories),
    designCategories: catalogList(input.designCategories, catalogSeed.designCategories),
    materialCategories,
    materialCategoryGroups: normalizeMaterialCategoryGroups(input.materialCategoryGroups, materialCategories),
    contractTypes: catalogList(input.contractTypes, catalogSeed.contractTypes),
    designContractTypes: catalogList(input.designContractTypes, catalogSeed.designContractTypes),
    constructionContractTypes: catalogList(input.constructionContractTypes, catalogSeed.constructionContractTypes),
    subcontractTypes: catalogList(input.subcontractTypes, catalogSeed.subcontractTypes),
    voucherTypes: catalogList(input.voucherTypes, catalogSeed.voucherTypes),
    overtimeVoucherTypes: catalogList(input.overtimeVoucherTypes, catalogSeed.overtimeVoucherTypes),
    paymentVoucherTypes: catalogList(input.paymentVoucherTypes, catalogSeed.paymentVoucherTypes),
    attendanceVoucherTypes: catalogList(input.attendanceVoucherTypes, catalogSeed.attendanceVoucherTypes),
    inventoryReceiptTypes: catalogList(input.inventoryReceiptTypes, catalogSeed.inventoryReceiptTypes),
    inventoryIssueTypes: catalogList(input.inventoryIssueTypes, catalogSeed.inventoryIssueTypes),
    warehouseList: catalogList(input.warehouseList, catalogSeed.warehouseList),
    cdtChangeRequestTypes: catalogList(input.cdtChangeRequestTypes, catalogSeed.cdtChangeRequestTypes),
    cdtNoteRequestTypes: catalogList(input.cdtNoteRequestTypes, catalogSeed.cdtNoteRequestTypes),
    cdtApprovalRequestTypes: catalogList(input.cdtApprovalRequestTypes, catalogSeed.cdtApprovalRequestTypes),
    incidentIssueTypes: catalogList(input.incidentIssueTypes, catalogSeed.incidentIssueTypes),
    listTitles: catalogListTitles(input.listTitles)
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

const configDocumentsSeed = [
  ["GT001","Giấy phép kinh doanh.pdf","PDF","Pháp lý công ty","Đăng ký doanh nghiệp","DINH Công Hoàng","2026-06-03",0,"Ban lãnh đạo","Bản lưu pháp lý công ty"],
  ["GT002","Mẫu hợp đồng nhận thầu.docx","Word","Mẫu biểu","Hợp đồng","DINH Công Hoàng","2026-06-02",0,"Toàn công ty","Mẫu dùng khi lập hợp đồng nhận thầu"],
  ["GT003","Biểu mẫu nghiệm thu.xlsx","Excel","Mẫu biểu","Nghiệm thu","DINH Công Hoàng","2026-06-01",0,"Thiết kế, Thi công","Bảng mẫu tổng hợp nghiệm thu"],
  ["GT004","Slide giới thiệu năng lực.pptx","PowerPoint","Hồ sơ năng lực","Công ty","DINH Công Hoàng","2026-05-30",0,"Toàn công ty","File trình bày năng lực Le Dome"]
];

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
const materialsSeed = [
  { id: "VT001", date: "2026-05-14", item: "Khóa từ", category: "THIẾT BỊ", supplier: "NCC HOMEKIT", quantity: 1, unit: "bộ", locationType: "Kho dự án", location: "6ATS", project: "6ATS", status: "Đã nhận", note: "Nhận từ NCC, chờ lắp đặt" },
  { id: "VT002", date: "2026-05-15", item: "Ổ cắm 3 mặt", category: "THIẾT BỊ Ổ CẮM CÔNG TẮC", supplier: "NCC QUANG PANA", quantity: 7, unit: "cái", locationType: "Kho dự án", location: "6ATS", project: "6ATS", status: "Đã nhận", note: "Phát sinh theo công trường" },
  { id: "VT003", date: "2026-05-18", item: "Bơm tăng áp vệ sinh", category: "THIẾT BỊ ĐIỆN", supplier: "KHÁC", quantity: 1, unit: "cái", locationType: "Kho VP", location: "Văn phòng Le Dome", project: "", status: "Lưu kho", note: "Chờ điều chuyển" },
  { id: "VT004", date: "2026-05-25", item: "Khay inox", category: "KIM LOẠI", supplier: "KHÁC", quantity: 1, unit: "bộ", locationType: "Kho dự án", location: "6ATS", project: "6ATS", status: "Đã xuất dùng", note: "Mua vật tư bổ sung" }
];

function normalizeMaterialRow(row = {}, index = 0) {
  const source = Array.isArray(row)
    ? { id: row[0], date: row[1], item: row[2], category: row[3], supplier: row[4], quantity: row[5], unit: row[6], locationType: row[7], location: row[8], project: row[9], status: row[10], note: row[11] }
    : row;
  return {
    id: String(source.id || `VT${String(index + 1).padStart(3, "0")}`).trim(),
    date: String(source.date || "").trim(),
    item: String(source.item || "").trim(),
    category: String(source.category || "").trim(),
    supplier: String(source.supplier || "").trim(),
    quantity: Number(source.quantity || 0),
    unit: String(source.unit || "").trim(),
    locationType: source.locationType === "Kho dự án" ? "Kho dự án" : "Kho VP",
    location: String(source.location || "").trim(),
    project: String(source.project || "").trim(),
    status: ["Đã nhận", "Lưu kho", "Đã xuất dùng", "Cần kiểm tra"].includes(source.status) ? source.status : "Đã nhận",
    note: String(source.note || "").trim()
  };
}

function readMaterials() {
  return readJsonFile(materialsFile, materialsSeed).map(normalizeMaterialRow).filter((row) => row.item);
}

function writeMaterials(rows) {
  writeJsonAtomic(materialsFile, (Array.isArray(rows) ? rows : []).map(normalizeMaterialRow).filter((row) => row.item));
}

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
function repairConfigDocumentRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row, index) => {
    const next = Array.isArray(row) ? [...row] : [];
    next[0] = String(next[0] || `GT${String(index + 1).padStart(3, "0")}`);
    next[1] = String(next[1] || "Giấy tờ chưa đặt tên");
    next[2] = String(next[2] || "File");
    next[3] = String(next[3] || "Giấy tờ");
    next[4] = String(next[4] || "Chưa phân loại");
    next[5] = String(next[5] || "LE DOME");
    next[6] = String(next[6] || new Date().toISOString().slice(0, 10));
    next[7] = Number(next[7] || 0);
    next[8] = String(next[8] || "Toàn công ty");
    next[9] = String(next[9] || "");
    next[10] = next[10] ? safeFileName(next[10]) : "";
    next[11] = String(next[11] || "");
    return next;
  });
}
function readConfigDocuments() { return repairConfigDocumentRows(readJsonFile(configDocumentsFile, configDocumentsSeed)); }
function writeConfigDocuments(data) { writeJsonAtomic(configDocumentsFile, repairConfigDocumentRows(data)); }
function readOrgStaff() { return readJsonFile(orgStaffFile, orgStaffSeed); }
function writeOrgStaff(data) { writeJsonAtomic(orgStaffFile, data); }
function attendanceEmployeeOptions() {
  const people = new Map();
  readOrgStaff().forEach((staff) => {
    const id = String(staff[0] || "").trim();
    const name = String(staff[1] || "").trim();
    if (!id || !name) return;
    const key = personKey(name) || id;
    if (!people.has(key)) people.set(key, { id, name });
  });
  return [...people.values()];
}
function readDiaryReports() { return readJsonFile(diaryReportsFile, {}); }
function writeDiaryReports(data) { writeJsonAtomic(diaryReportsFile, data); }
function readProjectChat() { return readJsonFile(projectChatFile, {}); }
function writeProjectChat(data) { writeJsonAtomic(projectChatFile, data); }
function readTeamChat() {
  const rows = readJsonFile(teamChatFile, []);
  return Array.isArray(rows) ? rows.slice(-200) : [];
}
function writeTeamChat(rows) {
  writeJsonAtomic(teamChatFile, (Array.isArray(rows) ? rows : []).slice(-200));
}
function projectChatPublicMessage(projectId, message) {
  if (message?.revokedAt) return { ...message, text: "", attachments: [], attachmentExpired: false };
  const sourceAttachments = Array.isArray(message?.attachments) ? message.attachments : [];
  const attachments = sourceAttachments.map((attachment) => {
    const info = projectChatFileTarget(projectId, attachment.storedName);
    if (!info) return null;
    return {
      storedName: info.storedName,
      name: attachment.name || info.displayName,
      category: attachment.category || info.category,
      size: Number(attachment.size || info.size) || 0,
      uploadedAt: attachment.uploadedAt || info.updatedAt,
      expiresAt: info.expiresAt,
      url: projectChatFileUrl(projectId, info.storedName),
      previewUrl: projectChatPreviewUrl(projectId, info.storedName)
    };
  }).filter(Boolean);
  return { ...message, attachments, attachmentExpired: sourceAttachments.length > 0 && attachments.length === 0 };
}
function projectChatMessages(projectId) {
  const data = readProjectChat();
  const rows = data[String(projectId || "")];
  if (!Array.isArray(rows)) return [];
  const messages = rows.map((message) => projectChatPublicMessage(projectId, message)).slice(-200);
  if (JSON.stringify(rows) !== JSON.stringify(messages)) {
    data[String(projectId || "")] = messages;
    writeProjectChat(data);
  }
  return messages;
}
function teamChatPublicMessage(message) {
  const sourceAttachments = Array.isArray(message?.attachments) ? message.attachments : [];
  const attachments = sourceAttachments.map((attachment) => {
    const info = teamChatFileTarget(attachment.storedName);
    if (!info) return null;
    return {
      storedName: info.storedName,
      name: attachment.name || info.displayName,
      category: attachment.category || info.category,
      size: Number(attachment.size || info.size) || 0,
      uploadedAt: attachment.uploadedAt || info.updatedAt,
      expiresAt: info.expiresAt,
      url: teamChatFileUrl(info.storedName),
      previewUrl: teamChatPreviewUrl(info.storedName)
    };
  }).filter(Boolean);
  return { ...message, attachments, attachmentExpired: sourceAttachments.length > 0 && attachments.length === 0 };
}
function teamChatMessages() {
  const rows = readTeamChat();
  const messages = rows.map(teamChatPublicMessage);
  if (JSON.stringify(rows) !== JSON.stringify(messages)) writeTeamChat(messages);
  return messages;
}

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
      const currentByPosition = new Map(readAccounts().map((account) => [accountRecordKey(account), account]));
      const accounts = Array.isArray(input.accounts) ? input.accounts.map((account) => {
        const current = currentByPosition.get(accountRecordKey(account)) || {};
        const raw = {
          ...current,
          ...account,
          positionCode: String(account.positionCode || account.staffCode || current.positionCode || current.staffCode || "").trim(),
          loginId: String(account.loginId || "").trim(),
          active: Boolean(account.active)
        };
        const next = { ...raw, ...normalizeAccountAccess(raw) };
        if (String(account.newPassword || "").trim()) Object.assign(next, hashPassword(account.newPassword));
        delete next.password;
        delete next.newPassword;
        return next;
      }).filter((account) => account.staffCode && account.positionCode && account.loginId) : [];
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
  if (pathname === "/api/v1/config-documents") {
    if (req.method === "GET") {
      if (!requireAccount(req, res, "config")) return;
      return json(res, 200, { data: readConfigDocuments() });
    }
    if (req.method === "PATCH") {
      if (!requireAccount(req, res, "config")) return;
      return readJson(req, (error, input) => {
        if (error) return json(res, 400, { error: error.message });
        const data = Array.isArray(input.files) ? input.files : [];
        writeConfigDocuments(data);
        return json(res, 200, { data: readConfigDocuments() });
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
  if (pathname === "/api/v1/materials") {
    if (req.method === "GET") {
      if (!requireAccount(req, res, "materials.view")) return;
      const data = readMaterials();
      return json(res, 200, { data, total: data.length });
    }
    if (req.method === "PATCH") {
      if (!requireAccount(req, res, "materials.edit")) return;
      return readJson(req, (error, input) => {
        if (error) return json(res, 400, { error: error.message });
        const data = Array.isArray(input.rows) ? input.rows.map(normalizeMaterialRow).filter((row) => row.item) : [];
        writeMaterials(data);
        return json(res, 200, { data, total: data.length });
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
  if (pathname === "/api/v1/config-document-files") {
    if (req.method === "GET") {
      if (!requireAccount(req, res, "config")) return;
      return json(res, 200, { data: listConfigDocumentStoredFiles() });
    }
    if (req.method === "POST") {
      if (!requireAccount(req, res, "config")) return;
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const name = safeFileName(url.searchParams.get("name"));
      if (!name) return json(res, 400, { error: "File name is required" });
      const uploadError = validateUploadName(name);
      if (uploadError) return json(res, 400, { error: uploadError });
      fs.mkdirSync(configDocumentFilesDir, { recursive: true });
      const storedName = `configdoc__${Date.now()}-${crypto.randomBytes(4).toString("hex")}__${name}`;
      const target = path.join(configDocumentFilesDir, storedName);
      return handleUpload(req, res, target, () => json(res, 201, listConfigDocumentStoredFiles().find((item) => item.storedName === storedName)));
    }
    if (req.method === "DELETE") {
      if (!requireAccount(req, res, "config")) return;
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const storedName = safeFileName(url.searchParams.get("storedName"));
      const target = path.join(configDocumentFilesDir, storedName);
      if (storedName && fs.existsSync(target)) fs.unlinkSync(target);
      return json(res, 200, { ok: true });
    }
  }
  if (pathname === "/api/v1/config-document-files/view" && req.method === "GET") {
    if (!requireAccount(req, res, "config")) return;
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const info = configDocumentStoredTarget(url.searchParams.get("storedName"));
    if (!info) return json(res, 404, { error: "File not found" });
    return sendDriveStoredFile(res, info, "inline");
  }
  if (pathname === "/api/v1/config-document-files/preview" && req.method === "GET") {
    if (!requireAccount(req, res, "config")) return;
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const info = configDocumentStoredTarget(url.searchParams.get("storedName"));
    if (!info) return json(res, 404, { error: "File not found" });
    try {
      return json(res, 200, { data: previewOfficeFile(info) });
    } catch {
      return json(res, 422, { error: "Unable to preview this file" });
    }
  }
  if (pathname === "/api/v1/config-document-files/download" && req.method === "GET") {
    if (!requireAccount(req, res, "config")) return;
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const info = configDocumentStoredTarget(url.searchParams.get("storedName"));
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
  const projectChatFileViewMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/chat\/file$/);
  if (projectChatFileViewMatch && req.method === "GET") {
    const projectId = projectChatFileViewMatch[1];
    const project = projectDetail[projectId] || dashboardProjects.find((item) => item.id === projectId);
    if (!project) return json(res, 404, { error: "Project not found" });
    if (!requireAccount(req, res, "projects.view")) return;
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const info = projectChatFileTarget(projectId, url.searchParams.get("storedName"));
    if (!info) return json(res, 404, { error: "File not found or expired" });
    return sendProjectChatFile(res, info, url.searchParams.get("download") ? "attachment" : "inline");
  }
  const projectChatFilePreviewMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/chat\/file\/preview$/);
  if (projectChatFilePreviewMatch && req.method === "GET") {
    const projectId = projectChatFilePreviewMatch[1];
    const project = projectDetail[projectId] || dashboardProjects.find((item) => item.id === projectId);
    if (!project) return json(res, 404, { error: "Project not found" });
    if (!requireAccount(req, res, "projects.view")) return;
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const info = projectChatFileTarget(projectId, url.searchParams.get("storedName"));
    if (!info) return json(res, 404, { error: "File not found or expired" });
    try {
      return json(res, 200, { data: previewOfficeFile(info) });
    } catch {
      return json(res, 422, { error: "Unable to preview this file" });
    }
  }
  const projectChatUploadMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/chat\/files$/);
  if (projectChatUploadMatch && req.method === "POST") {
    const projectId = projectChatUploadMatch[1];
    const project = projectDetail[projectId] || dashboardProjects.find((item) => item.id === projectId);
    if (!project) return json(res, 404, { error: "Project not found" });
    const account = requireAccount(req, res, "projects.upload");
    if (!account) return;
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const name = safeFileName(url.searchParams.get("name"));
    if (!name) return json(res, 400, { error: "File name is required" });
    const uploadError = validateUploadName(name);
    if (uploadError) return json(res, 400, { error: uploadError });
    const dir = projectChatProjectDir(projectId);
    fs.mkdirSync(dir, { recursive: true });
    const storedName = `chat__${Date.now()}-${crypto.randomBytes(4).toString("hex")}__${name}`;
    const target = path.join(dir, storedName);
    return handleUpload(req, res, target, () => {
      const stats = fs.statSync(target);
      const attachment = {
        storedName,
        name,
        category: fileCategory(name),
        size: stats.size,
        uploadedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + chatFileRetentionMs).toISOString(),
        url: projectChatFileUrl(projectId, storedName),
        previewUrl: projectChatPreviewUrl(projectId, storedName)
      };
      const data = readProjectChat();
      const list = Array.isArray(data[projectId]) ? data[projectId] : [];
      const message = {
        id: `msg-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        projectId,
        author: account.staffName || account.loginId || "User",
        loginId: account.loginId,
        staffCode: account.staffCode,
        text: String(url.searchParams.get("text") || "").trim().slice(0, 2000),
        attachments: [attachment],
        createdAt: new Date().toISOString()
      };
      data[projectId] = [...list, message].slice(-200);
      writeProjectChat(data);
      return json(res, 201, projectChatPublicMessage(projectId, message));
    });
  }
  const projectChatRevokeMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/chat\/([^/]+)$/);
  if (projectChatRevokeMatch && req.method === "DELETE") {
    const [, projectId, messageId] = projectChatRevokeMatch;
    const project = projectDetail[projectId] || dashboardProjects.find((item) => item.id === projectId);
    if (!project) return json(res, 404, { error: "Project not found" });
    const account = requireAccount(req, res, "projects.view");
    if (!account) return;
    const data = readProjectChat();
    const list = Array.isArray(data[projectId]) ? data[projectId] : [];
    const index = list.findIndex((message) => message.id === messageId);
    if (index < 0) return json(res, 404, { error: "Message not found" });
    const message = list[index];
    const canRevoke = String(message.loginId || "").toLowerCase() === String(account.loginId || "").toLowerCase() || hasPermission(account, "projects.edit") || hasPermission(account, "config.accounts");
    if (!canRevoke) return json(res, 403, { error: "Không có quyền thu hồi tin nhắn này" });
    (Array.isArray(message.attachments) ? message.attachments : []).forEach((attachment) => {
      const clean = safeFileName(attachment.storedName);
      if (!clean) return;
      try { fs.rmSync(path.join(projectChatProjectDir(projectId), clean), { force: true }); } catch {}
    });
    list[index] = { ...message, text: "", attachments: [], revokedAt: message.revokedAt || new Date().toISOString(), revokedBy: account.loginId };
    data[projectId] = list;
    writeProjectChat(data);
    return json(res, 200, { data: projectChatPublicMessage(projectId, list[index]) });
  }
  const projectChatMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/chat$/);
  if (projectChatMatch) {
    const projectId = projectChatMatch[1];
    const project = projectDetail[projectId] || dashboardProjects.find((item) => item.id === projectId);
    if (!project) return json(res, 404, { error: "Project not found" });
    const account = requireAccount(req, res, "projects.view");
    if (!account) return;
    if (req.method === "GET") return json(res, 200, { data: projectChatMessages(projectId) });
    if (req.method === "POST") {
      return readJson(req, (error, input) => {
        if (error) return json(res, 400, { error: error.message });
        const text = String(input.text || "").trim().slice(0, 2000);
        if (!text) return json(res, 400, { error: "Message text is required" });
        const data = readProjectChat();
        const list = Array.isArray(data[projectId]) ? data[projectId] : [];
        const message = {
          id: `msg-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
          projectId,
          author: account.staffName || account.loginId || "User",
          loginId: account.loginId,
          staffCode: account.staffCode,
          text,
          attachments: [],
          createdAt: new Date().toISOString()
        };
        data[projectId] = [...list, message].slice(-200);
        writeProjectChat(data);
        return json(res, 201, message);
      });
    }
    return json(res, 405, { error: "Method not allowed" });
  }
  const mutatingRequest = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  const requiredPermission = permissionForRequest(pathname, req.method);
  if (mutatingRequest && requiredPermission && !requireAccount(req, res, requiredPermission)) return;
  if (/\/download$/.test(pathname) && requiredPermission && !requireAccount(req, res, requiredPermission)) return;
  if (pathname === "/api/v1/team-chat/file" && req.method === "GET") {
    const account = requireAccount(req, res);
    if (!account) return;
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const info = teamChatFileTarget(url.searchParams.get("storedName"));
    if (!info) return json(res, 404, { error: "File not found or expired" });
    return sendTeamChatFile(res, info, url.searchParams.get("download") ? "attachment" : "inline");
  }
  if (pathname === "/api/v1/team-chat/file/preview" && req.method === "GET") {
    const account = requireAccount(req, res);
    if (!account) return;
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const info = teamChatFileTarget(url.searchParams.get("storedName"));
    if (!info) return json(res, 404, { error: "File not found or expired" });
    try {
      return json(res, 200, { data: previewOfficeFile(info) });
    } catch {
      return json(res, 422, { error: "Unable to preview this file" });
    }
  }
  if (pathname === "/api/v1/team-chat/files" && req.method === "POST") {
    const account = requireAccount(req, res);
    if (!account) return;
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const name = safeFileName(url.searchParams.get("name"));
    if (!name) return json(res, 400, { error: "File name is required" });
    const uploadError = validateUploadName(name);
    if (uploadError) return json(res, 400, { error: uploadError });
    fs.mkdirSync(teamChatDir(), { recursive: true });
    const storedName = `teamchat__${Date.now()}-${crypto.randomBytes(4).toString("hex")}__${name}`;
    const target = path.join(teamChatDir(), storedName);
    return handleUpload(req, res, target, () => {
      const stats = fs.statSync(target);
      const attachment = {
        storedName,
        name,
        category: fileCategory(name),
        size: stats.size,
        uploadedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + chatFileRetentionMs).toISOString(),
        url: teamChatFileUrl(storedName),
        previewUrl: teamChatPreviewUrl(storedName)
      };
      const rows = readTeamChat();
      const message = {
        id: `team-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        channel: "dashboard",
        source: "member",
        author: account.staffName || account.loginId || "User",
        loginId: account.loginId,
        staffCode: account.staffCode,
        text: String(url.searchParams.get("text") || "").trim().slice(0, 2000),
        attachments: [attachment],
        createdAt: new Date().toISOString()
      };
      writeTeamChat([...rows, message]);
      return json(res, 201, teamChatPublicMessage(message));
    });
  }
  if (pathname === "/api/v1/team-chat") {
    const account = requireAccount(req, res);
    if (!account) return;
    if (req.method === "GET") return json(res, 200, { data: teamChatMessages() });
    if (req.method === "POST") {
      return readJson(req, (error, input) => {
        if (error) return json(res, 400, { error: error.message });
        const text = String(input.text || "").trim().slice(0, 2000);
        if (!text) return json(res, 400, { error: "Message text is required" });
        const rows = readTeamChat();
        const message = {
          id: `team-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
          channel: "dashboard",
          source: input.source === "agent" ? "agent" : "member",
          author: account.staffName || account.loginId || "User",
          loginId: account.loginId,
          staffCode: account.staffCode,
          text,
          attachments: [],
          createdAt: new Date().toISOString()
        };
        writeTeamChat([...rows, message]);
        return json(res, 201, message);
      });
    }
    return json(res, 405, { error: "Method not allowed" });
  }
  if (pathname === "/api/v1/navigation") return json(res, 200, navigation);
  if (pathname === "/api/v1/dashboard") return json(res, 200, dashboard);
  if (pathname === "/api/v1/dashboard/projects") return json(res, 200, { data: activeProjectList(dashboardProjects) });
  if (pathname === "/api/v1/insight") return json(res, 200, insight);
  if (pathname === "/api/v1/attendance/config" && req.method === "GET") {
    const account = requireAccount(req, res);
    if (!account) return;
    const employees = attendanceEmployeeOptions();
    const employee = employees.find((item) => item.id === account.staffCode);
    return json(res, 200, { sites: attendanceSiteOptions(), employees: employee ? [employee] : [] });
  }
  if (pathname === "/api/v1/attendance/records" && req.method === "GET") {
    const account = requireAccount(req, res);
    if (!account) return;
    const accountEmployeeId = String(account.staffCode || account.employeeId || "").trim();
    const data = hasPermission(account, "hrm.view") ? attendanceRecords : attendanceRecords.filter((record) => record.employeeId === accountEmployeeId);
    return json(res, 200, { data, total: data.length });
  }
  if (pathname === "/api/v1/attendance/check" && req.method === "POST") {
    const account = requireAccount(req, res);
    if (!account) return;
    readJson(req, (error, input) => {
      if (error) return json(res, 400, { error: error.message });
      const employee = attendanceEmployeeOptions().find((item) => item.id === input.employeeId);
      const site = attendanceSiteOptions().find((item) => item.id === input.siteId);
      const latitude = Number(input.latitude);
      const longitude = Number(input.longitude);
      const accuracy = Number(input.accuracy);
      const type = input.type === "check-out" ? "check-out" : "check-in";
      const accountEmployeeId = String(account.staffCode || account.employeeId || "").trim();
      const requestedEmployeeId = String(input.employeeId || "").trim();
      if (!accountEmployeeId || requestedEmployeeId !== accountEmployeeId) return json(res, 403, { error: "Không có quyền chấm công cho nhân sự khác" });
      if (!employee) return json(res, 400, { error: "Nhân sự không hợp lệ" });
      if (!site) return json(res, 400, { error: "Vị trí không hợp lệ" });
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return json(res, 400, { error: "Thiếu tọa độ GPS" });
      if (!Number.isFinite(accuracy) || accuracy > 150) return json(res, 400, { error: "GPS chưa đủ chính xác. Hãy bật định vị chính xác và thử lại." });
      if (!input.hasFacePhoto) return json(res, 400, { error: "Hãy chụp ảnh xác thực tại vị trí." });
      const hasGeofence = attendanceSiteHasGeofence(site);
      const distance = hasGeofence ? distanceMeters({ latitude, longitude }, site) : null;
      const insideGeofence = hasGeofence ? distance <= site.radiusMeters : false;
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
        geofenceRadiusMeters: hasGeofence ? site.radiusMeters : null,
        insideGeofence,
        gpsStatus: insideGeofence ? "Đạt" : "Không đạt",
        gpsNote: insideGeofence ? "GPS chuẩn vị trí trong phạm vi cho phép" : hasGeofence ? "GPS ngoài phạm vi cho phép" : "Điểm chấm công chưa có phạm vi GPS",
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
          type: String(input.type || "").trim(),
          buildingType: String(input.buildingType || "").trim(),
          group: String(input.group || "").trim(),
          owner: String(input.owner || "").trim(),
          location: String(input.location || "").trim(),
          manager: String(input.manager || "").trim(),
          commander: String(input.commander || "").trim(),
          qs: String(input.qs || "").trim(),
          accountant: String(input.accountant || "").trim(),
          progress: 0,
          status: String(input.status || "").trim(),
          health: String(input.health || "").trim(),
          startDate: String(input.startDate || "").trim(),
          endDate: String(input.endDate || "").trim(),
          duration: String(input.duration || "").trim(),
          budget: 0,
          spent: 0,
          description: String(input.description || "").trim()
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
      const kind = contractAllowedFileKind(requestedKind, "contract");
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
      const kind = contractAllowedFileKind(requestedKind, "contract");
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

  const contractDraftMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/contract-drafts\/([^/]+)$/);
  if (contractDraftMatch) {
    const projectId = contractDraftMatch[1];
    const type = contractDraftType(decodeURIComponent(contractDraftMatch[2]));
    if (!type) return json(res, 400, { error: "Invalid draft type" });
    if (req.method === "GET") return json(res, 200, { data: readContractDraft(projectId, type) });
    if (req.method === "PUT") {
      return readJson(req, (error, body) => {
        if (error) return json(res, 400, { error: error.message });
        return json(res, 200, { data: writeContractDraft(projectId, type, body.data || body) });
      });
    }
    if (req.method === "DELETE") {
      deleteContractDraft(projectId, type);
      return json(res, 200, { ok: true });
    }
  }

  const contractPdfMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/contract-files\/pdf$/);
  if (contractPdfMatch && req.method === "POST") {
    const projectId = contractPdfMatch[1];
    return readJson(req, async (error, body) => {
      if (error) return json(res, 400, { error: error.message });
      const kind = contractAllowedFileKind(body.kind, "quote");
      const rawName = safeFileName(body.name || `${kind}-${Date.now()}.pdf`);
      const name = /\.pdf$/i.test(rawName) ? rawName : `${rawName}.pdf`;
      if (!name) return json(res, 400, { error: "File name is required" });
      const uploadError = validateUploadName(name);
      if (uploadError) return json(res, 400, { error: uploadError });
      try {
        const dir = contractProjectDir(projectId);
        fs.mkdirSync(dir, { recursive: true });
        const storedName = `${kind}__${name}`;
        const target = path.join(dir, storedName);
        const pdf = await contractHtmlToPdfBuffer(body.html);
        fs.writeFileSync(target, pdf);
        return json(res, 201, contractFileResponseItem(projectId, storedName));
      } catch (pdfError) {
        return json(res, 500, { error: pdfError.message || "Unable to export PDF" });
      }
    });
  }

  const contractDownloadMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/contract-files\/download$/);
  if (contractDownloadMatch && req.method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const storedName = safeFileName(url.searchParams.get("storedName"));
    const target = path.join(contractProjectDir(contractDownloadMatch[1]), storedName);
    if (!storedName || !fs.existsSync(target)) return json(res, 404, { error: "File not found" });
    const originalName = storedName.includes("__") ? storedName.slice(storedName.indexOf("__") + 2) : storedName;
    const contentType = mime[path.extname(originalName).toLowerCase()] || "application/octet-stream";
    const inline = url.searchParams.get("download") !== "1";
    res.writeHead(200, {
      "content-type": contentType,
      "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(originalName)}`,
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
    const html = fs.readFileSync(filename, "utf8").replace(/\/construction\.js(?:\?v=\d+)?/g, "/construction.js?v=232");
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
