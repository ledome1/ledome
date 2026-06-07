const $ = (selector) => document.querySelector(selector);
const state = { position: null, photo: null, config: null, account: null, locating: false, watchId: null, records: [], submitting: false };

const api = (path, options = {}) => fetch(`/api/v1${path}`, { credentials: "same-origin", ...options }).then(async (response) => {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Không thể kết nối máy chủ");
  return body;
});

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
const isLocalhost = () => ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
const hasSecureBrowserFeatures = () => window.isSecureContext || isLocalhost();
const LAST_SITE_STORAGE = "ledome.attendance.lastSite.v1";
const secureFeatureMessage = "Domain chấm công phải chạy HTTPS để trình duyệt cho phép lấy GPS/camera. Localhost được phép, domain HTTP sẽ bị chặn.";

function renderLogin(message = "") {
  document.body.innerHTML = `<main>
    <header class="mobile-head"><img class="mobile-logo" src="/assets/ledome-logo-light.png" alt="LE DOME"><small>Đăng nhập chấm công</small></header>
    <section class="attendance-card">
      <form id="mobile-login">
        <label>ID đăng nhập<input name="loginId" autocomplete="username" required></label>
        <label>Mật khẩu<input name="password" type="password" autocomplete="current-password" required></label>
        ${message ? `<p class="notice error">${escapeHtml(message)}</p>` : `<p class="notice">Dùng tài khoản LE DOME để chấm công bằng GPS.</p>`}
        <button>Đăng nhập</button>
      </form>
    </section>
  </main>`;
  $("#mobile-login").onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data)
      });
      location.reload();
    } catch (error) {
      renderLogin(error.message);
    }
  };
}

async function ensureLogin() {
  try {
    const body = await api("/auth/me");
    state.account = body.account || null;
    return true;
  } catch {
    renderLogin();
    return false;
  }
}

function renderClock() {
  const now = new Date();
  $("#clock").textContent = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  $("#today").textContent = now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

function notice(message, type = "") {
  $("#notice").textContent = message;
  $("#notice").className = `notice ${type}`;
}

function siteOptionExists(siteId) {
  const id = String(siteId || "").trim();
  return Boolean(id && state.config?.sites?.some((site) => String(site.id) === id));
}

function latestRecordSiteId(employeeId, records = state.records) {
  const id = String(employeeId || "").trim();
  if (!id || !Array.isArray(records)) return "";
  let latestSiteId = "";
  let latestTime = -1;
  records.forEach((record) => {
    if (String(record.employeeId || "").trim() !== id || !record.siteId) return;
    const time = Date.parse(record.capturedAt || record.createdAt || record.date || "");
    const timestamp = Number.isFinite(time) ? time : 0;
    if (timestamp >= latestTime) {
      latestTime = timestamp;
      latestSiteId = String(record.siteId);
    }
  });
  return latestSiteId;
}

function storedSiteId(employeeId) {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_SITE_STORAGE) || "{}");
    return String(saved?.[String(employeeId || "").trim()] || "");
  } catch {
    return "";
  }
}

function rememberLastSite(employeeId, siteId) {
  const id = String(employeeId || "").trim();
  const site = String(siteId || "").trim();
  if (!id || !site) return;
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_SITE_STORAGE) || "{}");
    saved[id] = site;
    localStorage.setItem(LAST_SITE_STORAGE, JSON.stringify(saved));
  } catch {}
}

function applyPreferredSite(employeeId, records = state.records) {
  const preferredSiteId = [latestRecordSiteId(employeeId, records), storedSiteId(employeeId)].find(siteOptionExists);
  if (preferredSiteId) $("#site").value = preferredSiteId;
}

function gpsResult(record) {
  const rawDistance = record.distanceMeters;
  const distance = Number(rawDistance);
  const hasDistance = rawDistance !== null && rawDistance !== undefined && rawDistance !== "" && Number.isFinite(distance);
  const radius = Number(record.geofenceRadiusMeters ?? record.radiusMeters ?? record.attendanceRadiusMeters);
  const hasRadius = Number.isFinite(radius) && radius > 0;
  const passed = record.insideGeofence === true || record.gpsStatus === "Đạt";
  const note = passed ? "GPS chuẩn vị trí trong phạm vi cho phép" : record.gpsNote || (hasRadius ? "GPS ngoài phạm vi cho phép" : "Điểm chấm công chưa có phạm vi GPS");
  const detail = hasDistance ? `Cách ${Math.round(distance)} m${hasRadius ? ` / phạm vi ${Math.round(radius)} m` : ""}` : "Chưa có phạm vi GPS";
  return { status: passed ? "Đạt" : "Không đạt", note, detail };
}

function renderHistory(records) {
  $("#history").innerHTML = records.slice(0, 5).map((record) => {
    const gps = gpsResult(record);
    return `<article class="history-row"><div><b>${record.type === "check-in" ? "Check-in" : "Check-out"} · ${escapeHtml(record.siteName)}</b><span>${new Date(record.capturedAt).toLocaleString("vi-VN")} · GPS ${escapeHtml(gps.status)} · ${escapeHtml(gps.detail)}</span></div><i class="${gps.status === "Đạt" ? "" : "review"}">${escapeHtml(gps.status)}</i></article>`;
  }).join("") || `<p class="notice">Chưa có bản ghi chấm công.</p>`;
}

const gpsOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

