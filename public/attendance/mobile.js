const $ = (selector) => document.querySelector(selector);
const state = { position: null, photo: null, config: null };

const api = (path, options = {}) => fetch(`/api/v1${path}`, { credentials: "same-origin", ...options }).then(async (response) => {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Không thể kết nối máy chủ");
  return body;
});

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));

function renderLogin(message = "") {
  document.body.innerHTML = `<main>
    <header class="mobile-head"><span class="brand-mark">LD</span><div><b>LE DOME</b><small>Đăng nhập chấm công</small></div></header>
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
    await api("/auth/me");
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

function renderHistory(records) {
  $("#history").innerHTML = records.slice(0, 5).map((record) => `<article class="history-row"><div><b>${record.type === "check-in" ? "Check-in" : "Check-out"} · ${escapeHtml(record.siteName)}</b><span>${new Date(record.capturedAt).toLocaleString("vi-VN")} · GPS ${record.distanceMeters} m</span></div><i class="${record.status === "Hợp lệ" ? "" : "review"}">${escapeHtml(record.status)}</i></article>`).join("") || `<p class="notice">Chưa có bản ghi chấm công.</p>`;
}

async function locate() {
  if (!navigator.geolocation) return notice("Điện thoại không hỗ trợ GPS trên trình duyệt này.", "error");
  $("#gps-status").textContent = "Đang định vị...";
  navigator.geolocation.getCurrentPosition((position) => {
    state.position = position.coords;
    $("#gps-status").textContent = `Độ chính xác ±${Math.round(position.coords.accuracy)} m`;
    $("#gps-detail").textContent = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
    notice("Đã lấy vị trí. Chụp ảnh và chọn Check-in hoặc Check-out.", "ok");
  }, (error) => {
    $("#gps-status").textContent = "Không thể lấy vị trí";
    notice(error.message || "Hãy cho phép truy cập vị trí GPS.", "error");
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
}

async function submit(type) {
  if (!state.position) return notice("Hãy lấy vị trí GPS trước khi chấm công.", "error");
  if (!state.photo) return notice("Hãy chụp ảnh xác thực tại công trình.", "error");
  try {
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
    notice(`${type === "check-in" ? "Check-in" : "Check-out"} thành công. GPS cách điểm công trình ${record.distanceMeters} m · ${record.status}.`, record.status === "Hợp lệ" ? "ok" : "error");
    const records = await api("/attendance/records");
    renderHistory(records.data.filter((item) => item.employeeId === $("#employee").value));
  } catch (error) {
    notice(error.message, "error");
  }
}

async function init() {
  if (!await ensureLogin()) return;
  renderClock();
  setInterval(renderClock, 30000);
  state.config = await api("/attendance/config");
  $("#employee").innerHTML = state.config.employees.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.id)} · ${escapeHtml(item.name)}</option>`).join("");
  $("#site").innerHTML = state.config.sites.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · bán kính ${item.radiusMeters} m</option>`).join("");
  $("#locate").onclick = locate;
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
  const records = await api("/attendance/records");
  renderHistory(records.data.filter((item) => item.employeeId === $("#employee").value));
  $("#employee").onchange = () => renderHistory(records.data.filter((item) => item.employeeId === $("#employee").value));
}

init().catch((error) => notice(error.message, "error"));
