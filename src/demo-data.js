const navigation = [
  ["Tổng quan", "home"], ["Insight", "insight"], ["Dự án", "projects"],
  ["Công việc", "tasks"], ["Phê duyệt", "approval"], ["CRM", "crm"],
  ["Nhân sự", "hrm"], ["Phương tiện", "fleet"], ["Drive", "drive"],
  ["Cơ sở dữ liệu", "catalog"]
];

const projects = [
  { id: "p1", code: "M-NT", name: "[Mẫu] Nội thất", type: "Nội thất", manager: "TÀI KHOẢN TRẢI NGHIỆM", progress: 18, status: "Đang thực hiện", health: "Chậm trễ", budget: 847000000, spent: 532698921 },
  { id: "p2", code: "M-AK70", name: "THI CÔNG NHÀ ANH KHÁNH 70M2 - LẠC LONG QUÂN", type: "Dân dụng", manager: "Nguyễn Tuấn Anh", progress: 84, status: "Đang thực hiện", health: "Bình thường", budget: 1700000000, spent: 72414067 }
];

const dashboard = {
  greeting: "Chào buổi sáng, Quản lý dự án",
  period: "Dữ liệu tổng hợp đến 31/05/2026",
  stats: [
    ["Tổng dự án", "2", "2 dự án mẫu", "teal"],
    ["Đang thực hiện", "2", "100% tổng dự án", "blue"],
    ["Cần chú ý", "1", "1 dự án chậm tiến độ", "orange"],
    ["Tổng giá trị HĐ", "603,2 tỷ", "+8,4% so với quý trước", "purple"]
  ],
  finance: [
    ["Hợp đồng CĐT", 603200000000], ["Sản lượng thực hiện", 402600000000],
    ["Đã nghiệm thu", 318400000000], ["Đã thu", 256800000000]
  ],
  cashflow: [
    ["T1", 24, 18], ["T2", 36, 22], ["T3", 32, 25],
    ["T4", 48, 34], ["T5", 56, 39], ["T6", 68, 45]
  ],
  alerts: [
    ["Cầu vượt tuyến vành đai", "Chậm tiến độ 12 ngày", "danger"],
    ["Nhà máy điện tử Đông Nam", "Vật tư thép vượt ngưỡng cấp 1", "warning"],
    ["Khu phức hợp Riverside", "3 phiếu chi đang chờ duyệt", "info"]
  ],
  tasks: [
    ["Nghiệm thu hạng mục móng", "Hôm nay", "Cao"],
    ["Duyệt đề xuất mua thép", "01/06", "Cao"],
    ["Cập nhật nhật ký thi công", "02/06", "Trung bình"]
  ]
};

const insight = {
  stats: [["Tổng dự án", "18"], ["Rủi ro", "1"], ["Chậm tiến độ", "2"], ["Phát sinh", "4,8 tỷ"], ["Sản lượng", "402,6 tỷ"]],
  receivables: [["Riverside", 12400000000], ["Cầu vượt vành đai", 8900000000], ["Nhà máy Đông Nam", 5400000000]]
};

const dashboardProjects = [
  ["[Mẫu] Nội thất",18,0,705204000,102300000,847000000,511193304,532698921,445698921,0,705204000,-172505079,12300000,12300000,12300000,12300000,0],
  ["THI CÔNG NHÀ ANH KHÁNH 70M2 - LẠC LONG QUÂN",84,1700000000,1830000000,31600000,4575607212,2712442627,906548753,929594779,0,1830000000,-900405221,318657034,270046599,72414067,0,0]
].map(([name, progress, budget, extraIncome, extraCost, ...numbers], index) => ({ id: index === 0 ? "p1" : "p2", name, progress, budget, extraIncome, extraCost, numbers }));

const projectDetail = {
  p1: {
    ...projects[0],
    description: "Dự án mẫu nội thất dùng để khởi tạo quy trình thi công, tiến độ, vật tư và tài chính.",
    schedule: [
      ["Chuẩn bị mặt bằng", "01/01", "20/01", 100],
      ["Thi công móng", "15/01", "20/03", 100],
      ["Kết cấu thân", "01/03", "30/08", 72],
      ["Cơ điện M&E", "01/06", "15/10", 38],
      ["Hoàn thiện", "01/09", "20/12", 8]
    ],
    kpis: [["Tiến độ kế hoạch", "72%"], ["Tiến độ thực tế", "68%"], ["Thu", "54,2 tỷ"], ["Chi", "76,4 tỷ"]],
    contract: [["Nhận thầu", "128 tỷ", "92 tỷ"], ["Giao thầu", "71 tỷ", "43 tỷ"], ["Nhà cung cấp", "38 tỷ", "24 tỷ"]],
    inventory: [["Thép D16", "18.450 kg", "Bình thường"], ["Xi măng PCB40", "1.280 bao", "Sắp hết"], ["Cát vàng", "320 m³", "Bình thường"]],
    recent: [["Nhật ký thi công", "Đã cập nhật khối lượng tầng 12", "30 phút trước"], ["Kho", "Nhập 24 tấn thép D16", "2 giờ trước"], ["Phê duyệt", "Phiếu chi PC-00218 chờ duyệt", "4 giờ trước"]]
  }
};

module.exports = { dashboard, dashboardProjects, insight, projects, projectDetail, navigation };