function updateGpsMap(coords) {
  const latitude = Number(coords?.latitude);
  const longitude = Number(coords?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
  const query = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=18&output=embed`;
  const linkUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  $("#gps-map").src = mapUrl;
  $("#gps-map-link").href = linkUrl;
  $("#gps-map-frame").classList.add("located");
}

function setGpsPosition(position) {
  state.locating = false;
  state.position = position.coords;
  $("#gps-status").textContent = `Độ chính xác ±${Math.round(position.coords.accuracy)} m`;
  $("#gps-detail").textContent = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
  updateGpsMap(position.coords);
  notice("Đã tự động lấy vị trí GPS. Chụp ảnh và chọn Check-in hoặc Check-out.", "ok");
}

function setGpsError(error) {
  state.locating = false;
  $("#gps-status").textContent = "Không thể lấy vị trí";
  $("#gps-detail").textContent = "";
  $("#gps-map-frame").classList.remove("located");
  notice(error?.message || "Hãy cho phép truy cập vị trí GPS để chấm công.", "error");
}

function locate(force = false) {
  if (!hasSecureBrowserFeatures()) {
    $("#gps-status").textContent = "Domain chưa bật HTTPS";
    $("#gps-detail").textContent = "";
    return notice(secureFeatureMessage, "error");
  }
  if (!navigator.geolocation) return notice("Điện thoại không hỗ trợ GPS trên trình duyệt này.", "error");
  if (state.locating && !force) return;
  state.locating = true;
  notice("Đang tự động lấy vị trí GPS...", "");
  $("#gps-status").textContent = "Đang tự động định vị...";
  navigator.geolocation.getCurrentPosition(setGpsPosition, setGpsError, gpsOptions);
}

function startAutoLocation() {
  if (!navigator.geolocation) return locate(true);
  locate(true);
  if (state.watchId !== null) navigator.geolocation.clearWatch(state.watchId);
  state.watchId = navigator.geolocation.watchPosition(setGpsPosition, setGpsError, gpsOptions);
}

function setSubmitting(value) {
  state.submitting = value;
  document.querySelectorAll("[data-type]").forEach((button) => {
    button.disabled = value;
    button.classList.toggle("loading", value);
  });
}

function returnHomeAfterSubmit(record) {
  window.opener?.postMessage({ type: "ledome.attendance.submitted", recordId: record.id }, location.origin);
  try {
    localStorage.setItem("ledome.attendance.submitted", JSON.stringify({ id: record.id, at: Date.now() }));
  } catch {}
  setTimeout(() => {
    location.replace("/#projects");
  }, 700);
}

async function submit(type) {
  if (state.submitting) return;
  if (!hasSecureBrowserFeatures()) return notice(secureFeatureMessage, "error");
  if (!state.position) return notice("Hệ thống đang tự động lấy vị trí GPS. Hãy cho phép quyền vị trí trên trình duyệt.", "error");
  if (!state.photo) return notice("Hãy chụp ảnh xác thực tại vị trí.", "error");
  try {
    setSubmitting(true);
    notice("Đang gửi phiếu chấm công...", "");
    const record = await api("/attendance/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type,
        employeeId: $("#employee").value,
        siteId: $("#site").value,
        latitude: state.position.latitude,
        longitude: state.position.longitude,
        accuracy: state.position.accuracy,
        hasFacePhoto: true,
        device: navigator.userAgent
      })
    });
    rememberLastSite(record.employeeId || $("#employee").value, record.siteId || $("#site").value);
    const gps = gpsResult(record);
    const gpsText = `GPS ${gps.status}: ${gps.note}. ${gps.detail}`;
    const records = await api("/attendance/records");
    state.records = records.data;
    const employeeRecords = records.data.filter((item) => item.employeeId === $("#employee").value);
    applyPreferredSite($("#employee").value, employeeRecords);
    renderHistory(employeeRecords);
    if (!records.data.some((item) => item.id === record.id)) throw new Error("Phiếu đã gửi nhưng chưa xuất hiện trong Danh sách phiếu chấm công.");
    notice(`${type === "check-in" ? "Check-in" : "Check-out"} thành công. ${gpsText} · ${record.status}. Đang quay về trang chủ...`, gps.status === "Đạt" ? "ok" : "error");
    returnHomeAfterSubmit(record);
  } catch (error) {
    notice(error.message, "error");
    setSubmitting(false);
  }
}

async function init() {
  if (!await ensureLogin()) return;
  renderClock();
  setInterval(renderClock, 30000);
  const [config, records] = await Promise.all([api("/attendance/config"), api("/attendance/records")]);
  state.config = config;
  state.records = Array.isArray(records.data) ? records.data : [];
  const employee = state.config.employees[0] || { id: state.account?.staffCode || "", name: state.account?.staffName || "" };
  if (!employee.id) return notice("Tài khoản chưa được gán với nhân sự hợp lệ.", "error");
  $("#employee").value = employee.id;
  $("#employee-name").value = employee.name;
  $("#site").innerHTML = state.config.sites.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
  const employeeRecords = state.records.filter((item) => item.employeeId === employee.id);
  applyPreferredSite(employee.id, employeeRecords);
  $("#site").onchange = () => locate(true);
  $("#photo").onchange = (event) => {
    const [file] = event.target.files;
    if (!file) return;
    state.photo = file;
    $("#photo-label").textContent = `✓ Đã chụp ảnh: ${file.name}`;
    $("#photo-label").classList.add("ready");
    $("#photo-preview").src = URL.createObjectURL(file);
    $("#photo-preview").classList.add("open");
  };
  document.querySelectorAll("[data-type]").forEach((button) => button.onclick = () => submit(button.dataset.type));
  renderHistory(employeeRecords);
  startAutoLocation();
}

init().catch((error) => notice(error.message, "error"));
