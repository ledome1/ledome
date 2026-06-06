const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat("vi-VN").format(value);
const moneyInput = (value) => Number(value || 0).toLocaleString("vi-VN");
const parseMoneyInput = (value) => Number(String(value || "").replace(/[^\d]/g, "")) || 0;
const state = { page: location.hash.slice(1) || "projects", nav: [], account: null, customerId: "", customerQuery: "", customerFilter: "Tất cả", crmQuery: "", crmStatus: "Tất cả", crmSupplierCategory: "Tất cả", catalogType: "constructionCategories", catalogQuery: "", driveQuery: "", driveUploadMessage: "", financeQuery: "", financeKind: "Tất cả", financeFilterOpen: "", financeFilters: { type: [], group: [], topic: [], category: [], partner: [] }, personalQuery: "", personalKind: "Tất cả", navCollapsed: {} };
const AUTH_STORAGE = "ledome.auth.v1";
const LOGIN_REMEMBER_STORAGE = "ledome.login.remember.v1";
const NAV_COLLAPSE_STORAGE = "ledome.navCollapsed.v1";
const FINANCE_STORAGE = "ledome.finance.v1";
const PERSONAL_FINANCE_STORAGE = "ledome.personalFinance.v1";
const MODULE_PERMISSION = {
  projects: "projects", "projects-overview": "projects", insight: "projects", drive: "projects", tasks: "projects", approval: "projects", fleet: "projects",
  "partners-overview": "partners", customers: "partners", contractors: "partners", suppliers: "partners",
  "hrm-overview": "hrm", "hrm-staff": "hrm", "hrm-attendance": "hrm", "hrm-payroll": "hrm",
  "finance-overview": "finance", "finance-ledome": "finance", "finance-projects": "finance",
  "personal-finance-overview": "personalFinance", "personal-finance-transactions": "personalFinance", "personal-finance-budget": "personalFinance", "personal-finance-report": "personalFinance",
  catalog: "config", materials: "config", processes: "config", standards: "config", accounts: "config"
};
const pageTitles = { home: "DASHBOARD", insight: "INSIGHT", projects: "❖ Danh sách dự án", "projects-overview": "▣ Tổng quan dự án", drive: "▰ LE DOME DRIVE", "partners-overview": "▣ Tổng quan đối tác", customers: "♟ Khách hàng", contractors: "▣ Nhà thầu", suppliers: "▤ Nhà cung cấp", "hrm-overview": "▣ Tổng quan nhân sự", "hrm-staff": "♟ Nhân sự", "hrm-attendance": "▣ Chấm công", "hrm-payroll": "$ Lương", "finance-overview": "▣ Tổng quan", "finance-ledome": "▣ Vận hành", "finance-projects": "▤ Dự án", "personal-finance-overview": "◈ Tài chính cá nhân", "personal-finance-transactions": "▤ Giao dịch cá nhân", "personal-finance-budget": "▣ Ngân sách tháng", "personal-finance-report": "◉ Báo cáo tháng", catalog: "▰ Cơ sở dữ liệu", materials: "▰ Kho", processes: "▰ Quy trình", standards: "▰ Quy chuẩn", accounts: "▣ Tài khoản" };
const api = (url, options = {}) => fetch(`/api/v1${url}`, { credentials: "same-origin", ...options }).then(async (res) => {
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `API ${res.status}`);
  return body;
});
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
const NOTIFICATIONS = [
  { audience: ["all"], title: "Họp giao ban Le Dome sẽ bắt đầu lúc 14:00 hôm nay.", time: "13 giờ trước", unread: true, avatar: "LD" },
  { audience: ["projects"], title: "Cập nhật tiến độ [Mẫu] Nội thất cần kiểm tra trước khi chốt ngày.", time: "1 ngày trước", unread: true, avatar: "DA" },
  { audience: ["finance"], title: "Có phiếu thu/chi mới cần đối soát trong mục Tài chính.", time: "2 ngày trước", unread: true, avatar: "TC" },
  { audience: ["hrm"], title: "Bản ghi chấm công GPS cần duyệt trong hôm nay.", time: "2 ngày trước", unread: false, avatar: "NS" },
  { audience: ["config"], title: "Danh sách tài khoản đã được cập nhật theo nhân sự thật và vị trí kiêm nhiệm.", time: "3 ngày trước", unread: true, avatar: "CH" }
];
const ui = { sortBy: "updated", sortDir: "desc", dateType: "all", dateRange: "Mọi lúc", hiddenWelcome: false };
const isFinalSettlementProject = (project) => String(project?.projectStage || "").trim() === "final-settlement";
const activeProjectsOnly = (items = []) => items.filter((project) => !isFinalSettlementProject(project));
const PROJECT_NAV_FALLBACK = [
  ["▰  Khu phức hợp Riverside", "project/p1"],
  ["▰  Nhà máy điện tử Đông Nam", "project/p2"],
  ["▰  Cầu vượt tuyến vành đai", "project/p3"]
];
let projectNavItems = null;

function setTitle(page, subtitle = "") {
  $("#title").textContent = pageTitles[page] || state.nav.find((x) => x[1] === page)?.[0] || "Ledome-MGMT";
  $("#subtitle").textContent = subtitle;
}

function permissionForPage(page) {
  if (page === "home" || page.startsWith("project/")) return "projects";
  return MODULE_PERMISSION[page] || "projects";
}

function canAccessPersonalFinance() {
  return Boolean(state.account?.permissions?.personalFinance || state.account?.permissions?.["personalFinance.view"]);
}

function canAccess(page) {
  if (permissionForPage(page) === "personalFinance") return canAccessPersonalFinance();
  return Boolean(state.account?.permissions?.[permissionForPage(page)]);
}

function openProjectDetail(id) {
  location.href = `/constructions/detail/${id}/`;
}

function updateUserChrome() {
  const name = state.account?.staffName || "";
  const role = state.account?.role || "";
  const initials = name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "LD";
  document.querySelectorAll(".avatar").forEach((avatar) => { avatar.textContent = initials; });
  const profile = document.querySelector(".profile div");
  if (profile) profile.innerHTML = `<b>${name}</b><small>${role}</small><button data-auth="logout">Đăng xuất</button>`;
  renderNotifications();
}

function accountNotifications() {
  const account = state.account;
  if (!account) return [];
  const enabled = Object.entries(account.permissions || {}).filter(([, value]) => value).map(([key]) => key);
  return NOTIFICATIONS.filter((item) => item.audience.includes("all") || item.audience.some((key) => enabled.includes(key)) || item.audience.includes(account.staffCode));
}

function renderNotifications() {
  const panel = $("#notification-panel");
  const counter = $("#notification-count");
  if (!panel || !counter) return;
  const items = accountNotifications();
  const unread = items.filter((item) => item.unread).length;
  counter.textContent = unread;
  counter.hidden = unread === 0;
  panel.innerHTML = `<h2>Thông báo</h2><div class="notification-tabs"><button>Tất cả</button><button>Chưa đọc</button></div><div class="notification-list">${items.map((item) => `<article class="${item.unread ? "unread" : ""}"><b>${item.avatar}</b><span>${item.title}<small>◉ ${item.time}</small></span><i></i></article>`).join("") || `<p>Không có thông báo liên quan.</p>`}</div><button class="notification-all">Xem tất cả</button>`;
}

function renderNav() {
  const activeProjects = Array.isArray(projectNavItems) ? projectNavItems : PROJECT_NAV_FALLBACK;
  const groups = [
    ["", [["⌕  Tìm kiếm dự án...", "projects"], ["◉  INSIGHT", "insight"], ["▰  LE DOME DRIVE", "drive"]]],
    ["DỰ ÁN", [["▣  Tổng quan", "projects-overview"], ...activeProjects]],
    ["ĐỐI TÁC", [["▣  Tổng quan", "partners-overview"], ["♟  Khách hàng", "customers"], ["▣  Nhà thầu", "contractors"], ["▤  Nhà cung cấp", "suppliers"]]],
    ["NHÂN SỰ", [["▣  Tổng quan", "hrm-overview"], ["♟  Nhân sự", "hrm-staff"], ["▣  Chấm công", "hrm-attendance"], ["$  Lương", "hrm-payroll"]]],
    ["TÀI CHÍNH", [["▣  Tổng quan", "finance-overview"], ["▣  Vận hành", "finance-ledome"], ["▤  Dự án", "finance-projects"]]],
    ["CẤU HÌNH", [["▰  Cơ sở dữ liệu", "catalog"], ["▰  Kho", "materials"], ["▰  Quy trình", "processes"], ["▰  Quy chuẩn", "standards"], ["▣  Tài khoản", "accounts"]]],
    ["", [["✣  DỰ ÁN MẪU", "projects"], ["⊘  DỰ ÁN ĐÓNG", "projects"]]],
    ["TÀI CHÍNH CÁ NHÂN", [["◈  Tổng quan", "personal-finance-overview"], ["▤  Giao dịch", "personal-finance-transactions"], ["▣  Ngân sách tháng", "personal-finance-budget"], ["◉  Báo cáo tháng", "personal-finance-report"]]]
  ].map(([group, items]) => [group, items.filter(([, id]) => canAccess(id))]).filter(([, items]) => items.length);
  $("#nav").innerHTML = groups.map(([group, items], index) => {
    const key = group || `ungrouped-${index}`;
    const collapsed = Boolean(group && state.navCollapsed[key]);
    const header = group ? `<h4 class="${group === "TÀI CHÍNH CÁ NHÂN" ? "personal-nav-group" : ""}"><button type="button" data-nav-group="${key}" aria-expanded="${!collapsed}"><span>${group}</span><i>${collapsed ? "▸" : "▾"}</i></button></h4>` : "";
    const children = collapsed ? "" : items.map(([label, id]) => `<button class="${state.page === id ? "active" : ""}" data-page="${id}">${label}</button>`).join("");
    return `${header}${children}`;
  }).join("");
  $("#nav").onclick = (event) => {
    const groupButton = event.target.closest("[data-nav-group]");
    if (groupButton) {
      const key = groupButton.dataset.navGroup;
      state.navCollapsed[key] = !state.navCollapsed[key];
      localStorage.setItem(NAV_COLLAPSE_STORAGE, JSON.stringify(state.navCollapsed));
      renderNav();
      return;
    }
    const button = event.target.closest("[data-page]");
    if (!button) return;
    if (button.dataset.page === "home") {
      location.href = "/projectsdashboard/";
      return;
    }
    if (button.dataset.page.startsWith("project/")) {
      openProjectDetail(button.dataset.page.split("/")[1]);
      return;
    }
    location.hash = button.dataset.page;
    $(".sidebar").classList.remove("open");
  };
}

const stat = ([label, value, hint, color = "teal"]) => `<article class="stat"><small><i class="dot ${color}"></i>${label}</small><b>${value}</b>${hint ? `<em>${hint}</em>` : ""}</article>`;
const progress = (value) => `<div class="progress"><i style="width:${value}%"></i></div>`;
const badge = (text) => `<span class="badge ${text.includes("Chậm") ? "danger" : text.includes("chú ý") || text.includes("Sắp") ? "warning" : ""}">${text}</span>`;

async function projectLanding() {
  const data = await api("/dashboard");
  setTitle("projects", "");
  const sourceProjects = activeProjectsOnly((await api("/projects")).data);
  const sortedProjects = [...sourceProjects].sort((a, b) => {
    const field = ui.sortBy === "code" ? "code" : ui.sortBy === "name" ? "name" : ui.sortBy === "status" ? "status" : "id";
    return String(a[field]).localeCompare(String(b[field]), "vi") * (ui.sortDir === "asc" ? 1 : -1);
  });
  $("#app").innerHTML = `
    <div class="project-toolbar">
      <div class="menu-wrap"><button class="btn quick" data-action="toggle-quick">♟ Xem nhanh⌄</button><div class="tool-menu" id="quick-menu"><button>▦ Danh sách dự án</button><button>▤ Dự án theo nhóm</button><button>◉ Tổng quan nhanh</button></div></div>
      <button class="btn quick" data-action="reload">⟳ Tải lại</button>
      <select class="toolbar-select sort-select" aria-label="Sắp xếp"><option value="code">Mã dự án</option><option value="name">Tên dự án</option><option value="created">Ngày tạo</option><option value="updated" selected>Ngày cập nhật</option><option value="status">Trạng thái</option><option value="health">Tình trạng</option></select>
      <button class="sort-dir" data-action="sort-dir" aria-label="Sắp xếp giảm dần">${ui.sortDir === "desc" ? "⇣" : "⇡"}</button>
      <div class="date-wrap"><button class="date-trigger" data-action="toggle-date">${ui.dateRange}　▣</button><div class="date-menu" id="date-menu"><select aria-label="Loại ngày"><option value="all">Tất cả</option><option value="created">Ngày tạo</option><option value="start">Ngày bắt đầu</option><option value="end">Ngày kết thúc</option></select><div class="date-grid"><button>7 ngày qua</button><button>30 ngày qua</button><button>Quý này</button><button>Mọi lúc</button></div></div></div>
      <button class="btn" data-action="create-project">+ Dự án</button>
      <div class="menu-wrap"><button class="btn" data-action="toggle-utility">Tiện ích⌄</button><div class="tool-menu right" id="utility-menu"><button>Nhập dữ liệu Excel</button><button>Xuất danh sách dự án</button><button>Cấu hình hiển thị</button></div></div>
    </div>
    <div class="workspace">
    <div class="project-feed">
    <div class="summary-strip">
      <article class="donut-card teal-bg"><div class="donut"><b>40</b></div><div><p><i class="sq blue"></i>Kế hoạch　 <b>2</b>　(5%)</p><p><i class="sq cyan"></i>Đang làm? <b>37</b>　(93%)</p><p><i class="sq orange"></i>Tạm dừng　 <b>0</b>　(0%)</p><p><i class="sq green"></i>Hoàn thành? <b>1</b>　(3%)</p></div></article>
      <article class="donut-card teal-bg"><div class="donut"><b>40</b></div><div><p><i class="sq blue"></i>Bình thường　 <b>30</b>　(75%)</p><p><i class="sq green"></i>Tăng tốc　 <b>0</b>　(0%)</p><p><i class="sq orange"></i>Lưu ý　 <b>0</b>　(0%)</p><p><i class="sq red"></i>Rủi ro　 <b>0</b>　(0%)</p><p><i class="sq red"></i>Chậm trễ　 <b>10</b>　(25%)</p></div></article>
      <article class="member-card"><b>DỰ ÁN TÔI THAM GIA: 25</b><div><span>Giám đốc <b>18</b></span><span>Thành viên <b>2</b></span><span>Chỉ huy <b>5</b></span><span>Theo dõi <b>0</b></span></div></article>
    </div>
    <div class="finance-strip">
      <article class="finance-box owner"><h3>CHỦ ĐẦU TƯ (CĐT)</h3>${data.finance.map(([x,y]) => `<div><span>${x}</span><b>${money(y)}</b></div>`).join("")}<strong>CĐT còn nợ <b>61.600.000.000</b></strong></article>
      <article class="finance-box contractor"><h3>NHÀ THẦU (NT)</h3><div><span>Hợp đồng</span><b>186.420.000.000</b></div><div><span>Đã thực hiện</span><b>92.610.000.000</b></div><div><span>Đề nghị thanh toán</span><b>54.880.000.000</b></div><div><span>Trả thực tế</span><b>42.300.000.000</b></div><strong>Còn nợ NT <b>12.580.000.000</b></strong></article>
      <article class="finance-box supplier"><h3>NHÀ CUNG CẤP (NCC)</h3><div><span>Hợp đồng</span><b>72.840.000.000</b></div><div><span>Đề nghị thanh toán</span><b>31.600.000.000</b></div><div><span>Trả thực tế</span><b>26.240.000.000</b></div><strong>Còn nợ NCC <b>5.360.000.000</b></strong></article>
    </div>
    <div class="project-cards">${sortedProjects.map((p) => `<article class="project-compact" data-project="${p.id}"><h2>${p.name}</h2><p><i class="dot blue"></i>${p.status}　 Mã dự án: ${p.code}　 Giám đốc: ${p.manager}</p><div class="project-metrics"><div><small>Tình trạng</small>${badge(p.health)}</div><div class="ring"><b>${p.progress}%</b><small>Công việc</small></div><div><small>Tiến độ kế hoạch</small>${progress(Math.min(100,p.progress+4))}<small>Tiến độ thực tế</small>${progress(p.progress)}</div></div><footer><span>◌ Ngân sách <b>${money(p.budget)}</b></span><span>♧ Thu <b>${money(Math.round(p.spent*.72))}</b></span><span>❉ Chi <b>${money(p.spent)}</b></span></footer></article>`).join("")}</div>
    </div>
    <aside class="activity-rail"><div class="rail-date">Chủ nhật, ngày 31/05/2026</div><article><h3>Công việc hôm nay <b>−</b></h3>${data.tasks.concat([["Kiểm tra vật tư nhập kho","02/06","Trung bình"]]).map(([a,b]) => `<div class="rail-row"><small>${b}<br>17:00</small><span>${a}<em>Quá hạn</em></span></div>`).join("")}</article><article><h3>Lịch họp <b>−</b></h3><p class="empty">▣<br>Không có lịch họp nào!</p></article><article><h3>?? xuất cần duyệt <b>−</b></h3>${data.alerts.map(([a,b]) => `<div class="rail-row"><small>15:37</small><span>${b}<small>${a}</small></span></div>`).join("")}</article></aside>
    </div>${projectModal()}`;
  bindLanding();
}

function projectModal() {
  const templates = ["Mẫu nội thất", "Mẫu Kiến trúc", "Mẫu Kiến trúc Nội thất", "Mẫu quy hoạch"];
  return `<div class="modal-backdrop" id="project-modal"><section class="project-modal"><header><h2>Khởi tạo dự án</h2><button data-action="close-modal">×</button></header><div class="creation-options"><button data-action="new-project">＋<b>Khởi tạo dự án mới</b><small>Tạo dự án thực tế hoặc dự án mẫu</small></button><button>▤<b>Khởi tạo từ Excel</b><small>Nhập dữ liệu theo file mẫu</small></button><button data-action="show-templates">▦<b>Khởi tạo từ dự án mẫu</b><small>Chọn một mẫu dự án đã thiết lập sẵn</small></button></div><section class="template-picker" id="template-picker"><h3>Chọn dự án mẫu</h3><p>Nội dung chi tiết của từng mẫu sẽ được bổ sung sau.</p><div>${templates.map((name) => `<button data-template="${name}"><b>${name}</b><small>Nội dung mẫu đang cập nhật</small></button>`).join("")}</div></section><form id="project-form"><h3>Thông tin dự án <small id="selected-template"></small></h3><label>Mã dự án<input name="code" value="DA-${String(Date.now()).slice(-4)}"></label><label>Tên dự án<input name="name" id="nameProject" required placeholder="Nhập tên dự án"></label><label>Mô tả<textarea name="description" placeholder="Nhập mô tả dự án"></textarea></label><label>Nhóm dự án<select name="group"><option>Thiết kế</option><option>Thi công</option><option>Thiết kế Thi công</option></select></label><label>Loại dự án<select name="type" id="typeProject"><option>Dự án thực tế</option><option>Dự án mẫu</option></select></label><label>Lĩnh vực<select><option>Chọn lĩnh vực</option><option>Cơ điện</option><option>Giao thông</option><option>Xây dựng</option><option>Nội thất</option></select></label><label>Quy trình<select><option>Chọn quy trình</option><option>Quy trình thi công xây dựng</option><option>Quy trình thiết kế thi công nội thất</option></select></label><label>Quản trị dự án<input name="manager" placeholder="Chọn người quản trị"></label><label>Thực hiện dự án<input placeholder="Chọn thành viên"></label><label>Người theo dõi<input placeholder="Chọn người theo dõi"></label><label>Trạng thái<select name="status" id="statusProject"><option>Kế hoạch</option><option>Đang thực hiện</option><option>Tạm dừng</option><option>Hoàn thành</option><option>Đóng</option></select></label><footer><button type="button" class="btn secondary" data-action="close-modal">Đóng</button><button class="btn">Tạo và mở chi tiết</button></footer></form></section></div>`;
}

function bindLanding() {
  $(".sort-select").value = ui.sortBy;
  $("#app").onclick = (event) => {
    const card = event.target.closest("[data-project]");
    if (card) return void (location.href = `/constructions/detail/${card.dataset.project}/`);
    const template = event.target.closest("[data-template]")?.dataset.template;
    if (template) {
      $("#selected-template").textContent = `- ${template}`;
      $("#nameProject").value = template;
      $("#typeProject").value = "Dự án mẫu";
      $("#template-picker").classList.remove("open");
      return $("#project-form").classList.add("open");
    }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "toggle-quick") return $("#quick-menu").classList.toggle("open");
    if (action === "toggle-utility") return $("#utility-menu").classList.toggle("open");
    if (action === "toggle-date") return $("#date-menu").classList.toggle("open");
    if (action === "reload") return projectLanding();
    if (action === "sort-dir") { ui.sortDir = ui.sortDir === "desc" ? "asc" : "desc"; return projectLanding(); }
    if (action === "hide-welcome") { ui.hiddenWelcome = true; return projectLanding(); }
    if (action === "create-project") return $("#project-modal").classList.add("open");
    if (action === "close-modal") return $("#project-modal").classList.remove("open");
    if (action === "new-project") return $("#project-form").classList.add("open");
    if (action === "show-templates") return $("#template-picker").classList.add("open");
  };
  $(".sort-select").onchange = (event) => { ui.sortBy = event.target.value; projectLanding(); };
  $("#date-menu").onclick = (event) => {
    const button = event.target.closest(".date-grid button");
    if (!button) return;
    ui.dateRange = button.innerText;
    projectLanding();
  };
  $("#project-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const project = await response.json();
    if (!response.ok) return alert(project.error || "Không thể tạo dự án");
    location.href = `/constructions/detail/${project.id}/`;
  };
}

async function projectTable() {
  const response = await api("/projects");
  const data = activeProjectsOnly(response.data);
  setTitle("projects", "Quản lý danh sách và trạng thái dự án xây dựng");
  $("#app").innerHTML = `<div class="hero"><div><h2>Danh sách dự án</h2><span class="muted">${data.length} dự án đang hiển thị</span></div><button class="btn">+ Tạo dự án</button></div>
  <table><thead><tr><th>Mã dự án</th><th>Tên dự án</th><th>Loại</th><th>Quản lý</th><th>Tiến độ</th><th>Tình trạng</th><th>Ngân sách</th></tr></thead><tbody>
  ${data.map((p) => `<tr><td>${p.code}</td><td class="project-name" data-project="${p.id}">${p.name}</td><td>${p.type}</td><td>${p.manager}</td><td>${progress(p.progress)}<small>${p.progress}%</small></td><td>${badge(p.health)}</td><td>${money(p.budget)} đ</td></tr>`).join("")}</tbody></table>`;
  $("#app").onclick = (event) => {
    const target = event.target.closest("[data-project]");
    if (target) openProjectDetail(target.dataset.project);
  };
}

async function home() {
  const data = await api("/dashboard");
  setTitle("home", "Theo dõi hoạt động xây dựng theo thời gian thực");
  $("#app").innerHTML = `
    <div class="hero"><div><h2>${data.greeting}</h2><span class="muted">Đây là tình hình hoạt động nổi bật hôm nay.</span></div><button class="btn">+ Tạo dự án</button></div>
    <div class="grid stats">${data.stats.map(stat).join("")}</div>
    <div class="grid two">
      <article class="card"><h3>Tổng quan tài chính</h3>${data.finance.map(([x,y]) => `<div class="money-row"><span>${x}</span><b>${money(y)} đ</b></div>`).join("")}</article>
      <article class="card"><h3>Dòng tiền 6 tháng</h3><div class="bars">${data.cashflow.map(([m,a,b]) => `<div class="bar-group"><div class="bar-pair"><i class="bar in" style="height:${a}%"></i><i class="bar out" style="height:${b}%"></i></div>${m}</div>`).join("")}</div></article>
    </div>
    <div class="grid three">
      <article class="card"><h3>Cảnh báo cần xử lý</h3>${data.alerts.map(([a,b,c]) => `<div class="feed-row"><span><b>${a}</b><br><small class="muted">${b}</small></span><i class="badge ${c}">!</i></div>`).join("")}</article>
      <article class="card"><h3>Công việc sắp đến hạn</h3>${data.tasks.map(([a,b]) => `<div class="feed-row"><span>${a}</span><span class="badge">${b}</span></div>`).join("")}</article>
      <article class="card"><h3>Truy cập nhanh</h3><div class="grid"><button class="btn secondary">+ Nhật ký thi công</button><button class="btn secondary">+ Phiếu vật tư</button><button class="btn secondary">+ Phiếu thu chi</button><button class="btn secondary">+ Đề xuất phê duyệt</button></div></article>
    </div>`;
}

async function insight() {
  const data = await api("/insight");
  setTitle("insight", "Phân tích dữ liệu 360° cấp doanh nghiệp và dự án");
  $("#app").innerHTML = `<div class="hero"><div><h2>Insight danh mục dự án</h2><span class="muted">Theo dõi rủi ro, sản lượng và công nợ tập trung.</span></div><button class="btn secondary">Bộ lọc</button></div>
  <div class="grid stats">${data.stats.map(([a,b]) => stat([a,b,"Cập nhật theo dữ liệu dự án"])).join("")}</div>
  <div class="grid two"><article class="card"><h3>Công nợ chủ đầu tư cần theo dõi</h3>${data.receivables.map(([a,b]) => `<div class="money-row"><span>${a}</span><b>${money(b)} đ</b></div>`).join("")}</article><article class="card"><h3>Phân bổ tình trạng</h3><div class="bars"><div class="bar-group"><div class="bar-pair"><i class="bar in" style="height:90%"></i></div>Bình thường</div><div class="bar-group"><div class="bar-pair"><i class="bar out" style="height:32%;background:#f59d31"></i></div>Chú ý</div><div class="bar-group"><div class="bar-pair"><i class="bar out" style="height:20%;background:#d94d55"></i></div>Chậm</div></div></article></div>`;
}

async function project(id) {
  const p = await api(`/projects/${id}`);
  setTitle("projects", p.code);
  $("#app").innerHTML = `<section class="project-head"><h2>${p.name}</h2><div class="muted">${p.description}</div></section>
  <div class="tabs"><button class="active">Dashboard</button><button>Tiến độ</button><button>Nhật ký</button><button>Hợp đồng</button><button>Vật tư</button><button>Nhân công</button><button>Máy thi công</button><button>Tài chính</button><button>Hồ sơ</button></div>
  <div class="grid stats">${p.kpis.map(([a,b]) => stat([a,b,"Cập nhật theo nhật ký"])).join("")}</div>
  <div class="grid two"><article class="card"><h3>Kế hoạch thi công</h3>${p.schedule.map(([a,b,c,d]) => `<div class="schedule-row"><b>${a}</b><span>${b}</span><span>${c}</span>${progress(d)}</div>`).join("")}</article>
  <article class="card"><h3>Giá trị hợp đồng</h3>${p.contract.map(([a,b,c]) => `<div class="money-row"><span>${a}<br><small class="muted">Đã thực hiện ${c}</small></span><b>${b}</b></div>`).join("")}</article></div>
  <div class="grid two"><article class="card"><h3>Tồn kho cần theo dõi</h3>${p.inventory.map(([a,b,c]) => `<div class="money-row"><span>${a}</span><b>${b} ${badge(c)}</b></div>`).join("")}</article><article class="card"><h3>Hoạt động gần đây</h3>${p.recent.map(([a,b,c]) => `<div class="feed-row"><span><b>${a}</b><br><small class="muted">${b}</small></span><small class="muted">${c}</small></div>`).join("")}</article></div>`;
}

const CRM_CUSTOMERS = [
  ["KH0101","GOLD 1 - XDATA",["Nhà thầu"],"Kim Hoàng Hà",1,58362731268,1150000,1500878],
  ["KH0092","Giang Hạ",["Chủ đầu tư","Nhà thầu","Nhà cung cấp"],"Lê Xuân Kiên",14,58362731268,1150000,1500878],
  ["KH0100","NHÀ THẦU NGUYỄN VĂN CHẤP",["Nhà thầu","Nhà cung cấp"],"Tài khoản test giám đốc",0,0,0,0],
  ["BT","BÊ TÔNG VIỆT NHẬT",["Nhà thầu","Nhà cung cấp"],"Tài khoản trải nghiệm",0,0,0,0],
  ["KH0097","Trường TH Phenikaa",["Chủ đầu tư"],"Lê Xuân Kiên",1,89000,143288350,0],
  ["KH0108","Line5",["Chủ đầu tư"],"TÀI KHOẢN TRẢI NGHIỆM",2,5765465502,0,0],
  ["KH0107","Công ty cổ phần cao tốc đường vành đai 4 Hà Nội",["Chủ đầu tư"],"Lê Xuân Kiên",3,201144706899,0,0],
  ["KH0105","Fastwork",["Chủ đầu tư","Nhà thầu","Nhà cung cấp"],"Lê Xuân Kiên",3,4126124765779,2282666057,6472001278],
  ["TL","CHỦ ĐẦU TƯ THĂNG LONG",["Chủ đầu tư","Nhà cung cấp"],"Lê Xuân Kiên",8,1099171057067,2000000000,0],
  ["KH0106","HGA",["Chủ đầu tư"],"TÀI KHOẢN TRẢI NGHIỆM",1,8979497438,0,0],
  ["KH0104","VIT",["Chủ đầu tư"],"TÀI KHOẢN TRẢI NGHIỆM",1,250873346159,0,0],
  ["PC","CÔNG TY ĐẦU TƯ VÀ THƯƠNG MẠI PC1",["Chủ đầu tư","Nhà thầu","Nhà cung cấp"],"TEST FASTCONS",4,3863305175,36052036,1667004113],
  ["KH0103","GOLD 3 - XDATA",["Nhà thầu","Nhà cung cấp"],"Tài khoản trải nghiệm",0,0,0,0],
  ["KH0102","GOLD 2 - XDATA",["Nhà thầu"],"Tài khoản trải nghiệm",0,0,0,0],
  ["KH0087","CÔNG TY TNHH PCCC ĐỨC GIANG",["Chủ đầu tư","Nhà thầu","Nhà cung cấp"],"Lê Xuân Kiên",0,0,0,4455000],
  ["KH0099","DỊCH VỤ NHÂN CÔNG LÊ TUẤN HẢI",["Nhà thầu"],"Tài khoản trải nghiệm",0,0,0,0],
  ["KH0098","ANH DŨNG BA ĐÌNH",["Chủ đầu tư"],"Lê Xuân Kiên",2,277928600,0,0],
  ["KH0096","Công ty Cổ phần Huy Hồng",["Chủ đầu tư"],"TÀI KHOẢN TRẢI NGHIỆM",1,199090000,199090000,0],
  ["SXHALONG","CÔNG TY TNHH ĐẦU TƯ PHÁT TRIỂN SẢN XUẤT HẠ LONG",["Chủ đầu tư"],"Lê Xuân Kiên",3,308715600,292215600,0],
  ["KH0085","BAN QUẢN LÝ DỰ ÁN XÂY DỰNG DD&CN",["Chủ đầu tư","Nhà cung cấp"],"Lê Xuân Kiên",4,6088971451,0,6362000],
  ["KH0095","BQL Vườn Quốc Gia",["Chủ đầu tư"],"TÀI KHOẢN TRẢI NGHIỆM",1,2758287752,0,0],
  ["01","Ban NN",["Chủ đầu tư"],"TÀI KHOẢN TRẢI NGHIỆM",1,189389278,0,0],
  ["KH0084","CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ THƯƠNG MẠI HÒA PHÁT",["Chủ đầu tư","Nhà cung cấp"],"Lê Xuân Kiên",1,1281346888,15000000,258279892],
  ["KH0094","Hạnh thuận thành 2",["Chủ đầu tư","Nhà cung cấp"],"Tài khoản test giám đốc",0,0,0,0],
  ["KH0093","Nguyễn Công Minh",["Chủ đầu tư"],"Lê Xuân Kiên",0,0,15000,0]
];
const crmTags = (tags) => tags.map((tag) => `<i class="crm-tag ${tag === "Chủ đầu tư" ? "owner-tag" : tag === "Nhà thầu" ? "contractor-tag" : "supplier-tag"}">${tag}</i>`).join("");
const crmMap = () => `<div class="crm-map"><i></i><i></i><i></i><i></i><b>⌖</b><small>Vinhomes Royal City</small></div>`;

function customerPanel() {
  const selects = ["Phân loại","Thẻ","Trạng thái","Phân cấp","Chiến dịch","Lĩnh vực","Nguồn khách hàng","Quy mô hoạt động","Loại khách hàng *","Nhóm khách hàng","Kênh bán hàng","Quốc gia","Tỉnh thành","Quận huyện"];
  return `<aside class="crm-drawer" id="crm-drawer"><header><b>Tạo khách hàng mới</b><button data-crm="close-drawer">×</button></header><form id="crm-create-form">
    <label>Mã khách hàng<input placeholder="Nhập mã khách hàng" value="KH${String(Date.now()).slice(-4)}"></label><label>Tên khách hàng *<input name="name" required placeholder="Nhập tên khách hàng"></label>
    <label>Người phụ trách<span class="crm-person">● Trần Mạnh Hùng</span></label><label>Người theo dõi<span class="crm-person">＋ TÀI KHOẢN TRẢI NGHIỆM</span></label>
    <label>Mã số thuế<input placeholder="Nhập mã số thuế"></label><label>Địa chỉ<input placeholder="Nhập địa chỉ"></label>${crmMap()}
    ${selects.slice(0,2).map((x) => `<label>${x}<select><option>Chọn ${x.toLowerCase()}</option><option>Chủ đầu tư</option><option>Nhà thầu</option></select></label>`).join("")}
    <label class="crm-check"><input type="checkbox" checked> Hoạt động</label>
    ${selects.slice(2).map((x) => `<label>${x}<select><option>Chọn ${x.toLowerCase()}</option><option>Khách hàng cũ</option><option>Tiềm năng</option></select></label>`).join("")}
    <label>Số điện thoại<input placeholder="Nhập số điện thoại"></label><label>Email<input placeholder="Nhập email"></label><label>Website<input placeholder="Nhập website"></label><label>Ngày thành lập<input type="date"></label><label>Người giới thiệu<input placeholder="Chọn người giới thiệu"></label><label>Ghi chú<textarea placeholder="Nhập ghi chú"></textarea></label>
    <h3>Liên hệ</h3><label>Xưng hô<select><option>Chọn xưng hô</option><option>Anh</option><option>Chị</option></select></label><label>Họ và tên<input placeholder="Nhập họ tên liên hệ"></label><label>Phòng ban<input placeholder="Nhập phòng ban"></label><label>Chức vụ<input placeholder="Chọn chức vụ"></label><label>Số điện thoại<input placeholder="Nhập số điện thoại"></label><label>Địa chỉ<input placeholder="Nhập địa chỉ"></label><label>Email<input placeholder="Nhập email"></label>
    <footer><button class="btn">▣ Lưu</button></footer></form></aside>`;
}

function customers() {
  setTitle("customers", "");
  const query = state.customerQuery.toLocaleLowerCase("vi");
  const rows = CRM_CUSTOMERS.filter((c) => (!query || `${c[0]} ${c[1]}`.toLocaleLowerCase("vi").includes(query)) && (state.customerFilter === "Tất cả" || c[2].includes(state.customerFilter)));
  $("#app").innerHTML = `<section class="crm-shell"><aside class="crm-filter"><input id="crm-search" value="${state.customerQuery}" placeholder="Tìm kiếm..."><h4>✓ Tất cả</h4><button>Tôi phụ trách</button><button>Tôi theo dõi</button><button>Chưa có người phụ trách</button><h4>♟ Phân loại⌄</h4>${["Chủ đầu tư","Nhà thầu"].map((x) => `<button data-filter="${x}">✓ ${x}</button>`).join("")}<h4>♟ Nhóm khách hàng⌄</h4><h4>▦ Loại khách hàng⌄</h4><h4>▦ Nguồn khách hàng⌄</h4><h4>⌁ Kênh bán hàng⌄</h4><h4>◉ Lĩnh vực⌄</h4><h4>◉ Quy mô hoạt động⌄</h4><h4>▦ Khu vực⌄</h4><h4>⚑ Trạng thái⌄</h4><h4>♟ Nhân viên phụ trách⌄</h4><h4>♟ Thẻ⌄</h4></aside>
  <div class="crm-main"><div class="crm-toolbar"><b>❖ Khách hàng (${rows.length})</b><span></span><button>↻ Tải lại</button><button>Ngày cập nhật⌄</button><button>Tất cả thời gian</button><button class="crm-add" data-crm="add">＋ Thêm mới</button><button class="crm-add">Tiện ích⌄</button></div>
  <div class="crm-table-wrap"><table class="crm-table"><thead><tr><th></th><th>Mã KH</th><th>Tên khách hàng</th><th>Phân loại</th><th>Người phụ trách</th><th>Người theo dõi</th><th>Thẻ</th><th>Hợp đồng</th><th>Giá trị hợp đồng</th><th>Công nợ phải thu</th><th>Công nợ phải trả</th><th>Dự án</th></tr></thead><tbody>
  ${rows.map((c) => `<tr><td><input type="checkbox"> <i class="crm-status"></i></td><td>${c[0]}</td><td><button class="crm-name" data-customer="${c[0]}">${c[1]}</button></td><td>${crmTags(c[2])}</td><td><span class="crm-avatar">●</span> ${c[3]}</td><td></td><td></td><td>${c[4]}</td><td>${money(c[5])}</td><td>${money(c[6])}</td><td>${money(c[7])}</td><td>0</td></tr>`).join("")}</tbody></table></div><footer class="crm-pager"><b>1</b> Hiển thị 1 - ${rows.length} trên tổng số ${CRM_CUSTOMERS.length} bản ghi</footer></div>${customerPanel()}</section>`;
  bindCustomers();
}

function customerDetail(id) {
  const customer = CRM_CUSTOMERS.find((c) => c[0] === id) || CRM_CUSTOMERS[1];
  setTitle("customers", "");
  $("#app").innerHTML = `<section class="crm-detail"><div class="crm-detail-bar"><b>Chi tiết khách hàng</b><span></span><button class="crm-add">▣ Lưu</button><button class="crm-danger">▣ Xóa</button><button class="crm-blue">● Thiết lập</button><button data-crm="back">× Đóng</button></div>
  <aside class="crm-profile"><h2><i>▦</i>${customer[1]}</h2>${[["Số lượng hợp đồng",customer[4]],["Giá trị hợp đồng",money(customer[5])],["Công nợ phải thu",money(customer[6])],["Công nợ phải trả",money(customer[7])],["Số lượng dự án","12"],["Ngày tạo","21/06/2023"],["Ngày cập nhật gần nhất","27/05/2026"],["Ngày liên hệ gần nhất","14/04/2025 10:52"],["Phân loại",customer[2].join(", ")],["Trạng thái","Tiềm năng"],["Chiến dịch",""],["Loại khách hàng",""],["Nguồn khách hàng",""],["Nhóm khách hàng",""],["Điểm khách hàng",""],["Phân cấp",""],["Thẻ",""]].map(([a,b]) => `<p><span>${a}</span><b>${b}</b></p>`).join("")}
  <section><h3>Liên hệ (1)</h3><p><span class="crm-avatar">●</span><b> QUYẾT<br><small>⌕ 0987654</small></b></p><a>⌕ Thêm liên hệ</a><a>＋ Tạo liên hệ</a></section><section><h3>Người phụ trách(1)</h3><p><span class="crm-avatar">●</span><b> Lê Xuân Kiên<br><small>✉ giamdoc@kdfcd</small></b></p><a>⌕ Thêm người phụ trách</a></section><section><h3>Người theo dõi</h3><a>⌕ Thêm người theo dõi</a></section></aside>
  <main class="crm-detail-main"><nav>${["Thông tin","Trao đổi (1)","Ghi chú (0)","Hoạt động (34)","Đính kèm","Báo giá (0)","Hợp đồng bán (14)","Hợp đồng mua (1)","Bán hàng","Công việc","Thu chi","Cơ hội (0)","Chăm sóc (0)","Nhiệm vụ"].map((x,i) => `<button class="${i ? "" : "active"}">${x}</button>`).join("")}</nav><form><label>Mã khách hàng<input value="${customer[0]}"></label><label>Tên khách hàng *<input value="${customer[1]}"></label><label>Mã số thuế<input placeholder="Nhập mã số thuế"></label><label>Địa chỉ<div class="crm-address"><input value="Kim Mã"><button>⌖</button></div></label><label class="crm-check"><input type="checkbox" checked> Hoạt động</label><label>Lĩnh vực<select><option>Chọn lĩnh vực</option></select></label><label>Quy mô hoạt động<select><option>Chọn quy mô hoạt động</option></select></label><label>Kênh bán hàng<select><option>Chọn kênh bán hàng</option></select></label><label>Quốc gia<select><option>Chọn quốc gia</option></select></label><label>Tỉnh thành<select><option>Chọn tỉnh thành</option></select></label><label>Quận huyện<select><option>Chọn quận huyện</option></select></label><label>Số điện thoại<input placeholder="Nhập số điện thoại"></label><label>Email<input placeholder="Nhập email"></label><label>Website<input placeholder="Nhập website"></label><label>Ngày thành lập<input placeholder="Chọn ngày thành lập"></label><label>Người giới thiệu<select><option>Chọn người giới thiệu</option></select></label></form></main>
  <div class="crm-modal" id="crm-edit-modal"><section><header><b>Cập nhật thông tin quản lý khách hàng</b><button data-crm="close-modal">×</button></header><label>Phân loại<div>${crmTags(customer[2])}</div></label><footer><button data-crm="close-modal">× Đóng</button><button class="crm-add" data-crm="close-modal">▣ Lưu</button></footer></section></div></section>`;
  $("#app").onclick = (event) => {
    const action = event.target.closest("[data-crm]")?.dataset.crm;
    if (action === "back") return customers();
    if (action === "close-modal") return $("#crm-edit-modal").classList.remove("open");
    if (event.target.closest(".crm-profile p:nth-of-type(9)")) $("#crm-edit-modal").classList.add("open");
  };
}

function bindCustomers() {
  $("#crm-search").oninput = (event) => { state.customerQuery = event.target.value; customers(); };
  $("#app").onclick = (event) => {
    const id = event.target.closest("[data-customer]")?.dataset.customer;
    if (id) return customerDetail(id);
    const filter = event.target.closest("[data-filter]")?.dataset.filter;
    if (filter) { state.customerFilter = state.customerFilter === filter ? "Tất cả" : filter; return customers(); }
    const action = event.target.closest("[data-crm]")?.dataset.crm;
    if (action === "add") return $("#crm-drawer").classList.add("open");
    if (action === "close-drawer") return $("#crm-drawer").classList.remove("open");
  };
  $("#crm-create-form").onsubmit = (event) => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("name");
    CRM_CUSTOMERS.unshift([`KH${String(CRM_CUSTOMERS.length + 101).padStart(4,"0")}`,name,["Chủ đầu tư"],"Trần Mạnh Hùng",0,0,0,0]);
    customers();
  };
}

const CRM_DIRECTORY = {
  customers: {
    title: "Khách hàng", singular: "khách hàng", icon: "♟", code: "KH",
    rows: [
      ["KH001","Công ty CP Đầu tư An Phú","Nguyễn Minh Anh","0901 234 567","Đang hợp tác","Hà Nội",1850000000,320000000,["Green City","Le Dome Office"],"Ưu tiên đối soát cuối tháng"],
      ["KH002","Công ty TNHH Kiến trúc Việt","Trần Thanh Hà","0987 456 321","Tiềm năng","TP. Hồ Chí Minh",0,0,["Nội thất Le Dome"],"Đang hoàn thiện báo giá"],
      ["KH003","Ban quản lý dự án Green City","Lê Hoàng Nam","0912 884 299","Đang hợp tác","Đà Nẵng",2760000000,0,["Green City"],"Thanh toán theo tiến độ nghiệm thu"],
      ["KH004","Công ty CP Hạ tầng Đông Dương","Phạm Thu Trang","0936 222 810","Tạm ngưng","Hải Phòng",450000000,120000000,["Riverside","Hạ tầng Đông Dương"],"Tạm dừng chờ bổ sung hồ sơ"]
    ]
  },
  contractors: {
    title: "Nhà thầu", singular: "nhà thầu", icon: "▣", code: "NT",
    rows: [
      ["NT001","Công ty Xây dựng Hưng Thịnh","Vũ Quốc Bảo","0903 411 225","Đang hợp tác","Xây dựng",0,1680000000,["Green City","Riverside"],"Đối tác thi công phần thô"],
      ["NT002","Cơ điện M&E Thành Công","Đỗ Mạnh Hùng","0918 762 901","Đang hợp tác","Cơ điện",85000000,920000000,["M&E Riverside"],"Cần chốt khối lượng phát sinh"],
      ["NT003","Nội thất Minh Long","Nguyễn Khánh Linh","0981 156 668","Tiềm năng","Nội thất",0,0,["Nội thất Le Dome"],"Đang đánh giá năng lực"],
      ["NT004","Hạ tầng Giao thông Việt","Lương Văn Sơn","0906 820 477","Tạm ngưng","Hạ tầng",0,340000000,["Hạ tầng Đông Dương"],"Chờ biên bản nghiệm thu"]
    ]
  },
  suppliers: {
    title: "Nhà cung cấp", singular: "nhà cung cấp", icon: "▤", code: "NCC",
    rows: [
      ["NCC001","Vật liệu xây dựng Hòa Phát","Trần Văn Đức","0905 778 812","Đang hợp tác","Vật liệu",0,780000000,["Green City","Riverside"],"Giao vật tư định kỳ hàng tuần"],
      ["NCC002","Thiết bị điện Ánh Dương","Hoàng Thu Mai","0934 100 568","Đang hợp tác","Thiết bị",65000000,460000000,["M&E Riverside","Le Dome Office"],"Có bảo hành thiết bị 24 tháng"],
      ["NCC003","Sơn và chống thấm Đại Việt","Nguyễn Tuấn Anh","0977 460 222","Tiềm năng","Hoàn thiện",0,0,["Nội thất Le Dome"],"Đang gửi mẫu vật liệu"],
      ["NCC004","Thép Việt Nhật","Phan Minh Quân","0911 345 789","Tạm ngưng","Kết cấu",0,215000000,["Green City"],"Tạm dừng nhập mới"]
    ]
  }
};

const crmStatusClass = (status) => status === "Đang hợp tác" ? "active" : status === "Tiềm năng" ? "lead" : "paused";
const crmProjects = (projects = []) => `<div class="directory-projects">${projects.map((project) => `<i>${escapeHtml(project)}</i>`).join("")}</div>`;
const CATALOG_FALLBACK = {
  constructionCategories: ["KHẢO SÁT - ĐO ĐẠC", "CHE PHỦ", "PHÁ DỠ", "VẬN CHUYỂN", "XÂY TRÁT", "CHỐNG THẤM", "ĐIỆN NƯỚC", "PCCC / AN TOÀN KỸ THUẬT", "ĐIỀU HÒA", "THIẾT BỊ THÔNG MINH - MẠNG - CAMERA", "THẠCH CAO", "ỐP LÁT", "ĐÁ", "SƠN BẢ", "SÀN GỖ - SÀN NHỰA", "CỬA", "NHÔM KÍNH", "SẮT", "GỖ NỘI THẤT", "RÈM", "CÂY - TIỂU CẢNH", "BIỂN BẢNG LOGO", "DEFECT CHẤM VÁ", "VỆ SINH CN", "KHÁC"],
  materialCategories: ["VẬT LIỆU HOÀN THIỆN", "PHỤ KIỆN ĐỒ NỘI THẤT", "THIẾT BỊ CHIẾU SÁNG", "THIẾT BỊ BẾP", "THIẾT BỊ VỆ SINH", "ĐÈN DECOR", "ĐỒ DECOR", "ĐỒ DECOR BẾP", "CHĂN GA ĐỆM", "ĐỒ THỦ CÔNG", "KHÁC"],
  contractTypes: ["Hợp đồng thiết kế", "Hợp đồng thi công", "Hợp đồng thiết kế thi công", "Hợp đồng phát sinh"]
};
let catalogData = { constructionCategories: [...CATALOG_FALLBACK.constructionCategories], materialCategories: [...CATALOG_FALLBACK.materialCategories], contractTypes: [...CATALOG_FALLBACK.contractTypes] };
function catalogList(input, fallback) {
  const source = Array.isArray(input) ? input : fallback;
  return [...new Set(source.map((item) => String(item || "").trim()).filter(Boolean))];
}
function normalizeCatalogData(input = {}) {
  return {
    constructionCategories: catalogList(input.constructionCategories, CATALOG_FALLBACK.constructionCategories),
    materialCategories: catalogList(input.materialCategories, CATALOG_FALLBACK.materialCategories),
    contractTypes: catalogList(input.contractTypes, CATALOG_FALLBACK.contractTypes)
  };
}
const materialCategoryOptions = () => catalogList(catalogData.materialCategories, CATALOG_FALLBACK.materialCategories);
const constructionCategoryOptions = () => catalogList(catalogData.constructionCategories, CATALOG_FALLBACK.constructionCategories);
const contractTypeOptions = () => catalogList(catalogData.contractTypes, CATALOG_FALLBACK.contractTypes);
const CATALOG_LIST_CONFIG = {
  constructionCategories: {
    title: "Danh sách Hạng mục thi công",
    note: "Dùng cho Nhà thầu, Hợp đồng nhận thầu/giao thầu và các màn thi công.",
    placeholder: "VD: ỐP LÁT"
  },
  materialCategories: {
    title: "Danh sách hạng mục Thiết bị Vật tư",
    note: "Dùng cho Nhà cung cấp, kế hoạch vật tư, hóa đơn và kho.",
    placeholder: "VD: THIẾT BỊ BẾP"
  },
  contractTypes: {
    title: "Danh sách hợp đồng",
    note: "Dùng để phân loại hợp đồng trong dự án và giao dịch tài chính.",
    placeholder: "VD: Hợp đồng bảo trì",
    preserveCase: true
  }
};
const TRANSACTION_FLOW_LIST_CONFIG = {
  financeFlowTypes: {
    field: "types",
    title: "Loại",
    placeholder: "",
    readOnly: true,
    preserveCase: true
  },
  financeFlowTopics: {
    field: "topics",
    title: "Chủ đề",
    placeholder: "VD: VẬN HÀNH"
  },
  financeFlowCategories: {
    field: "categories",
    title: "Hạng mục",
    placeholder: "VD: ĐIỆN"
  },
  financeFlowPartners: {
    field: "partners",
    title: "Đối tượng",
    placeholder: "VD: NCC HOMEKIT",
    preserveCase: true
  }
};
const TRANSACTION_FLOW_LIST_TYPES = Object.keys(TRANSACTION_FLOW_LIST_CONFIG);
const FINANCE_TRANSACTION_TYPES = ["Thu", "Chi"];
let catalogFinanceData = null;
let catalogTransactionFlow = { types: [...FINANCE_TRANSACTION_TYPES], topics: [], categories: [], partners: [] };
async function loadCatalogData() {
  try {
    const body = await api("/catalog");
    catalogData = normalizeCatalogData(body.data || body);
  } catch (error) {
    console.warn("Cannot load catalog", error);
    catalogData = normalizeCatalogData(catalogData);
  }
  return catalogData;
}
async function saveCatalogData(data) {
  const body = await api("/catalog", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: normalizeCatalogData(data) })
  });
  catalogData = normalizeCatalogData(body.data || data);
  return catalogData;
}
const plainVietnamese = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi").replace(/\s+/g, " ").trim();
const MATERIAL_CATEGORY_ALIASES = new Map([
  ["Vật liệu", "VẬT LIỆU HOÀN THIỆN"],
  ["Vật liệu xây dựng", "VẬT LIỆU HOÀN THIỆN"],
  ["Xây dựng", "VẬT LIỆU HOÀN THIỆN"],
  ["Kết cấu", "VẬT LIỆU HOÀN THIỆN"],
  ["Vật liệu hoàn thiện", "VẬT LIỆU HOÀN THIỆN"],
  ["Hoàn thiện", "VẬT LIỆU HOÀN THIỆN"],
  ["Gạch", "VẬT LIỆU HOÀN THIỆN"],
  ["Đá", "VẬT LIỆU HOÀN THIỆN"],
  ["Sơn", "VẬT LIỆU HOÀN THIỆN"],
  ["Sơn và chống thấm", "VẬT LIỆU HOÀN THIỆN"],
  ["Thiết bị", "THIẾT BỊ CHIẾU SÁNG"],
  ["Thiết bị công trình", "THIẾT BỊ CHIẾU SÁNG"],
  ["Cơ điện", "THIẾT BỊ CHIẾU SÁNG"],
  ["Đèn", "THIẾT BỊ CHIẾU SÁNG"],
  ["Đèn trang trí", "ĐÈN DECOR"],
  ["Đồ nội thất", "PHỤ KIỆN ĐỒ NỘI THẤT"],
  ["Nội thất", "PHỤ KIỆN ĐỒ NỘI THẤT"],
  ["Decor", "ĐỒ DECOR"],
  ["Đồ decor", "ĐỒ DECOR"],
  ["Đồ décor", "ĐỒ DECOR"],
  ["Đồ trang trí", "ĐỒ DECOR"],
  ["Đồ Bếp", "ĐỒ DECOR BẾP"],
  ["Bếp", "THIẾT BỊ BẾP"],
  ["Đồ thủ công", "ĐỒ THỦ CÔNG"],
  ["Thủ công", "ĐỒ THỦ CÔNG"],
  ["Rèm", "KHÁC"],
  ["Mành rèm", "KHÁC"],
  ["Chăn Ga Đệm", "CHĂN GA ĐỆM"],
  ["Chăn ga gối đệm", "CHĂN GA ĐỆM"]
].map(([alias, category]) => [plainVietnamese(alias), category]));
const materialCategoryOrder = (category) => {
  const options = materialCategoryOptions();
  const index = options.indexOf(category);
  return index >= 0 ? index : options.length;
};
function knownMaterialCategory(value) {
  return materialCategoryOptions().find((option) => plainVietnamese(option) === plainVietnamese(value));
}
function normalizeMaterialCategory(value) {
  const cleaned = String(value || "").replace(/\s*\+\d+\s*$/u, "").trim();
  if (!cleaned) return "";
  const aliased = MATERIAL_CATEGORY_ALIASES.get(plainVietnamese(cleaned)) || cleaned;
  return knownMaterialCategory(aliased) || "KHÁC";
}
function sortMaterialCategories(categories) {
  return [...new Set(categories.map(normalizeMaterialCategory).filter(Boolean))]
    .sort((a, b) => materialCategoryOrder(a) - materialCategoryOrder(b) || a.localeCompare(b, "vi", { sensitivity: "base" }));
}
const DIRECTORY_COLUMN_STORAGE = "ledome.directoryColumnWidths.v3";
const DIRECTORY_DEFAULT_WIDTHS = [80, 230, 160, 130, 150, 135, 135, 190, 280, 72];
const DIRECTORY_SUPPLIER_WIDTHS = [190, 230, 155, 130, 135, 135, 190, 310, 72];
const DIRECTORY_AUTO_WIDTH_RULES = [
  [64, 92], [130, 320], [120, 240], [120, 230], [110, 260],
  [120, 150], [120, 150], [140, 320], [220, 680], [72, 72]
];
const DIRECTORY_SUPPLIER_AUTO_WIDTH_RULES = [
  [150, 360], [130, 320], [120, 240], [120, 230],
  [120, 150], [120, 150], [140, 320], [220, 680], [72, 72]
];
const directoryColumnKey = (type) => type === "suppliers" ? `${DIRECTORY_COLUMN_STORAGE}.${type}.categoryFirst` : `${DIRECTORY_COLUMN_STORAGE}.${type}`;
const directoryDefaultWidths = (type) => type === "suppliers" ? DIRECTORY_SUPPLIER_WIDTHS : DIRECTORY_DEFAULT_WIDTHS;
const directoryAutoWidthRules = (type) => type === "suppliers" ? DIRECTORY_SUPPLIER_AUTO_WIDTH_RULES : DIRECTORY_AUTO_WIDTH_RULES;
function directoryColumnWidths(type, count) {
  const defaults = directoryDefaultWidths(type);
  try {
    const saved = JSON.parse(localStorage.getItem(directoryColumnKey(type)) || "[]");
    return Array.from({ length: count }, (_, index) => Math.max(56, Number(saved[index] || defaults[index] || 120)));
  } catch {
    return defaults.slice(0, count);
  }
}
function directoryColumnMarkup(type, count) {
  return `<colgroup>${directoryColumnWidths(type, count).map((width) => `<col style="width:${width}px">`).join("")}</colgroup>`;
}
function directoryAutoFitColumns(type) {
  const table = document.querySelector("[data-directory-table]");
  if (!table) return;
  const cols = [...table.querySelectorAll("col")];
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const font = getComputedStyle(table).font || "11px Inter, Segoe UI, Arial";
  if (ctx) ctx.font = font;
  const measure = (text) => ctx ? ctx.measureText(String(text || "").trim()).width : String(text || "").trim().length * 7;
  const rules = directoryAutoWidthRules(type);
  const widths = cols.map((_, index) => {
    const rule = rules[index] || [80, 260];
    const cells = [...table.querySelectorAll(`thead th:nth-child(${index + 1}), tbody td:nth-child(${index + 1})`)];
    const longest = cells.reduce((max, cell) => Math.max(max, measure(cell.textContent.replace(/\s+/g, " "))), 0);
    return Math.round(Math.min(Math.max(longest + 34, rule[0]), rule[1]));
  });
  localStorage.setItem(directoryColumnKey(type), JSON.stringify(widths));
  cols.forEach((col, index) => { col.style.width = `${widths[index]}px`; });
  const total = widths.reduce((sum, width) => sum + width, 0);
  table.style.width = `${Math.max(total, table.parentElement?.clientWidth || 0)}px`;
  table.style.minWidth = `${total}px`;
  bindOverflowTooltips(table);
}
function directoryHeaderMarkup(headers) {
  return headers.map((header, index) => `<th data-directory-col="${index}"><span>${escapeHtml(header)}</span>${index < headers.length - 1 ? `<button type="button" class="directory-col-resizer" data-directory-resize="${index}" aria-label="Đổi chiều rộng cột ${escapeHtml(header)}"></button>` : ""}</th>`).join("");
}
function bindOverflowTooltips(scope = document) {
  requestAnimationFrame(() => {
    scope.querySelectorAll(".directory-resizable-table th, .directory-resizable-table td").forEach((cell) => {
      if (cell.classList.contains("directory-actions")) return;
      const text = cell.textContent.replace(/\s+/g, " ").trim();
      if (!text) return;
      const clipped = cell.scrollWidth > cell.clientWidth + 1 || [...cell.children].some((child) => child.scrollWidth > child.clientWidth + 1);
      if (clipped) {
        if (!cell.title) cell.dataset.autoTitle = "1";
        cell.title = text;
      } else if (cell.dataset.autoTitle) {
        cell.removeAttribute("title");
        delete cell.dataset.autoTitle;
      }
    });
  });
}
function bindDirectoryColumnResize(type) {
  const table = document.querySelector("[data-directory-table]");
  if (!table) return;
  const cols = [...table.querySelectorAll("col")];
  let drag = null;
  const setTableWidth = () => {
    const total = cols.reduce((sum, col) => sum + Number.parseFloat(col.style.width || 0), 0);
    table.style.width = `${Math.max(total, table.parentElement?.clientWidth || 0)}px`;
    table.style.minWidth = `${total}px`;
  };
  setTableWidth();
  table.querySelectorAll("[data-directory-resize]").forEach((handle) => {
    handle.onpointerdown = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const index = Number(handle.dataset.directoryResize);
      drag = { index, startX: event.clientX, startWidth: Number.parseFloat(cols[index].style.width || directoryDefaultWidths(type)[index] || 120) };
      handle.setPointerCapture(event.pointerId);
      table.classList.add("column-resizing");
    };
    handle.onpointermove = (event) => {
      if (!drag) return;
      const nextWidth = Math.max(56, drag.startWidth + event.clientX - drag.startX);
      cols[drag.index].style.width = `${nextWidth}px`;
      setTableWidth();
    };
    handle.onpointerup = (event) => {
      if (!drag) return;
      handle.releasePointerCapture(event.pointerId);
      table.classList.remove("column-resizing");
      localStorage.setItem(directoryColumnKey(type), JSON.stringify(cols.map((col) => Math.round(Number.parseFloat(col.style.width || 0)))));
      drag = null;
      bindOverflowTooltips(table);
    };
  });
}

function supplierCategoryParts(value) {
  return String(value || "")
    .replace(/\s*\+\d+\s*$/u, "")
    .split(/[,\n;]/u)
    .map(normalizeMaterialCategory)
    .filter(Boolean);
}

function supplierNoteCategories(note) {
  return [...String(note || "").matchAll(/^Nguồn:\s*(.+)$/gimu)]
    .map((match) => normalizeMaterialCategory(match[1]))
    .filter(Boolean);
}

function supplierCategories(row) {
  return sortMaterialCategories([...supplierCategoryParts(row[5]), ...supplierNoteCategories(row[9])]);
}

function supplierDisplayCategory(row) {
  return supplierCategories(row).join(", ") || String(row[5] || "Khác");
}

function supplierPrimaryCategory(row) {
  return supplierCategories(row)[0] || String(row[5] || "");
}

function supplierCategoryOptions(rows) {
  return ["Tất cả", ...sortMaterialCategories(materialCategoryOptions())];
}

function supplierCategoryFieldMarkup() {
  return `<fieldset class="directory-multi directory-form-wide"><legend>Hạng mục vật tư</legend><div class="directory-check-list">${materialCategoryOptions().map((option) => `<label class="directory-check"><input type="checkbox" name="supplierCategories" value="${escapeHtml(option)}"><span>${escapeHtml(option)}</span></label>`).join("")}</div></fieldset>`;
}

function setSupplierCategoryChecks(form, categories = []) {
  const selected = new Set(sortMaterialCategories(categories));
  form.querySelectorAll('input[name="supplierCategories"]').forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function supplierSelectedFormCategories(form) {
  return sortMaterialCategories([...form.querySelectorAll('input[name="supplierCategories"]:checked')].map((input) => input.value));
}

function directoryFilterMarkup(type, supplierOptions = []) {
  const options = type === "suppliers" ? supplierOptions : ["Tất cả", "Đang hợp tác", "Tiềm năng", "Tạm ngưng"];
  return `<select id="directory-filter">${options.map((option) => `<option>${escapeHtml(option)}</option>`).join("")}</select>`;
}

function directoryRowMarkup(type, row) {
  if (type === "suppliers") {
    return `<tr><td>${escapeHtml(supplierDisplayCategory(row))}</td><td>${escapeHtml(row[1])}</td><td>${escapeHtml(row[2])}</td><td>${escapeHtml(row[3])}</td><td class="directory-money">${money(row[6])}</td><td class="directory-money">${money(row[7])}</td><td>${crmProjects(row[8])}</td><td class="directory-note" title="${escapeHtml(row[9])}">${escapeHtml(row[9])}</td><td class="directory-actions"><button title="Chỉnh sửa" data-directory="edit" data-code="${escapeHtml(row[0])}">✎</button><button title="Xóa" data-directory="delete" data-code="${escapeHtml(row[0])}">×</button></td></tr>`;
  }
  return `<tr><td><b>${escapeHtml(row[0])}</b></td><td>${escapeHtml(row[1])}</td><td>${escapeHtml(row[2])}</td><td>${escapeHtml(row[3])}</td><td>${escapeHtml(row[5])}</td><td class="directory-money">${money(row[6])}</td><td class="directory-money">${money(row[7])}</td><td>${crmProjects(row[8])}</td><td class="directory-note" title="${escapeHtml(row[9])}">${escapeHtml(row[9])}</td><td class="directory-actions"><button title="Chỉnh sửa" data-directory="edit" data-code="${escapeHtml(row[0])}">✎</button><button title="Xóa" data-directory="delete" data-code="${escapeHtml(row[0])}">×</button></td></tr>`;
}

async function loadPartnerRows(type) {
  try {
    const body = await api(`/partners/${type}`);
    CRM_DIRECTORY[type].rows = Array.isArray(body.data) ? body.data : CRM_DIRECTORY[type].rows;
  } catch (error) {
    console.warn("Cannot load partners", error);
  }
  return CRM_DIRECTORY[type].rows;
}

async function savePartnerRows(type) {
  const body = await api(`/partners/${type}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rows: CRM_DIRECTORY[type].rows })
  });
  CRM_DIRECTORY[type].rows = body.data || CRM_DIRECTORY[type].rows;
}

async function crmDirectory(type) {
  const config = CRM_DIRECTORY[type];
  const isSupplier = type === "suppliers";
  if (isSupplier || type === "contractors") await loadCatalogData();
  await loadPartnerRows(type);
  const groupLabel = type === "customers" ? "Khu vực" : "Hạng mục";
  const supplierOptions = isSupplier ? supplierCategoryOptions(config.rows) : [];
  if (isSupplier && state.crmSupplierCategory !== "Tất cả" && !supplierOptions.includes(state.crmSupplierCategory)) state.crmSupplierCategory = "Tất cả";
  const headers = isSupplier
    ? ["Hạng mục", `Tên ${config.singular}`, "Người liên hệ", "Số điện thoại", "Công nợ phải thu", "Công nợ phải trả", "Tên dự án", "Ghi chú", ""]
    : ["Mã", `Tên ${config.singular}`, "Người liên hệ", "Số điện thoại", groupLabel, "Công nợ phải thu", "Công nợ phải trả", "Tên dự án", "Ghi chú", ""];
  const query = state.crmQuery.toLocaleLowerCase("vi");
  const rows = config.rows
    .filter((row) => {
      const searchText = isSupplier ? [...row, supplierDisplayCategory(row)].join(" ") : row.join(" ");
      const matchQuery = !query || searchText.toLocaleLowerCase("vi").includes(query);
      const matchFilter = isSupplier ? state.crmSupplierCategory === "Tất cả" || supplierCategories(row).includes(state.crmSupplierCategory) : state.crmStatus === "Tất cả" || row[4] === state.crmStatus;
      return matchQuery && matchFilter;
    })
    .sort((a, b) => isSupplier
      ? supplierPrimaryCategory(a).localeCompare(supplierPrimaryCategory(b), "vi", { sensitivity: "base" }) || String(a[0]).localeCompare(String(b[0]), "vi", { numeric: true })
      : 0);
  setTitle(type, "");
  $("#app").innerHTML = `<section class="directory">
    <header class="directory-head"><div><h2>${config.icon} ${config.title}</h2><p>Quản lý danh sách và thông tin liên hệ</p></div><button class="btn" data-directory="add">＋ Thêm ${config.singular}</button></header>
    <div class="directory-summary"><article><small>Tổng số</small><b>${config.rows.length}</b><span>${config.title.toLowerCase()} đã lưu</span></article><article><small>Đang hợp tác</small><b>${config.rows.filter((x) => x[4] === "Đang hợp tác").length}</b><span>Đang hoạt động</span></article><article><small>Tiềm năng</small><b>${config.rows.filter((x) => x[4] === "Tiềm năng").length}</b><span>Cần tiếp tục theo dõi</span></article></div>
    <div class="directory-tools"><input id="directory-search" value="${escapeHtml(state.crmQuery)}" placeholder="⌕ Tìm theo mã, tên hoặc người liên hệ">${directoryFilterMarkup(type, supplierOptions)}<button class="directory-auto-fit" data-directory="auto-fit">Tự xếp</button><button data-directory="add">＋ Thêm mới</button></div>
    <div class="directory-table-wrap"><table class="directory-table directory-table-wide directory-resizable-table" data-directory-table="${type}">${directoryColumnMarkup(type, headers.length)}<thead><tr>${directoryHeaderMarkup(headers)}</tr></thead><tbody>${rows.map((row) => directoryRowMarkup(type, row)).join("")}</tbody></table></div>
    <div class="directory-empty ${rows.length ? "" : "open"}">Không tìm thấy dữ liệu phù hợp.</div>${crmDirectoryModal(config, groupLabel, type)}
  </section>`;
  $("#directory-filter").value = isSupplier ? state.crmSupplierCategory : state.crmStatus;
  bindCrmDirectory(type);
  bindDirectoryColumnResize(type);
  bindOverflowTooltips($("#app"));
}

function crmDirectoryModal(config, groupLabel = "Nhóm", type = "") {
  const groupField = type === "suppliers"
    ? supplierCategoryFieldMarkup()
    : type === "contractors"
      ? `<label>${groupLabel}<select name="group">${constructionCategoryOptions().map((option) => `<option>${escapeHtml(option)}</option>`).join("")}</select></label>`
      : `<label>${groupLabel}<input name="group" placeholder="Nhập ${groupLabel.toLowerCase()}"></label>`;
  return `<div class="directory-modal" id="directory-modal"><form id="directory-form"><header><h3 id="directory-modal-title">Thêm ${config.singular}</h3><button type="button" data-directory="close">×</button></header><input type="hidden" name="currentCode"><label>Mã<input name="code" required></label><label>Tên ${config.singular}<input name="name" required placeholder="Nhập tên"></label><label>Người liên hệ<input name="contact" required placeholder="Nhập họ tên"></label><label>Số điện thoại<input name="phone" placeholder="Nhập số điện thoại"></label><label>Trạng thái<select name="status"><option>Đang hợp tác</option><option>Tiềm năng</option><option>Tạm ngưng</option></select></label>${groupField}<label>Công nợ phải thu<input name="receivable" inputmode="numeric" data-money-input placeholder="0"></label><label>Công nợ phải trả<input name="payable" inputmode="numeric" data-money-input placeholder="0"></label><label class="directory-form-wide">Tên dự án<input name="projects" placeholder="Nhập nhiều dự án, phân cách bằng dấu phẩy"></label><label class="directory-form-wide">Ghi chú<textarea name="note" placeholder="Nhập ghi chú"></textarea></label><footer><button type="button" class="btn secondary" data-directory="close">Đóng</button><button class="btn">Lưu</button></footer></form></div>`;
}

function bindCrmDirectory(type) {
  const config = CRM_DIRECTORY[type];
  const isSupplier = type === "suppliers";
  const modal = $("#directory-modal");
  const form = $("#directory-form");
  $("#directory-search").oninput = (event) => { state.crmQuery = event.target.value; crmDirectory(type); };
  $("#directory-filter").onchange = (event) => {
    if (isSupplier) state.crmSupplierCategory = event.target.value;
    else state.crmStatus = event.target.value;
    crmDirectory(type);
  };
  form.querySelectorAll("[data-money-input]").forEach((input) => {
    input.oninput = () => {
      input.value = input.value.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };
  });
  $("#app").onclick = async (event) => {
    const button = event.target.closest("[data-directory]");
    if (!button) return;
    const action = button.dataset.directory;
    if (action === "close") return modal.classList.remove("open");
    if (action === "auto-fit") return directoryAutoFitColumns(type);
    if (action === "add") {
      form.reset();
      form.elements.currentCode.value = "";
      form.elements.code.value = `${config.code}${String(config.rows.length + 1).padStart(3, "0")}`;
      if (isSupplier) setSupplierCategoryChecks(form, []);
      $("#directory-modal-title").textContent = `Thêm ${config.singular}`;
      return modal.classList.add("open");
    }
    const index = config.rows.findIndex((row) => row[0] === button.dataset.code);
    if (action === "delete" && index >= 0) {
      if (confirm(`Xóa ${config.singular} "${config.rows[index][1]}"?`)) {
        config.rows.splice(index, 1);
        await savePartnerRows(type);
      }
      return crmDirectory(type);
    }
    if (action === "edit" && index >= 0) {
      const row = config.rows[index];
      ["code","name","contact","phone","status"].forEach((name, i) => { form.elements[name].value = row[i]; });
      if (isSupplier) setSupplierCategoryChecks(form, supplierCategories(row));
      else form.elements.group.value = row[5];
      form.elements.receivable.value = moneyInput(row[6]);
      form.elements.payable.value = moneyInput(row[7]);
      form.elements.projects.value = row[8].join(", ");
      form.elements.note.value = row[9];
      form.elements.currentCode.value = row[0];
      $("#directory-modal-title").textContent = `Chỉnh sửa ${config.singular}`;
      return modal.classList.add("open");
    }
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const categories = isSupplier ? supplierSelectedFormCategories(form) : [];
    if (isSupplier && !categories.length) {
      alert("Chọn ít nhất một hạng mục vật tư cho nhà cung cấp.");
      return;
    }
    const row = [data.code, data.name, data.contact, data.phone, data.status, isSupplier ? categories.join(", ") : data.group, parseMoneyInput(data.receivable), parseMoneyInput(data.payable), data.projects.split(",").map((project) => project.trim()).filter(Boolean), data.note];
    const index = config.rows.findIndex((item) => item[0] === data.currentCode);
    if (index >= 0) config.rows[index] = row;
    else config.rows.unshift(row);
    await savePartnerRows(type);
    crmDirectory(type);
  };
}

const DRIVE_STORAGE = "ledome.drive.v1";
const DRIVE_SEED = [
  ["DRV001","Hồ sơ pháp lý công ty.pdf","PDF","Công ty","Hành chính","DINH Công Hoàng","03/06/2026",2450,"Ban lãnh đạo","Tài liệu dùng chung nội bộ"],
  ["DRV002","Mẫu hợp đồng thiết kế.docx","Word","Mẫu biểu","Hợp đồng","Trần Văn Đức","02/06/2026",820,"Toàn công ty","Mẫu cập nhật 2026"],
  ["DRV003","Báo giá vật liệu hoàn thiện.xlsx","Excel","Dự án","Vật liệu","Hoàng Thu Mai","01/06/2026",1260,"Thi công, Kế toán","Bảng tham khảo NCC"],
  ["DRV004","Concept HDT 17T5.pdf","PDF","Dự án","HDT 17T5","DINH Công Hoàng","31/05/2026",10511,"Phòng thiết kế","File concept mới nhất"],
  ["DRV005","Ảnh hiện trạng Mandarin Garden.zip","ZIP","Dự án","MG D608","Nguyễn Hoàng Hải","30/05/2026",84200,"Thiết kế, Thi công","Ảnh khảo sát hiện trạng"],
  ["DRV006","Quy trình chấm công công trình.pdf","PDF","Nhân sự","Chấm công","Nguyễn Tuấn Anh","29/05/2026",1680,"Toàn công ty","Hướng dẫn dùng điện thoại GPS"],
  ["DRV007","Danh sách nhà thầu thi công.xlsx","Excel","Đối tác","Nhà thầu","Bùi Xuân Dũng","28/05/2026",940,"Ban lãnh đạo, Thi công","Đang rà soát năng lực"],
  ["DRV008","Biên bản họp giao ban 06-2026.docx","Word","Công ty","Điều hành","DINH Công Hoàng","27/05/2026",360,"Toàn công ty","Nội dung họp đầu tháng"]
];

async function loadDriveFiles() {
  try {
    const body = await api("/drive");
    return Array.isArray(body.data) ? body.data : structuredClone(DRIVE_SEED);
  } catch {
    return structuredClone(DRIVE_SEED);
  }
}

async function saveDriveFiles(files) {
  await api("/drive", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ files })
  });
}

function driveIcon(type) {
  return type === "PDF" ? "PDF" : type === "Excel" ? "XLS" : type === "Word" ? "DOC" : type === "PowerPoint" ? "PPT" : type === "Ảnh" ? "IMG" : type === "ZIP" ? "ZIP" : "FILE";
}

function driveBadge(scope) {
  const cls = scope === "Toàn công ty" ? "done" : scope.includes("Ban lãnh đạo") ? "danger" : "";
  return `<i class="finance-badge ${cls}">${escapeHtml(scope)}</i>`;
}

function driveTypeFromName(name) {
  const ext = String(name || "").split(".").pop().toLowerCase();
  if (ext === "pdf") return "PDF";
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "Ảnh";
  if (["xls", "xlsx", "csv"].includes(ext)) return "Excel";
  if (["doc", "docx"].includes(ext)) return "Word";
  if (["ppt", "pptx"].includes(ext)) return "PowerPoint";
  if (ext === "zip") return "ZIP";
  return "File";
}

const DRIVE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.md,.note,.zip";
const DRIVE_ALLOWED_EXTENSIONS = new Set(DRIVE_ACCEPT.split(","));
const DRIVE_PREVIEW_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".ppt", ".pptx", ".txt", ".md", ".note"]);
const driveExt = (name) => {
  const match = String(name || "").toLowerCase().match(/\.[^.\\/]+$/);
  return match ? match[0] : "";
};
const driveRelativeName = (file) => String(file?.driveRelativePath || file?.relativePath || file?.webkitRelativePath || file?.name || "").replace(/\\/g, "/").replace(/^\/+/, "");
const driveFolderTopic = (name) => name.includes("/") ? name.split("/").slice(0, -1).join("/") : "Chia sẻ nhanh";
const driveDownloadUrl = (file) => `/api/v1/drive-files/download?storedName=${encodeURIComponent(file[10])}`;
const driveViewUrl = (file) => `/api/v1/drive-files/view?storedName=${encodeURIComponent(file[10])}`;
const drivePreviewUrl = (file) => `/api/v1/drive-files/preview?storedName=${encodeURIComponent(file[10])}`;
const driveIsAllowedFile = (file) => DRIVE_ALLOWED_EXTENSIONS.has(driveExt(driveRelativeName(file) || file?.name));
const drivePreviewKind = (name) => {
  const ext = driveExt(name);
  if (ext === ".pdf") return "pdf";
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return "image";
  if ([".doc", ".docx", ".xls", ".xlsx", ".csv", ".ppt", ".pptx", ".txt", ".md", ".note"].includes(ext)) return "office";
  return "file";
};
const driveCanPreview = (file) => DRIVE_PREVIEW_EXTENSIONS.has(driveExt(file?.[1]));

function driveExpiryLabel(value) {
  const expiresAt = Date.parse(value || "");
  if (!Number.isFinite(expiresAt)) return "Tự xóa sau 7 ngày";
  const days = Math.max(0, Math.ceil((expiresAt - Date.now()) / 86400000));
  return days > 0 ? `Còn ${days} ngày` : "Sắp tự xóa";
}

async function uploadDriveFile(file, displayName = file.name) {
  const response = await fetch(`/api/v1/drive-files?name=${encodeURIComponent(displayName)}`, {
    method: "POST",
    credentials: "same-origin",
    body: file
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Upload ${response.status}`);
  return body;
}

function driveRowsMarkup(rows) {
  return rows.map(({ file, originalIndex }) => {
    const canPreview = driveCanPreview(file);
    const fileOpen = canPreview ? `<button type="button" class="drive-file drive-file-button" data-drive="preview" data-index="${originalIndex}" title="Click để đọc nhanh">` : `<div class="drive-file">`;
    const fileClose = canPreview ? "</button>" : "</div>";
    const actions = `<button data-drive="download" data-index="${originalIndex}">Tải</button><button data-drive="delete" data-index="${originalIndex}">×</button>`;
    return `<tr><td>${fileOpen}<b>${driveIcon(file[2])}</b><span>${escapeHtml(file[1])}<small>${escapeHtml(file[0])} · ${escapeHtml(file[2])} · ${escapeHtml(driveExpiryLabel(file[12]))}</small></span>${fileClose}</td><td>${escapeHtml(file[5])}</td><td>${financeDate(file[6])}</td><td>${money(file[7])} KB</td><td>${driveBadge(file[8])}</td><td>${escapeHtml(file[9])}</td><td class="drive-actions">${actions}</td></tr>`;
  }).join("");
}

function drivePreviewContent(data) {
  if (data.text) return `<pre>${escapeHtml(data.text)}</pre>`;
  if (data.message) return `<div class="drive-preview-empty">${escapeHtml(data.message)}</div>`;
  if (Array.isArray(data.sheets)) {
    return data.sheets.map((sheet) => `<section><h4>${escapeHtml(sheet.title)}</h4><div class="drive-preview-table-wrap"><table>${(sheet.rows || []).map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("") || `<tr><td>Không có dữ liệu xem nhanh.</td></tr>`}</table></div></section>`).join("");
  }
  if (Array.isArray(data.sections)) {
    return data.sections.map((section) => `<section><h4>${escapeHtml(section.title)}</h4>${(section.lines || []).map((line) => `<p>${escapeHtml(line)}</p>`).join("") || `<p>Không có nội dung text để xem nhanh.</p>`}</section>`).join("");
  }
  return `<div class="drive-preview-empty">Không có nội dung xem nhanh.</div>`;
}

async function openDrivePreview(file) {
  if (!file?.[10]) return alert("File mẫu chưa có bản lưu trữ thật để đọc nhanh.");
  const title = escapeHtml(file[1]);
  const kind = drivePreviewKind(file[1]);
  const viewUrl = driveViewUrl(file);
  const shell = (body, cls = "") => `<div class="drive-preview-modal ${cls}"><section><header><h3>${title}</h3><div><a href="${driveDownloadUrl(file)}" download>Tải file</a><button type="button" data-drive-preview-close>×</button></div></header><main class="drive-preview-body">${body}</main></section></div>`;
  const body = kind === "image"
    ? `<img src="${viewUrl}" alt="${title}">`
    : kind === "pdf"
      ? `<iframe src="${viewUrl}" title="${title}"></iframe>`
      : `<div class="drive-preview-empty">Đang đọc nhanh nội dung...</div>`;
  document.body.insertAdjacentHTML("beforeend", shell(body, kind));
  const modal = document.querySelector(".drive-preview-modal");
  const close = () => {
    modal?.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (event) => { if (event.key === "Escape") close(); };
  modal.querySelector("[data-drive-preview-close]").onclick = close;
  document.addEventListener("keydown", onKey);
  if (kind === "office") {
    try {
      const response = await fetch(drivePreviewUrl(file), { credentials: "same-origin" });
      const bodyJson = await response.json();
      if (!response.ok) throw new Error(bodyJson.error || "Không đọc được file.");
      modal.querySelector(".drive-preview-body").innerHTML = drivePreviewContent(bodyJson.data || {});
    } catch (error) {
      modal.querySelector(".drive-preview-body").innerHTML = `<div class="drive-preview-empty">${escapeHtml(error.message || "Không đọc được file.")}</div>`;
    }
  }
}

function driveFileWithPath(file, relativePath) {
  try {
    Object.defineProperty(file, "driveRelativePath", { value: relativePath, configurable: true });
  } catch {
    file.driveRelativePath = relativePath;
  }
  return file;
}

function driveEntryFiles(entry, prefix = "") {
  return new Promise((resolve) => {
    if (!entry) return resolve([]);
    if (entry.isFile) {
      return entry.file((file) => resolve([driveFileWithPath(file, `${prefix}${file.name}`)]), () => resolve([]));
    }
    if (!entry.isDirectory) return resolve([]);
    const reader = entry.createReader();
    const all = [];
    const readBatch = () => reader.readEntries(async (entries) => {
      if (!entries.length) return resolve(all.flat());
      all.push(...await Promise.all(entries.map((child) => driveEntryFiles(child, `${prefix}${entry.name}/`))));
      readBatch();
    }, () => resolve(all.flat()));
    readBatch();
  });
}

async function driveDroppedFiles(dataTransfer) {
  const items = Array.from(dataTransfer?.items || []);
  const entries = items.map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
  if (entries.length) return (await Promise.all(entries.map((entry) => driveEntryFiles(entry)))).flat();
  return Array.from(dataTransfer?.files || []);
}

async function renderDrive() {
  const files = await loadDriveFiles();
  const query = state.driveQuery.toLocaleLowerCase("vi");
  const filtered = files.map((file, originalIndex) => ({ file, originalIndex })).filter(({ file }) => !query || file.join(" ").toLocaleLowerCase("vi").includes(query));
  const totalSize = files.reduce((sum,file) => sum + Number(file[7] || 0), 0);
  setTitle("drive", "");
  $("#app").innerHTML = `<section class="drive-page">
    <header class="drive-head"><div><h2>▰ LE DOME DRIVE</h2><p>Nơi các thành viên gửi nhanh file. File lưu tại đây sẽ tự động xóa sau 1 tuần.</p></div><button class="btn" data-drive="open-upload">＋ Chia sẻ file</button></header>
    <div class="finance-kpis drive-kpis"><article><small>Tổng file</small><b>${files.length}</b><span>Đang chia sẻ nội bộ</span></article><article><small>Dung lượng</small><b>${money(totalSize)} KB</b><span>Tổng dung lượng hiện có</span></article><article><small>Thời hạn lưu</small><b>7 ngày</b><span>Tự xóa file tải lên</span></article><article><small>Toàn công ty</small><b>${files.filter((file) => file[8] === "Toàn công ty").length}</b><span>Ai cũng xem được</span></article></div>
    <div class="drive-layout">
      <main class="drive-main"><p class="drive-rule">Le DOME Drive dùng để gửi nhanh file cho đội nội bộ. File tải lên được lưu tạm và tự động xóa sau 7 ngày.</p><label class="drive-drop" id="drive-drop"><input id="drive-upload-input" type="file" multiple accept="${DRIVE_ACCEPT}"><strong>Kéo thả file hoặc folder vào đây</strong><span>Hỗ trợ đọc nhanh PDF, JPEG, PNG, Word, Excel, PowerPoint. Có thể thả cả folder.</span><em>${escapeHtml(state.driveUploadMessage || "Hoặc bấm để chọn file từ máy. File mới sẽ được thêm thẳng vào Drive và tự xóa sau 7 ngày.")}</em></label><div class="drive-tools"><input id="drive-search" value="${escapeHtml(state.driveQuery)}" placeholder="Tìm tên file, folder, người chia sẻ, ghi chú"><button data-drive="reset">Khôi phục mẫu</button></div><div class="drive-table-wrap"><table class="drive-table"><thead><tr><th>File</th><th>Người chia sẻ</th><th>Cập nhật</th><th>Dung lượng</th><th>Quyền xem</th><th>Ghi chú</th><th></th></tr></thead><tbody>${driveRowsMarkup(filtered) || `<tr><td colspan="7">Chưa có file phù hợp.</td></tr>`}</tbody></table></div></main>
    </div>
    <div class="finance-modal" id="drive-modal"><form id="drive-form"><header><h3>Chia sẻ file</h3><button type="button" data-drive="close-upload">×</button></header><label class="wide">Tên file<input name="name" required placeholder="VD: Hợp đồng mẫu.docx"></label><label>Loại<select name="type"><option>PDF</option><option>Word</option><option>Excel</option><option>ZIP</option><option>File</option></select></label><label>Thuộc mục<input name="topic" placeholder="VD: HDT 17T5"></label><label>Quyền xem<input name="scope" value="Toàn công ty"></label><label class="wide">Ghi chú<textarea name="note" placeholder="Mô tả ngắn về file"></textarea></label><footer><button type="button" class="btn secondary" data-drive="close-upload">Đóng</button><button class="btn">Lưu chia sẻ</button></footer></form></div>
  </section>`;
  bindDrive();
}

function bindDrive() {
  $("#drive-search").oninput = (event) => { state.driveQuery = event.target.value; renderDrive(); };
  const uploadInput = $("#drive-upload-input");
  const dropZone = $("#drive-drop");
  const handleFiles = async (items) => {
    const incoming = Array.from(items || []).filter((file) => file && file.name);
    const picked = incoming.filter(driveIsAllowedFile);
    const skipped = incoming.length - picked.length;
    if (!picked.length) {
      if (skipped) {
        state.driveUploadMessage = `Đã bỏ qua ${skipped} file chưa hỗ trợ.`;
        renderDrive();
      }
      return;
    }
    state.driveUploadMessage = `Đang tải lên ${picked.length} file${skipped ? `, bỏ qua ${skipped} file chưa hỗ trợ` : ""}...`;
    renderDrive();
    try {
      const files = await loadDriveFiles();
      for (const file of picked) {
        const displayName = driveRelativeName(file) || file.name;
        const stored = await uploadDriveFile(file, displayName);
        const updatedAt = stored.updatedAt || new Date().toISOString();
        const expiresAt = stored.expiresAt || new Date(Date.now() + 7 * 86400000).toISOString();
        files.unshift([`DRV${String(files.length + 1).padStart(3, "0")}`, displayName, driveTypeFromName(displayName), "Chia sẻ", driveFolderTopic(displayName), state.account?.staffName || "LE DOME", updatedAt.slice(0, 10), Math.max(1, Math.ceil(file.size / 1024)), "Toàn công ty", "File gửi nhanh, tự xóa sau 7 ngày", stored.storedName, updatedAt, expiresAt]);
      }
      await saveDriveFiles(files);
      state.driveUploadMessage = `Đã tải lên ${picked.length} file${skipped ? `, bỏ qua ${skipped} file chưa hỗ trợ.` : "."}`;
      renderDrive();
    } catch (error) {
      state.driveUploadMessage = error.message || "Không tải file lên được.";
      renderDrive();
    }
  };
  uploadInput.onchange = (event) => handleFiles(event.target.files);
  ["dragenter", "dragover"].forEach((type) => {
    dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.classList.add("dragging");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.classList.remove("dragging");
    });
  });
  dropZone.ondrop = async (event) => handleFiles(await driveDroppedFiles(event.dataTransfer));
  $("#app").onclick = async (event) => {
    const action = event.target.closest("[data-drive]")?.dataset.drive;
    if (!action) return;
    const modal = $("#drive-modal");
    const files = await loadDriveFiles();
    if (action === "open-upload") return modal.classList.add("open");
    if (action === "close-upload") return modal.classList.remove("open");
    if (action === "reset" && confirm("Khôi phục danh sách file chia sẻ mẫu?")) {
      await saveDriveFiles(structuredClone(DRIVE_SEED));
      return renderDrive();
    }
    const index = Number(event.target.closest("[data-index]")?.dataset.index);
    if (action === "preview" && Number.isInteger(index)) {
      await openDrivePreview(files[index]);
      return;
    }
    if (action === "download") {
      if (!files[index]?.[10]) return alert("File mẫu chưa có bản lưu trữ thật để tải.");
      location.href = `/api/v1/drive-files/download?storedName=${encodeURIComponent(files[index][10])}`;
      return;
    }
    if (action === "delete" && Number.isInteger(index) && confirm("Xóa file chia sẻ này?")) {
      if (files[index]?.[10]) {
        try { await api(`/drive-files?storedName=${encodeURIComponent(files[index][10])}`, { method: "DELETE" }); } catch {}
      }
      files.splice(index, 1);
      await saveDriveFiles(files);
      return renderDrive();
    }
  };
  $("#drive-form").onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const files = await loadDriveFiles();
    files.unshift([`DRV${String(files.length + 1).padStart(3, "0")}`, data.name, data.type, "Chia sẻ", data.topic, state.account?.staffName || "LE DOME", new Date().toISOString().slice(0, 10), 0, data.scope, data.note]);
    await saveDriveFiles(files);
    renderDrive();
  };
}

const FINANCE_SEED = {
  transactions: [
    ["2026-01-12","Chi","DỰ ÁN","VAY","","","",30000000,"","",""],
    ["2026-01-12","Chi","LE DOME","ĐẦU TƯ","QUÀ CÁP","QUÀ","Phong bì lì xì cuối năm",4200000,"","",""],
    ["2026-01-15","Thu","DỰ ÁN","38TQK","HỢP ĐỒNG THI CÔNG","LE DOME","",60348000,"","",""],
    ["2026-01-15","Chi","LE DOME","LƯƠNG","LƯƠNG","LE DOME","Lương nhân viên T12",108128000,"","",""],
    ["2026-01-15","Chi","LE DOME","VẬN HÀNH","ĐIỆN","EVN","Tiền điện văn phòng",3000000,"","",""],
    ["2026-01-20","Chi","DỰ ÁN","A LUYẾN","THI CÔNG THÔ","VHD","",15000000,"","",""],
    ["2026-02-05","Chi","LE DOME","VẬN HÀNH","KHÁC","LE DOME","Vệ sinh văn phòng",300000,"","",""],
    ["2026-02-05","Chi","LE DOME","ĂN UỐNG VUI CHƠI","ĂN UỐNG VUI CHƠI","LE DOME","Trà chiều",210000,"","",""],
    ["2026-02-09","Chi","DỰ ÁN","A LUYẾN","THI CÔNG THÔ","VHD","",17500000,"","",""],
    ["2026-03-03","Thu","DỰ ÁN","6ATS","HỢP ĐỒNG THI CÔNG","Anh Phan","Tạm ứng thi công",212000000,"","",""],
    ["2026-04-10","Thu","DỰ ÁN","TQB","HỢP ĐỒNG THI CÔNG","Khách hàng","Thu đợt 1",50000000,"","",""],
    ["2026-05-18","Thu","DỰ ÁN","HDT 17T5","HỢP ĐỒNG THIẾT KẾ","Anh Việt","Thu thiết kế",15000000,"","",""],
    ["2026-05-20","Thu","DỰ ÁN","PN AN HUNG","HỢP ĐỒNG THIẾT KẾ","Bách","Thu thiết kế",7000000,"","",""],
    ["2026-06-01","Chi","LE DOME","VẬN HÀNH","THUÊ NHÀ","MAI","Thuê văn phòng",8000000,"","",""]
  ],
  projects: [
    ["PN ADINH","Căn hộ PN An Định","Anh Định","Thiết kế + thi công nội thất","Hoàn thành","Hoàng",0,0,16000000,17000000,-1000000,0,0,"Cần rà soát"],
    ["A LUYẾN","A Luyến","A Luyến","Thi công nội thất","Hoàn thành","Dũng",0,0,289017000,80543000,20263780,0,0,"Ổn"],
    ["38TQK","Nhà phố 38 TQK","Chưa cập nhật","Thi công nội thất","Hoàn thành","Dũng",0,0,150830000,99545000,51285000,0,0,"Ổn"],
    ["6ATS","Nhà phố 6A Sơn Tây","Anh Phan","Thiết kế + thi công nội thất","Đang thi công","Hoàng + Hải",0,0,367700000,295342000,72358000,0,0,"Ổn"],
    ["TQB","Tạ Quang Bửu","Chưa cập nhật","Thi công nội thất","Hoàn thành","Dũng",0,0,120000000,86733000,33267000,0,0,"Ổn"],
    ["VPH","Nhà phố VPH","Chưa cập nhật","Thi công nội thất","Đang thi công","Dũng",0,0,24000000,37955000,-13955000,0,0,"Không ổn"],
    ["HDT 17T5","Cải tạo Căn hộ","Anh Việt, bác Thảo","Thiết kế + thi công nội thất","Đang thiết kế","Hoàng",0,0,15000000,0,15000000,0,0,"Ổn"],
    ["PN AN HUNG","Cải tạo Căn hộ","Bách","Thiết kế + thi công nội thất","Đang thiết kế","Hoàng",0,0,7000000,0,7000000,0,0,"Ổn"],
    ["MG D608","Căn hộ duplex Mandarine","Anh Kiên","Thiết kế + thi công nội thất","Đang thiết kế","Hoàng",0,0,0,0,0,0,0,"Theo dõi"]
  ],
  budgets: [
    ["6ATS","Nhà phố 6A Sơn Tây","Thi công thô","VHD",150000000,145000000,0,128000000,17000000,88,"Ổn"],
    ["6ATS","Nhà phố 6A Sơn Tây","Gỗ nội thất","NAM VƯƠNG",98000000,92000000,0,87000000,5000000,95,"Sắp vượt"],
    ["VPH","Nhà phố VPH","Điện nước","NCC QUANG PANA",42000000,39000000,6000000,37955000,7045000,97,"Sắp vượt"],
    ["HDT 17T5","Cải tạo Căn hộ","Hồ sơ thiết kế","LE DOME",15000000,15000000,0,0,15000000,0,"Ổn"]
  ],
  debts: [
    ["2026-05-20","Phải thu","HDT 17T5","Anh Việt","Hợp đồng thiết kế","Đợt chốt concept",15000000,15000000,0,"2026-06-05","Đã xong",""],
    ["2026-05-25","Phải trả","6ATS","NAM VƯƠNG","Gỗ nội thất","Thanh toán xưởng gỗ",92000000,60000000,32000000,"2026-06-10","Đến hạn","Cần đối soát KL"],
    ["2026-05-28","Phải trả","VPH","NCC QUANG PANA","Điện nước","Vật tư điện nước",39000000,18000000,21000000,"2026-06-08","Đến hạn",""],
    ["2026-05-30","Phải thu","6ATS","Anh Phan","Hợp đồng thi công","Thu đợt tiếp theo",90000000,0,90000000,"2026-06-12","Chưa thu",""]
  ]
};

const FINANCE_PROJECT_GROUP = "DỰ ÁN";
const FINANCE_OPERATION_GROUP = "VẬN HÀNH LE DOME";
const FINANCE_CAPITAL_GROUP = "TÀI CHÍNH";
const FINANCE_GROUPS = [FINANCE_PROJECT_GROUP, FINANCE_OPERATION_GROUP, FINANCE_CAPITAL_GROUP];
const FINANCE_FILTER_FIELDS = [
  { key: "type", label: "Loại", rowIndex: 1 },
  { key: "group", label: "Nhóm", rowIndex: 2 },
  { key: "topic", label: "Chủ đề", rowIndex: 3 },
  { key: "category", label: "Hạng mục", rowIndex: 4 },
  { key: "partner", label: "Đối tượng", rowIndex: 5 }
];

function normalizeFinanceGroup(value) {
  const text = String(value || "").trim().toLocaleUpperCase("vi");
  if (text === "LE DOME" || text === "VẬN HÀNH LE DOME") return FINANCE_OPERATION_GROUP;
  if (text === "DỰ ÁN") return FINANCE_PROJECT_GROUP;
  if (text === "TÀI CHÍNH") return FINANCE_CAPITAL_GROUP;
  return FINANCE_OPERATION_GROUP;
}

function normalizeFinanceData(input = {}) {
  const data = input && typeof input === "object" ? input : {};
  const transactions = Array.isArray(data.transactions) ? data.transactions.map((row) => {
    const next = Array.isArray(row) ? [...row] : [];
    next[2] = normalizeFinanceGroup(next[2]);
    return next;
  }) : [];
  return {
    ...data,
    transactions,
    projects: Array.isArray(data.projects) ? data.projects : [],
    budgets: Array.isArray(data.budgets) ? data.budgets : [],
    debts: Array.isArray(data.debts) ? data.debts : [],
    options: data.options && typeof data.options === "object" ? data.options : {}
  };
}

async function loadFinanceData() {
  try {
    const body = await api("/finance/overview");
    return body.data?.transactions ? normalizeFinanceData(body.data) : normalizeFinanceData(structuredClone(FINANCE_SEED));
  } catch {
    return normalizeFinanceData(structuredClone(FINANCE_SEED));
  }
}

async function saveFinanceData(data) {
  await api("/finance/overview", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: normalizeFinanceData(data) })
  });
}

async function loadFinanceReferenceData() {
  await loadCatalogData();
  await Promise.all(["customers", "contractors", "suppliers"].map(loadPartnerRows));
}

function financeAmountClass(value) {
  return Number(value) < 0 ? "negative" : "positive";
}

function financeBadge(text) {
  const danger = /không|vượt|đến hạn|chưa/i.test(text);
  const done = /ổn|xong|hoàn thành/i.test(text);
  return `<i class="finance-badge ${danger ? "danger" : done ? "done" : ""}">${text || "Theo dõi"}</i>`;
}

function financeDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN");
}

function financeMonth(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `${date.getMonth() + 1}/${date.getFullYear()}`;
}

function financeStats(items) {
  return `<div class="finance-kpis">${items.map(([label,value,hint,cls=""]) => `<article class="${cls}"><small>${label}</small><b>${value}</b><span>${hint}</span></article>`).join("")}</div>`;
}

function financeUnique(values) {
  const seen = new Set();
  return values.map((value) => String(value || "").trim()).filter(Boolean).filter((value) => {
    const key = value.toLocaleLowerCase("vi");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function financeArray(values) {
  return Array.isArray(values) ? values : [];
}

function financeGroupOptionsForType(type = "Chi") {
  return type === "Thu"
    ? [FINANCE_CAPITAL_GROUP, FINANCE_PROJECT_GROUP]
    : [FINANCE_CAPITAL_GROUP, FINANCE_OPERATION_GROUP, FINANCE_PROJECT_GROUP];
}

function financePartnerNames(type) {
  return financeUnique((CRM_DIRECTORY[type]?.rows || []).map((row) => row[1]));
}

function financeProjectCodeOptions(data = {}) {
  const options = data.options || {};
  const projectRows = Array.isArray(data.projects) ? data.projects : [];
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  return financeUnique([
    ...financeArray(options.projectCodes),
    ...projectRows.map((row) => row[0]),
    ...transactions.filter((row) => row[2] === FINANCE_PROJECT_GROUP).map((row) => row[3])
  ]);
}

function financeProjectCategoryOptions(data = {}) {
  const options = data.options || {};
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  return financeUnique([
    ...contractTypeOptions(),
    ...constructionCategoryOptions(),
    ...materialCategoryOptions(),
    ...financeArray(options.projectCategories),
    ...transactions.filter((row) => row[2] === FINANCE_PROJECT_GROUP).map((row) => row[4])
  ]);
}

function financeProjectPartnerOptions(data = {}, type = "Chi") {
  const options = data.options || {};
  const projectRows = Array.isArray(data.projects) ? data.projects : [];
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  if (type === "Thu") {
    return financeUnique([
      ...financePartnerNames("customers"),
      ...projectRows.map((row) => row[2]),
      ...financeArray(options.projectIncomePartners),
      ...transactions.filter((row) => row[2] === FINANCE_PROJECT_GROUP && row[1] === "Thu").map((row) => row[5])
    ]);
  }
  return financeUnique([
    ...financePartnerNames("contractors"),
    ...financePartnerNames("suppliers"),
    ...financeArray(options.projectExpensePartners),
    ...transactions.filter((row) => row[2] === FINANCE_PROJECT_GROUP && row[1] === "Chi").map((row) => row[5])
  ]);
}

function financeContextOptionList(data = {}, group = FINANCE_OPERATION_GROUP, type = "Chi", field = "topics") {
  const options = data.options || {};
  const managed = options.transactionFlow && typeof options.transactionFlow === "object" ? options.transactionFlow : {};
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  const rows = transactions.filter((row) => row[2] === group);
  if (group === FINANCE_PROJECT_GROUP) {
    if (field === "topics") return financeProjectCodeOptions(data);
    if (field === "categories") return financeProjectCategoryOptions(data);
    return financeProjectPartnerOptions(data, type);
  }
  if (group === FINANCE_CAPITAL_GROUP) {
    if (field === "topics") return financeUnique([...financeArray(managed.topics), ...financeArray(options.financeTopics), ...rows.map((row) => row[3])]);
    if (field === "categories") return financeUnique([...financeArray(managed.categories), ...financeArray(options.financeCategories), ...rows.map((row) => row[4])]);
    return financeUnique([...financeArray(managed.partners), ...financeArray(options.financePartners), ...rows.map((row) => row[5])]);
  }
  if (field === "topics") return financeUnique([...financeArray(managed.topics), ...financeArray(options.operationTopics), ...rows.map((row) => row[3])]);
  if (field === "categories") return financeUnique([...financeArray(managed.categories), ...financeArray(options.operationCategories), ...rows.map((row) => row[4])]);
  return financeUnique([...financeArray(managed.partners), ...financeArray(options.operationPartners), ...rows.map((row) => row[5])]);
}

function emptyFinanceTransactionFlow() {
  return {
    types: [...FINANCE_TRANSACTION_TYPES],
    topics: [],
    categories: [...contractTypeOptions()],
    partners: []
  };
}

function financeTransactionFlowOptions(data = {}) {
  const options = data.options && typeof data.options === "object" ? data.options : {};
  const managed = options.transactionFlow && typeof options.transactionFlow === "object" ? options.transactionFlow : null;
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  const operationRows = transactions.filter((row) => row[2] === FINANCE_OPERATION_GROUP);
  const capitalRows = transactions.filter((row) => row[2] === FINANCE_CAPITAL_GROUP);
  const legacyTopics = managed ? [] : [
    ...financeArray(options.operationTopics),
    ...financeArray(options.financeTopics),
    ...operationRows.map((row) => row[3]),
    ...capitalRows.map((row) => row[3])
  ];
  const legacyCategories = managed ? [] : [
    ...financeArray(options.operationCategories),
    ...financeArray(options.financeCategories),
    ...operationRows.map((row) => row[4]),
    ...capitalRows.map((row) => row[4])
  ];
  const legacyPartners = managed ? [] : [
    ...financeArray(options.operationPartners),
    ...financeArray(options.financePartners),
    ...operationRows.map((row) => row[5]),
    ...capitalRows.map((row) => row[5])
  ];
  return {
    types: [...FINANCE_TRANSACTION_TYPES],
    topics: financeUnique([...financeArray(managed?.topics), ...legacyTopics]),
    categories: financeUnique([...financeArray(managed?.categories), ...legacyCategories]),
    partners: financeUnique([...financeArray(managed?.partners), ...legacyPartners])
  };
}

function financeOptionLists(data = {}) {
  return {
    projectCodes: financeContextOptionList(data, FINANCE_PROJECT_GROUP, "Chi", "topics"),
    projectCategories: financeContextOptionList(data, FINANCE_PROJECT_GROUP, "Chi", "categories"),
    projectIncomePartners: financeContextOptionList(data, FINANCE_PROJECT_GROUP, "Thu", "partners"),
    projectExpensePartners: financeContextOptionList(data, FINANCE_PROJECT_GROUP, "Chi", "partners"),
    operationTopics: financeContextOptionList(data, FINANCE_OPERATION_GROUP, "Chi", "topics"),
    operationCategories: financeContextOptionList(data, FINANCE_OPERATION_GROUP, "Chi", "categories"),
    operationPartners: financeContextOptionList(data, FINANCE_OPERATION_GROUP, "Chi", "partners"),
    capitalTopics: financeContextOptionList(data, FINANCE_CAPITAL_GROUP, "Chi", "topics"),
    capitalCategories: financeContextOptionList(data, FINANCE_CAPITAL_GROUP, "Chi", "categories"),
    capitalPartners: financeContextOptionList(data, FINANCE_CAPITAL_GROUP, "Chi", "partners")
  };
}

function financeDatalist(id, values) {
  return `<datalist id="${id}">${values.map((value) => `<option value="${escapeHtml(value)}"></option>`).join("")}</datalist>`;
}

function financeSelectOptions(values, selected = "", placeholder = "Chọn") {
  const list = financeUnique([selected, ...values]);
  return `<option value="">${placeholder}</option>${list.map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}`;
}

function financeSelect(name, values, selected = "", attrs = "") {
  return `<select name="${name}" ${attrs}>${financeSelectOptions(values, selected)}</select>`;
}

function financeFlowOptions(data, row = []) {
  const type = row[1] || "Chi";
  const groups = financeGroupOptionsForType(type);
  const requestedGroup = normalizeFinanceGroup(row[2]);
  const group = groups.includes(requestedGroup) ? requestedGroup : groups[0];
  return {
    groups,
    group,
    topics: financeContextOptionList(data, group, type, "topics"),
    categories: financeContextOptionList(data, group, type, "categories"),
    partners: financeContextOptionList(data, group, type, "partners")
  };
}

function financeDraftFromRow(row = []) {
  return {
    date: row[0] || "",
    type: row[1] || "Chi",
    group: normalizeFinanceGroup(row[2]),
    topic: row[3] || "",
    category: row[4] || "",
    partner: row[5] || "",
    desc: row[6] || "",
    amount: moneyInput(row[7]),
    note: row[10] || ""
  };
}

function financeDraftFromElement(rowElement) {
  const get = (name) => rowElement.querySelector(`[name="${name}"]`)?.value || "";
  return {
    date: get("date"),
    type: get("type") || "Chi",
    group: normalizeFinanceGroup(get("group")),
    topic: get("topic"),
    category: get("category"),
    partner: get("partner"),
    desc: get("desc"),
    amount: get("amount"),
    note: get("note")
  };
}

function financeDraftToRow(draft, previous = []) {
  return [draft.date, draft.type, normalizeFinanceGroup(draft.group), draft.topic, draft.category, draft.partner, draft.desc, parseMoneyInput(draft.amount), previous[8] || "", previous[9] || "", draft.note ?? previous[10] ?? ""];
}

function financeFilterState() {
  if (!state.financeFilters || typeof state.financeFilters !== "object") state.financeFilters = {};
  FINANCE_FILTER_FIELDS.forEach(({ key }) => {
    if (!Array.isArray(state.financeFilters[key])) state.financeFilters[key] = [];
  });
  return state.financeFilters;
}

function financeFilterContextRows(data, group = "") {
  return (data.transactions || []).filter((row) => !group || row[2] === group);
}

function financeConfiguredFilterOptions(data, groupContext = "") {
  const filters = financeFilterState();
  const selectedTypes = (filters.type.length ? filters.type : FINANCE_TRANSACTION_TYPES).filter((type) => FINANCE_TRANSACTION_TYPES.includes(type));
  const groupOptions = groupContext ? [groupContext] : financeUnique(selectedTypes.flatMap(financeGroupOptionsForType));
  const selectedGroups = (filters.group.length ? filters.group : groupOptions).map(normalizeFinanceGroup).filter((group) => groupOptions.includes(group));
  const activeGroups = selectedGroups.length ? selectedGroups : groupOptions;
  const pairs = selectedTypes.flatMap((type) => activeGroups.filter((group) => financeGroupOptionsForType(type).includes(group)).map((group) => ({ type, group })));
  return {
    type: FINANCE_TRANSACTION_TYPES,
    group: groupOptions,
    topic: financeUnique(pairs.flatMap(({ type, group }) => financeContextOptionList(data, group, type, "topics"))),
    category: financeUnique(pairs.flatMap(({ type, group }) => financeContextOptionList(data, group, type, "categories"))),
    partner: financeUnique(pairs.flatMap(({ type, group }) => financeContextOptionList(data, group, type, "partners")))
  };
}

function financeFilterOptions(data, rows, group = "") {
  const configured = financeConfiguredFilterOptions(data, group);
  return Object.fromEntries(FINANCE_FILTER_FIELDS.map(({ key }) => [key, configured[key] || []]));
}

function pruneFinanceFilters(options) {
  const filters = financeFilterState();
  FINANCE_FILTER_FIELDS.forEach(({ key }) => {
    const allowed = new Set(options[key] || []);
    filters[key] = (filters[key] || []).filter((value) => allowed.has(value));
  });
}

function financeSelectedFilterCount() {
  const filters = financeFilterState();
  return FINANCE_FILTER_FIELDS.reduce((count, { key }) => count + filters[key].length, 0);
}

function financeFilterControl(field, values) {
  const selected = new Set(financeFilterState()[field.key]);
  const open = state.financeFilterOpen === field.key;
  return `<div class="finance-filter ${open ? "open" : ""}" data-finance-filter="${field.key}">
    <button type="button" class="${selected.size ? "active" : ""}" data-finance-filter-toggle="${field.key}"><span>${field.label}</span>${selected.size ? `<b>${selected.size}</b>` : ""}<i>▾</i></button>
    <div class="finance-filter-panel">
      <header><strong>${field.label}</strong><button type="button" data-finance-filter-clear="${field.key}">Bỏ chọn</button></header>
      <div class="finance-filter-list">${values.map((value) => `<label class="finance-filter-option"><input type="checkbox" data-finance-filter-option="${field.key}" value="${escapeHtml(value)}" ${selected.has(value) ? "checked" : ""}><span>${escapeHtml(value)}</span></label>`).join("") || `<em>Không có option.</em>`}</div>
    </div>
  </div>`;
}

function financeTools(data, group = "") {
  const options = financeFilterOptions(data, financeFilterContextRows(data, group), group);
  pruneFinanceFilters(options);
  const selectedCount = financeSelectedFilterCount();
  return `<div class="finance-tools"><input id="finance-search" value="${escapeHtml(state.financeQuery)}" placeholder="Tìm theo dự án, nhóm, đối tượng, mô tả"><div class="finance-filter-bar">${FINANCE_FILTER_FIELDS.map((field) => financeFilterControl(field, options[field.key] || [])).join("")}${selectedCount ? `<button type="button" class="finance-clear-filters" data-finance-filter-clear-all>Xóa lọc ${selectedCount}</button>` : ""}</div><button class="btn" data-finance="add-transaction">＋ Thêm giao dịch</button></div>`;
}

function renderFinancePage(page) {
  if (page === "finance-ledome") return renderFinanceLedome();
  if (page === "finance-projects") return renderFinanceProjects();
  return renderFinanceOverview();
}

function financeShell(page, title, desc, content, data = {}) {
  setTitle(page, "");
  $("#app").innerHTML = `<section class="finance-page">
    <header class="finance-head"><div><h2>${title}</h2><p>${desc}</p></div><div><button class="${page === "finance-overview" ? "active" : ""}" data-page-link="finance-overview">Tổng quan</button><button class="${page === "finance-ledome" ? "active" : ""}" data-page-link="finance-ledome">Vận hành Le Dome</button><button class="${page === "finance-projects" ? "active" : ""}" data-page-link="finance-projects">Dự án</button></div></header>
    ${content}
    ${financeModal(data)}
  </section>`;
  bindFinance(page);
}

function financeTransactionLedger(data, rows, title = "Sổ giao dịch thu chi", subtitle = "Sheet Giao dịch", group = "") {
  return `<section class="finance-section"><header><h3>${title}</h3><span>${subtitle}</span></header>${financeTools(data, group)}<div class="finance-table-wrap"><table class="finance-table finance-transaction-table"><thead><tr><th>Ngày</th><th>Loại</th><th>Nhóm</th><th>Chủ đề</th><th>Hạng mục</th><th>Đối tượng</th><th>Mô tả</th><th>Số tiền</th><th>Tháng</th><th></th></tr></thead><tbody>${rows.map(({row,index}) => financeTransactionRow(data, row, index)).join("") || `<tr><td colspan="10">Không có giao dịch phù hợp.</td></tr>`}</tbody></table></div></section>`;
}

function financeTransactionRow(data, row, index) {
  if (state.financeEditingIndex === index) {
    const draft = state.financeEditDraft || financeDraftFromRow(row);
    const flow = financeFlowOptions(data, [draft.date, draft.type, draft.group, draft.topic, draft.category, draft.partner, draft.desc, parseMoneyInput(draft.amount), "", "", draft.note]);
    return `<tr class="finance-edit-row" data-finance-row="${index}">
      <td><input name="date" type="date" value="${escapeHtml(draft.date)}"></td>
      <td>${financeSelect("type", FINANCE_TRANSACTION_TYPES, draft.type, 'data-finance-inline="type"')}</td>
      <td>${financeSelect("group", flow.groups, flow.group, 'data-finance-inline="group"')}</td>
      <td>${financeSelect("topic", flow.topics, draft.topic)}</td>
      <td>${financeSelect("category", flow.categories, draft.category)}</td>
      <td>${financeSelect("partner", flow.partners, draft.partner)}</td>
      <td><input name="desc" value="${escapeHtml(draft.desc)}" placeholder="Mô tả"></td>
      <td><input name="amount" value="${escapeHtml(draft.amount)}" inputmode="numeric" data-money-input></td>
      <td>${financeMonth(draft.date)}<input type="hidden" name="note" value="${escapeHtml(draft.note)}"></td>
      <td class="finance-actions inline"><button data-finance="save-transaction" data-index="${index}">Lưu</button><button data-finance="cancel-edit" data-index="${index}">Hủy</button></td>
    </tr>`;
  }
  return `<tr><td>${financeDate(row[0])}</td><td>${financeBadge(row[1])}</td><td><b>${row[2]}</b></td><td>${row[3]}</td><td>${row[4] || ""}</td><td>${row[5] || ""}</td><td>${row[6] || ""}</td><td class="finance-money ${row[1] === "Chi" ? "negative" : "positive"}">${row[1] === "Chi" ? "-" : "+"}${money(row[7])}</td><td>${financeMonth(row[0])}</td><td class="finance-actions"><button data-finance="edit-transaction" data-index="${index}">Sửa</button><button data-finance="delete-transaction" data-index="${index}">×</button></td></tr>`;
}

function financeFilteredTransactions(data, group = "") {
  pruneFinanceFilters(financeFilterOptions(data, [], group));
  const q = state.financeQuery.toLocaleLowerCase("vi");
  const filters = financeFilterState();
  return data.transactions
    .map((row,index) => ({ row, index }))
    .filter((item) => (!group || item.row[2] === group) && (!q || item.row.join(" ").toLocaleLowerCase("vi").includes(q)) && FINANCE_FILTER_FIELDS.every(({ key, rowIndex }) => {
      const selected = filters[key] || [];
      if (!selected.length) return true;
      return selected.includes(String(item.row[rowIndex] || "").trim());
    }));
}

function financeTotals(transactions) {
  const totalIn = transactions.filter((row) => row[1] === "Thu").reduce((sum,row) => sum + Number(row[7] || 0), 0);
  const totalOut = transactions.filter((row) => row[1] === "Chi").reduce((sum,row) => sum + Number(row[7] || 0), 0);
  return { totalIn, totalOut, cash: totalIn - totalOut };
}

async function renderFinanceOverview() {
  await loadFinanceReferenceData();
  const data = await loadFinanceData();
  const rows = financeFilteredTransactions(data);
  const { totalIn, totalOut, cash } = financeTotals(data.transactions);
  const months = Array.from({length: 12}, (_, i) => {
    const monthRows = data.transactions.filter((row) => new Date(row[0]).getMonth() === i);
    const income = monthRows.filter((row) => row[1] === "Thu").reduce((sum,row) => sum + Number(row[7] || 0), 0);
    const expense = monthRows.filter((row) => row[1] === "Chi").reduce((sum,row) => sum + Number(row[7] || 0), 0);
    return [i + 1, 2026, income, expense, income - expense, monthRows.length];
  });
  const byGroup = FINANCE_GROUPS.map((group) => {
    const groupRows = data.transactions.filter((row) => row[2] === group);
    const income = groupRows.filter((row) => row[1] === "Thu").reduce((sum,row) => sum + Number(row[7] || 0), 0);
    const expense = groupRows.filter((row) => row[1] === "Chi").reduce((sum,row) => sum + Number(row[7] || 0), 0);
    return [group, income, expense, income - expense];
  });
  financeShell("finance-overview", "Tổng quan tài chính", "Ghi chép tất cả thu chi của Công ty, tổng hợp từ toàn bộ sổ giao dịch.", `
    ${financeStats([["Tổng thu",`${money(totalIn)} đ`,"Từ toàn bộ giao dịch","income"],["Tổng chi",`${money(totalOut)} đ`,"Chi dự án, vận hành, lương","expense"],["Dòng tiền",`${money(cash)} đ`,"Thu - chi",financeAmountClass(cash)],["Số giao dịch",data.transactions.length,"Bản ghi trong sổ thu chi"]])}
    <section class="finance-grid-view">
      <article class="finance-panel-card"><header><h3>Tổng hợp theo nhóm</h3><span>Thu / Chi / Dòng tiền</span></header><div class="finance-mini-table">${byGroup.map(([group,income,expense,cash]) => `<p><b>${group}</b><span>${money(income)}</span><span>${money(expense)}</span><strong class="${financeAmountClass(cash)}">${money(cash)}</strong></p>`).join("")}</div></article>
      <article class="finance-panel-card"><header><h3>Báo cáo tháng</h3><span>12 tháng năm 2026</span></header><div class="finance-bars">${months.map((row) => `<i title="Tháng ${row[0]}: ${money(row[4])}" style="height:${Math.max(8, Math.min(100, Math.abs(row[4]) / 3000000))}px" class="${row[4] < 0 ? "expense" : "income"}"><em>${row[0]}</em></i>`).join("")}</div></article>
    </section>
    ${financeTransactionLedger(data, rows, "Tất cả thu chi công ty", "Ghi chép chung toàn công ty")}
  `, data);
}

async function renderFinanceLedome() {
  await loadFinanceReferenceData();
  const data = await loadFinanceData();
  const source = data.transactions.filter((row) => row[2] === FINANCE_OPERATION_GROUP);
  const rows = financeFilteredTransactions(data, FINANCE_OPERATION_GROUP);
  const { totalIn, totalOut, cash } = financeTotals(source);
  const byTopic = Array.from(new Set(source.map((row) => row[3]).filter(Boolean))).map((topic) => {
    const topicRows = source.filter((row) => row[3] === topic);
    const { totalIn, totalOut, cash } = financeTotals(topicRows);
    return [topic, totalIn, totalOut, cash];
  });
  financeShell("finance-ledome", "Thu chi vận hành Le Dome", "Ghi chép riêng các khoản thu chi phục vụ vận hành Le Dome.", `
    ${financeStats([["Thu vận hành",`${money(totalIn)} đ`,"Nhóm VẬN HÀNH LE DOME","income"],["Chi vận hành",`${money(totalOut)} đ`,"Văn phòng, lương, đầu tư","expense"],["Dòng tiền vận hành",`${money(cash)} đ`,"Thu - chi",financeAmountClass(cash)],["Số giao dịch",source.length,"Giao dịch nhóm vận hành"]])}
    <section class="finance-grid-view single"><article class="finance-panel-card"><header><h3>Theo chủ đề vận hành</h3><span>Vận hành Le Dome</span></header><div class="finance-mini-table">${byTopic.map(([topic,income,expense,cash]) => `<p><b>${topic}</b><span>${money(income)}</span><span>${money(expense)}</span><strong class="${financeAmountClass(cash)}">${money(cash)}</strong></p>`).join("") || "<p><b>Chưa có dữ liệu</b><span></span><span></span><strong></strong></p>"}</div></article></section>
    ${financeTransactionLedger(data, rows, "Sổ thu chi vận hành Le Dome", "Lọc nhóm VẬN HÀNH LE DOME", FINANCE_OPERATION_GROUP)}
  `, data);
}

async function renderFinanceProjects() {
  await loadFinanceReferenceData();
  const data = await loadFinanceData();
  const q = state.financeQuery.toLocaleLowerCase("vi");
  const projects = data.projects.filter((row) => !q || row.join(" ").toLocaleLowerCase("vi").includes(q));
  const projectTransactions = financeFilteredTransactions(data, FINANCE_PROJECT_GROUP);
  const projectSource = data.transactions.filter((row) => row[2] === FINANCE_PROJECT_GROUP);
  const projectCash = financeTotals(projectSource);
  const totalProfit = data.projects.reduce((sum,row) => sum + Number(row[10] || 0), 0);
  financeShell("finance-projects", "Thu chi dự án", "Ghi chép thu chi cho toàn bộ các dự án của Le Dome, kèm lợi nhuận và ngân sách.", `
    ${financeStats([["Thu từ dự án",`${money(projectCash.totalIn)} đ`,"Giao dịch nhóm DỰ ÁN","income"],["Chi cho dự án",`${money(projectCash.totalOut)} đ`,"Nhà thầu, NCC, phát sinh","expense"],["Dòng tiền dự án",`${money(projectCash.cash)} đ`,"Thu - chi",financeAmountClass(projectCash.cash)],["Lợi nhuận dự án",`${money(totalProfit)} đ`,"Theo sheet Dự án",financeAmountClass(totalProfit)]])}
    ${financeTransactionLedger(data, projectTransactions, "Sổ thu chi toàn bộ dự án", "Lọc nhóm DỰ ÁN", FINANCE_PROJECT_GROUP)}
    <section class="finance-section"><header><h3>Báo cáo lợi nhuận dự án</h3><span>Sheet Dự án</span></header><div class="finance-table-wrap"><table class="finance-table project-finance-table"><thead><tr><th>Mã dự án</th><th>Tên dự án</th><th>Khách hàng</th><th>Loại dự án</th><th>Trạng thái</th><th>Quản lý</th><th>Thu</th><th>Chi</th><th>Lợi nhuận</th><th>Biên LN</th><th>Phải thu</th><th>Phải trả</th><th>Cảnh báo</th></tr></thead><tbody>${projects.map((row) => { const margin = row[8] ? row[10] / row[8] : 0; return `<tr><td><b>${row[0]}</b></td><td>${row[1]}</td><td>${row[2] || ""}</td><td>${row[3]}</td><td>${row[4]}</td><td>${row[5]}</td><td class="finance-money positive">${money(row[8])}</td><td class="finance-money negative">${money(row[9])}</td><td class="finance-money ${financeAmountClass(row[10])}">${money(row[10])}</td><td>${Math.round(margin * 100)}%</td><td>${money(row[11])}</td><td>${money(row[12])}</td><td>${financeBadge(row[13])}</td></tr>`; }).join("")}</tbody></table></div></section>
    <section class="finance-section"><header><h3>Ngân sách dự án</h3><span>Breakdown theo hạng mục và đối tượng chi</span></header><div class="finance-table-wrap compact"><table class="finance-table"><thead><tr><th>Dự án</th><th>Hạng mục</th><th>Nhà thầu/NCC</th><th>Dự toán</th><th>Thực chi</th><th>Còn lại</th><th>% dùng</th><th>Cảnh báo</th></tr></thead><tbody>${data.budgets.map((row) => `<tr><td><b>${row[0]}</b><small>${row[1]}</small></td><td>${row[2]}</td><td>${row[3]}</td><td>${money(row[4])}</td><td>${money(row[7])}</td><td>${money(row[8])}</td><td>${row[9]}%</td><td>${financeBadge(row[10])}</td></tr>`).join("") || `<tr><td colspan="8">Chưa có dữ liệu ngân sách dự án.</td></tr>`}</tbody></table></div></section>
  `, data);
}

function financeModal(data = {}) {
  return `<div class="finance-modal" id="finance-modal"><form id="finance-form"><header><h3 id="finance-modal-title">Thêm giao dịch</h3><button type="button" data-finance="close-modal">×</button></header><input type="hidden" name="index"><label>Ngày<input name="date" type="date" required></label><label>Loại<select name="type">${FINANCE_TRANSACTION_TYPES.map((type) => `<option>${escapeHtml(type)}</option>`).join("")}</select></label><label>Nhóm<select name="group">${FINANCE_GROUPS.map((group) => `<option>${escapeHtml(group)}</option>`).join("")}</select></label><label>Chủ đề<select name="topic" data-finance-topic></select></label><label>Hạng mục<select name="category" data-finance-category></select></label><label>Đối tượng<select name="partner" data-finance-partner></select></label><label class="wide">Mô tả<textarea name="desc" placeholder="Nội dung thu chi"></textarea></label><label>Số tiền<input name="amount" inputmode="numeric" data-money-input required></label><label>Ghi chú<input name="note"></label><footer><button type="button" class="btn secondary" data-finance="close-modal">Đóng</button><button class="btn">Lưu</button></footer></form></div>`;
}

async function bindFinance(page) {
  const data = await loadFinanceData();
  const modal = $("#finance-modal");
  const form = $("#finance-form");
  $("#finance-search")?.addEventListener("input", (event) => {
    state.financeQuery = event.target.value;
    renderFinancePage(page);
  });
  $("#app").onchange = (event) => {
    const inlineField = event.target.closest("[data-finance-inline]");
    if (inlineField) {
      const rowElement = event.target.closest("[data-finance-row]");
      const index = Number(rowElement?.dataset.financeRow);
      if (Number.isInteger(index)) {
        const draft = financeDraftFromElement(rowElement);
        if (inlineField.dataset.financeInline === "group") {
          draft.topic = "";
          draft.category = "";
          draft.partner = "";
        }
        if (inlineField.dataset.financeInline === "type") {
          const groups = financeGroupOptionsForType(draft.type);
          if (!groups.includes(draft.group)) draft.group = groups[0];
          draft.topic = "";
          draft.category = "";
          draft.partner = "";
        }
        state.financeEditingIndex = index;
        state.financeEditDraft = draft;
        renderFinancePage(page);
      }
      return;
    }
    const option = event.target.closest("[data-finance-filter-option]");
    if (!option) return;
    const key = option.dataset.financeFilterOption;
    const filters = financeFilterState();
    const selected = new Set(filters[key] || []);
    if (option.checked) selected.add(option.value);
    else selected.delete(option.value);
    filters[key] = [...selected];
    state.financeFilterOpen = key;
    renderFinancePage(page);
  };
  $("#app").querySelectorAll("[data-money-input]").forEach((input) => {
    input.oninput = () => { input.value = input.value.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, "."); };
  });
  const setFinanceSelectOptions = (select, values, selected) => {
    const hasSelected = selected && values.includes(selected);
    const nextSelected = hasSelected ? selected : "";
    select.innerHTML = financeSelectOptions(values, nextSelected);
    select.value = nextSelected;
    return nextSelected;
  };
  const updateFinanceFieldOptions = () => {
    if (!form) return;
    const type = form.elements.type.value;
    const groupSelect = form.elements.group;
    const groupOptions = financeGroupOptionsForType(type);
    const previousGroup = normalizeFinanceGroup(groupSelect.value);
    let group = setFinanceSelectOptions(groupSelect, groupOptions, previousGroup);
    if (!group) {
      group = groupOptions[0];
      setFinanceSelectOptions(groupSelect, groupOptions, group);
      form.elements.topic.value = "";
      form.elements.category.value = "";
      form.elements.partner.value = "";
    }
    const topic = form.elements.topic;
    const category = form.elements.category;
    const partner = form.elements.partner;
    const current = [form.elements.date.value, type, group, topic.value, category.value, partner.value, form.elements.desc.value, parseMoneyInput(form.elements.amount.value), "", "", form.elements.note.value];
    const flow = financeFlowOptions(data, current);
    setFinanceSelectOptions(topic, flow.topics, topic.value);
    setFinanceSelectOptions(category, flow.categories, category.value);
    setFinanceSelectOptions(partner, flow.partners, partner.value);
  };
  form?.elements.group?.addEventListener("change", () => {
    form.elements.topic.value = "";
    form.elements.category.value = "";
    form.elements.partner.value = "";
    updateFinanceFieldOptions();
  });
  form?.elements.type?.addEventListener("change", () => {
    if (!financeGroupOptionsForType(form.elements.type.value).includes(normalizeFinanceGroup(form.elements.group.value))) form.elements.group.value = "";
    form.elements.topic.value = "";
    form.elements.category.value = "";
    form.elements.partner.value = "";
    updateFinanceFieldOptions();
  });
  form?.elements.category?.addEventListener("change", updateFinanceFieldOptions);
  updateFinanceFieldOptions();
  $("#app").onclick = async (event) => {
    const pageLink = event.target.closest("[data-page-link]")?.dataset.pageLink;
    if (pageLink) return void (location.hash = pageLink);
    const filterToggle = event.target.closest("[data-finance-filter-toggle]");
    if (filterToggle) {
      const key = filterToggle.dataset.financeFilterToggle;
      state.financeFilterOpen = state.financeFilterOpen === key ? "" : key;
      return renderFinancePage(page);
    }
    const filterClear = event.target.closest("[data-finance-filter-clear]");
    if (filterClear) {
      financeFilterState()[filterClear.dataset.financeFilterClear] = [];
      state.financeFilterOpen = filterClear.dataset.financeFilterClear;
      return renderFinancePage(page);
    }
    if (event.target.closest("[data-finance-filter-clear-all]")) {
      FINANCE_FILTER_FIELDS.forEach(({ key }) => { financeFilterState()[key] = []; });
      state.financeFilterOpen = "";
      return renderFinancePage(page);
    }
    const action = event.target.closest("[data-finance]")?.dataset.finance;
    if (!action) return;
    if (action === "close-modal") return modal.classList.remove("open");
    if (action === "add-transaction") {
      state.financeFilterOpen = "";
      state.financeEditingIndex = null;
      state.financeEditDraft = null;
      form.reset();
      form.elements.type.value = "Chi";
      form.elements.date.value = new Date().toISOString().slice(0, 10);
      form.elements.group.value = page === "finance-projects" ? FINANCE_PROJECT_GROUP : page === "finance-ledome" ? FINANCE_OPERATION_GROUP : FINANCE_OPERATION_GROUP;
      form.elements.index.value = "";
      $("#finance-modal-title").textContent = "Thêm giao dịch";
      updateFinanceFieldOptions();
      return modal.classList.add("open");
    }
    const index = Number(event.target.closest("[data-index]")?.dataset.index);
    if (action === "delete-transaction" && Number.isInteger(index)) {
      if (confirm("Xóa giao dịch này?")) {
        data.transactions.splice(index, 1);
        state.financeEditingIndex = null;
        state.financeEditDraft = null;
        await saveFinanceData(data);
        renderFinancePage(page);
      }
      return;
    }
    if (action === "edit-transaction" && Number.isInteger(index)) {
      state.financeFilterOpen = "";
      state.financeEditingIndex = index;
      state.financeEditDraft = financeDraftFromRow(data.transactions[index]);
      return renderFinancePage(page);
    }
    if (action === "cancel-edit") {
      state.financeEditingIndex = null;
      state.financeEditDraft = null;
      return renderFinancePage(page);
    }
    if (action === "save-transaction" && Number.isInteger(index)) {
      const rowElement = event.target.closest("[data-finance-row]");
      if (!rowElement) return;
      data.transactions[index] = financeDraftToRow(financeDraftFromElement(rowElement), data.transactions[index]);
      state.financeEditingIndex = null;
      state.financeEditDraft = null;
      await saveFinanceData(data);
      return renderFinancePage(page);
    }
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(form));
    const row = [formData.date, formData.type, normalizeFinanceGroup(formData.group), formData.topic, formData.category, formData.partner, formData.desc, parseMoneyInput(formData.amount), "", "", formData.note];
    const index = formData.index === "" ? -1 : Number(formData.index);
    state.financeEditingIndex = null;
    state.financeEditDraft = null;
    if (index >= 0) data.transactions[index] = row;
    else data.transactions.unshift(row);
    await saveFinanceData(data);
    renderFinancePage(page);
  };
}

const PERSONAL_FINANCE_SEED = {
  transactions: [
    ["2026-05-17","Thu","VAY","Khác","Mẹ",15000000,""],
    ["2026-05-19","Chi","ĂN UỐNG","CAFE","Tiền cafe",65000,"Tiền cafe"],
    ["2026-05-19","Chi","ĐI LẠI","GRAB","Grab",135000,"Grab"],
    ["2026-05-19","Chi","ĂN UỐNG","ĂN","Ăn sáng cá nhân",60000,"Ăn sáng cá nhân"],
    ["2026-05-19","Chi","ĂN UỐNG","CAFE","Nước cá nhân",33000,"Nước cá nhân"],
    ["2026-05-19","Chi","ĂN UỐNG","ĂN","Ăn trưa cá nhân",60000,"Ăn trưa cá nhân"],
    ["2026-05-19","Chi","ĂN UỐNG","ĂN","Ăn tối cá nhân",55000,"Ăn tối cá nhân"],
    ["2026-05-19","Chi","Gia đình","MẸ","Viện phí cho mẹ",12300000,"Viện phí cho mẹ"],
    ["2026-05-19","Chi","Gia đình","MẸ","Xe cứu thương cho mẹ",1900000,"Xe cứu thương cho mẹ"],
    ["2026-05-20","Chi","ĐI LẠI","GRAB","Đi Grab",80000,"Đi Grab"],
    ["2026-05-20","Chi","ĂN UỐNG","ĂN","Ăn trưa cá nhân",40000,"Ăn trưa cá nhân"],
    ["2026-05-20","Thu","VAY","Khác","Vay mẹ",19000000,"Vay mẹ"],
    ["2026-05-21","Chi","ĐI LẠI","GRAB","Tiền Grab",26000,"Tiền Grab"],
    ["2026-05-21","Chi","ĂN UỐNG","CAFE","Cafe",15000,"Cafe"],
    ["2026-05-23","Chi","ĐI LẠI","GRAB","Grab",64000,"Grab"],
    ["2026-05-23","Chi","ĂN UỐNG","CAFE","Cafe",7000,"Cafe"],
    ["2026-05-23","Chi","ĐI LẠI","GRAB","Grab",70000,"Grab"],
    ["2026-05-24","Chi","ĂN UỐNG","Khác","Mua thuốc lào",20000,"Thuốc lào"],
    ["2026-05-24","Chi","Gia đình","MẸ","Thuốc cho mẹ",70000,"Thuốc cho mẹ"],
    ["2026-05-24","Chi","Gia đình","MẸ","Đồ ăn",115000,"Đồ ăn cho mẹ"],
    ["2026-05-25","Chi","ĐI LẠI","GRAB","Grab",30000,"Grab"]
  ],
  budgets: [
    [5,"ĂN UỐNG","ĂN",3500000],
    [5,"ĂN UỐNG","CAFE",900000],
    [5,"ĐI LẠI","GRAB",1800000],
    [5,"ĐI LẠI","Xăng",1200000],
    [5,"Gia đình","MẸ",18000000],
    [5,"MUA SẮM","Quần áo",2500000],
    [5,"SỨC KHỎE","Khác",3000000],
    [5,"CÔNG VIỆC","Khác",2000000]
  ],
  categories: {
    Thu: [["Lương","LeDome"],["Lương","Rooftop"],["Lương","NTU"],["THUÊ NHÀ","TQV"],["THUÊ NHÀ","MDP"],["VAY","Khác"],["Khác","Khác"]],
    Chi: [["ĂN UỐNG","ĂN"],["ĂN UỐNG","CAFE"],["ĐI LẠI","GRAB"],["ĐI LẠI","Xăng"],["Kem","Tiền học"],["Kem","Quà, chơi"],["Gia đình","MẸ"],["Gia đình","ĐỒ DÙNG"],["MUA SẮM","Quần áo"],["SỨC KHỎE","Khác"],["ĐẦU TƯ","Khác"],["CÔNG VIỆC","Khác"]]
  }
};

async function loadPersonalFinanceData() {
  try {
    const body = await api("/personal-finance");
    return body.data?.transactions ? body.data : structuredClone(PERSONAL_FINANCE_SEED);
  } catch {
    return structuredClone(PERSONAL_FINANCE_SEED);
  }
}

async function savePersonalFinanceData(data) {
  await api("/personal-finance", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data })
  });
}

function personalRows(data) {
  const query = state.personalQuery.toLocaleLowerCase("vi");
  return data.transactions.map((row,index) => ({ row, index })).filter(({row}) => (!query || row.join(" ").toLocaleLowerCase("vi").includes(query)) && (state.personalKind === "Tất cả" || row[1] === state.personalKind));
}

function personalTotals(rows) {
  const totalIn = rows.filter((row) => row[1] === "Thu").reduce((sum,row) => sum + Number(row[5] || 0), 0);
  const totalOut = rows.filter((row) => row[1] === "Chi").reduce((sum,row) => sum + Number(row[5] || 0), 0);
  return { totalIn, totalOut, cash: totalIn - totalOut };
}

function personalMonthRows(data, month = 5) {
  return data.transactions.filter((row) => new Date(row[0]).getMonth() + 1 === month);
}

function personalByTopic(rows) {
  return Array.from(new Set(rows.map((row) => row[2]).filter(Boolean))).map((topic) => {
    const topicRows = rows.filter((row) => row[2] === topic);
    const totals = personalTotals(topicRows);
    return [topic, totals.totalIn, totals.totalOut, totals.cash];
  });
}

function personalShell(page, title, desc, content) {
  setTitle(page, "");
  $("#app").innerHTML = `<section class="finance-page personal-finance-page">
    <header class="finance-head"><div><h2>${title}</h2><p>${desc}</p></div><div><button class="${page === "personal-finance-overview" ? "active" : ""}" data-page-link="personal-finance-overview">Tổng quan</button><button class="${page === "personal-finance-transactions" ? "active" : ""}" data-page-link="personal-finance-transactions">Giao dịch</button><button class="${page === "personal-finance-budget" ? "active" : ""}" data-page-link="personal-finance-budget">Ngân sách</button><button class="${page === "personal-finance-report" ? "active" : ""}" data-page-link="personal-finance-report">Báo cáo</button></div></header>
    ${content}
    ${personalFinanceModal()}
  </section>`;
  bindPersonalFinance(page);
}

function personalToolbar() {
  return `<div class="finance-tools"><input id="personal-search" value="${state.personalQuery}" placeholder="Tìm theo chủ đề, đối tượng, mô tả"><select id="personal-kind"><option>Tất cả</option><option>Thu</option><option>Chi</option></select><button class="btn" data-personal-finance="add">＋ Thêm giao dịch</button><button data-personal-finance="reset">Khôi phục mẫu Excel</button></div>`;
}

function personalTransactionsTable(rows, title = "Giao dịch thu chi") {
  return `<section class="finance-section"><header><h3>${title}</h3><span>Sheet GIAO DỊCH</span></header>${personalToolbar()}<div class="finance-table-wrap"><table class="finance-table"><thead><tr><th>Ngày</th><th>Loại</th><th>Chủ đề</th><th>Đối tượng</th><th>Mô tả</th><th>Số tiền</th><th>Tháng</th><th>Ghi chú</th><th></th></tr></thead><tbody>${rows.map(({row,index}) => `<tr><td>${financeDate(row[0])}</td><td>${financeBadge(row[1])}</td><td><b>${row[2]}</b></td><td>${row[3] || ""}</td><td>${row[4] || ""}</td><td class="finance-money ${row[1] === "Chi" ? "negative" : "positive"}">${row[1] === "Chi" ? "-" : "+"}${money(row[5])}</td><td>${financeMonth(row[0])}</td><td>${row[6] || ""}</td><td class="finance-actions"><button data-personal-finance="edit" data-index="${index}">Sửa</button><button data-personal-finance="delete" data-index="${index}">×</button></td></tr>`).join("") || `<tr><td colspan="9">Không có giao dịch phù hợp.</td></tr>`}</tbody></table></div></section>`;
}

async function renderPersonalFinanceOverview() {
  const data = await loadPersonalFinanceData();
  const month = 5;
  const monthRows = personalMonthRows(data, month);
  const totals = personalTotals(monthRows);
  const allTotals = personalTotals(data.transactions);
  const budgetTotal = data.budgets.filter((row) => row[0] === month).reduce((sum,row) => sum + Number(row[3] || 0), 0);
  const usedPct = budgetTotal ? Math.round(totals.totalOut * 100 / budgetTotal) : 0;
  const reportRows = Array.from({length: 12}, (_, i) => {
    const rows = personalMonthRows(data, i + 1);
    const t = personalTotals(rows);
    return [i + 1, t.totalIn, t.totalOut, t.cash];
  });
  personalShell("personal-finance-overview", "Tài chính cá nhân", "Dashboard cá nhân theo tháng, ngân sách và dòng tiền. Chỉ account HoangDinh nhìn thấy mục này.", `
    ${financeStats([["Tổng thu tháng",`${money(totals.totalIn)} đ`,`Tháng ${month}/2026`,"income"],["Tổng chi tháng",`${money(totals.totalOut)} đ`,`${monthRows.length} giao dịch`,"expense"],["Dòng tiền tháng",`${money(totals.cash)} đ`,totals.cash >= 0 ? "Dương" : "Âm",financeAmountClass(totals.cash)],["Tỷ lệ dùng ngân sách",`${usedPct}%`,budgetTotal ? `${money(budgetTotal)} đ ngân sách` : "Chưa đặt ngân sách"]])}
    <section class="finance-grid-view"><article class="finance-panel-card"><header><h3>Dòng tiền 12 tháng</h3><span>Báo cáo tháng</span></header><div class="finance-bars">${reportRows.map((row) => `<i title="Tháng ${row[0]}: ${money(row[3])}" style="height:${Math.max(8, Math.min(120, Math.abs(row[3]) / 50000000))}px" class="${row[3] < 0 ? "expense" : "income"}"><em>${row[0]}</em></i>`).join("")}</div></article><article class="finance-panel-card"><header><h3>Chi phí theo chủ đề</h3><span>Tháng ${month}</span></header><div class="finance-mini-table">${personalByTopic(monthRows).filter((row) => row[2] > 0).map(([topic,,expense]) => `<p><b>${topic}</b><span></span><span>${money(expense)}</span><strong class="negative">-${money(expense)}</strong></p>`).join("")}</div></article></section>
    ${personalTransactionsTable(personalRows(data).slice(0, 12), "Giao dịch gần đây")}
  `);
  $("#personal-kind").value = state.personalKind;
}

async function renderPersonalFinanceTransactions() {
  const data = await loadPersonalFinanceData();
  personalShell("personal-finance-transactions", "Giao dịch cá nhân", "Nhập và quản lý giao dịch thu chi cá nhân giống sheet GIAO DỊCH.", personalTransactionsTable(personalRows(data), "Toàn bộ giao dịch cá nhân"));
  $("#personal-kind").value = state.personalKind;
}

async function renderPersonalFinanceBudget() {
  const data = await loadPersonalFinanceData();
  const month = 5;
  const monthRows = personalMonthRows(data, month);
  const rows = data.budgets.filter((row) => row[0] === month);
  personalShell("personal-finance-budget", "Ngân sách tháng", "Đặt ngân sách theo tháng cho từng mục chi; thực chi và cảnh báo tự cập nhật từ giao dịch.", `
    <section class="finance-section"><header><h3>Ngân sách tháng ${month}/2026</h3><span>Sheet NGÂN SÁCH THÁNG</span></header><div class="finance-table-wrap"><table class="finance-table"><thead><tr><th>Tháng</th><th>Chủ đề</th><th>Đối tượng</th><th>Ngân sách</th><th>Thực chi</th><th>Còn lại</th><th>% dùng</th><th>Cảnh báo</th></tr></thead><tbody>${rows.map((row) => { const spent = monthRows.filter((item) => item[1] === "Chi" && item[2].toLocaleLowerCase("vi") === row[1].toLocaleLowerCase("vi") && String(item[3] || "").toLocaleLowerCase("vi") === row[2].toLocaleLowerCase("vi")).reduce((sum,item) => sum + Number(item[5] || 0), 0); const remain = Number(row[3] || 0) - spent; const pct = row[3] ? Math.round(spent * 100 / row[3]) : 0; return `<tr><td>${row[0]}</td><td><b>${row[1]}</b></td><td>${row[2]}</td><td>${money(row[3])}</td><td class="finance-money negative">${money(spent)}</td><td class="finance-money ${financeAmountClass(remain)}">${money(remain)}</td><td>${pct}%</td><td>${financeBadge(pct >= 100 ? "Vượt ngân sách" : pct >= 80 ? "Sắp vượt" : "Ổn")}</td></tr>`; }).join("")}</tbody></table></div></section>
  `);
}

async function renderPersonalFinanceReport() {
  const data = await loadPersonalFinanceData();
  const rows = Array.from({length: 12}, (_, i) => {
    const monthRows = personalMonthRows(data, i + 1);
    const totals = personalTotals(monthRows);
    return [i + 1, 2026, totals.totalIn, totals.totalOut, totals.cash, monthRows.length];
  });
  personalShell("personal-finance-report", "Báo cáo tháng cá nhân", "Báo cáo 12 tháng theo năm, kèm breakdown thu/chi theo chủ đề.", `
    <section class="finance-section"><header><h3>Báo cáo 12 tháng</h3><span>Sheet BÁO CÁO THÁNG</span></header><div class="finance-table-wrap"><table class="finance-table"><thead><tr><th>Tháng</th><th>Năm</th><th>Tổng thu</th><th>Tổng chi</th><th>Dòng tiền</th><th>Số giao dịch</th></tr></thead><tbody>${rows.map((row) => `<tr><td><b>${row[0]}</b></td><td>${row[1]}</td><td class="finance-money positive">${money(row[2])}</td><td class="finance-money negative">${money(row[3])}</td><td class="finance-money ${financeAmountClass(row[4])}">${money(row[4])}</td><td>${row[5]}</td></tr>`).join("")}</tbody></table></div></section>
  `);
}

function personalFinanceModal() {
  return `<div class="finance-modal" id="personal-finance-modal"><form id="personal-finance-form"><header><h3 id="personal-finance-modal-title">Thêm giao dịch cá nhân</h3><button type="button" data-personal-finance="close">×</button></header><input type="hidden" name="index"><label>Ngày<input name="date" type="date" required></label><label>Loại<select name="type"><option>Thu</option><option>Chi</option></select></label><label>Chủ đề<input name="topic" placeholder="ĂN UỐNG, ĐI LẠI, VAY"></label><label>Đối tượng<input name="partner" placeholder="CAFE, GRAB, MẸ"></label><label class="wide">Mô tả<textarea name="desc" placeholder="Nội dung giao dịch"></textarea></label><label>Số tiền<input name="amount" inputmode="numeric" data-money-input required></label><label>Ghi chú<input name="note"></label><footer><button type="button" class="btn secondary" data-personal-finance="close">Đóng</button><button class="btn">Lưu</button></footer></form></div>`;
}

async function renderPersonalFinancePage(page) {
  if (page === "personal-finance-transactions") return renderPersonalFinanceTransactions();
  if (page === "personal-finance-budget") return renderPersonalFinanceBudget();
  if (page === "personal-finance-report") return renderPersonalFinanceReport();
  return renderPersonalFinanceOverview();
}

async function bindPersonalFinance(page) {
  const data = await loadPersonalFinanceData();
  const modal = $("#personal-finance-modal");
  const form = $("#personal-finance-form");
  $("#personal-search")?.addEventListener("input", (event) => { state.personalQuery = event.target.value; renderPersonalFinancePage(page); });
  $("#personal-kind")?.addEventListener("change", (event) => { state.personalKind = event.target.value; renderPersonalFinancePage(page); });
  form?.querySelectorAll("[data-money-input]").forEach((input) => { input.oninput = () => { input.value = input.value.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, "."); }; });
  $("#app").onclick = async (event) => {
    const pageLink = event.target.closest("[data-page-link]")?.dataset.pageLink;
    if (pageLink) return void (location.hash = pageLink);
    const action = event.target.closest("[data-personal-finance]")?.dataset.personalFinance;
    if (!action) return;
    if (action === "close") return modal.classList.remove("open");
    if (action === "reset" && confirm("Khôi phục dữ liệu mẫu từ file Excel cá nhân?")) {
      await savePersonalFinanceData(structuredClone(PERSONAL_FINANCE_SEED));
      return renderPersonalFinancePage(page);
    }
    if (action === "add") {
      form.reset();
      form.elements.date.value = new Date().toISOString().slice(0, 10);
      form.elements.index.value = "";
      $("#personal-finance-modal-title").textContent = "Thêm giao dịch cá nhân";
      return modal.classList.add("open");
    }
    const index = Number(event.target.closest("[data-index]")?.dataset.index);
    if (action === "delete" && Number.isInteger(index)) {
      if (confirm("Xóa giao dịch cá nhân này?")) {
        data.transactions.splice(index, 1);
        await savePersonalFinanceData(data);
        renderPersonalFinancePage(page);
      }
      return;
    }
    if (action === "edit" && Number.isInteger(index)) {
      const row = data.transactions[index];
      form.elements.index.value = index;
      form.elements.date.value = row[0];
      form.elements.type.value = row[1];
      form.elements.topic.value = row[2];
      form.elements.partner.value = row[3];
      form.elements.desc.value = row[4];
      form.elements.amount.value = moneyInput(row[5]);
      form.elements.note.value = row[6] || "";
      $("#personal-finance-modal-title").textContent = "Chỉnh sửa giao dịch cá nhân";
      return modal.classList.add("open");
    }
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(form));
    const row = [input.date, input.type, input.topic, input.partner, input.desc, parseMoneyInput(input.amount), input.note];
    const index = input.index === "" ? -1 : Number(input.index);
    if (index >= 0) data.transactions[index] = row;
    else data.transactions.unshift(row);
    await savePersonalFinanceData(data);
    renderPersonalFinancePage(page);
  };
}

const HRM_STAFF = [
  ["NV001","Nguyễn Minh Anh","Chỉ huy trưởng","Dự án Green City","0901 234 567","Đang làm việc"],
  ["NV002","Trần Thanh Hà","K? sư hiện trường","Nội thất Le Dome","0987 456 321","Đang làm việc"],
  ["NV003","Lê Hoàng Nam","Giám sát M&E","Dự án M&E Riverside","0912 884 299","Đang làm việc"],
  ["NV004","Phạm Thu Trang","Kế toán dự án","Văn phòng Le Dome","0936 222 810","Đang làm việc"],
  ["NV005","Vũ Quốc Bảo","Kỹ thuật thi công","Dự án Green City","0903 411 225","Tạm nghỉ"],
  ["NV006","Đỗ Mạnh Hùng","Quản lý kho","Dự án M&E Riverside","0918 762 901","Đang làm việc"]
];
const ORG_STAFF = [
  ["NS001","DINH Công Hoàng","Giám đốc","Ban lãnh đạo","0901 234 567","hoang@ledome.vn","Đang làm việc","Điều hành chung","https://i.pravatar.cc/96?img=12"],
  ["NS002","Bùi Xuân Dũng","Phó giám đốc","Ban lãnh đạo","0987 456 321","dung@ledome.vn","Đang làm việc","Điều hành thiết kế","https://i.pravatar.cc/96?img=47"],
  ["NS003","Bùi Xuân Dũng","Trưởng phòng thiết kế","Phòng thiết kế","0987 456 321","dung@ledome.vn","Đang làm việc","Quản lý phòng thiết kế","https://i.pravatar.cc/96?img=47"],
  ["NS004","Nguyễn Hoàng Hải","Kiến trúc sư","Phòng thiết kế","0912 884 299","hai@ledome.vn","Đang làm việc","Thiết kế kiến trúc","https://i.pravatar.cc/96?img=11"],
  ["NS005","Bùi Vũ Kiên","Kiến trúc sư","Phòng thiết kế","0981 156 668","kien@ledome.vn","Đang làm việc","Thiết kế kiến trúc","https://i.pravatar.cc/96?img=44"],
  ["NS006","DINH Công Hoàng","Trưởng phòng thi công","Phòng thi công","0901 234 567","hoang@ledome.vn","Đang làm việc","Quản lý thi công","https://i.pravatar.cc/96?img=12"],
  ["NS007","Hồ Quang Chiến","Giám sát thi công","Phòng thi công","0918 762 901","chien@ledome.vn","Đang làm việc","Giám sát hiện trường","https://i.pravatar.cc/96?img=5"],
  ["NS008","Hoàng Thu Mai","Hành chính","Khối văn phòng","0934 100 568","mai@ledome.vn","Đang làm việc","Hành chính văn phòng","https://i.pravatar.cc/96?img=45"],
  ["NS009","Trần Văn Đức","Kế toán","Khối văn phòng","0905 778 812","duc@ledome.vn","Đang làm việc","Tài chính dự án","https://i.pravatar.cc/96?img=15"],
  ["NS010","Nguyễn Tuấn Anh","Nhân sự","Khối văn phòng","0977 460 222","anh@ledome.vn","Đang làm việc","Tuyển dụng và hồ sơ","https://i.pravatar.cc/96?img=3"],
  ["NS011","Nguyễn Hà Vân","Marketing & Sale","Khối kinh doanh","0911 345 789","van@ledome.vn","Đang làm việc","Phát triển khách hàng","https://i.pravatar.cc/96?img=8"]
];
let selectedOrgStaff = "NS001";
const ORG_STAFF_STORAGE = "ledome.orgStaff.v1";
async function loadOrgStaff() {
  try {
    const body = await api("/hrm/staff");
    const saved = body.data;
    if (Array.isArray(saved) && saved.length > 0 && saved.every((row) => Array.isArray(row) && row.length >= 9)) {
      ORG_STAFF.splice(0, ORG_STAFF.length, ...saved);
      selectedOrgStaff = ORG_STAFF[0]?.[0] || "";
    }
  } catch (error) {
    console.warn("Cannot load saved org staff", error);
  }
}
async function saveOrgStaff() {
  await api("/hrm/staff", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rows: ORG_STAFF })
  });
}
const ACCOUNT_STORAGE = "ledome.accounts.v1";
const ACCOUNT_MODULES = [
  ["projects.view","Dự án: xem"],
  ["projects.edit","Dự án: sửa"],
  ["projects.upload","Dự án: upload"],
  ["projects.download","Dự án: tải file"],
  ["projects.delete","Dự án: xóa"],
  ["partners.view","Đối tác: xem"],
  ["partners.edit","Đối tác: sửa"],
  ["partners.delete","Đối tác: xóa"],
  ["hrm.view","Nhân sự: xem"],
  ["hrm.edit","Nhân sự: sửa"],
  ["hrm.approve","Chấm công: duyệt"],
  ["finance.view","Tài chính: xem"],
  ["finance.edit","Tài chính: sửa"],
  ["finance.delete","Tài chính: xóa"],
  ["config.accounts","Cấu hình tài khoản"],
  ["private","Hồ sơ riêng"],
  ["personalFinance.view","Tài chính cá nhân: xem"],
  ["personalFinance.edit","Tài chính cá nhân: sửa"]
];
const ACCOUNT_PERMISSION_KEYS = ACCOUNT_MODULES.map(([key]) => key);
const ACCOUNT_ACCESS_LEVELS = [
  {
    key: "admin",
    rank: 1,
    label: "Admin",
    scope: "Toàn hệ thống",
    description: "Xem và chỉnh sửa toàn bộ hệ thống, bao gồm Cấu hình.",
    permissions: ACCOUNT_PERMISSION_KEYS
  },
  {
    key: "leadership",
    rank: 2,
    label: "Lãnh đạo",
    scope: "Toàn hệ thống trừ Cấu hình",
    description: "Xem, sửa và xóa dữ liệu vận hành; không được vào mục Cấu hình.",
    permissions: ACCOUNT_PERMISSION_KEYS.filter((key) => !key.startsWith("config.") && !key.startsWith("personalFinance."))
  },
  {
    key: "manager",
    rank: 3,
    label: "Trưởng phòng",
    scope: "Theo phòng ban / dự án phụ trách",
    description: "Quản lý một phần hệ thống theo phạm vi được giao, không có quyền xóa dữ liệu hệ thống.",
    permissions: ["projects.view","projects.edit","projects.upload","projects.download","partners.view","partners.edit","hrm.view"]
  },
  {
    key: "staff",
    rank: 4,
    label: "Nhân viên",
    scope: "Theo công việc được giao",
    description: "Xem và cập nhật nội dung giới hạn trong công việc hằng ngày.",
    permissions: ["projects.view","projects.edit","projects.upload","projects.download","partners.view"]
  },
  {
    key: "guest",
    rank: 5,
    label: "Guest",
    scope: "Xem giới hạn",
    description: "Không có quyền chỉnh sửa, chỉ xem một phần thông tin được mở.",
    permissions: ["projects.view","partners.view"]
  }
];
const ACCOUNT_ACCESS_BY_KEY = Object.fromEntries(ACCOUNT_ACCESS_LEVELS.map((level) => [level.key, level]));
let LEDOME_ACCOUNTS = [];
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
const LEADERSHIP_TITLES = ["Giám đốc", "Phó giám đốc"];
const personKey = (name) => String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^\w]/g, "").toLowerCase();
const uniqueValues = (items) => [...new Set(items.filter(Boolean))];
const accountSearchText = (account = {}) => [
  account.staffName,
  account.role,
  account.department,
  account.title,
  ...(account.roles || []),
  ...(account.departments || []),
  ...(account.positions || [])
].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
function knownAccountAccessLevel(level) {
  return Boolean(ACCOUNT_ACCESS_BY_KEY[String(level || "")]);
}
function inferAccountAccessLevel(account = {}) {
  const loginId = String(account.loginId || "").trim().toLowerCase();
  const text = accountSearchText(account);
  if (loginId === "hoangdinh" || account.staffCode === "NS001" || account.permissions?.personalFinance) return "admin";
  if (loginId === "dungbui" || text.includes("ban lanh dao") || text.includes("pho giam doc")) return "leadership";
  if (text.includes("truong phong")) return "manager";
  return "staff";
}
function expandAccountPermissions(permissions = {}) {
  const source = permissions && typeof permissions === "object" ? permissions : {};
  const next = {};
  ACCOUNT_PERMISSION_KEYS.forEach((key) => { next[key] = Boolean(source[key]); });
  if (source.projects) ["view","edit","upload","download"].forEach((action) => { next[`projects.${action}`] = true; });
  if (source.partners) ["view","edit"].forEach((action) => { next[`partners.${action}`] = true; });
  if (source.hrm) ["view","edit","approve"].forEach((action) => { next[`hrm.${action}`] = true; });
  if (source.finance) ["view","edit","delete"].forEach((action) => { next[`finance.${action}`] = true; });
  if (source.personalFinance) ["view","edit"].forEach((action) => { next[`personalFinance.${action}`] = true; });
  if (source.config) {
    next["config.accounts"] = true;
    next["projects.delete"] = true;
    next["partners.delete"] = true;
  }
  next.projects = ["view","edit","upload","download","delete"].some((action) => next[`projects.${action}`]);
  next.partners = ["view","edit","delete"].some((action) => next[`partners.${action}`]);
  next.hrm = ["view","edit","approve"].some((action) => next[`hrm.${action}`]);
  next.finance = ["view","edit","delete"].some((action) => next[`finance.${action}`]);
  next.config = Boolean(next["config.accounts"]);
  next.private = Boolean(next.private || source.private);
  next.personalFinance = ["view","edit"].some((action) => next[`personalFinance.${action}`]);
  return next;
}
function permissionsForAccountLevel(accessLevel) {
  const level = ACCOUNT_ACCESS_BY_KEY[knownAccountAccessLevel(accessLevel) ? accessLevel : "staff"];
  const allowed = new Set(level.permissions);
  const permissions = {};
  ACCOUNT_PERMISSION_KEYS.forEach((key) => { permissions[key] = allowed.has(key); });
  return expandAccountPermissions(permissions);
}
function normalizeAccountAccess(account = {}) {
  const accessLevel = knownAccountAccessLevel(account.accessLevel) ? account.accessLevel : inferAccountAccessLevel(account);
  return {
    ...account,
    accessLevel,
    accessScope: ACCOUNT_ACCESS_BY_KEY[accessLevel].scope,
    permissions: permissionsForAccountLevel(accessLevel)
  };
}
function staffPeople() {
  const people = new Map();
  ORG_STAFF.forEach((staff) => {
    const key = personKey(staff[1]) || staff[0];
    const person = people.get(key) || {
      staffCode: staff[0],
      staffName: staff[1],
      phone: staff[4],
      email: staff[5],
      status: staff[6],
      photo: staff[8],
      roles: [],
      departments: [],
      titles: [],
      positions: []
    };
    person.roles.push(staff[2]);
    person.departments.push(staff[3]);
    if (staff[3] === "Ban lãnh đạo" || LEADERSHIP_TITLES.includes(staff[2])) person.titles.push(staff[2]);
    else person.positions.push(`${staff[2]} - ${staff[3]}`);
    if (!person.positions.length && staff[3] !== "Ban lãnh đạo") person.positions.push(`${staff[2]} - ${staff[3]}`);
    people.set(key, person);
  });
  return [...people.values()].map((person) => ({
    ...person,
    roles: uniqueValues(person.roles),
    departments: uniqueValues(person.departments),
    titles: uniqueValues(person.titles),
    positions: uniqueValues(person.positions)
  }));
}
function defaultAccountPermissions(staff) {
  return permissionsForAccountLevel(inferAccountAccessLevel(staff));
}
function defaultAccounts() {
  const used = new Set();
  return staffPeople().map((person) => {
    const account = {
      staffCode: person.staffCode,
      staffName: person.staffName,
      role: person.titles[0] || person.roles[0] || "",
      department: person.departments.join(", "),
      title: person.titles.join(", ") || "Không có chức danh lãnh đạo",
      positions: person.positions.length ? person.positions : person.roles.map((role, index) => `${role} - ${person.departments[index] || person.departments[0] || ""}`),
      loginId: accountLoginId(person.staffName, used),
      password: "1",
      active: true
    };
    return normalizeAccountAccess(account);
  });
}
async function loadAccounts() {
  try {
    const body = await api("/accounts");
    LEDOME_ACCOUNTS = (body.data || []).map(normalizeAccountAccess);
  } catch (error) {
    console.warn("Cannot load server accounts", error);
    LEDOME_ACCOUNTS = defaultAccounts();
  }
}
async function resetDefaultAccounts() {
  const body = await api("/accounts/reset", { method: "POST" });
  LEDOME_ACCOUNTS = (body.data || []).map(normalizeAccountAccess);
  localStorage.removeItem(AUTH_STORAGE);
  return LEDOME_ACCOUNTS;
}
async function saveAccounts() {
  const body = await api("/accounts", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accounts: LEDOME_ACCOUNTS })
  });
  LEDOME_ACCOUNTS = (body.data || LEDOME_ACCOUNTS).map(normalizeAccountAccess);
}
const STAFF_PRIVATE_INFO = {
  NS001: ["001084000111","0101112233","BHXH-010-111","VCB 0011 2233 4455"],
  NS002: ["001086000222","0102223344","BHXH-010-222","TCB 0022 3344 5566"],
  NS003: ["001087000333","0103334455","BHXH-010-333","MB 0033 4455 6677"],
  NS004: ["001088000444","0104445566","BHXH-010-444","ACB 0044 5566 7788"],
  NS005: ["001089000555","0105556677","BHXH-010-555","VCB 0055 6677 8899"],
  NS006: ["001083000666","0106667788","BHXH-010-666","TCB 0066 7788 9900"],
  NS007: ["001082000777","0107778899","BHXH-010-777","MB 0077 8899 0011"],
  NS008: ["001081000888","0108889900","BHXH-010-888","ACB 0088 9900 1122"],
  NS009: ["001080000999","0109990011","BHXH-010-999","VCB 0099 0011 2233"],
  NS010: ["001079001010","0110101122","BHXH-011-010","TCB 1010 1122 3344"],
  NS011: ["001078001111","0111112233","BHXH-011-111","MB 1111 2233 4455"],
  NS012: ["001077001212","0112123344","BHXH-011-212","ACB 1212 3344 5566"]
};
const HRM_ATTENDANCE = [
  ["NV001","Nguyễn Minh Anh","07:42","17:36","Green City - Cổng A","98%","12 m","Hợp lệ"],
  ["NV002","Trần Thanh Hà","07:55","17:28","Le Dome - Tầng 2","96%","8 m","Hợp lệ"],
  ["NV003","Lê Hoàng Nam","08:17","17:45","Riverside - Khu M&E","94%","19 m","Đi muộn"],
  ["NV004","Phạm Thu Trang","07:58","17:31","Văn phòng Le Dome","99%","6 m","Hợp lệ"],
  ["NV005","Vũ Quốc Bảo","08:05","--","Green City - Cổng A","82%","186 m","Cần duyệt"],
  ["NV006","Đỗ Mạnh Hùng","07:49","17:22","Riverside - Kho vật tư","97%","14 m","Hợp lệ"]
];
const HRM_PAYROLL = [
  ["NV001","Nguyễn Minh Anh","Chỉ huy trưởng",26,8,22000000,3500000,1200000,26700000],
  ["NV002","Trần Thanh Hà","K? sư hiện trường",25,12,14500000,1800000,860000,16160000],
  ["NV003","Lê Hoàng Nam","Giám sát M&E",24.5,16,16500000,2200000,1040000,17660000],
  ["NV004","Phạm Thu Trang","Kế toán dự án",26,0,15000000,1200000,780000,15420000],
  ["NV005","Vũ Quốc Bảo","Kỹ thuật thi công",23,10,13000000,900000,650000,13250000],
  ["NV006","Đỗ Mạnh Hùng","Quản lý kho",26,4,12500000,700000,620000,12580000]
];
const hrmStatus = (text) => `<i class="hrm-status ${text === "Hợp lệ" || text === "Đang làm việc" ? "ok" : text === "Cần duyệt" ? "review" : text === "Đi muộn" ? "late" : "off"}">${text}</i>`;
const hrmHeader = (title, subtitle, action = "") => `<header class="hrm-head"><div><h2>${title}</h2><p>${subtitle}</p></div>${action}</header>`;
const hrmStats = (items) => `<div class="hrm-stats">${items.map(([label,value,note]) => `<article><small>${label}</small><b>${value}</b><span>${note}</span></article>`).join("")}</div>`;

async function hrmStaff() {
  await loadOrgStaff();
  const selected = ORG_STAFF.find((staff) => staff[0] === selectedOrgStaff) || ORG_STAFF[0];
  const groups = [
    ["Ban lãnh đạo",["Ban lãnh đạo"],"♜"],
    ["Phòng thiết kế",["Phòng thiết kế"],"▧"],
    ["Phòng thi công",["Phòng thi công"],"▣"],
    ["Khối văn phòng",["Khối văn phòng"],"▤"],
    ["Khối kinh doanh",["Khối kinh doanh"],"◉"]
  ];
  setTitle("hrm-staff", "");
  $("#app").innerHTML = `<section class="hrm-page">${hrmHeader("♟ Nhân sự","Sơ đồ tổ chức và hồ sơ nhân sự Le Dome",'<button class="btn" data-hrm="add-staff">＋ Thêm nhân sự</button>')}
  <div class="org-layout"><section class="org-tree"><div class="org-toolbar"><b>Sơ đồ tổ chức</b><span>${staffPeople().length} nhân sự thật · ${ORG_STAFF.length} vị trí</span><button data-hrm="add-staff">＋</button></div>
  ${groups.map(([name,departments,icon], index) => `<article class="org-branch ${index === 0 ? "leadership" : ""}"><h3><i>${icon}</i>${name}<b>${ORG_STAFF.filter((staff) => departments.includes(staff[3])).length}</b></h3><div>${ORG_STAFF.filter((staff) => departments.includes(staff[3])).map(orgStaffCard).join("")}</div></article>`).join("")}</section>
  <aside class="org-profile"><header><span>Hồ sơ nhân sự</span><button data-hrm="edit-staff" data-code="${selected[0]}" title="Chỉnh sửa">✎</button></header><img src="${selected[8]}" alt="${selected[1]}"><h2>${selected[1]}</h2><strong>${selected[2]}</strong>${hrmStatus(selected[6])}<div class="org-profile-info"><p><span>Mã nhân sự</span><b>${selected[0]}</b></p><p><span>Phòng ban</span><b>${selected[3]}</b></p><p><span>Điện thoại</span><b>${selected[4]}</b></p><p><span>Email</span><b>${selected[5]}</b></p><p><span>Phụ trách</span><b>${selected[7]}</b></p></div><button class="org-detail" data-hrm="staff-private" data-code="${selected[0]}">Chi tiết <small>Chỉ Ban lãnh đạo</small></button><button class="org-edit" data-hrm="edit-staff" data-code="${selected[0]}">✎ Chỉnh sửa thông tin</button><button class="org-delete" data-hrm="delete-staff" data-code="${selected[0]}">× Xóa nhân sự</button></aside></div>
  <div class="directory-modal" id="hrm-staff-modal"><form id="hrm-staff-form"><header><h3 id="hrm-staff-modal-title">Thêm nhân sự</h3><button type="button" data-hrm="close">×</button></header><input type="hidden" name="currentCode"><label>Mã nhân viên<input name="code" value="NS${String(ORG_STAFF.length + 1).padStart(3,"0")}"></label><label>Họ và tên<input name="name" required placeholder="Nhập họ tên"></label><label>Chức vụ<select name="role">${["Giám đốc","Phó giám đốc","Trưởng phòng thiết kế","Kiến trúc sư","Trưởng phòng thi công","Giám sát thi công","Kỹ sư","Hành chính","Kế toán","Nhân sự","Marketing & Sale"].map((role) => `<option>${role}</option>`).join("")}</select></label><label>Phòng ban<select name="department">${["Ban lãnh đạo","Phòng thiết kế","Phòng thi công","Khối văn phòng","Khối kinh doanh"].map((department) => `<option>${department}</option>`).join("")}</select></label><label>Số điện thoại<input name="phone" placeholder="Nhập số điện thoại"></label><label>Email<input name="email" type="email" placeholder="email@ledome.vn"></label><label>Trạng thái<select name="status"><option>Đang làm việc</option><option>Tạm nghỉ</option></select></label><label>Phụ trách<input name="scope" placeholder="Nhiệm vụ hoặc dự án"></label><label class="directory-form-wide">URL ảnh hồ sơ<input name="photo" placeholder="https://..."></label><footer><button type="button" class="btn secondary" data-hrm="close">Đóng</button><button class="btn">Lưu</button></footer></form></div></section>`;
  bindHrm("staff");
}

function orgStaffCard(staff) {
  return `<article class="org-person ${selectedOrgStaff === staff[0] ? "selected" : ""}" data-hrm="select-staff" data-code="${staff[0]}"><img src="${staff[8]}" alt=""><span><b>${staff[1]}</b><small>${staff[2]}</small></span><i>›</i></article>`;
}

async function hrmAttendance() {
  const runtime = await api("/attendance/records");
  const phoneRows = runtime.data.map((record) => [
    record.employeeId,
    record.employeeName,
    record.type === "check-in" ? new Date(record.capturedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--",
    record.type === "check-out" ? new Date(record.capturedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--",
    record.siteName,
    record.faceEvidence || "Đã chụp ảnh",
    `${record.distanceMeters} m`,
    record.status,
    record.id
  ]);
  const attendanceRows = phoneRows.concat(HRM_ATTENDANCE);
  setTitle("hrm-attendance", "");
  $("#app").innerHTML = `<section class="hrm-page">${hrmHeader("▣ Chấm công","Xác thực bằng ảnh và vị trí GPS từ điện thoại",'<a class="btn attendance-mobile-link" href="/attendance/" target="_blank">▣ Mở trang chấm công điện thoại</a>')}${hrmStats([["Bản ghi hôm nay",attendanceRows.length,"Check-in / check-out"],["Từ điện thoại",phoneRows.length,"Đã gửi GPS"],["Cần kiểm tra",attendanceRows.filter((row) => row[7] === "Cần duyệt").length,"GPS ngoài vùng cho phép"],["Đi muộn",attendanceRows.filter((row) => row[7] === "Đi muộn").length,"Sau giờ vào ca"]])}
  <div class="hrm-tools"><input placeholder="⌕ Tìm theo nhân sự hoặc địa điểm"><input type="date" value="2026-06-01"><select><option>Tất cả trạng thái</option><option>Hợp lệ</option><option>Cần duyệt</option><option>Đi muộn</option></select><button>↻ Tải lại</button></div>
  <div class="hrm-table-wrap"><table class="hrm-table attendance-table"><thead><tr><th>Nhân sự</th><th>Check-in</th><th>Check-out</th><th>Điểm chấm công</th><th>Ảnh xác thực</th><th>GPS</th><th>Trạng thái</th><th></th></tr></thead><tbody>${attendanceRows.map((row) => `<tr><td><b>${row[1]}</b><small>${row[0]}</small></td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td><td><b class="face-score">◉ ${row[5]}</b></td><td>${row[6]}</td><td>${hrmStatus(row[7])}</td><td><button class="hrm-view" data-hrm="evidence" data-code="${row[0]}" data-record="${row[8] || ""}">Xem</button></td></tr>`).join("")}</tbody></table></div>
  <aside class="hrm-evidence" id="hrm-evidence"><header><b>Chi tiết xác thực</b><button data-hrm="close-evidence">×</button></header><div class="face-preview"><i>◎</i><span>Face ID</span></div><div class="gps-preview"><b>⌖</b><span>Vị trí GPS từ điện thoại</span></div><p><span>Nhân sự</span><b id="evidence-name"></b></p><p><span>Thiết bị</span><b>Điện thoại cá nhân</b></p><p><span>Độ khớp Face ID</span><b id="evidence-face"></b></p><p><span>Khoảng cách GPS</span><b id="evidence-gps"></b></p><footer><button class="btn secondary" data-hrm="close-evidence">Đóng</button><button class="btn" data-hrm="approve-attendance">Duyệt bản ghi</button></footer></aside></section>`;
  bindHrm("attendance", attendanceRows);
}

function hrmPayroll() {
  setTitle("hrm-payroll", "");
  const total = HRM_PAYROLL.reduce((sum,row) => sum + row[8], 0);
  $("#app").innerHTML = `<section class="hrm-page">${hrmHeader("$ Lương","Tổng hợp tự động từ bảng chấm công và thưởng theo dự án",'<button class="btn">▣ Chốt bảng lương</button>')}${hrmStats([["Kỳ lương","06 / 2026","Đang tổng hợp"],["Tổng thực nhận",`${money(total)} đ`,"6 nhân sự"],["Thưởng dự án",`${money(HRM_PAYROLL.reduce((sum,row) => sum + row[6],0))} đ`,"Theo phân bổ dự án"],["Bản ghi cần kiểm tra","1","Liên quan bảng chấm công"]])}
  <div class="payroll-note"><b>Nguyên tắc tính tạm thời</b><span>Thực nhận = Lương cơ bản theo ngày công + tăng ca + thưởng dự án - khấu trừ. Công thức chi tiết sẽ cập nhật theo quy định của Le Dome.</span><button>⚙ Cấu hình công thức</button></div>
  <div class="hrm-tools"><input placeholder="⌕ Tìm nhân sự hoặc chức vụ"><input type="month" value="2026-06"><button>↻ Tính lại từ bảng công</button><button class="btn secondary">▣ Xuất bảng lương</button></div>
  <div class="hrm-table-wrap"><table class="hrm-table payroll-table"><thead><tr><th>Nhân sự</th><th>Chức vụ</th><th>Ngày công</th><th>Tăng ca</th><th>Lương cơ bản</th><th>Thưởng dự án</th><th>Khấu trừ</th><th>Thực nhận</th><th></th></tr></thead><tbody>${HRM_PAYROLL.map((row) => `<tr><td><b>${row[1]}</b><small>${row[0]}</small></td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]} giờ</td><td>${money(row[5])}</td><td class="payroll-bonus">+ ${money(row[6])}</td><td class="payroll-deduct">- ${money(row[7])}</td><td><strong>${money(row[8])} đ</strong></td><td><button class="hrm-view">Chi tiết</button></td></tr>`).join("")}</tbody><tfoot><tr><td colspan="7">Tổng thực nhận</td><td colspan="2">${money(total)} đ</td></tr></tfoot></table></div></section>`;
  bindHrm("payroll");
}

function bindHrm(type, attendanceRows = HRM_ATTENDANCE) {
  $("#app").onclick = async (event) => {
    const action = event.target.closest("[data-hrm]")?.dataset.hrm;
    if (action === "add-staff") {
      $("#hrm-staff-form").reset();
      $("#hrm-staff-form").elements.code.value = `NS${String(ORG_STAFF.length + 1).padStart(3,"0")}`;
      $("#hrm-staff-modal-title").textContent = "Thêm nhân sự";
      return $("#hrm-staff-modal").classList.add("open");
    }
    if (action === "close") return $("#hrm-staff-modal").classList.remove("open");
    if (action === "close-evidence") return $("#hrm-evidence").classList.remove("open");
    if (action === "close-private") return $("#staff-private-modal")?.remove();
    if (action === "staff-private") {
      if (!state.account?.permissions?.private) return alert("Tài khoản chưa được cấp quyền xem hồ sơ riêng.");
      const staff = ORG_STAFF.find((item) => item[0] === event.target.closest("[data-code]").dataset.code);
      const info = STAFF_PRIVATE_INFO[staff[0]] || ["Chưa cập nhật","Chưa cập nhật","Chưa cập nhật","Chưa cập nhật"];
      $("#app").insertAdjacentHTML("beforeend", `<div class="staff-private-modal" id="staff-private-modal"><section><header><div><b>Chi tiết hồ sơ nhân sự</b><small>Chỉ Ban lãnh đạo được xem hoặc chỉnh sửa</small></div><button data-hrm="close-private">×</button></header><div class="staff-private-person"><img src="${staff[8]}" alt=""><span><b>${staff[1]}</b><small>${staff[2]} · ${staff[3]}</small></span></div><div class="staff-private-grid"><p><span>Căn cước công dân</span><b>${info[0]}</b></p><p><span>Mã số thuế</span><b>${info[1]}</b></p><p><span>Mã BHXH</span><b>${info[2]}</b></p><p><span>Tài khoản nhận lương</span><b>${info[3]}</b></p><p><span>Ngày vào làm</span><b>01/06/2024</b></p><p><span>Loại hợp đồng</span><b>Hợp đồng lao động</b></p></div><footer><button class="btn secondary" data-hrm="close-private">Đóng</button><button class="btn">Chỉnh sửa khi có phân quyền</button></footer></section></div>`);
      return;
    }
    if (action === "delete-staff") {
      const index = ORG_STAFF.findIndex((row) => row[0] === event.target.closest("[data-code]").dataset.code);
      if (ORG_STAFF.length <= 1) {
        alert("Can giu lai it nhat 1 nhan su.");
        return;
      }
      if (index >= 0 && confirm(`Xóa nhân sự "${ORG_STAFF[index][1]}"?`)) {
        ORG_STAFF.splice(index, 1);
        await saveOrgStaff();
        selectedOrgStaff = ORG_STAFF[Math.max(0, index - 1)]?.[0] || ORG_STAFF[0]?.[0] || "";
      }
      return hrmStaff();
    }
    if (action === "select-staff") {
      selectedOrgStaff = event.target.closest("[data-code]").dataset.code;
      return hrmStaff();
    }
    if (action === "edit-staff") {
      event.stopPropagation();
      const row = ORG_STAFF.find((item) => item[0] === event.target.closest("[data-code]").dataset.code);
      const form = $("#hrm-staff-form");
      ["code","name","role","department","phone","email","status","scope","photo"].forEach((name, index) => { form.elements[name].value = row[index]; });
      form.elements.currentCode.value = row[0];
      $("#hrm-staff-modal-title").textContent = "Chỉnh sửa nhân sự";
      return $("#hrm-staff-modal").classList.add("open");
    }
    if (action === "evidence") {
      const trigger = event.target.closest("[data-code]");
      const row = attendanceRows.find((item) => item[0] === trigger.dataset.code && (item[8] || "") === trigger.dataset.record);
      $("#evidence-name").textContent = row[1];
      $("#evidence-face").textContent = row[5];
      $("#evidence-gps").textContent = row[6];
      $("#hrm-evidence").dataset.code = row[0];
      $("#hrm-evidence").dataset.record = row[8] || "";
      return $("#hrm-evidence").classList.add("open");
    }
    if (action === "approve-attendance") {
      const recordId = $("#hrm-evidence").dataset.record;
      if (recordId) await api(`/attendance/records/${recordId}/approve`, { method: "POST" });
      else {
        const row = HRM_ATTENDANCE.find((item) => item[0] === $("#hrm-evidence").dataset.code);
        if (row) row[7] = "Hợp lệ";
      }
      return hrmAttendance();
    }
  };
  if (type === "staff") $("#hrm-staff-form").onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const row = [data.code,data.name,data.role,data.department,data.phone,data.email,data.status,data.scope,data.photo || "https://i.pravatar.cc/96?img=1"];
    const index = ORG_STAFF.findIndex((item) => item[0] === data.currentCode);
    if (index >= 0) ORG_STAFF[index] = row;
    else ORG_STAFF.push(row);
    await saveOrgStaff();
    selectedOrgStaff = row[0];
    hrmStaff();
  };
}

function accountPermissionBadges(permissions) {
  const active = ACCOUNT_MODULES.filter(([key]) => permissions?.[key]);
  return active.length ? active.map(([, label]) => `<i>${label}</i>`).join("") : `<em>Không có quyền</em>`;
}

function accountAccessOptions(current) {
  return ACCOUNT_ACCESS_LEVELS.map((level) => `<option value="${level.key}" ${current === level.key ? "selected" : ""}>${level.rank}. ${level.label}</option>`).join("");
}

function accountAccessCards() {
  return `<div class="account-role-grid">${ACCOUNT_ACCESS_LEVELS.map((level) => `<article data-access-card="${level.key}"><b>${level.rank}. ${level.label}</b><span>${escapeHtml(level.scope)}</span><p>${escapeHtml(level.description)}</p></article>`).join("")}</div>`;
}

function accountRow(account) {
  const safe = normalizeAccountAccess(account);
  const level = ACCOUNT_ACCESS_BY_KEY[safe.accessLevel];
  const positions = safe.positions || [`${safe.role} - ${safe.department}`];
  return `<tr data-staff="${safe.staffCode}"><td><div class="account-person"><b>${escapeHtml(safe.staffName)}</b><span><em>Chức danh:</em> ${escapeHtml(safe.title || safe.role || "Chưa cập nhật")}<br><em>Vị trí:</em> ${positions.map(escapeHtml).join("<br>")}</span></div></td><td><input name="loginId" value="${escapeHtml(safe.loginId)}"></td><td><input name="newPassword" type="password" placeholder="Để trống nếu không đổi"></td><td><label class="account-active"><input type="checkbox" name="active" ${safe.active ? "checked" : ""}> Hoạt động</label></td><td><div class="account-level-picker"><select name="accessLevel" data-account-level>${accountAccessOptions(safe.accessLevel)}</select><small data-account-level-desc>${escapeHtml(level.description)}</small></div></td><td><div class="account-scope"><b data-account-scope>${escapeHtml(level.scope)}</b><span>Cấp ${level.rank}: ${escapeHtml(level.label)}</span></div><div class="account-badges" data-account-badges>${accountPermissionBadges(safe.permissions || {})}</div></td></tr>`;
}

function updateAccountRowAccess(row) {
  const accessLevel = row.querySelector("[data-account-level]").value;
  const level = ACCOUNT_ACCESS_BY_KEY[accessLevel];
  const permissions = permissionsForAccountLevel(accessLevel);
  row.querySelector("[data-account-level-desc]").textContent = level.description;
  row.querySelector("[data-account-scope]").textContent = level.scope;
  row.querySelector(".account-scope span").textContent = `Cấp ${level.rank}: ${level.label}`;
  row.querySelector("[data-account-badges]").innerHTML = accountPermissionBadges(permissions);
}

async function configAccounts() {
  await loadAccounts();
  setTitle("accounts", "");
  const activeCount = LEDOME_ACCOUNTS.filter((account) => account.active).length;
  $("#app").innerHTML = `<section class="account-page">
    <header class="account-head"><div><h2>▣ Tài khoản</h2><p>Quản lý tài khoản đăng nhập và phân quyền cho nhân sự Le Dome</p></div><button class="btn" data-account="save">Lưu thay đổi</button></header>
    <div class="account-summary"><article><small>Tổng tài khoản</small><b>${LEDOME_ACCOUNTS.length}</b><span>Theo nhân sự thật, không theo số vị trí kiêm nhiệm</span></article><article><small>Đang hoạt động</small><b>${activeCount}</b><span>Có thể đăng nhập</span></article><article><small>Cấp quyền</small><b>5</b><span>Admin, Lãnh đạo, Trưởng phòng, Nhân viên, Guest</span></article></div>
    ${accountAccessCards()}
    <div class="account-tools"><span>RBAC theo cấp: quyền chi tiết và phạm vi dữ liệu được chuẩn hóa theo chính sách quản trị.</span><button data-account="reset">Tạo lại mặc định</button></div>
    <div class="account-table-wrap"><table class="account-table"><thead><tr><th>Nhân sự thật</th><th>ID đăng nhập</th><th>Đặt mật khẩu mới</th><th>Trạng thái</th><th>Cấp quyền</th><th>Phạm vi & quyền đang bật</th></tr></thead><tbody>${LEDOME_ACCOUNTS.map(accountRow).join("")}</tbody></table></div>
  </section>`;
  bindAccounts();
}

function bindAccounts() {
  $("#app").onchange = (event) => {
    if (event.target.matches("[data-account-level]")) updateAccountRowAccess(event.target.closest("tr"));
  };
  $("#app").onclick = async (event) => {
    const action = event.target.closest("[data-account]")?.dataset.account;
    if (action === "save") {
      LEDOME_ACCOUNTS = [...document.querySelectorAll(".account-table tbody tr")].map((row) => {
        const previous = LEDOME_ACCOUNTS.find((account) => account.staffCode === row.dataset.staff);
        const accessLevel = row.querySelector('[name="accessLevel"]').value;
        return {
          ...previous,
          loginId: row.querySelector('[name="loginId"]').value.trim(),
          newPassword: row.querySelector('[name="newPassword"]').value,
          active: row.querySelector('[name="active"]').checked,
          accessLevel,
          accessScope: ACCOUNT_ACCESS_BY_KEY[accessLevel].scope,
          permissions: permissionsForAccountLevel(accessLevel)
        };
      });
      await saveAccounts();
      state.account = LEDOME_ACCOUNTS.find((account) => account.staffCode === state.account?.staffCode) || state.account;
      if (state.account) localStorage.setItem(AUTH_STORAGE, JSON.stringify({ staffCode: state.account.staffCode, loginId: state.account.loginId }));
      updateUserChrome();
      return configAccounts();
    }
    if (action === "reset" && confirm("Tạo lại toàn bộ tài khoản về ID mặc định và pass = 1?")) {
      await resetDefaultAccounts();
      return configAccounts();
    }
  };
}

function catalogConfigForType(type) {
  return CATALOG_LIST_CONFIG[type] || TRANSACTION_FLOW_LIST_CONFIG[type];
}

function catalogValuesForType(type) {
  const flowConfig = TRANSACTION_FLOW_LIST_CONFIG[type];
  if (flowConfig) return catalogTransactionFlow[flowConfig.field] || [];
  return catalogData[type] || [];
}

function setCatalogValuesForType(type, values) {
  const flowConfig = TRANSACTION_FLOW_LIST_CONFIG[type];
  if (flowConfig) catalogTransactionFlow[flowConfig.field] = values;
  else catalogData[type] = values;
}

function catalogInputValueForType(type, value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return catalogConfigForType(type)?.preserveCase ? text : text.toLocaleUpperCase("vi");
}

function catalogEditorRows(type) {
  const query = state.catalogQuery.toLocaleLowerCase("vi");
  return catalogValuesForType(type).map((item, index) => ({ item, index }))
    .filter(({ item }) => !query || item.toLocaleLowerCase("vi").includes(query));
}

function catalogChipMarkup(type, item, index) {
  const config = catalogConfigForType(type);
  const readOnly = config?.readOnly;
  return `<label class="catalog-chip ${readOnly ? "readonly" : ""}" data-catalog-row="${index}"><span>${index + 1}</span><input value="${escapeHtml(item)}" data-catalog-input="${type}" data-index="${index}" ${readOnly ? "readonly" : ""}>${readOnly ? "" : `<button type="button" aria-label="Xóa ${escapeHtml(item)}" data-catalog-delete="${type}" data-index="${index}">×</button>`}</label>`;
}

function catalogEditorList(type) {
  const config = CATALOG_LIST_CONFIG[type];
  const rows = catalogEditorRows(type);
  return `<section class="catalog-panel ${config.preserveCase ? "preserve-case" : ""}" data-catalog-panel="${type}">
    <header><div><h3>${escapeHtml(config.title)}</h3><span>${catalogValuesForType(type).length} mục đang lưu</span></div></header>
    <p>${escapeHtml(config.note)}</p>
    <div class="catalog-add-row"><input data-catalog-new="${type}" placeholder="${escapeHtml(config.placeholder)}"><button data-catalog-add="${type}">Thêm</button></div>
    <div class="catalog-list">${rows.map(({ item, index }) => catalogChipMarkup(type, item, index)).join("") || `<em>Không có hạng mục phù hợp.</em>`}</div>
  </section>`;
}

function catalogFlowList(type) {
  const config = TRANSACTION_FLOW_LIST_CONFIG[type];
  const rows = catalogEditorRows(type);
  const readOnly = config.readOnly;
  return `<div class="catalog-flow-list ${config.preserveCase ? "preserve-case" : ""}" data-catalog-panel="${type}">
    <header><strong>${escapeHtml(config.title)}</strong><span>${catalogValuesForType(type).length} mục</span></header>
    ${readOnly ? "" : `<div class="catalog-add-row"><input data-catalog-new="${type}" placeholder="${escapeHtml(config.placeholder)}"><button data-catalog-add="${type}">Thêm</button></div>`}
    <div class="catalog-list">${rows.map(({ item, index }) => catalogChipMarkup(type, item, index)).join("") || `<em>Không có mục phù hợp.</em>`}</div>
  </div>`;
}

function catalogDependencyCard(title, items) {
  return `<article class="catalog-dependency-card"><h4>${escapeHtml(title)}</h4>${items.map(([label, value]) => `<p><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></p>`).join("")}</article>`;
}

function catalogDependencyGrid() {
  const data = catalogFinanceData || {};
  const projectCount = financeProjectCodeOptions(data).length;
  const contractorCount = financePartnerNames("contractors").length;
  const supplierCount = financePartnerNames("suppliers").length;
  const customerCount = financePartnerNames("customers").length;
  return `<div class="catalog-dependency-grid">
    ${catalogDependencyCard("Loại -> Nhóm", [
      ["Chi", financeGroupOptionsForType("Chi").join(", ")],
      ["Thu", financeGroupOptionsForType("Thu").join(", ")]
    ])}
    ${catalogDependencyCard("Nhóm Dự án", [
      ["Chủ đề", `Danh sách dự án (${projectCount})`],
      ["Hạng mục", "Danh sách hợp đồng + hạng mục thi công + thiết bị vật tư"],
      ["Đối tượng Thu", `Danh sách CĐT (${customerCount})`],
      ["Đối tượng Chi", `Nhà thầu (${contractorCount}) + Nhà cung cấp (${supplierCount})`]
    ])}
    ${catalogDependencyCard("Nhóm Vận hành Le Dome", [
      ["Loại hợp lệ", "Chi"],
      ["Chủ đề/Hạng mục/Đối tượng", "Danh sách vận hành tùy chỉnh"]
    ])}
    ${catalogDependencyCard("Nhóm Tài chính", [
      ["Loại hợp lệ", "Thu, Chi"],
      ["Chủ đề/Hạng mục/Đối tượng", "Danh sách tài chính tùy chỉnh"]
    ])}
  </div>`;
}

function catalogFlowPanel() {
  const total = TRANSACTION_FLOW_LIST_TYPES.reduce((sum, type) => sum + catalogValuesForType(type).length, 0);
  return `<section class="catalog-panel catalog-flow-panel">
    <header><div><h3>Phân luồng giao dịch</h3><span>${total} mục đang lưu</span></div></header>
    <p>Dùng cho bộ lọc và form giao dịch tài chính theo cấu trúc phụ thuộc Loại -> Nhóm -> Chủ đề -> Hạng mục -> Đối tượng.</p>
    ${catalogDependencyGrid()}
    <div class="catalog-flow-grid">${TRANSACTION_FLOW_LIST_TYPES.map(catalogFlowList).join("")}</div>
  </section>`;
}

async function configCatalog(reload = true) {
  if (reload) {
    await loadCatalogData();
    await Promise.all(["customers", "contractors", "suppliers"].map(loadPartnerRows));
    catalogFinanceData = await loadFinanceData();
    catalogTransactionFlow = financeTransactionFlowOptions(catalogFinanceData);
  }
  setTitle("catalog", "Quản lý danh sách dùng chung cho các module");
  $("#app").innerHTML = `<section class="catalog-page">
    <header class="catalog-head"><div><h2>▰ Cơ sở dữ liệu</h2><p>Nguồn dữ liệu chuẩn cho Hợp đồng, Nhà thầu, Nhà cung cấp và các màn dự án.</p></div><button class="btn" data-catalog-save>Lưu cơ sở dữ liệu</button></header>
    <div class="catalog-tools"><input data-catalog-search value="${escapeHtml(state.catalogQuery)}" placeholder="⌕ Tìm danh mục"><button data-catalog-reset>Khôi phục mặc định</button></div>
    <div class="catalog-grid">${catalogEditorList("constructionCategories")}${catalogEditorList("materialCategories")}${catalogEditorList("contractTypes")}</div>
    ${catalogFlowPanel()}
  </section>`;
  bindCatalog();
}

function collectCatalogPanel(type) {
  const config = catalogConfigForType(type);
  if (config?.readOnly) return catalogValuesForType(type);
  const fallback = CATALOG_FALLBACK[type] || [];
  const values = [...catalogValuesForType(type)];
  document.querySelectorAll(`[data-catalog-input="${type}"]`).forEach((input) => {
    values[Number(input.dataset.index)] = input.value;
  });
  return catalogList(values.map((value) => catalogInputValueForType(type, value)), fallback);
}

function refreshCatalogFromDom() {
  [...Object.keys(CATALOG_LIST_CONFIG), ...TRANSACTION_FLOW_LIST_TYPES].forEach((type) => {
    setCatalogValuesForType(type, collectCatalogPanel(type));
  });
}

function bindCatalog() {
  $("#app").onclick = async (event) => {
    const addType = event.target.closest("[data-catalog-add]")?.dataset.catalogAdd;
    if (addType) {
      refreshCatalogFromDom();
      const input = event.target.closest("[data-catalog-panel]")?.querySelector(`[data-catalog-new="${addType}"]`);
      const value = catalogInputValueForType(addType, input?.value || "");
      if (!value) {
        input?.focus();
        return;
      }
      setCatalogValuesForType(addType, [...catalogValuesForType(addType), value]);
      return configCatalog(false);
    }
    const deleteButton = event.target.closest("[data-catalog-delete]");
    if (deleteButton) {
      refreshCatalogFromDom();
      const type = deleteButton.dataset.catalogDelete;
      const index = Number(deleteButton.dataset.index);
      const values = [...catalogValuesForType(type)];
      values.splice(index, 1);
      setCatalogValuesForType(type, values);
      return configCatalog(false);
    }
    if (event.target.closest("[data-catalog-reset]") && confirm("Khôi phục cơ sở dữ liệu mặc định?")) {
      catalogData = normalizeCatalogData(CATALOG_FALLBACK);
      catalogTransactionFlow = emptyFinanceTransactionFlow();
      catalogFinanceData = catalogFinanceData || await loadFinanceData();
      catalogFinanceData.options = { ...(catalogFinanceData.options || {}), transactionFlow: catalogTransactionFlow };
      await saveCatalogData(catalogData);
      await saveFinanceData(catalogFinanceData);
      return configCatalog();
    }
    if (event.target.closest("[data-catalog-save]")) {
      refreshCatalogFromDom();
      catalogFinanceData = catalogFinanceData || await loadFinanceData();
      catalogFinanceData.options = { ...(catalogFinanceData.options || {}), transactionFlow: catalogTransactionFlow };
      await saveCatalogData(catalogData);
      await saveFinanceData(catalogFinanceData);
      return configCatalog();
    }
  };
  $("#app").oninput = (event) => {
    if (event.target.matches("[data-catalog-search]")) {
      state.catalogQuery = event.target.value;
      return configCatalog(false);
    }
    if (event.target.matches("[data-catalog-input]")) {
      const type = event.target.dataset.catalogInput;
      const index = Number(event.target.dataset.index);
      const values = [...catalogValuesForType(type)];
      values[index] = event.target.value;
      setCatalogValuesForType(type, values);
    }
  };
}

async function loadSession() {
  try {
    const body = await api("/auth/me");
    state.account = body.account || null;
    if (state.account) localStorage.setItem(AUTH_STORAGE, JSON.stringify({ staffCode: state.account.staffCode, loginId: state.account.loginId }));
  } catch {
    state.account = null;
  }
  return state.account;
}

function renderLogin(message = "") {
  document.body.classList.add("login-mode");
  let remembered = {};
  try {
    remembered = JSON.parse(localStorage.getItem(LOGIN_REMEMBER_STORAGE) || "{}") || {};
  } catch {}
  $("#app").innerHTML = `<section class="login-page"><form id="login-form" class="login-card"><div class="brand-mark">LD</div><h2>LE DOME</h2><p>Đăng nhập hệ thống quản lý dự án</p>${message ? `<strong>${message}</strong>` : ""}<label>ID đăng nhập<input name="loginId" autocomplete="username" autofocus value="${escapeHtml(remembered.loginId || "")}"></label><label>Mật khẩu<input name="password" type="password" autocomplete="current-password" value="${escapeHtml(remembered.password || "")}"></label><div class="login-options"><label><input type="checkbox" name="rememberId" ${remembered.rememberId || remembered.rememberPassword ? "checked" : ""}> Lưu ID</label><label><input type="checkbox" name="rememberPassword" ${remembered.rememberPassword ? "checked" : ""}> Lưu mật khẩu</label></div><button class="btn">Đăng nhập</button><small>Liên hệ quản trị viên nếu cần cấp lại mật khẩu.</small></form></section>`;
  const form = $("#login-form");
  form.elements.rememberPassword.onchange = () => {
    if (form.elements.rememberPassword.checked) form.elements.rememberId.checked = true;
  };
  form.elements.rememberId.onchange = () => {
    if (!form.elements.rememberId.checked) form.elements.rememberPassword.checked = false;
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const loginId = String(data.loginId || "").trim();
    const password = String(data.password || "").trim();
    try {
      const body = await api("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ loginId, password })
      });
      state.account = body.account;
      localStorage.setItem(AUTH_STORAGE, JSON.stringify({ staffCode: state.account.staffCode, loginId: state.account.loginId }));
      const rememberPassword = Boolean(data.rememberPassword);
      const rememberId = Boolean(data.rememberId) || rememberPassword;
      localStorage.setItem(LOGIN_REMEMBER_STORAGE, JSON.stringify({
        rememberId,
        rememberPassword,
        loginId: rememberId ? loginId : "",
        password: rememberPassword ? password : ""
      }));
      document.body.classList.remove("login-mode");
      await loadNavigation();
      updateUserChrome();
      route();
    } catch (error) {
      renderLogin(error.message || "Sai ID, mật khẩu hoặc tài khoản đang bị khóa.");
    }
  };
}

async function requireLogin() {
  if (await loadSession()) {
    document.body.classList.remove("login-mode");
    updateUserChrome();
    return true;
  }
  renderLogin();
  return false;
}

async function loadNavigation() {
  state.nav = await api("/navigation");
}

async function logout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {}
  localStorage.removeItem(AUTH_STORAGE);
  state.account = null;
  renderLogin();
}

const overviewKpis = (items) => `<div class="overview-kpis">${items.map(([label, value, note, tone = ""]) => `<article class="${tone}"><small>${label}</small><b>${value}</b><span>${note}</span></article>`).join("")}</div>`;

function bindOverviewActions() {
  $("#app").onclick = (event) => {
    const pageLink = event.target.closest("[data-page-link]")?.dataset.pageLink;
    if (pageLink) return void (location.hash = pageLink);
    const projectId = event.target.closest("[data-project-id]")?.dataset.projectId;
    if (projectId) return openProjectDetail(projectId);
  };
}

async function projectsOverview() {
  const { data: projects } = await api("/projects");
  let dashboard = { tasks: [], alerts: [] };
  try {
    dashboard = await api("/dashboard");
  } catch {}
  const totalBudget = projects.reduce((sum, project) => sum + Number(project.budget || 0), 0);
  const totalSpent = projects.reduce((sum, project) => sum + Number(project.spent || 0), 0);
  const activeProjects = projects.filter((project) => project.status === "Đang thực hiện");
  const averageProgress = projects.length ? Math.round(projects.reduce((sum, project) => sum + Number(project.progress || 0), 0) / projects.length) : 0;
  const healthGroups = [...new Set(projects.map((project) => project.health || "Chưa cập nhật"))].map((health) => [health, projects.filter((project) => (project.health || "Chưa cập nhật") === health).length]);
  setTitle("projects-overview", "Hiển thị nhanh tổng quát các dự án bên dưới");
  $("#app").innerHTML = `<section class="overview-page">
    <header class="overview-head"><div><h2>▣ Tổng quan dự án</h2><p>Tóm tắt nhanh trạng thái, tiến độ và ngân sách của toàn bộ dự án đang quản lý.</p></div><button data-page-link="projects">Mở danh sách dự án</button></header>
    ${overviewKpis([["Tổng dự án", projects.length, "Dự án đang có trong hệ thống"], ["Đang thực hiện", activeProjects.length, "Dự án cần theo dõi hằng ngày"], ["Tiến độ trung bình", `${averageProgress}%`, "Theo tiến độ thực tế"], ["Ngân sách", `${money(totalBudget)} đ`, `Đã chi ${money(totalSpent)} đ`, "positive"]])}
    <div class="overview-layout">
      <section class="overview-panel overview-wide"><header><h3>Dự án đang mở</h3><button data-page-link="projects">Xem tất cả</button></header><div class="overview-project-list">${projects.map((project) => `<article data-project-id="${escapeHtml(project.id)}"><div><b>${escapeHtml(project.name)}</b><small>${escapeHtml(project.code)} · ${escapeHtml(project.manager || "Chưa cập nhật")}</small></div><span>${escapeHtml(project.status || "Chưa cập nhật")}</span><strong>${project.progress || 0}%</strong>${progress(project.progress || 0)}<em>${badge(project.health || "Theo dõi")}</em></article>`).join("")}</div></section>
      <aside class="overview-panel"><header><h3>Tình trạng</h3><button data-page-link="insight">Insight</button></header><div class="overview-mini-list">${healthGroups.map(([name, count]) => `<p><span>${escapeHtml(name)}</span><b>${count}</b></p>`).join("")}</div></aside>
      <aside class="overview-panel"><header><h3>Việc cần chú ý</h3></header><div class="overview-feed">${(dashboard.tasks || []).slice(0, 4).map(([name, date]) => `<p><b>${escapeHtml(name)}</b><small>${escapeHtml(date)}</small></p>`).join("") || "<p><b>Chưa có việc nổi bật</b><small>Dữ liệu đang cập nhật</small></p>"}</div></aside>
      <aside class="overview-panel"><header><h3>Cảnh báo</h3></header><div class="overview-feed">${(dashboard.alerts || []).slice(0, 4).map(([type, text]) => `<p><b>${escapeHtml(text || type)}</b><small>${escapeHtml(type || "")}</small></p>`).join("") || "<p><b>Không có cảnh báo mới</b><small>Hệ thống chưa ghi nhận rủi ro</small></p>"}</div></aside>
    </div>
  </section>`;
  bindOverviewActions();
}

async function partnersOverview() {
  const types = ["customers", "contractors", "suppliers"];
  await Promise.all(types.map(loadPartnerRows));
  const groups = types.map((type) => ({ type, ...CRM_DIRECTORY[type] }));
  const allRows = groups.flatMap((group) => group.rows);
  const totalReceivable = allRows.reduce((sum, row) => sum + Number(row[6] || 0), 0);
  const totalPayable = allRows.reduce((sum, row) => sum + Number(row[7] || 0), 0);
  const activeCount = allRows.filter((row) => row[4] === "Đang hợp tác").length;
  setTitle("partners-overview", "Hiển thị nhanh khách hàng, nhà thầu và nhà cung cấp");
  $("#app").innerHTML = `<section class="overview-page">
    <header class="overview-head"><div><h2>▣ Tổng quan đối tác</h2><p>Tóm tắt các nhóm Khách hàng, Nhà thầu và Nhà cung cấp để vào chi tiết nhanh.</p></div><button data-page-link="customers">Mở khách hàng</button></header>
    ${overviewKpis([["Tổng đối tác", allRows.length, "Tất cả khách hàng, nhà thầu, NCC"], ["Đang hợp tác", activeCount, "Đối tác còn hoạt động"], ["Công nợ phải thu", `${money(totalReceivable)} đ`, "Tổng từ các hồ sơ đối tác", "positive"], ["Công nợ phải trả", `${money(totalPayable)} đ`, "Cần theo dõi thanh toán", "negative"]])}
    <div class="overview-card-grid">${groups.map((group) => {
      const receivable = group.rows.reduce((sum, row) => sum + Number(row[6] || 0), 0);
      const payable = group.rows.reduce((sum, row) => sum + Number(row[7] || 0), 0);
      return `<article class="overview-panel"><header><h3>${group.icon} ${group.title}</h3><button data-page-link="${group.type}">Chi tiết</button></header><div class="overview-mini-list"><p><span>Tổng số</span><b>${group.rows.length}</b></p><p><span>Đang hợp tác</span><b>${group.rows.filter((row) => row[4] === "Đang hợp tác").length}</b></p><p><span>Phải thu</span><b>${money(receivable)} đ</b></p><p><span>Phải trả</span><b>${money(payable)} đ</b></p></div><div class="overview-feed">${group.rows.slice(0, 4).map((row) => `<p><b>${escapeHtml(row[1])}</b><small>${escapeHtml(row[2])} · ${escapeHtml(row[4])}</small></p>`).join("")}</div></article>`;
    }).join("")}</div>
  </section>`;
  bindOverviewActions();
}

async function hrmOverview() {
  await loadOrgStaff();
  let phoneRows = [];
  try {
    const runtime = await api("/attendance/records");
    phoneRows = Array.isArray(runtime.data) ? runtime.data : [];
  } catch {}
  const people = staffPeople();
  const attendanceRows = phoneRows.map((record) => [record.employeeId, record.employeeName, record.type === "check-in" ? new Date(record.capturedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--", record.type === "check-out" ? new Date(record.capturedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--", record.siteName, record.faceEvidence || "Đã chụp ảnh", `${record.distanceMeters} m`, record.status]).concat(HRM_ATTENDANCE);
  const payrollTotal = HRM_PAYROLL.reduce((sum, row) => sum + Number(row[8] || 0), 0);
  const departmentGroups = [...new Set(ORG_STAFF.map((staff) => staff[3]))].map((department) => [department, ORG_STAFF.filter((staff) => staff[3] === department).length]);
  setTitle("hrm-overview", "Hiển thị nhanh nhân sự, chấm công và lương");
  $("#app").innerHTML = `<section class="overview-page">
    <header class="overview-head"><div><h2>▣ Tổng quan nhân sự</h2><p>Tổng hợp nhanh dữ liệu Nhân sự, Chấm công và Lương của Le Dome.</p></div><button data-page-link="hrm-staff">Mở nhân sự</button></header>
    ${overviewKpis([["Nhân sự thật", people.length, `${ORG_STAFF.length} vị trí đang đảm nhiệm`], ["Chấm công", attendanceRows.length, "Bản ghi hôm nay / mẫu"], ["Cần kiểm tra", attendanceRows.filter((row) => row[7] === "Cần duyệt" || row[7] === "Đi muộn").length, "Bản ghi chưa ổn", "negative"], ["Quỹ lương mẫu", `${money(payrollTotal)} đ`, `${HRM_PAYROLL.length} nhân sự trong bảng`, "positive"]])}
    <div class="overview-card-grid">
      <article class="overview-panel"><header><h3>♟ Nhân sự theo phòng ban</h3><button data-page-link="hrm-staff">Chi tiết</button></header><div class="overview-mini-list">${departmentGroups.map(([department, count]) => `<p><span>${escapeHtml(department)}</span><b>${count}</b></p>`).join("")}</div></article>
      <article class="overview-panel"><header><h3>▣ Chấm công gần nhất</h3><button data-page-link="hrm-attendance">Chi tiết</button></header><div class="overview-feed">${attendanceRows.slice(0, 6).map((row) => `<p><b>${escapeHtml(row[1])}</b><small>${escapeHtml(row[4])} · ${escapeHtml(row[7])}</small></p>`).join("")}</div></article>
      <article class="overview-panel"><header><h3>$ Bảng lương</h3><button data-page-link="hrm-payroll">Chi tiết</button></header><div class="overview-feed">${HRM_PAYROLL.slice(0, 6).map((row) => `<p><b>${escapeHtml(row[1])}</b><small>${escapeHtml(row[2])} · ${money(row[8])} đ</small></p>`).join("")}</div></article>
    </div>
  </section>`;
  bindOverviewActions();
}

function placeholder(page) {
  setTitle(page, "Module đã được định tuyến trong nền tảng");
  $("#app").innerHTML = `<article class="card module-placeholder"><h2>${pageTitles[page] || state.nav.find((x) => x[1] === page)?.[0]}</h2><p class="muted">Module này đã có vị trí trong kiến trúc. Các workflow chi tiết sẽ được triển khai trên cùng API, RBAC và audit trail của nền tảng.</p><button class="btn" onclick="location.hash='projects'">Xem dự án mẫu</button></article>`;
}

function renderConnectionError(error) {
  console.error(error);
  setTitle("projects", "Không thể kết nối dữ liệu");
  $("#app").innerHTML = `<article class="card connection-error"><h2>Không thể tải dữ liệu dự án</h2><p>Server LE DOME đang tạm dừng hoặc chưa kết nối. Dữ liệu dự án không bị mất.</p><button class="btn" data-retry>⟳ Tải lại</button></article>`;
  $("#app").querySelector("[data-retry]").onclick = () => location.reload();
}

function accessDenied() {
  setTitle("Không có quyền", "");
  $("#app").innerHTML = `<article class="card connection-error"><h2>Không có quyền truy cập</h2><p>Tài khoản hiện tại chưa được cấp quyền xem module này.</p><button class="btn" data-auth="logout">Đăng xuất</button></article>`;
}

async function refreshProjectNav() {
  try {
    const { data } = await api("/projects");
    projectNavItems = activeProjectsOnly(data)
      .map((project) => ["▰  " + project.name, `project/${project.id}`]);
  } catch (error) {
    projectNavItems = PROJECT_NAV_FALLBACK;
  }
}

async function route() {
  if (!state.account && !(await requireLogin())) return;
  state.page = location.hash.slice(1) || "projects";
  if (["finance-operations","finance-payroll","finance-funds"].includes(state.page)) {
    location.hash = "finance-overview";
    return;
  }
  if (state.page.startsWith("project/")) {
    openProjectDetail(state.page.split("/")[1]);
    return;
  }
  await refreshProjectNav();
  renderNav();
  try {
    if (!canAccess(state.page)) {
      const firstAllowed = ["projects-overview","partners-overview","hrm-overview","finance-overview","catalog","materials","processes","standards","accounts"].find((page) => canAccess(page)) || "projects";
      if (state.page !== firstAllowed) {
        location.hash = firstAllowed;
        return;
      }
      return accessDenied();
    }
    if (state.page === "home") return await home();
    if (state.page === "projects-overview") return await projectsOverview();
    if (state.page === "projects") return await projectLanding();
    if (state.page === "insight") return await insight();
    if (state.page === "drive") return renderDrive();
    if (state.page === "partners-overview") return partnersOverview();
    if (state.page === "customers") return crmDirectory("customers");
    if (state.page === "contractors") return crmDirectory("contractors");
    if (state.page === "suppliers") return crmDirectory("suppliers");
    if (state.page === "finance-overview") return renderFinanceOverview();
    if (state.page === "finance-ledome") return renderFinanceLedome();
    if (state.page === "finance-projects") return renderFinanceProjects();
    if (state.page.startsWith("personal-finance-")) return renderPersonalFinancePage(state.page);
    if (state.page === "hrm-overview") return hrmOverview();
    if (state.page === "hrm-staff") return hrmStaff();
    if (state.page === "hrm-attendance") return hrmAttendance();
    if (state.page === "hrm-payroll") return hrmPayroll();
    if (state.page === "catalog") return configCatalog();
    if (state.page === "accounts") return configAccounts();
    return placeholder(state.page);
  } catch (error) {
    renderConnectionError(error);
  }
}

async function init() {
  try {
    state.navCollapsed = JSON.parse(localStorage.getItem(NAV_COLLAPSE_STORAGE) || "{}");
  } catch {
    state.navCollapsed = {};
  }
  $("#menu").onclick = () => $(".sidebar").classList.toggle("open");
  document.body.onclick = async (event) => {
    const notificationWrap = event.target.closest(".notification-wrap");
    if (event.target.closest("[data-notifications-toggle]")) {
      $("#notification-panel")?.classList.toggle("open");
      return;
    }
    if (!notificationWrap) $("#notification-panel")?.classList.remove("open");
    if (event.target.closest("[data-auth='logout']")) logout();
    if (event.target.closest("[data-auth='reset-default']") && confirm("Khôi phục danh sách tài khoản mặc định theo nhân sự hiện tại?")) {
      await resetDefaultAccounts();
      renderLogin("Đã khôi phục tài khoản mặc định. Dùng ID theo Tên + Họ, pass = 1.");
    }
  };
  addEventListener("hashchange", route);
  if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistrations?.().then((items) => items.forEach((item) => item.unregister()));
  try {
    if (!(await requireLogin())) return;
    await loadNavigation();
    await route();
  } catch (error) {
    renderConnectionError(error);
  }
}
init();
