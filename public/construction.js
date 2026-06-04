document.head.insertAdjacentHTML("beforeend",'<link rel="stylesheet" href="/construction-overrides.css?v=120">');
document.head.insertAdjacentHTML("beforeend",'<link rel="stylesheet" href="/construction-gantt.css?v=110">');
const fmt=(v)=>new Intl.NumberFormat("vi-VN").format(v||0);
const id=location.pathname.split("/").filter(Boolean).pop();
let currentProject;
const projectDraftKey="ledome.project.info.drafts";
const AUTH_STORAGE="ledome.auth.v1";
const accountLevels={hoangdinh:1,dungbui:2};
const staffLevelOverrides={NS001:1,NS002:2};
const levelLabels={1:"Toàn quyền",2:"Quản lý",3:"Nhân sự",4:"Theo dõi"};
const companyPeople=["DINH Cong Hoang","Bùi Xuân Dũng","Nguyễn Hoàng Hải","Bùi Vũ Kiên","Hồ Quang Chiến","Hoàng Thu Mai","Trần Văn Đức","Nguyễn Tuấn Anh","Nguyễn Hà Vân"];
const projectTypeOptions=["Nội thất","Kiến trúc","Nội thất kiến trúc","Khác"];
const projectBuildingTypeOptions=["Căn hộ","Nhà phố","Biệt thự","Homestay","Nhà hàng","Quán cafe","Bar","Văn phòng","Khác"];
const projectGroupOptions=["Thiết kế","Thi công","Thiết kế Thi công"];
const money=(label,value)=>`<div><span>${label}</span><b>${fmt(value)}</b></div>`;
const empty=(text,icon="⚒")=>`<div class="empty-block"><b>${icon}</b><span>${text}</span></div>`;
const materialRows=[["Bê tông C10","0","105","25"],["Bê tông C10 độ sụt 12+-2","0","234","233"],["đồ bảo hộ","0","100","70"],["mũ","0","100","100"],["Cát","0","10.001","999"]];

function financeBox(type,title,rows,totalLabel,total){
  return `<article class="finance-panel ${type}"><h3>${title}</h3>${rows.map(([a,b])=>money(a,b)).join("")}<strong>${totalLabel}<b>${fmt(total)}</b></strong></article>`;
}
function materialTable(title,action,rows=materialRows){
  return `<article class="box data-box"><header><h3>${title}</h3><select data-material-filter><option>${action}</option><option>Vượt mức cảnh báo 1 (0)</option><option>Vượt mức cảnh báo 2 (0)</option></select><i data-collapse>−</i></header><table><thead><tr><th>STT</th><th>Vật liệu</th><th>ĐVT</th><th>Định mức</th><th>Tổng nhập</th><th>Tồn kho</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td><a>${r[0]}</a></td><td></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join("")}</tbody></table><footer>Xem thêm</footer></article>`;
}
function expenseQuickList(total){
  const rows=[
    ["PC-00218","Chi vật tư hoàn thiện","Nhà cung cấp Minh An","31/05/2026",258279892,"Chờ duyệt"],
    ["PC-00217","Chi nhân công đội sơn bả","Đội thi công Hoàng Long","30/05/2026",76400000,"Đã chi"],
    ["PC-00216","Chi vận chuyển vật liệu","Kho tổng LE DOME","29/05/2026",22400000,"Đã chi"],
    ["PC-00215","Tạm ứng chi phí hồ sơ","Nguyễn Hoàng Hải","28/05/2026",15000000,"Chờ duyệt"]
  ];
  return `<section class="expense-quick box"><header><div><h2>Danh sách chi</h2><p>Hiển thị nhanh các khoản chi của dự án</p></div><strong>Chi lũy kế ${fmt(total)}</strong></header><table><thead><tr><th>Mã phiếu</th><th>Nội dung chi</th><th>Đối tượng</th><th>Ngày</th><th>Giá trị</th><th>Trạng thái</th></tr></thead><tbody>${rows.map(row=>`<tr><td><a data-form="expense">${row[0]}</a></td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td>${fmt(row[4])}</td><td><span class="${row[5]==="Chờ duyệt"?"pending":"done"}">${row[5]}</span></td></tr>`).join("")}</tbody></table></section>`;
}
function requestIssueGrid(project){
  const rfiRows=[
    ["RFI-001","L\u00e0m r\u00f5 cao \u0111\u1ed9 tr\u1ea7n khu v\u1ef1c ph\u00f2ng kh\u00e1ch","Nguy\u1ec5n Ho\u00e0ng H\u1ea3i","02/06/2026","\u0110ang ch\u1edd ph\u1ea3n h\u1ed3i"],
    ["RFI-002","X\u00e1c nh\u1eadn v\u1ecb tr\u00ed h\u1ed9p k\u1ef9 thu\u1eadt t\u1ea7ng 1","B\u00f9i Xu\u00e2n D\u0169ng","01/06/2026","\u0110ang x\u1eed l\u00fd"],
    ["RFI-003","B\u1ed5 sung k\u00edch th\u01b0\u1edbc c\u1eeda WC theo b\u1ea3n v\u1ebd m\u1edbi","H\u1ed3 Quang Chi\u1ebfn","31/05/2026","\u0110\u00e3 ph\u1ea3n h\u1ed3i"]
  ];
  const approvalRows=[
    ["CDT-PD-001","Ph\u00ea duy\u1ec7t ph\u01b0\u01a1ng \u00e1n \u0111\u1ed5i v\u1eadt li\u1ec7u ho\u00e0n thi\u1ec7n khu WC","DINH Cong Hoang","02/06/2026","Ch\u1edd CDT duy\u1ec7t"],
    ["CDT-PD-002","Ph\u00ea duy\u1ec7t chi ph\u00ed ph\u00e1t sinh s\u01a1n b\u1ea3 ph\u00f2ng kh\u00e1ch","B\u00f9i Xu\u00e2n D\u0169ng","01/06/2026","Ch\u1edd b\u1ed5 sung h\u1ed3 s\u01a1"],
    ["CDT-PD-003","Ph\u00ea duy\u1ec7t m\u1eabu c\u1eeda g\u1ed7 WC tr\u01b0\u1edbc khi \u0111\u1eb7t h\u00e0ng","Nguy\u1ec5n Ho\u00e0ng H\u1ea3i","31/05/2026","\u0110ang x\u1eed l\u00fd"]
  ];
  const ownerRows=[
    ["CDT-001","B\u1ed5 sung b\u1ea3n v\u1ebd chi ti\u1ebft c\u1eeda g\u1ed7 WC","L\u00ea Dome / CDT","Nguy\u1ec5n Ho\u00e0ng H\u1ea3i","03/06/2026","\u0110ang x\u1eed l\u00fd"],
    ["CDT-002","X\u00e1c nh\u1eadn l\u1ea1i m\u1eabu s\u01a1n khu v\u1ef1c ph\u00f2ng kh\u00e1ch tr\u01b0\u1edbc khi thi c\u00f4ng \u0111\u1ea1i tr\u00e0","L\u00ea Dome / CDT","B\u00f9i Xu\u00e2n D\u0169ng","02/06/2026","Ch\u1edd ph\u1ea3n h\u1ed3i n\u1ed9i b\u1ed9"],
    ["CDT-004","L\u00e0m r\u00f5 ph\u01b0\u01a1ng \u00e1n thay \u0111\u1ed5i v\u1eadt li\u1ec7u ho\u00e0n thi\u1ec7n khu WC","L\u00ea Dome / CDT","DINH Cong Hoang","31/05/2026","Ch\u1edd duy\u1ec7t ph\u01b0\u01a1ng \u00e1n"]
  ];
  const issueRows=[
    ["CDT-003","C\u1eadp nh\u1eadt ti\u1ebfn \u0111\u1ed9 ho\u00e0n thi\u1ec7n t\u1ea7ng 1 k\u00e8m \u1ea3nh hi\u1ec7n tr\u01b0\u1eddng","L\u00ea Dome / CDT","H\u1ed3 Quang Chi\u1ebfn","01/06/2026","Qu\u00e1 h\u1ea1n"],
    ["CDT-005","Ghi ch\u00fa nghi\u1ec7m thu: ki\u1ec3m tra l\u1ea1i m\u00e9p len ch\u00e2n t\u01b0\u1eddng ph\u00f2ng ng\u1ee7","L\u00ea Dome / CDT","H\u1ed3 Quang Chi\u1ebfn","31/05/2026","C\u1ea7n x\u1eed l\u00fd"]
  ];
  const box=(cls,title,desc,headers,rows,link)=>`<section class="proposal-snapshot ${cls} box"><header><div><h2>${title}</h2><p>${desc}</p></div></header><table><thead><tr>${headers.map(header=>`<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr><td><a data-view-link="${link}">${row[0]}</a></td>${row.slice(1,-1).map(cell=>`<td>${cell}</td>`).join("")}<td><span class="${row.at(-1)==="Qu\u00e1 h\u1ea1n"?"danger":""}">${row.at(-1)}</span></td></tr>`).join("")}</tbody></table></section>`;
  return `<section class="request-grid">${box("rfi-requests","Y\u00eau c\u1ea7u th\u00f4ng tin","C\u00e1c c\u00e2u h\u1ecfi c\u1ea7n l\u00e0m r\u00f5 \u0111\u1ec3 tri\u1ec3n khai thi c\u00f4ng",["M\u00e3 y\u00eau c\u1ea7u","N\u1ed9i dung y\u00eau c\u1ea7u","Ph\u1ee5 tr\u00e1ch","Ng\u00e0y g\u1eedi","Tr\u1ea1ng th\u00e1i"],rfiRows,"rfi")}${box("cdt-approval","Y\u00eau c\u1ea7u c\u1ea7n CDT ph\u00ea duy\u1ec7t","C\u00e1c \u0111\u1ec1 xu\u1ea5t \u0111ang ch\u1edd Ch\u1ee7 \u0111\u1ea7u t\u01b0 x\u00e1c nh\u1eadn",["M\u00e3 y\u00eau c\u1ea7u","N\u1ed9i dung ph\u00ea duy\u1ec7t","Ph\u1ee5 tr\u00e1ch","Ng\u00e0y g\u1eedi","Tr\u1ea1ng th\u00e1i"],approvalRows,"rfa")}${box("owner-notes","Y\u00eau c\u1ea7u c\u1ee7a CDT","C\u00e1c ghi ch\u00fa, y\u00eau c\u1ea7u v\u00e0 ph\u1ea3n h\u1ed3i t\u1eeb Ch\u1ee7 \u0111\u1ea7u t\u01b0",["M\u00e3 note","N\u1ed9i dung y\u00eau c\u1ea7u","Ng\u01b0\u1eddi g\u1eedi","Ph\u1ee5 tr\u00e1ch","Ng\u00e0y nh\u1eadn","Tr\u1ea1ng th\u00e1i"],ownerRows,"owner-request")}${box("owner-issues","V\u1ea5n \u0111\u1ec1 c\u1ea7n x\u1eed l\u00fd","C\u00e1c note CDT \u0111ang qu\u00e1 h\u1ea1n ho\u1eb7c c\u1ea7n x\u1eed l\u00fd ri\u00eang",["M\u00e3 note","N\u1ed9i dung c\u1ea7n x\u1eed l\u00fd","Ng\u01b0\u1eddi g\u1eedi","Ph\u1ee5 tr\u00e1ch","Ng\u00e0y nh\u1eadn","Tr\u1ea1ng th\u00e1i"],issueRows,"issues")}</section>`;
}
function scheduleGanttShortcut(){
  const calendar=ganttCalendar(),weekdays=["CN","T2","T3","T4","T5","T6","T7"];
  const tasks=ensureGanttTaskList().map((row,index)=>({...taskMeta(index),isGroup:row.isGroup})).filter((task,index)=>index>0).slice(0,10);
  const days=calendar.dates.map((date,index)=>`<b class="${date.getDay()===0||date.getDay()===6?"weekend":""} ${index===calendar.todayIndex?"today":""}">${weekdays[date.getDay()]}<em>${String(date.getDate()).padStart(2,"0")}</em></b>`).join("");
  const rows=tasks.map(task=>{const metrics=ganttBarMetrics(task),progress=Math.max(0,Math.min(100,Number(task.progress)||0));return `<div class="schedule-gantt-row ${task.isGroup?"group":""}"><strong title="${task.name}">${task.name}</strong><span><i style="margin-left:${metrics.leftPct}%;width:${metrics.widthPct}%"><em style="width:${progress}%"></em></i></span></div>`}).join("");
  return `<section class="schedule-gantt-shortcut"><header><div><h3>Shortcut bảng Gantt tiến độ</h3><p>Xem nhanh kế hoạch và mức độ hoàn thành của các công việc chính</p></div><a data-view-link="gantt">Mở Gantt đầy đủ</a></header><div class="schedule-gantt-legend"><span><i></i>Kế hoạch</span><span><i></i>Đã thực hiện</span><small>Hiển thị ${tasks.length} task đầu tiên</small></div><div class="schedule-gantt-scroll"><div class="schedule-gantt-grid"><div class="schedule-gantt-head"><strong>Công việc</strong><span>${days}</span></div>${rows}</div></div></section>`;
}
function scheduleOverviewReport(){
  const today=new Date(2026,5,2);
  const parseDate=(value)=>{const parts=String(value||"").split("/").map(Number);return new Date(2026,(parts[1]||1)-1,parts[0]||1)};
  const tasks=ensureGanttTaskList().map((row,index)=>({...taskMeta(index),isGroup:row.isGroup})).filter(task=>!task.isGroup);
  const total=tasks.length || 1;
  const done=tasks.filter(task=>Number(task.progress)>=100).length;
  const doing=tasks.filter(task=>Number(task.progress)>0 && Number(task.progress)<100).length;
  const todo=tasks.filter(task=>Number(task.progress)<=0).length;
  const overdueTasks=tasks.filter(task=>Number(task.progress)<100 && parseDate(task.planEnd)<today);
  const lateDoneTasks=tasks.filter(task=>Number(task.progress)>=100 && task.actualEnd && parseDate(task.actualEnd)>parseDate(task.planEnd));
  const paused=tasks.filter(task=>task.status==="T\u1ea1m d\u1eebng").length;
  const importantTasks=tasks.filter(task=>/!|quan tr\u1ecdng/i.test(task.name)||Number(task.progress)<50&&parseDate(task.planEnd)<=today);
  const planProgress=Math.round(tasks.reduce((sum,task)=>sum+(Number(task.progress)>=100?100:Math.min(100,Number(task.progress||0)+18)),0)/total);
  const actualProgress=Math.round(tasks.reduce((sum,task)=>sum+Number(task.progress||0),0)/total);
  const pct=(value)=>Math.round(value*100/total);
  const statusOf=(task)=>Number(task.progress)>=100?"Ho\u00e0n th\u00e0nh":overdueTasks.some(item=>item.id===task.id)?"Qu\u00e1 h\u1ea1n":Number(task.progress)>0?"\u0110ang l\u00e0m":"Ch\u01b0a l\u00e0m";
  const focusTasks=[...overdueTasks,...importantTasks,...tasks.filter(task=>Number(task.progress)<100)].filter((task,index,arr)=>arr.findIndex(item=>item.id===task.id)===index).slice(0,6);
  const rows=focusTasks.map(task=>`<tr><td><a data-view-link="gantt">${task.code}</a></td><td>${task.name}</td><td>${task.assignee}</td><td>${task.planStart} - ${task.planEnd}</td><td><span class="${statusOf(task)==="Qu\u00e1 h\u1ea1n"?"danger":""}">${statusOf(task)}</span></td><td>${task.progress}%</td></tr>`).join("");
  return `<section class="schedule-overview box"><header><div><h2>T\u1ed5ng quan ti\u1ebfn \u0111\u1ed9</h2><p>L\u1ea5y s\u1ed1 li\u1ec7u tr\u1ef1c ti\u1ebfp t\u1eeb b\u1ea3ng ti\u1ebfn \u0111\u1ed9 thi c\u00f4ng</p></div><a data-view-link="gantt">M\u1edf b\u1ea3ng ti\u1ebfn \u0111\u1ed9</a></header><div class="schedule-body"><article class="schedule-donut"><strong>${total}</strong><span>Task</span></article><article class="schedule-status"><p><i class="todo"></i>Ch\u01b0a l\u00e0m <b>${todo} (${pct(todo)}%)</b></p><p><i class="doing"></i>\u0110ang l\u00e0m <b>${doing} (${pct(doing)}%)</b></p><p><i class="done"></i>Ho\u00e0n th\u00e0nh <b>${done} (${pct(done)}%)</b></p><p><i class="other"></i>Kh\u00e1c <b>${Math.max(0,total-todo-doing-done)} (0%)</b></p></article><article class="schedule-lines"><label>Ti\u1ebfn \u0111\u1ed9 k\u1ebf ho\u1ea1ch ${planProgress}%</label><div><i style="width:${planProgress}%"></i></div><label>Ti\u1ebfn \u0111\u1ed9 th\u1ef1c t\u1ebf ${actualProgress}%</label><div class="actual"><i style="width:${actualProgress}%"></i></div></article></div><footer><b>QU\u00c1 H\u1ea0N<em>${overdueTasks.length}</em></b><b>HT QU\u00c1 H\u1ea0N<em>${lateDoneTasks.length}</em></b><b>T\u1ea0M D\u1eeaNG<em>${paused}</em></b><b>QUAN TR\u1eccNG<em>${importantTasks.length}</em></b></footer>${scheduleGanttShortcut()}<div class="schedule-focus"><h3>Task c\u1ea7n ch\u00fa \u00fd</h3><table><thead><tr><th>M\u00e3</th><th>C\u00f4ng vi\u1ec7c</th><th>Ng\u01b0\u1eddi th\u1ef1c hi\u1ec7n</th><th>K\u1ebf ho\u1ea1ch</th><th>T\u00ecnh tr\u1ea1ng</th><th>Ti\u1ebfn \u0111\u1ed9</th></tr></thead><tbody>${rows||`<tr><td colspan="6">Kh\u00f4ng c\u00f3 task c\u1ea7n ch\u00fa \u00fd.</td></tr>`}</tbody></table></div></section>`;
}
function projectDrafts(){return {}}
function saveProjectDraft(project){}
function currentSession(){try{return JSON.parse(localStorage.getItem(AUTH_STORAGE)||"{}")||{}}catch{return {}}}
function currentLoginId(){return currentSession()?.loginId||"HoangDinh"}
function accountLevel(){const session=currentSession(),login=String(session?.loginId||"HoangDinh").trim().toLowerCase();return staffLevelOverrides[session?.staffCode]||accountLevels[login]||3}
function canEditProjectInfo(){return accountLevel()<=2}
function projectInfoValue(project,key,fallback){return project[key]||fallback}
function projectInfoCard(p,progress,budget,spent){
  const planProgress=Math.min(100,progress+4),canEdit=canEditProjectInfo();
  const info=[
    ["Mã dự án",projectInfoValue(p,"code",id)],["Phạm vi",projectInfoValue(p,"type","Nội thất")],["Loại hình",projectInfoValue(p,"buildingType","Căn hộ")],["Chủ đầu tư",projectInfoValue(p,"owner","Le Dome")],
    ["Khách hàng",projectInfoValue(p,"client","Chưa cập nhật")],["Địa điểm",projectInfoValue(p,"location","Chưa cập nhật")],["Giám đốc dự án",projectInfoValue(p,"manager","Chưa phân công")],["Chỉ huy trưởng",projectInfoValue(p,"commander","Chưa phân công")],
    ["QS phụ trách",projectInfoValue(p,"qs","Chưa phân công")],["Ngày bắt đầu",projectInfoValue(p,"startDate","01/02/2023")],["Ngày kết thúc",projectInfoValue(p,"endDate","11/07/2023")],
    ["Thời gian",projectInfoValue(p,"duration","161 ngày")],["Trạng thái",projectInfoValue(p,"status","Kế hoạch")],["Ngân sách",fmt(budget)]
  ];
  return `<section class="project-summary project-info box"><header><div><h2>${p.name}</h2><p><i></i>${projectInfoValue(p,"status","Kế hoạch")} · ${projectInfoValue(p,"health","Bình thường")}</p></div><div class="project-permission"><button data-project-edit class="${canEdit?"":"readonly"}">Sửa thông tin</button></div></header><small>${projectInfoValue(p,"description","Theo dõi tổng thể tiến độ, tài chính và nguồn lực dự án.")}</small><div class="project-info-grid">${info.map(([label,value])=>`<p><span>${label}</span><b>${value}</b></p>`).join("")}</div></section>`;
}
function organizeProjectOverview(){
  const app=document.querySelector("#project-app");
  const overview=document.createElement("div");
  overview.className="project-overview";
  const zones=[
    ["quick-zone","01","Truy c\u1eadp nhanh","M\u1edf nhanh c\u00e1c nghi\u1ec7p v\u1ee5 th\u01b0\u1eddng d\u00f9ng",[".quick"]],
    ["info-zone","02","Th\u00f4ng tin","Th\u00f4ng tin nh\u1eadn di\u1ec7n v\u00e0 nh\u00e2n s\u1ef1 ph\u1ee5 tr\u00e1ch d\u1ef1 \u00e1n",[".project-info"]],
    ["progress-zone","03","Ti\u1ebfn \u0111\u1ed9","Th\u1ed1ng k\u00ea nhanh ti\u1ebfn \u0111\u1ed9 thi c\u00f4ng v\u00e0 c\u00e1c task c\u1ea7n ch\u00fa \u00fd",[".schedule-overview"]],
    ["finance-zone","04","D\u00f2ng ti\u1ec1n","T\u1ed5ng h\u1ee3p c\u00f4ng n\u1ee3 v\u00e0 c\u00e1c kho\u1ea3n chi g\u1ea7n nh\u1ea5t",[".finance-grid",".expense-quick"]],
    ["request-zone","05","Y\u00eau c\u1ea7u & v\u1ea5n \u0111\u1ec1","Theo d\u00f5i c\u00e1c n\u1ed9i dung c\u1ea7n ph\u1ea3n h\u1ed3i, ph\u00ea duy\u1ec7t ho\u1eb7c x\u1eed l\u00fd",[".request-grid"]]
  ];
  zones.forEach(([className,index,title,description,selectors])=>{
    const zone=document.createElement("section");
    zone.className=`overview-zone ${className}`;
    zone.innerHTML=`<header class="overview-zone-head"><b>${index}</b><div><h2>${title}</h2><p>${description}</p></div></header><div class="overview-zone-body"></div>`;
    const body=zone.querySelector(".overview-zone-body");
    selectors.forEach(selector=>{
      const node=[...app.children].find(child=>child.matches(selector));
      if(node)body.appendChild(node);
    });
    if(body.childElementCount)overview.appendChild(zone);
  });
  app.prepend(overview);
}
function projectInfoModal(){
  if(!canEditProjectInfo())return alert("Account hiện tại không có quyền sửa thông tin dự án.");
  const p=currentProject;
  const fields=[["name","Tên dự án",p.name],["code","Mã dự án",p.code||id],["type","Phạm vi",p.type||"Nội thất"],["buildingType","Loại hình",p.buildingType||"Căn hộ"],["group","Nhóm dự án",p.group||"Thi công"],["owner","Chủ đầu tư",p.owner||"Le Dome"],["client","Khách hàng",p.client||""],["location","Địa điểm",p.location||""],["manager","Giám đốc dự án",p.manager||""],["commander","Chỉ huy trưởng",p.commander||""],["qs","QS phụ trách",p.qs||""],["accountant","Kế toán dự án",p.accountant||""],["startDate","Ngày bắt đầu",p.startDate||"01/02/2023"]];
  const esc=(value)=>String(value||"").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;");
  const selectField=(key,label,value,options)=>`<label><span>${label}</span><select name="${key}">${options.map(option=>`<option value="${esc(option)}" ${option===value?"selected":""}>${option}</option>`).join("")}</select></label>`;
  const staffField=(key,label,value)=>{
    const isKnown=companyPeople.includes(value),selected=isKnown?value:"Khác";
    return `<label class="staff-select"><span>${label}</span><select name="${key}" data-staff-select>${companyPeople.map(person=>`<option value="${esc(person)}" ${person===selected?"selected":""}>${person}</option>`).join("")}<option value="Khác" ${selected==="Khác"?"selected":""}>Khác</option></select><input name="${key}Other" data-staff-other value="${isKnown?"":esc(value)}" placeholder="Nhập nhân sự khác" ${selected==="Khác"?"":"hidden"}></label>`;
  };
  const fieldHtml=fields.map(([key,label,value])=>{
    if(key==="type")return selectField(key,label,value,projectTypeOptions);
    if(key==="buildingType")return selectField(key,label,value,projectBuildingTypeOptions);
    if(key==="group")return selectField(key,label,value,projectGroupOptions);
    if(["manager","commander","qs","accountant"].includes(key))return staffField(key,label,value);
    return `<label><span>${label}</span><input name="${key}" value="${esc(value)}" ${/date$/i.test(key)?"data-popup-date readonly":""}></label>`;
  }).join("");
  document.body.insertAdjacentHTML("beforeend",`<div class="cash-modal project-info-modal"><section><header><h2>Sửa thông tin dự án</h2><button data-project-info-close>×</button></header><div class="project-info-form">${fieldHtml}<label class="wide"><span>Mô tả</span><textarea name="description">${esc(p.description||"")}</textarea></label></div><footer><button data-project-info-close>Đóng</button><button data-project-info-save>Lưu thay đổi</button></footer></section></div>`);
  document.querySelectorAll("[data-project-info-close]").forEach(x=>x.onclick=()=>document.querySelector(".project-info-modal").remove());
  document.querySelectorAll("[data-staff-select]").forEach(select=>select.onchange=()=>{select.nextElementSibling.hidden=select.value!=="Khác"});
  bindPopupDateFields(document.querySelector(".project-info-modal"));
  document.querySelector("[data-project-info-save]").onclick=async()=>{const modal=document.querySelector(".project-info-modal"),next={};modal.querySelectorAll("input:not([data-staff-other]),select,textarea").forEach(input=>next[input.name]=input.value.trim());modal.querySelectorAll("[data-staff-select]").forEach(select=>{next[select.name]=select.value==="Khác"?select.nextElementSibling.value.trim():select.value});const response=await fetch(`/api/v1/projects/${id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(next)});const saved=await response.json();if(!response.ok)return alert(saved.error||"Không thể lưu thông tin dự án");const merged={...currentProject,...next,...saved};saveProjectDraft(merged);Object.assign(currentProject,merged);modal.remove();render()};
}
async function render(){
  document.querySelector(".toolbar").style.display="";
  document.querySelector("#project-app").style.padding="";
  const res=await fetch(`/api/v1/projects/${id}`);
  const p=res.ok?await res.json():{name:"Dự án xây dựng",progress:0,budget:0,spent:0};
  if(!res.ok)Object.assign(p,projectDrafts()[id]||{});
  const progress=p.progress||0, budget=p.budget||25038348888, spent=p.spent||272579000;
  currentProject=p;
  document.querySelector("#crumb-name").innerText=p.name;
  document.title=`LE DOME - ${p.name}`;
  document.querySelector("#project-app").innerHTML=`
  <section class="quick box"><h2>Truy cập nhanh</h2><div class="quick-grid quick-grid-three"><div><b>Công nợ</b><a data-view-link="debt-owner">Công nợ CDT theo DA ↗</a><a data-view-link="debt-vendor">Công nợ nhà thầu theo DA ↗</a><a data-view-link="debt-supplier">Công nợ NCC ↗</a></div><div><b>Công trường</b><a data-form="diary">Thêm nhật ký thi công</a><a data-form="slip-in">Thêm phiếu nhập</a><a data-form="expense">Thêm phiếu chi</a><a data-view-link="issues">Thêm vấn đề cần xử lý</a></div><div><b>CDT</b><a data-view-link="rfa">Thêm yêu cầu phê duyệt CDT</a><a data-view-link="owner-request">Thêm yêu cầu CDT</a></div></div></section>
  ${projectInfoCard(p,progress,budget,spent)}
  ${scheduleOverviewReport()}
  <section class="finance-grid">${financeBox("owner","CHỦ ĐẦU TƯ",[["Hợp đồng",10419962702],["Đã thực hiện",16385814818],["Đã nghiệm thu",2779314400],["Đề nghị thanh toán",2042461974],["Giá trị giữ lại",0],["Thu thực tế",42461974]],"CĐT còn nợ",2000000000)}${financeBox("contractor","NHÀ THẦU",[["Hợp đồng",1429623737],["Đã thực hiện",958201030],["Đã nghiệm thu",252527868],["Đề nghị thanh toán",258279892],["Giá trị giữ lại",0],["Trả thực tế",0]],"Còn nợ NT",258279892)}${financeBox("supplier","NHÀ CUNG CẤP",[["Hợp đồng",155924000],["Đề nghị thanh toán",1900329517],["Trả thực tế",200179000]],"Còn nợ NCC",1700150517)}</section>
  ${expenseQuickList(spent)}
  <section class="grid-two"><article class="box cost-watch"><h2>Theo dõi chi phí dự án</h2><div class="cost-part"><h3>CHI PHÍ THEO KHỐI LƯỢNG ĐÃ THỰC HIỆN</h3>${money("Chi phí dự toán khối lượng đã thực hiện (1)",16385814818)}${money("Chi phí trả cho Thầu phụ (2)",258279892)}${money("Chi phí trả cho Nhà cung cấp (3)",1900329517)}${money("Tổng chi phí khác (4)",22400000)}${money("Tổng chi phí đã sử dụng thực tế (5) = (2) + (3) + (4)",2181009409)}${money("Dự trù lãi/lỗ (6) = (1) - (5)",14204805409)}</div><div class="cost-part"><h3>CHI PHÍ THEO VẬT LIỆU ĐÃ MUA</h3>${money("Tổng chi phí mua vật liệu đến hiện tại theo dự toán (1)",0)}${money("Tổng chi phí mua vật liệu theo phiếu mua (2)",3186627819)}${money("Dự trù lãi/lỗ (3) = (1) - (2)",-3186627819)}</div></article><article class="box cashflow" data-cashflow><h2>Dòng tiền dự án</h2><div class="legend">■ Giá trị thu　<span>■</span> Giá trị chi　⌁ Lũy kế thu　⌁ Lũy kế chi　⌁ Số dư</div><div class="cash-chart">${Array.from({length:31},(_,i)=>`<i style="height:${i===0?70:i===1?120:i===30?145:4}px"><b style="height:${i===0?80:i===1?135:i===30?210:4}px"></b></i>`).join("")}</div></article></section>
  ${requestIssueGrid(p)}
  <section class="grid-two lower">${materialTable("Vật liệu nhập vượt","Vượt định mức (26)")}${materialTable("Công việc sử dụng vượt vật liệu","Xuất vượt định mức (3)",[["Cắt ống thép bằng máy cắt cầm tay","25/11 - 26/11","0%",""],["Thi công lớp móng cát vàng gia cố xi măng","04/04 - 05/04","100%","Nguyễn Tuấn Anh"],["Thi công móng cấp phối đá dăm lớp trên","02/03 - 11/03","100%",""]])}${materialTable("Vật liệu xuất vượt","Vượt định mức (14)")}`
  +`<article class="box data-box"><header><h3>Phiếu vật liệu cần xác nhận</h3><button>Phiếu nhập (0)⌄</button><i data-collapse>−</i></header>${empty("Không có phiếu vật liệu cần xác nhận nào!","▤")}</article><article class="box data-box"><header><h3>Đề xuất vật liệu chưa duyệt</h3><button>Đề xuất mua (0)⌄</button><i data-collapse>−</i></header>${empty("Không có đề xuất vật liệu cần duyệt nào!")}</article><article class="box data-box"><header><h3>Vật liệu cần dùng trong 7 ngày tới</h3><i data-collapse>−</i></header>${empty("Không có vật liệu nào!")}</article><article class="box data-box"><header><h3>Nhân công cần dùng trong 7 ngày tới</h3><i data-collapse>−</i></header>${empty("Không có nhân công nào!")}</article><article class="box data-box"><header><h3>Máy thi công cần dùng trong 7 ngày tới</h3><i data-collapse>−</i></header>${empty("Không có máy thi công nào!")}</article></section>`;
  organizeProjectOverview();
  bind();
}
function bind(){
  document.querySelectorAll("[data-collapse]").forEach(x=>x.onclick=()=>{const box=x.closest(".data-box");box.classList.toggle("collapsed");x.innerText=box.classList.contains("collapsed")?"+":"−"});
  document.querySelector("[data-project-edit]")?.addEventListener("click",projectInfoModal);
  document.querySelectorAll("[data-view-link]").forEach(x=>x.onclick=()=>showView(x.dataset.viewLink));
  document.querySelectorAll("[data-form]").forEach(x=>x.onclick=()=>showForm(x.dataset.form));
  document.querySelectorAll("[data-material-filter]").forEach(x=>x.onchange=()=>alert(`Đang lọc: ${x.value}`));
}
const field=(label,placeholder="")=>{const isDate=/^\s*ngày/i.test(label)||/nhật ký ngày/i.test(label);return `<label><span>${label}</span><input ${isDate?"data-popup-date readonly":""} placeholder="${placeholder}" value="${isDate?placeholder:""}"></label>`};
function importModal(){document.body.insertAdjacentHTML("beforeend",`<div class="cash-modal import-modal"><section><header><h2>Nhập dữ liệu</h2><button data-dismiss>×</button></header><h3>File dữ liệu:</h3><input type="file"><p>Tải mẫu Excel:</p><a>File mẫu ↓</a><footer><button data-dismiss>Đóng</button><button data-import-confirm>Vui lòng tải file</button></footer></section></div>`);document.querySelectorAll("[data-dismiss]").forEach(x=>x.onclick=()=>document.querySelector(".import-modal").remove());document.querySelector("[data-import-confirm]").onclick=()=>alert("Hãy chọn file Excel trước khi nhập dữ liệu.");}
function formShell(title,body){document.querySelector("#project-app").innerHTML=`<section class="form-page box"><header><h2>${title}</h2><div><button data-save>▣ Lưu</button><button data-close>× Đóng</button></div></header>${body}</section>`;document.querySelector("[data-close]").onclick=()=>{history.replaceState(null,"",location.pathname);render()};document.querySelector("[data-save]").onclick=()=>alert("Đã lưu bản nháp dữ liệu demo.");document.querySelectorAll("[data-import]").forEach(x=>x.onclick=()=>importModal());document.querySelector("[data-diary-task]")?.addEventListener("click",diaryResourceDetail);bindPopupDateFields()}
function paymentRows(){const names=["PHẦN NỀN MÓNG","Đào móng bằng máy đào 0,4m3, chiều rộng móng ≤6m","Bê tông lót nền móng","Sản xuất, lắp dựng cốt thép móng","Bê tông móng, dầm móng","Bê tông cổ cột","Xây tường móng","Bê tông giằng tường móng","Đắp nền móng công trình bằng thủ công","Bê tông nền","Sản xuất, lắp dựng cốt thép cột, dầm, sàn","Ván khuôn cột - Cột vuông, chữ nhật","PHẦN THÂN NHÀ"];return names.map((name,i)=>`<tr class="${i&&i<7?"warn":""}"><td>${i?`1.${i}`:"1"}</td><td>${i?"AF."+String(11000+i*113):""}</td><td>${name}${i&&i<7?"<small>ⓘ Khối lượng thanh toán vượt khối lượng theo hợp đồng</small>":""}</td><td>${i?"m3":""}</td><td>${i?(i*.5421).toFixed(4):""}</td><td>${i?(i*.4132).toFixed(4):""}</td><td><input value="${i===1?"4,2":"0"}"></td><td>${i?Math.min(100,i*17)+",00":""}</td><td>${i?fmt(1198896+i*944047):""}</td><td><input></td><td>${i?fmt(i*1379627):""}</td></tr>`).join("")}
function diaryResourceDetail(){document.querySelector(".work-list").innerHTML=`<h3>Sản xuất, lắp dựng cốt thép móng, đường kính <=10mm</h3><p>KL kế hoạch　<b>0,4884</b>　 KL thi công　<b>0,2442</b>　 Tích lũy　<b>0,9768</b>　 Còn lại　<b>-0,4884</b></p><small>Khối lượng hoàn thành vượt khối lượng kế hoạch!</small><h3>VẬT LIỆU (2)</h3>${statTable(["STT","Vật liệu","Kho xuất","Thời gian xuất","Số lượng","Đơn vị"],[["1","Dây thép","Kho dự án","18:00","3,924294","kg"],["2","Thép tròn Fi ≤10mm","Kho dự án","18:00","245,421","kg"]])}<h3>NHÂN CÔNG (1)</h3>${statTable(["STT","Nhân công","Giờ làm","Số lượng","Đơn vị"],[["1","Nhân công bậc 3,5/7 - Nhóm 2","07:00 - 18:00","2,62515","công"]])}<h3>MÁY THI CÔNG (1)</h3>${statTable(["STT","Máy thi công","Giờ làm","Số lượng","Đơn vị"],[["1","Máy cắt uốn cốt thép - công suất: 5 kW","07:00 - 18:00","0,09768","ca"]])}`}
function showForm(type){
  history.replaceState(null,"",`${location.pathname}?form=${type}`);
  if(type==="diary")return diaryEditor(true);
  if(type==="diary")return formShell("Thêm mới nhật ký thi công",`<div class="form-tabs">Công việc　 Hạng mục <button data-import>↥ Nhập dữ liệu</button></div><div class="split-form"><section class="work-list"><input placeholder="⌕ Tìm công việc theo tên ..."><button data-diary-task>1. Lát nền, sàn gạch ceramic 50x50 vữa M75 trệt</button></section><section class="form-fields"><h3>THÔNG TIN NHẬT KÝ</h3><div class="media-row"><div class="photo">▣<small>Ảnh hiện trường</small></div><div class="photo">▧<small>BIM</small></div><div class="photo">⌘<small>Tệp đính kèm</small></div></div>${field("Mã nhật ký","Nhập mã nhật ký")}${field("Nhật ký ngày *","31/05/2026")}${field("Người theo dõi","Chọn người theo dõi")}<h4>Tình hình thi công trong ngày</h4><p>Công tác an toàn　 ◉ Tốt　○ Trung bình　○ Kém</p><p>Chất lượng thi công　 ◉ Tốt　○ Trung bình　○ Kém</p><p>Tiến độ thi công　 ◉ Tốt　○ Trung bình　○ Kém</p><p>Công tác vệ sinh　 ◉ Tốt　○ Trung bình　○ Kém</p></section></div>`);
  if(type==="volume-log")return formShell("Thêm mới nhật ký khối lượng",`<div class="split-form"><section class="work-list"><input placeholder="⌕ Tìm hạng mục theo tên ..."></section><section class="form-fields"><button data-import>↥ Nhập dữ liệu</button><h3>THÔNG TIN NHẬT KÝ</h3><div class="photo">▣<small>Ảnh hiện trường</small></div>${field("Mã nhật ký","Nhập mã nhật ký")}${field("Nhật ký ngày *","31/05/2026")}${field("Hợp đồng","Chọn hợp đồng")}${field("Tổ đội thi công","Nhập tổ đội thi công")}${field("Người theo dõi","Chọn người theo dõi")}<h4>Thời tiết</h4><div class="weather">　　Sáng　　 Chiều　　 Tối　　 Đêm<br>Điều kiện　＿＿＿＿　＿＿＿＿　＿＿＿＿　＿＿＿＿<br>Nhiệt độ　 ＿＿＿＿　＿＿＿＿　＿＿＿＿　＿＿＿＿</div><h4>Tình hình thi công trong ngày</h4><p>Công tác an toàn　 ◉ Tốt　○ Trung bình　○ Kém</p><p>Chất lượng thi công　 ◉ Tốt　○ Trung bình　○ Kém</p><p>Tiến độ thi công　 ◉ Tốt　○ Trung bình　○ Kém</p><textarea placeholder="Báo cáo sự cố"></textarea><textarea placeholder="Đề xuất - kiến nghị"></textarea><textarea placeholder="Ghi chú"></textarea></section></div>`);
  if(type==="approval")return formShell("Thêm đề xuất",`<div class="approval-grid"><section><h3>THÔNG TIN ĐỀ XUẤT</h3>${field("Loại đề xuất *","Chọn loại đề xuất")}${field("Phòng ban *","KD4MB CƠ ĐIỆN")}${field("Người xét duyệt *","Chọn người phê duyệt")}${field("Người nhận thông báo","Chọn người nhận thông báo")}${field("Thời hạn duyệt mong muốn","Nhập thời hạn mong muốn")}${field("Liên kết với đề xuất","Chọn đề xuất liên kết")}<h4>Nội dung</h4><div class="editor">Edit　 View　 Insert　 Format　 Tools　 Table<br><b>↗　☷　B　I　U　A　☰</b></div></section><section>${field("Tên đề xuất *","Nhập tên đề xuất")}${field("Người đề xuất","TÀI KHOẢN TRẢI NGHIỆM")}${field("Người theo dõi","Chọn người theo dõi")}<aside class="approval-flow"><h3>QUY TRÌNH XÉT DUYỆT</h3><b>QUY TRÌNH</b><br><br><b>NGƯỜI XÉT DUYỆT</b></aside></section></div>`);
  if(type==="slip-in"||type==="slip-out")return formShell(type==="slip-in"?"Tạo phiếu nhập":"Tạo phiếu xuất",`<div class="split-form"><section><div class="form-tabs"><input placeholder="⌕ Tìm hàng hóa theo mã, tên ..."><button>＋</button>　☐ Tách dòng</div><table class="form-table"><tr><th>STT</th><th>Hàng hóa</th><th>Thương hiệu</th><th>Xuất xứ</th><th>Đơn vị</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th><th>VAT (%)</th></tr></table></section><section class="form-fields"><div class="photo">▣<small>Ảnh hiện trường</small></div>${field("Mã phiếu","Nhập mã phiếu")}${field("Nhà cung cấp *","Tìm kiếm nhà cung cấp")}${field("Đơn hàng mua","Tìm kiếm đơn hàng mua")}${field("Hợp đồng NCC","Chọn hợp đồng NCC")}${field("Kế hoạch vật tư","Chọn kế hoạch")}${field("Kho nhận *","Kho dự án")}${field("Người nhận *","TÀI KHOẢN TRẢI NGHIỆM")}${field("Ngày nhận *","31/05/2026 21:39")}${field("Người giao","Nhập tên người giao")}${field("Biển số xe","Nhập biển số xe")}</section></div>`);
  if(type==="acceptance")return formShell("Thêm mới nghiệm thu",`<div class="form-tabs">Thông tin　 Hạng mục</div><div class="approval-grid"><section>${field("Tên gói thầu","Nhập tên gói thầu")}${field("Chủ đầu tư","Tìm kiếm chủ đầu tư")}${field("Căn cứ xác định","Nhập căn cứ xác định")}${field("Người theo dõi","Chọn người theo dõi")}${field("Đính kèm","Đính kèm liên kết")}</section><section>${field("Hợp đồng","Tìm kiếm hợp đồng")}${field("PL bổ sung","Nhập phụ lục")}${field("Nghiệm thu lần","Nhập lần nghiệm thu")}${field("VAT (%)","Nhập VAT")}</section></div>`);
  if(type==="payment")return formShell("Thêm mới thanh toán",`<div class="form-tabs">Thông tin　 <b>Hạng mục</b>　 Vật tư khấu trừ <button data-import>↥ Nhập dữ liệu</button><button>⟳ Điều chỉnh khối lượng</button></div><div class="payment-wrap"><input placeholder="⌕ Tìm kiếm hạng mục"><table class="payment-table"><thead><tr><th>Chỉ mục</th><th>Mã số</th><th>Hạng mục</th><th>Đơn vị</th><th>Khối lượng theo hợp đồng</th><th>Khối lượng đã nghiệm thu</th><th>Thực hiện kỳ này</th><th>% Hoàn thành</th><th>Đơn giá thanh toán</th><th>VAT (%)</th><th>Thành tiền kỳ này</th></tr></thead><tbody>${paymentRows()}</tbody></table></div>`);
  if(type==="receipt"||type==="expense")return showCashModal(type);
}
function showCashModal(type){const receipt=type==="receipt";document.body.insertAdjacentHTML("beforeend",`<div class="cash-modal"><section><header><h2>${receipt?"Lập phiếu thu":"Lập phiếu chi"}</h2><button data-dismiss>×</button></header>${field("Mã phiếu","Mã phiếu")}${field("Ngày lập phiếu *","31/05/2026")}${field("Giá trị *","0")}${field("Quỹ *","Chọn quỹ")}${field("Người theo dõi","Người theo dõi")}${field(receipt?"Khách hàng":"Nhà cung cấp","Chọn đối tượng")}${field(receipt?"Thuộc hợp đồng":"Thuộc hợp đồng","Hợp đồng")}${field("Phòng ban","Chọn phòng ban")}${field("Nhân viên","Chọn nhân viên")}${field(receipt?"Loại thu":"Loại chi",receipt?"Chọn loại thu":"Chọn loại chi")}${field("Ghi chú",receipt?"Thu tiền":"Trả tiền")}<h3>DIỄN GIẢI CHI TIẾT</h3>${field("Dự án",currentProject.name)}${field("Giai đoạn","Chọn giai đoạn")}${field("Công việc","Công việc")}<table class="form-table"><tr><th>STT</th><th>Diễn giải</th><th>Số tiền</th><th>Đối tượng</th><th>Chứng từ ghi nợ</th></tr><tr><td>1</td><td>${receipt?"Thu tiền":"Trả tiền"}</td><td>0</td><td>Đối tượng</td><td>Chứng từ ghi nợ</td></tr></table><footer><button data-dismiss>Đóng</button><button data-save-modal>Lưu và đóng</button></footer></section></div>`);document.querySelectorAll("[data-dismiss]").forEach(x=>x.onclick=()=>document.querySelector(".cash-modal").remove());document.querySelector("[data-save-modal]").onclick=()=>{alert("Đã lưu phiếu demo.");document.querySelector(".cash-modal").remove()};bindPopupDateFields()}
const warehouseRows=[["A24.0010","Đá 4x6","m3","16,4556353","1.000","0","1.000"],["V00750","Vật liệu khác","%","0","220,275","0","220,275"],["A33.0524","Cao su","m2","0","100","100","0"],["A33.0318","Que hàn không rỉ","kg","0","100","30","70"],["V42250","Thép tròn Fi >18mm","kg","0","100","98","2"],["A33.0115","Que hàn","kg","32,50773","80","30","50"],["A33.0739","BE D200mm","cái","0","1","1","0"],["A33.0698","BU D100mm","cái","0","1","1","0"]];
function warehouseView(){const rows=warehouseRows.map((r,i)=>`<tr><td><input type="checkbox"></td><td>⌄　<a>${r[0]}</a></td><td>${r[1]}</td><td></td><td></td><td></td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}${i===0||i===5?"　⚠":""}</td><td>${r[5]}</td><td>0</td><td>${r[6]}</td></tr>`).join("");document.querySelector("#project-app").innerHTML=`<section class="warehouse-view box"><div class="warehouse-tabs"><button class="active">Kho vật liệu</button><button>Định mức vật liệu</button><button>Lịch sử định mức</button><button>So sánh định mức</button></div><div class="warehouse-tools"><input placeholder="⌕ Tìm kiếm vật liệu..."><button data-filter> Bộ lọc⌄</button><span>⚠ 0 VL vượt mức cảnh báo 1</span><em>⚠ 4 VL vượt mức cảnh báo 2</em></div><div class="warehouse-filter"><label>Nhóm vật liệu<select><option>Chọn nhóm vật liệu</option></select></label><label>Kho dự án<select><option>Tất cả kho dự án</option><option>Kho dự án - ${currentProject.name}</option></select></label><label>Loại hàng hóa<input></label><button>Áp dụng</button></div><table class="warehouse-table"><thead><tr><th></th><th>Mã vật liệu</th><th>Tên vật liệu</th><th>Chủng loại</th><th>Thương hiệu</th><th>Xuất xứ</th><th>Đơn vị</th><th>Định mức</th><th>Tổng nhập</th><th>Tổng xuất</th><th>Tổng hoàn</th><th>Tồn kho</th></tr></thead><tbody>${rows}</tbody></table></section>`;document.querySelector("[data-filter]").onclick=()=>document.querySelector(".warehouse-filter").classList.toggle("open");document.querySelectorAll(".warehouse-tabs button").forEach((x,i)=>x.onclick=()=>{document.querySelectorAll(".warehouse-tabs button").forEach(b=>b.classList.remove("active"));x.classList.add("active");if(i===3)document.querySelector(".warehouse-table").outerHTML=`<div class="empty-module">▱<br>Không có định mức vật liệu nào!</div>`})}
function existingFileUrl(file){return `/api/v1/projects/${id}/existing-files/download?storedName=${encodeURIComponent(file.storedName)}`}
function existingFileIcon(file){return file.category==="image"?"Ảnh":file.category==="video"?"Video":"File"}
function existingFileCard(file){const url=existingFileUrl(file),isImage=file.category==="image",isPdf=/\.pdf$/i.test(file.name),canOpen=isImage||isPdf,openType=isPdf?"pdf":"image",preview=isImage?`<img src="${url}" alt="${contractEscape(file.name)}">`:file.category==="video"?`<video src="${url}" muted controls></video>`:`<div class="existing-file-icon ${isPdf?"pdf":""}">${isPdf?"PDF":existingFileIcon(file)}</div>`;return `<article class="existing-card ${canOpen?"clickable":""}" data-existing-category="${file.category}" ${canOpen?`data-open-file="${url}" data-open-type="${openType}" data-open-title="${contractEscape(file.name)}"`:""}><div class="existing-preview ${canOpen?"clickable":""}">${preview}</div><div class="existing-meta"><b title="${contractEscape(file.name)}">${contractEscape(file.name)}</b><span>${existingFileIcon(file)} · ${contractMoney(Math.ceil(file.size/1024))} KB</span></div><footer><a href="${url}" download>Tải</a><button data-existing-delete="${contractEscape(file.storedName)}">Xóa</button></footer></article>`}

function existingView(){history.replaceState(null,"",`${location.pathname}?view=project-existing`);document.querySelector("#project-app").innerHTML=`<section class="existing-view"><header><div><h2>Hiện trạng dự án</h2><p>Quản lý toàn bộ ảnh, video và file input hiện trạng dùng làm dữ liệu đầu vào dự án.</p></div><button data-existing-pick>+ Thêm file</button></header><section class="existing-drop" data-existing-drop><input type="file" hidden multiple data-existing-file accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.dwg,.zip"><strong>Kéo thả ảnh, video hoặc hồ sơ hiện trạng vào đây</strong><span>Hỗ trợ ảnh, video, PDF, Word, Excel, CAD và file nén. Có thể thả nhiều file cùng lúc.</span><button data-existing-pick>Chọn từ máy</button></section><section class="existing-tools"><input data-existing-search placeholder="Tìm ảnh, video, hồ sơ..."><button class="active" data-existing-filter="all">Tất cả</button><button data-existing-filter="image">Ảnh</button><button data-existing-filter="video">Video</button><button data-existing-filter="file">File</button><span data-existing-count>Đang tải...</span></section><section class="existing-gallery" data-existing-gallery><div class="existing-empty">Đang tải dữ liệu hiện trạng...</div></section></section>`;bindExistingView();loadExistingFiles()}
function bindExistingView(){document.querySelectorAll("[data-existing-pick]").forEach(button=>button.onclick=()=>document.querySelector("[data-existing-file]").click());document.querySelector("[data-existing-file]").onchange=e=>uploadExistingFiles([...e.target.files]);const drop=document.querySelector("[data-existing-drop]");drop.ondragover=e=>{e.preventDefault();drop.classList.add("dragging")};drop.ondragleave=()=>drop.classList.remove("dragging");drop.ondrop=e=>{e.preventDefault();drop.classList.remove("dragging");uploadExistingFiles([...e.dataTransfer.files])};document.querySelectorAll("[data-existing-filter]").forEach(button=>button.onclick=()=>{document.querySelectorAll("[data-existing-filter]").forEach(x=>x.classList.remove("active"));button.classList.add("active");filterExistingFiles()});document.querySelector("[data-existing-search]").oninput=filterExistingFiles}
async function loadExistingFiles(){const gallery=document.querySelector("[data-existing-gallery]"),count=document.querySelector("[data-existing-count]");try{const body=await fetch(`/api/v1/projects/${id}/existing-files`).then(res=>res.json()),files=body.data||[];gallery.innerHTML=files.length?files.map(existingFileCard).join(""):`<div class="existing-empty">Chưa có dữ liệu hiện trạng. Kéo thả file vào vùng upload phía trên.</div>`;count.textContent=`${files.length} file · ${files.filter(file=>file.category==="image").length} ảnh · ${files.filter(file=>file.category==="video").length} video`;gallery.querySelectorAll("[data-existing-delete]").forEach(button=>button.onclick=async()=>{await fetch(`/api/v1/projects/${id}/existing-files?storedName=${encodeURIComponent(button.dataset.existingDelete)}`,{method:"DELETE"});loadExistingFiles()});bindFileOpeners(gallery);filterExistingFiles()}catch{gallery.innerHTML=`<div class="existing-empty">Không tải được dữ liệu hiện trạng.</div>`;count.textContent="Lỗi tải dữ liệu"}}
async function uploadExistingFiles(files){for(const file of files){await fetch(`/api/v1/projects/${id}/existing-files?name=${encodeURIComponent(file.name)}`,{method:"POST",body:file})}loadExistingFiles()}
function filterExistingFiles(){const filter=document.querySelector("[data-existing-filter].active")?.dataset.existingFilter||"all",query=document.querySelector("[data-existing-search]")?.value.toLowerCase()||"";document.querySelectorAll(".existing-card").forEach(card=>{const byType=filter==="all"||card.dataset.existingCategory===filter,byText=card.innerText.toLowerCase().includes(query);card.hidden=!(byType&&byText)})}
function design3dFileUrl(file){return `/api/v1/projects/${id}/design-3d-files/download?storedName=${encodeURIComponent(file.storedName)}`}
function design3dCard(file){const url=design3dFileUrl(file),isImage=file.category==="image",isPdf=/\.pdf$/i.test(file.name),canOpen=isImage||isPdf,openType=isPdf?"pdf":"image",preview=isImage?`<img src="${url}" alt="${contractEscape(file.name)}">`:file.category==="video"?`<video src="${url}" muted controls></video>`:`<div class="existing-file-icon ${isPdf?"pdf":""}">${isPdf?"PDF":existingFileIcon(file)}</div>`;return `<article class="existing-card design3d-card ${file.final?"final":""} ${canOpen?"clickable":""}" data-existing-category="${file.category}" ${canOpen?`data-open-file="${url}" data-open-type="${openType}" data-open-title="${contractEscape(file.name)}"`:""}><div class="existing-preview ${canOpen?"clickable":""}">${preview}</div><div class="existing-meta"><b title="${contractEscape(file.name)}">${contractEscape(file.name)}</b><span>${existingFileIcon(file)} · ${contractMoney(Math.ceil(file.size/1024))} KB</span>${file.final?'<em>ĐÃ DUYỆT - File chốt cuối cùng</em>':""}</div><footer><a href="${url}" download>Tải</a>${file.kind==="concept"?`<button class="design3d-approve-button ${file.final?"active":""}" data-design3d-final="${contractEscape(file.storedName)}">${file.final?"BỎ DUYỆT":"ĐÃ DUYỆT"}</button>`:""}<button data-design3d-delete="${contractEscape(file.storedName)}">Xóa</button></footer></article>`}

function design3dDropZone(kind,title,desc){return `<section class="existing-drop design3d-drop" data-design3d-drop="${kind}"><input type="file" hidden multiple data-design3d-file="${kind}" accept="image/*,video/*,.pdf,.doc,.docx,.zip"><strong>${title}</strong><span>${desc}</span><button data-design3d-pick="${kind}">Chọn từ máy</button></section>`}
function design3dView(){history.replaceState(null,"",`${location.pathname}?view=project-design-3d`);document.querySelector("#project-app").innerHTML=`<section class="existing-view design3d-view"><header><div><h2>Hồ sơ thiết kế 3D</h2><p>Quản lý Proposal, các bản Concept và bản Final dùng trong hồ sơ thiết kế.</p></div></header><div class="design3d-layout"><section class="design3d-panel proposal-panel"><header><div><h3>Proposal</h3><p>Chỉ lưu một bản Proposal chính.</p></div><button data-design3d-pick="proposal">+ Proposal</button></header>${design3dDropZone("proposal","Upload Proposal","Bản đề xuất 3D ban đầu. Bản mới nhất sẽ được hiển thị là Proposal chính.")}<div class="existing-gallery design3d-gallery" data-design3d-list="proposal"><div class="existing-empty">Đang tải Proposal...</div></div></section><section class="design3d-panel concept-panel"><header><div><h3>Concept</h3><p>Có thể lưu nhiều phương án Concept. Chọn một bản làm Final.</p></div><button data-design3d-pick="concept">+ Concept</button></header>${design3dDropZone("concept","Upload Concept","Các phương án 3D concept, render hoặc file phối cảnh.")}<div class="existing-gallery design3d-gallery" data-design3d-list="concept"><div class="existing-empty">Đang tải Concept...</div></div></section></div></section>`;bindDesign3dView();loadDesign3dFiles()}
function bindDesign3dView(){document.querySelectorAll("[data-design3d-pick]").forEach(button=>button.onclick=()=>document.querySelector(`[data-design3d-file="${button.dataset.design3dPick}"]`).click());document.querySelectorAll("[data-design3d-file]").forEach(input=>input.onchange=e=>uploadDesign3dFiles(input.dataset.design3dFile,[...e.target.files]));document.querySelectorAll("[data-design3d-drop]").forEach(drop=>{drop.ondragover=e=>{e.preventDefault();drop.classList.add("dragging")};drop.ondragleave=()=>drop.classList.remove("dragging");drop.ondrop=e=>{e.preventDefault();drop.classList.remove("dragging");uploadDesign3dFiles(drop.dataset.design3dDrop,[...e.dataTransfer.files])}})}
async function loadDesign3dFiles(){const proposal=document.querySelector('[data-design3d-list="proposal"]'),concept=document.querySelector('[data-design3d-list="concept"]');try{const body=await fetch(`/api/v1/projects/${id}/design-3d-files`).then(res=>res.json()),files=body.data||[],proposalFiles=files.filter(file=>file.kind==="proposal"),conceptFiles=files.filter(file=>file.kind==="concept");proposal.innerHTML=proposalFiles.length?design3dCard(proposalFiles[0]):'<div class="existing-empty">Chưa có Proposal.</div>';concept.innerHTML=conceptFiles.length?conceptFiles.map(design3dCard).join(""):'<div class="existing-empty">Chưa có Concept.</div>';document.querySelectorAll("[data-design3d-delete]").forEach(button=>button.onclick=async()=>{await fetch(`/api/v1/projects/${id}/design-3d-files?storedName=${encodeURIComponent(button.dataset.design3dDelete)}`,{method:"DELETE"});loadDesign3dFiles()});document.querySelectorAll("[data-design3d-final]").forEach(button=>button.onclick=async()=>{await fetch(`/api/v1/projects/${id}/design-3d-files/final`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({storedName:button.dataset.design3dFinal})});loadDesign3dFiles()});bindFileOpeners(document.querySelector(".design3d-view")||document)}catch{proposal.innerHTML='<div class="existing-empty">Không tải được Proposal.</div>';concept.innerHTML='<div class="existing-empty">Không tải được Concept.</div>'}}
async function uploadDesign3dFiles(kind,files){for(const file of files){await fetch(`/api/v1/projects/${id}/design-3d-files?kind=${kind}&name=${encodeURIComponent(file.name)}`,{method:"POST",body:file})}loadDesign3dFiles()}
const ganttStageTemplates={
  design:[
    ["stage-design","THI\u1ebeT K\u1ebe","",true],
    ["design-survey","Khảo sát hiện trạng","stage-design"],
    ["design-concept","Lên phương án mặt bằng / concept","stage-design"],
    ["design-3d","Thiết kế 3D","stage-design"],
    ["design-technical","Hồ sơ kỹ thuật thi công","stage-design"],
    ["design-approval","Trình CDT phê duyệt hồ sơ thiết kế","stage-design"]
  ],
  construction:[
    ["stage-construction","THI C\u00d4NG","",true],
    ["construction-prepare","Chuẩn bị mặt bằng và nhân lực","stage-construction"],
    ["construction-rough","Thi công phần thô / hạng mục chính","stage-construction"],
    ["construction-me","Thi công điện nước / M&E","stage-construction"],
    ["construction-finish","Hoàn thiện nội thất","stage-construction"],
    ["construction-inspection","Nghiệm thu và bàn giao","stage-construction"]
  ]
};
let ganttTaskList;
function projectScheduleStages(){
  const group=String(currentProject?.group||"Thi công").toLocaleLowerCase("vi");
  const hasDesign=group.includes("thiết kế")||group.includes("thiáº¿t káº¿");
  const hasConstruction=group.includes("thi công")||group.includes("thi cã´ng")||!hasDesign;
  return hasDesign&&hasConstruction?["design","construction"]:hasDesign?["design"]:["construction"];
}
function ensureGanttTaskList(){
  const signature=projectScheduleStages().join("-");
  if(ganttTaskList?.signature===signature)return ganttTaskList;
  let index=0;
  ganttTaskList=projectScheduleStages().flatMap(stage=>ganttStageTemplates[stage].map(([id,name,parentId="",isGroup=false])=>({id,name,parentId,isGroup,stage,baseIndex:index++})));
  ganttTaskList.signature=signature;
  return ganttTaskList
}
function taskById(id){return ensureGanttTaskList().find(task=>task.id===id)}
function selectTaskRow(id){document.querySelectorAll("[data-gantt-row]").forEach(row=>row.classList.toggle("selected",row.dataset.taskId===id))}
function taskChildren(id){return ensureGanttTaskList().filter(task=>task.parentId===id)}
function taskDescendantIds(id){const out=[];const walk=parentId=>taskChildren(parentId).forEach(child=>{out.push(child.id);walk(child.id)});walk(id);return out}
function taskLevel(task){let level=task.parentId?2:1,parent=taskById(task.parentId);while(parent&&parent.parentId){level++;parent=taskById(parent.parentId)}return level}
function ganttParent(i){return ensureGanttTaskList()[i]?.parentId||""}
const ganttColumnStorageKey="ganttColumnWidths.v47";
const ganttColumnDefaults=[32, 44, 340, 155, 78, 78, 78, 78, 78, 106, 106, 78];
const ganttColumnLabels=["STT", "Mã số", "Công việc", "Người thực hiện", "Thời gian<br>(ngày)", "Bắt đầu<br>kế hoạch", "Kết thúc<br>kế hoạch", "Bắt đầu<br>thực tế", "Kết thúc<br>thực tế", "Khối lượng<br>kế hoạch", "Khối lượng<br>thực tế", "Đơn vị"];
function ganttColumnWidths(){try{const saved=JSON.parse(localStorage.getItem(ganttColumnStorageKey)||"[]");if(saved.length===ganttColumnDefaults.length)return saved.map((x,i)=>Math.max(i===2?160:28,Number(x)||ganttColumnDefaults[i]))}catch{}return ganttColumnDefaults.slice()}
function ganttColGroup(){return `<colgroup>${ganttColumnWidths().map(width=>`<col style="width:${width}px">`).join("")}</colgroup>`}
function ganttHeaderRow(){return `<tr>${ganttColumnLabels.map((label,i)=>`<th>${label}<i class="gantt-col-resizer" data-gantt-col="${i}"></i></th>`).join("")}</tr>`}
function ganttRows(){return ensureGanttTaskList().map((row,i)=>{const task=taskMeta(i);const collapsible=taskChildren(row.id).length>0;const parent=ganttParent(i);const level=taskLevel(row);const rowClass=(row.isGroup?"group":task.progress===100?"done":"late")+(row.stage?` stage-${row.stage}`:"");return `<tr class="${rowClass}" data-gantt-row="${i}" data-task-id="${row.id}" ${parent?`data-gantt-parent="${parent}"`:""}><td>${i+1}</td><td>${task.code||""}</td><td class="task-name" style="padding-left:${level*12}px"><a><button type="button" class="gantt-drag-handle" data-drag-task="${row.id}" title="Kéo để sắp xếp">⋮</button>${collapsible?`<button class="gantt-collapse" data-collapse-group="${row.id}">▾</button> `:""}<span class="task-title">${task.name}</span><span class="task-row-actions"><button type="button" class="gantt-add" data-add-task="${i}" title="Thêm task">+</button><button type="button" class="gantt-delete" data-delete-task="${i}" title="Xóa task">×</button></span></a></td><td>${row.isGroup?"":task.assignee}</td><td>${task.duration}</td><td>${task.planStart}</td><td>${task.planEnd}</td><td>${task.actualStart}</td><td>${task.actualEnd}</td><td>${fmt(task.plannedQty)}</td><td>${fmt(task.actualQty)}</td><td>${task.unit}</td></tr>`}).join("")}
function ganttBarMetrics(task,startField="planStart",endField="planEnd"){const start=ganttTimelineStart(),total=42,startDate=dateFromDisplay(task[startField]||task.planStart),endDate=dateFromDisplay(task[endField]||task.planEnd||task[startField]||task.planStart);const startIndex=Math.round((startDate-start)/86400000);const endIndex=Math.round((endDate-start)/86400000);const left=Math.max(0,Math.min(total-1,startIndex));const right=Math.max(left+1,Math.min(total,endIndex+1));return {leftPct:left*100/total,widthPct:Math.max(1,(right-left)*100/total),startIndex:left,endIndex:right-1}}
function ganttBars(actual=false){return ensureGanttTaskList().map((row,i)=>{if(i===0)return `<span></span>`;const task=taskMeta(i);const group=row.isGroup;const parent=ganttParent(i);const done=task.progress===100;const metrics=ganttBarMetrics(task);const actualMetrics=ganttBarMetrics(task,"actualStart","actualEnd");return `<span ${parent?`data-gantt-bar-parent="${parent}"`:""}><i data-plan-bar="${row.id}" class="${group?"bar-group":done?"bar-done":"bar-plan"}" style="margin-left:${metrics.leftPct}%;width:${metrics.widthPct}%"><button type="button" class="bar-resize left" data-bar-resize="left"></button><em>${task.name}</em><button type="button" class="bar-resize right" data-bar-resize="right"></button><strong>${task.name}</strong></i>${actual&&!group?`<b data-actual-bar="${row.id}" class="bar-actual" style="margin-left:${actualMetrics.leftPct}%;width:${actualMetrics.widthPct}%"><button type="button" class="bar-resize left" data-bar-resize="left"></button><button type="button" class="bar-resize right" data-bar-resize="right"></button><strong>${task.name} - Thực tế</strong></b>`:""}</span>`}).join("")}
function ganttTimelineStart(){return new Date(2026,4,23)}
function ganttCalendar(){const today=new Date();today.setHours(0,0,0,0);const start=ganttTimelineStart();const dates=Array.from({length:42},(_,i)=>{const date=new Date(start);date.setDate(start.getDate()+i);return date});const sameDay=(a,b)=>a.getTime()===b.getTime();const todayIndex=dates.findIndex(date=>sameDay(date,today));const monthGroups=[];dates.forEach(date=>{const label=`Tháng ${String(date.getMonth()+1).padStart(2,"0")}, ${date.getFullYear()}`;const last=monthGroups.at(-1);if(last&&last.label===label)last.days++;else monthGroups.push({label,days:1})});return {dates,todayIndex,months:monthGroups.map(x=>`<span style="grid-column:span ${x.days}">${x.label}</span>`).join("")}}
function ganttDays(calendar){const weekdays=["CN","T2","T3","T4","T5","T6","T7"];return calendar.dates.map((date,i)=>{const day=date.getDay(),blocked=isApartmentSchedule()&&isWeekendDate(date);return `<b class="${day===0||day===6?"weekend":""} ${day===0?"sunday":""} ${blocked?"blocked":""} ${i===calendar.todayIndex?"today":""}" ${blocked?'title="Ngày nghỉ thi công căn hộ"':""}>${weekdays[day]}<em>${String(date.getDate()).padStart(2,"0")}</em></b>`}).join("")}
function ganttView(){const calendar=ganttCalendar(),apartment=isApartmentSchedule();document.querySelector("#project-app").innerHTML=`<section class="gantt-view ${apartment?"apartment-schedule":""}"><header class="gantt-app-head"><b>❖ Dự án xây dựng</b><span>♨　?　⌂　▦　◉</span></header><div class="gantt-subhead"><a data-back-dashboard>Danh sách dự án</a> » <b>${currentProject.name}</b>${apartment?'<em class="gantt-workday-rule">Căn hộ: T7/CN không thi công</em>':""}<div class="gantt-toolbar"><button data-gantt-undo title="Hoàn tác (Ctrl+Z)">↶</button><button data-gantt-redo title="Làm lại (Ctrl+Y)">↷</button><button data-reload-gantt>⟳ Tải lại</button><input placeholder="⌕ Tìm kiếm công việc..."><button data-toggle-chart>◉ Ẩn sơ đồ</button><button data-baseline>Baseline⌄</button><button data-utility-gantt class="green">Tiện ích⌄</button></div></div>${apartment?'<div class="gantt-rule-banner">Lịch căn hộ chung cư đang tự ngắt T7 và CN. Các ngày này không được tính vào thời gian thi công.</div>':""}<div class="gantt-layout"><div class="gantt-grid"><table class="gantt-table">${ganttColGroup()}<thead>${ganttHeaderRow()}</thead><tbody>${ganttRows()}</tbody></table></div><button class="gantt-splitter" data-gantt-splitter aria-label="Kéo để thay đổi vùng hiển thị">⋮</button><aside class="gantt-chart"><header>${calendar.months}</header><div class="gantt-days">${ganttDays(calendar)}</div><div class="gantt-bars ${calendar.todayIndex<0?"without-today":""}" style="--today-index:${calendar.todayIndex}">${ganttBars(true)}</div></aside></div><menu class="gantt-menu baseline-menu"><button data-baseline-mode="plan">Kế hoạch</button><button data-baseline-mode="actual">Thực tế so với kế hoạch</button></menu><menu class="gantt-menu utility-menu"><button data-gantt-save-template>Lưu bản mẫu</button><button data-gantt-create-from-template>Xuất từ bản mẫu</button><button data-gantt-export>Xuất dữ liệu</button></menu></section>`;bindGantt();bindGanttScrollSync()}
function bindGanttScrollSync(){const grid=document.querySelector(".gantt-grid"),bars=document.querySelector(".gantt-bars");if(!grid||!bars)return;const sync=()=>bars.style.transform=`translateY(${-grid.scrollTop}px)`;grid.addEventListener("scroll",sync,{passive:true});sync()}
function bindGantt(){const toggle=(selector)=>document.querySelector(selector).classList.toggle("open");document.querySelector("[data-back-dashboard]").onclick=()=>{history.replaceState(null,"",location.pathname);render()};document.querySelector("[data-toggle-chart]").onclick=e=>{document.querySelector(".gantt-chart").classList.toggle("hidden");document.querySelector(".gantt-layout").classList.toggle("chart-hidden");e.target.innerText=document.querySelector(".gantt-chart").classList.contains("hidden")?"◉ Hiện sơ đồ":"◉ Ẩn sơ đồ"};document.querySelector("[data-baseline]").onclick=()=>toggle(".baseline-menu");document.querySelector("[data-utility-gantt]").onclick=()=>toggle(".utility-menu");document.querySelector("[data-gantt-save-template]").onclick=()=>{document.querySelector(".utility-menu").classList.remove("open");alert("Đã lưu bản mẫu.")};document.querySelector("[data-gantt-create-from-template]").onclick=()=>{document.querySelector(".utility-menu").classList.remove("open");alert("Chọn bản mẫu để xuất bảng tiến độ.")};document.querySelector("[data-gantt-export]").onclick=()=>{document.querySelector(".utility-menu").classList.remove("open");const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent("Mã số,Công việc,Tiến độ\n1,Hạng mục mẫu,64%");a.download="bang-tien-do.csv";a.click()};document.querySelector("[data-gantt-undo]").onclick=undoGantt;document.querySelector("[data-gantt-redo]").onclick=redoGantt;syncGanttTableWidth();bindGanttColumnResize();bindGanttKeyboard();const layout=document.querySelector(".gantt-layout"),splitter=document.querySelector("[data-gantt-splitter]");splitter.onpointerdown=e=>{splitter.setPointerCapture(e.pointerId);layout.classList.add("resizing")};splitter.onpointermove=e=>{if(!layout.classList.contains("resizing"))return;const rect=layout.getBoundingClientRect();const width=Math.min(rect.width-300,Math.max(360,e.clientX-rect.left));layout.style.setProperty("--grid-width",`${width}px`)};splitter.onpointerup=e=>{splitter.releasePointerCapture(e.pointerId);layout.classList.remove("resizing")};document.querySelectorAll("[data-collapse-group]").forEach(x=>x.onclick=e=>{e.stopPropagation();const group=x.dataset.collapseGroup;const hidden=!x.classList.contains("collapsed");const ids=[group,...taskDescendantIds(group)];ids.forEach(id=>document.querySelectorAll(`[data-gantt-parent="${id}"],[data-gantt-bar-parent="${id}"]`).forEach(item=>item.classList.toggle("gantt-child-hidden",hidden)));x.classList.toggle("collapsed",hidden);x.innerText=hidden?"▸":"▾"});document.querySelectorAll("[data-add-task]").forEach(x=>x.onclick=e=>{e.stopPropagation();taskFormModal(Number(x.dataset.addTask))});document.querySelectorAll("[data-delete-task]").forEach(x=>x.onclick=e=>{e.stopPropagation();selectTaskRow(ensureGanttTaskList()[Number(x.dataset.deleteTask)]?.id);deleteTaskModal()});document.querySelectorAll("[data-baseline-mode]").forEach(x=>x.onclick=()=>{document.querySelector(".gantt-bars").innerHTML=ganttBars(x.dataset.baselineMode==="actual");bindGanttBars();document.querySelector(".baseline-menu").classList.remove("open")});bindGanttRows();bindGanttDragDrop();bindGanttBars();document.querySelector("[data-reload-gantt]").onclick=()=>ganttView()}
function syncGanttTableWidth(){const table=document.querySelector(".gantt-table");if(!table)return;const width=ganttColumnWidths().reduce((sum,x)=>sum+x,0);table.style.width=`${width}px`;table.style.minWidth=`${width}px`}
function bindGanttColumnResize(){let state=null;const minWidth=i=>i===2?160:i===3?90:i>=10?70:32;document.querySelectorAll("[data-gantt-col]").forEach(handle=>{handle.onpointerdown=e=>{e.preventDefault();e.stopPropagation();const index=Number(handle.dataset.ganttCol);const widths=ganttColumnWidths();state={index,startX:e.clientX,startWidth:widths[index],widths};handle.setPointerCapture(e.pointerId);document.querySelector(".gantt-view").classList.add("col-resizing")};handle.onpointermove=e=>{if(!state)return;const next=Math.max(minWidth(state.index),state.startWidth+e.clientX-state.startX);state.widths[state.index]=next;const col=document.querySelectorAll(".gantt-table col")[state.index];if(col)col.style.width=`${next}px`;const table=document.querySelector(".gantt-table");const total=state.widths.reduce((sum,x)=>sum+x,0);table.style.width=`${total}px`;table.style.minWidth=`${total}px`};handle.onpointerup=e=>{if(!state)return;localStorage.setItem(ganttColumnStorageKey,JSON.stringify(state.widths));handle.releasePointerCapture(e.pointerId);document.querySelector(".gantt-view").classList.remove("col-resizing");state=null}})}
function bindGanttRows(){document.querySelectorAll("[data-gantt-row]").forEach(row=>{row.onclick=e=>{if(e.target.closest("button,.gantt-inline-editor"))return;document.querySelectorAll("[data-gantt-row]").forEach(r=>r.classList.remove("selected"));row.classList.add("selected");const cell=e.target.closest("td");if(cell)editGanttCell(row,cell)}})}
function closeTaskMenu(){document.querySelector(".task-row-menu")?.remove()}
function taskRowMenu(anchor,taskId){closeTaskMenu();const row=document.querySelector(`[data-task-id="${taskId}"]`);selectTaskRow(taskId);document.body.insertAdjacentHTML("beforeend",`<div class="task-row-menu"><button data-menu-delete>× Xóa task</button></div>`);const menu=document.querySelector(".task-row-menu"),rect=anchor.getBoundingClientRect();menu.style.left=`${rect.right+window.scrollX+4}px`;menu.style.top=`${rect.top+window.scrollY}px`;menu.querySelector("[data-menu-delete]").onclick=e=>{e.stopPropagation();closeTaskMenu();deleteTaskModal()};setTimeout(()=>document.addEventListener("pointerdown",e=>{if(!e.target.closest(".task-row-menu")&&!e.target.closest("[data-drag-task]"))closeTaskMenu()},{once:true}),0)}
function bindGanttDragDrop(){let drag=null;const cleanup=()=>{document.querySelectorAll(".gantt-drop-before,.gantt-drop-after,.gantt-drop-child,.dragging").forEach(x=>x.classList.remove("gantt-drop-before","gantt-drop-after","gantt-drop-child","dragging"));document.querySelector(".gantt-drag-ghost")?.remove()};document.querySelectorAll("[data-drag-task]").forEach(handle=>{handle.onpointerdown=e=>{e.preventDefault();e.stopPropagation();closeTaskMenu();const row=handle.closest("[data-gantt-row]");const ghost=document.createElement("div");ghost.className="gantt-drag-ghost";ghost.textContent=row.querySelector(".task-title")?.innerText||"Task";document.body.appendChild(ghost);row.classList.add("dragging");handle.setPointerCapture(e.pointerId);drag={id:row.dataset.taskId,handle,ghost,targetId:"",mode:"after",startX:e.clientX,startY:e.clientY,moved:false};handle.onpointermove=ev=>{if(!drag)return;if(Math.abs(ev.clientX-drag.startX)+Math.abs(ev.clientY-drag.startY)>4)drag.moved=true;drag.ghost.style.left=`${ev.clientX+12}px`;drag.ghost.style.top=`${ev.clientY+12}px`;document.querySelectorAll(".gantt-drop-before,.gantt-drop-after,.gantt-drop-child").forEach(x=>x.classList.remove("gantt-drop-before","gantt-drop-after","gantt-drop-child"));const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest("[data-gantt-row]");if(!target||target.dataset.taskId===drag.id)return;const rect=target.getBoundingClientRect();const y=(ev.clientY-rect.top)/rect.height;drag.mode=y<.25?"before":y>.75?"after":"child";drag.targetId=target.dataset.taskId;target.classList.add(drag.mode==="before"?"gantt-drop-before":drag.mode==="after"?"gantt-drop-after":"gantt-drop-child");drag.ghost.dataset.mode=drag.mode==="child"?"Làm task con":drag.mode==="before"?"Thả lên trên":"Thả xuống dưới"};handle.onpointerup=ev=>{const keepId=drag?.id,wasMoved=drag?.moved;if(wasMoved&&drag?.targetId){commitGanttHistory();moveTaskSmart(drag.id,drag.targetId,drag.mode)}cleanup();drag=null;if(wasMoved)refreshGanttTasks(taskIndexById(keepId));else taskRowMenu(handle,keepId)}}})}
function bindGanttBars(){bindGanttBarResize();document.querySelectorAll(".gantt-bars span").forEach((x,i)=>{x.onclick=e=>{if(e.target.closest("[data-plan-bar],[data-actual-bar],.bar-resize"))return;if(!ensureGanttTaskList()[i])return;document.querySelectorAll("[data-gantt-row]").forEach(r=>r.classList.toggle("selected",Number(r.dataset.ganttRow)===i))}})}
function bindGanttBarResize(){let drag=null;const startDate=ganttTimelineStart(),total=42,clamp=(v,min,max)=>Math.max(min,Math.min(max,v));const bind=(selector,idName,startField,endField)=>document.querySelectorAll(selector).forEach(bar=>{bar.onpointerdown=e=>{e.preventDefault();e.stopPropagation();const id=bar.dataset[idName],task=taskMeta(taskIndexById(id)),metrics=ganttBarMetrics(task,startField,endField),chart=document.querySelector(".gantt-bars"),rect=chart.getBoundingClientRect(),mode=e.target.dataset.barResize||"move";bar.setPointerCapture(e.pointerId);document.querySelector(".gantt-view").classList.add("bar-resizing");drag={id,bar,mode,rect,startX:e.clientX,startIndex:metrics.startIndex,endIndex:metrics.endIndex,startField,endField}};bar.onpointermove=e=>{if(!drag)return;const delta=Math.round((e.clientX-drag.startX)/(drag.rect.width/total));let start=drag.startIndex,end=drag.endIndex;if(drag.mode==="left")start=clamp(drag.startIndex+delta,0,end);else if(drag.mode==="right")end=clamp(drag.endIndex+delta,start,total-1);else{const length=end-start;start=clamp(drag.startIndex+delta,0,total-1-length);end=start+length}drag.nextStart=start;drag.nextEnd=end;drag.bar.style.marginLeft=`${start*100/total}%`;drag.bar.style.width=`${Math.max(1,(end-start+1)*100/total)}%`;drag.bar.dataset.range=`${dateDisplay(addDays(startDate,start))} - ${dateDisplay(addDays(startDate,end))}`};bar.onpointerup=e=>{if(!drag)return;commitGanttHistory();const start=drag.nextStart??drag.startIndex,end=drag.nextEnd??drag.endIndex,next={...(taskEdits[drag.id]||{})};next[drag.startField]=dateDisplay(addDays(startDate,start));next[drag.endField]=dateDisplay(addDays(startDate,end));normalizeTaskSchedule(next);taskEdits[drag.id]=next;const keepId=drag.id;drag.bar.releasePointerCapture(e.pointerId);document.querySelector(".gantt-view").classList.remove("bar-resizing");drag=null;refreshGanttTasks(taskIndexById(keepId))}});bind("[data-plan-bar]","planBar","planStart","planEnd");bind("[data-actual-bar]","actualBar","actualStart","actualEnd")}
const ganttEditableColumns={1:{field:"code",type:"text"},2:{field:"name",type:"text"},3:{field:"assignee",type:"member"},5:{field:"planStart",type:"date"},6:{field:"planEnd",type:"date"},7:{field:"actualStart",type:"date"},8:{field:"actualEnd",type:"date"},9:{field:"plannedQty",type:"number"},10:{field:"actualQty",type:"number"},11:{field:"unit",type:"unit"}};
function editGanttCell(row,cell){const index=Number(row.dataset.ganttRow);const col=[...row.children].indexOf(cell);const config=ganttEditableColumns[col];if(!config)return;const task=taskMeta(index);const current=task[config.field]??"";cell.classList.add("editing");const original=cell.innerHTML;let done=false;const finish=value=>{if(done)return;done=true;commitGanttHistory();const next={...(taskEdits[task.id]||{})};next[config.field]=config.type==="number"?Number(value):config.type==="date"?normalizeScheduleDate(value,config.field):value;normalizeTaskSchedule(next);taskEdits[task.id]=next;closeDatePicker();refreshGanttTasks(taskIndexById(task.id))};let editor;if(config.type==="member"){editor=document.createElement("select");projectMembers.forEach(member=>editor.add(new Option(member,member,false,member===current)))}else if(config.type==="unit"){editor=document.createElement("select");["m2","bộ","m3","kg","công","ca"].forEach(unit=>editor.add(new Option(unit,unit,false,unit===current)))}else{editor=document.createElement("input");editor.type=config.type==="date"?"text":config.type;editor.value=String(current).replace("%","");if(config.type==="date")editor.readOnly=true}editor.className="gantt-inline-editor";cell.innerHTML="";cell.appendChild(editor);editor.focus();if(config.type==="date")openDatePicker(editor,current,finish);else if(editor.select)editor.select();editor.onchange=()=>finish(editor.value);editor.onblur=()=>{if(config.type!=="date"&&document.body.contains(editor))finish(editor.value)};editor.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();finish(editor.value)}if(e.key==="Escape"){done=true;closeDatePicker();cell.innerHTML=original;cell.classList.remove("editing")}}}
function bindSelected(selector,handler){document.querySelectorAll(selector).forEach(x=>x.onclick=()=>{if(!document.querySelector("[data-gantt-row].selected"))return ganttToast("Vui lòng chọn công việc bạn muốn thao tác!");document.querySelector(".row-menu")?.classList.remove("open");handler()})}
function ganttToast(text){document.querySelector(".gantt-view").insertAdjacentHTML("afterbegin",`<div class="gantt-toast">${text}</div>`);setTimeout(()=>document.querySelector(".gantt-toast")?.remove(),2500)}
function newTaskField(label,name,value="",extra=""){return `<label><span>${label}</span><input data-new-task="${name}" ${extra} value="${String(value).replaceAll('"',"&quot;")}"></label>`}
function newTaskSelect(label,name,value=""){const options=projectMembers.includes(value)?projectMembers:[value,...projectMembers];return `<label><span>${label}</span><select data-new-task="${name}">${options.map(member=>`<option ${member===value?"selected":""}>${member}</option>`).join("")}</select></label>`}
function nextTaskCode(parentId){const parent=taskById(parentId),children=taskChildren(parentId);const parentCode=parent?taskMeta(taskIndexById(parent.id)).code:"";return parentCode?`${parentCode}.${children.length+1}`:`${ensureGanttTaskList().filter(task=>!task.parentId).length+1}`}
function createTaskFromModal(anchorIndex,openDetail=false){const list=ensureGanttTaskList(),anchor=list[anchorIndex]||list.at(-1),parentId=anchor?.isGroup?anchor.id:anchor?.parentId||"",id=`task-${Date.now()}`,newTask={id,name:document.querySelector('[data-new-task="name"]')?.value.trim()||"Công việc mới",baseIndex:list.length,parentId,isGroup:false,stage:(parentId?(list.find(t=>t.id===parentId)?.stage||""):(anchor?.stage||""))};let insertIndex=list.length;if(anchor){const family=[anchor.id,...taskDescendantIds(anchor.id)];insertIndex=anchor.isGroup?Math.max(...family.map(x=>list.findIndex(task=>task.id===x)).filter(i=>i>=0))+1:anchorIndex+1}commitGanttHistory();list.splice(insertIndex,0,newTask);taskEdits[id]=normalizeTaskSchedule({name:newTask.name,code:document.querySelector('[data-new-task="code"]')?.value.trim()||nextTaskCode(parentId),assignee:document.querySelector('[data-new-task="assignee"]')?.value||"Chưa phân công",follower:document.querySelector('[data-new-task="follower"]')?.value||"TÀI KHOẢN TRẢI NGHIỆM",planStart:document.querySelector('[data-new-task="planStart"]')?.value||"01/06/2026",planEnd:document.querySelector('[data-new-task="planEnd"]')?.value||"01/06/2026",actualStart:"",actualEnd:"",progress:0,unit:document.querySelector('[data-new-task="unit"]')?.value||"m2",plannedQty:Number(document.querySelector('[data-new-task="plannedQty"]')?.value)||0,actualQty:0,status:"Chưa làm"});document.querySelector(".gantt-modal")?.remove();refreshGanttTasks(taskIndexById(id));if(openDetail)taskDetail(taskIndexById(id))}
function taskFormModal(anchorIndex=ensureGanttTaskList().length-1){const parent=ensureGanttTaskList()[anchorIndex]?.isGroup?ensureGanttTaskList()[anchorIndex]:taskById(ensureGanttTaskList()[anchorIndex]?.parentId);ganttModal("Thêm công việc mới",`${newTaskField("Mã số","code",nextTaskCode(parent?.id||""))}${newTaskField("Tiêu đề *","name","")}${newTaskSelect("Người thực hiện","assignee","Chưa phân công")}${newTaskSelect("Người theo dõi","follower","TÀI KHOẢN TRẢI NGHIỆM")}${newTaskField("Bắt đầu kế hoạch","planStart","01/06/2026","data-popup-date readonly")}${newTaskField("Kết thúc kế hoạch","planEnd","01/06/2026","data-popup-date readonly")}${newTaskField("Đơn vị","unit","m2")}${newTaskField("Khối lượng kế hoạch","plannedQty","0",'type="number"')}${parent?`<p>Công việc mới sẽ nằm trong: <b>${parent.name}</b></p>`:""}`,`<button data-task-add-save>Lưu và đóng</button><button data-task-add-more>Lưu và thêm tiếp</button><button data-task-add-open>Lưu và mở chi tiết</button>`);document.querySelectorAll("[data-gantt-save]").forEach(x=>x.onclick=null);document.querySelector("[data-task-add-save]").onclick=()=>createTaskFromModal(anchorIndex,false);document.querySelector("[data-task-add-more]").onclick=()=>{createTaskFromModal(anchorIndex,false);taskFormModal(anchorIndex)};document.querySelector("[data-task-add-open]").onclick=()=>createTaskFromModal(anchorIndex,true)}
function taskParentOptions(taskId,currentParent=""){return `<option value="">Không thuộc giai đoạn nào</option>${ensureGanttTaskList().filter(task=>task.id!==taskId&&!taskDescendantIds(taskId).includes(task.id)).map(task=>`<option value="${task.id}" ${task.id===currentParent?"selected":""}>${task.name}</option>`).join("")}`}
function moveTaskModal(){const selected=document.querySelector("[data-gantt-row].selected");const index=Number(selected?.dataset.ganttRow);const row=ensureGanttTaskList()[index];if(!row)return;document.body.insertAdjacentHTML("beforeend",`<div class="cash-modal gantt-modal"><section><header><h2>Di chuyển / đổi task mẹ</h2><button data-gantt-close>×</button></header><label>Task mẹ<select data-parent-target>${taskParentOptions(row.id,row.parentId)}</select></label><p>Kéo thả trực tiếp trên bảng để đổi vị trí. Chọn task mẹ ở đây để đổi cấp cha-con.</p><footer><button data-gantt-close>× Đóng</button><button data-move-save>Lưu thay đổi</button></footer></section></div>`);document.querySelectorAll("[data-gantt-close]").forEach(x=>x.onclick=()=>document.querySelector(".gantt-modal").remove());document.querySelector("[data-move-save]").onclick=()=>{commitGanttHistory();setTaskParent(row.id,document.querySelector("[data-parent-target]").value);document.querySelector(".gantt-modal").remove();refreshGanttTasks(taskIndexById(row.id))}}
function assignmentModal(kind){ganttModal(`Bạn muốn thay đổi ${kind} cho công việc`,`<label>${kind[0].toUpperCase()+kind.slice(1)}<input value="TÀI KHOẢN TRẢI NGHIỆM"></label><div class="gantt-person">◉　TÀI KHOẢN TRẢI NGHIỆM</div><label><input type="radio" name="assign" checked> Thay thế ${kind} hiện tại</label><label><input type="radio" name="assign"> Bổ sung vào ${kind}</label>`,`<button data-gantt-save>Lưu thay đổi</button>`)}
function progressTaskModal(){ganttModal("Cập nhật tiến độ thực tế",`${field("Tiến độ thực tế (%)","0")}${field("Ngày bắt đầu thực tế","18/05/2026")}${field("Ngày kết thúc thực tế","26/05/2026")}`,`<button data-gantt-save>Lưu thay đổi</button>`)}
function statusTaskModal(){ganttModal("Cập nhật trạng thái công việc",`<label>Trạng thái<select><option>Chưa làm</option><option>Đang làm</option><option>Hoàn thành</option><option>Tạm dừng</option></select></label>`,`<button data-gantt-save>Lưu thay đổi</button>`)}
function deleteTaskModal(){const selected=document.querySelector("[data-gantt-row].selected");const index=Number(selected?.dataset.ganttRow);const row=ensureGanttTaskList()[index];if(!row)return;const childCount=taskDescendantIds(row.id).length;document.body.insertAdjacentHTML("beforeend",`<div class="cash-modal gantt-modal"><section><header><h2>Xóa công việc</h2><button data-gantt-close>×</button></header><p>Bạn có chắc chắn muốn xóa "${row.name}"${childCount?` và ${childCount} công việc con`:""}?</p><footer><button data-gantt-close>× Đóng</button><button data-delete-confirm class="danger">Xóa công việc</button></footer></section></div>`);document.querySelectorAll("[data-gantt-close]").forEach(x=>x.onclick=()=>document.querySelector(".gantt-modal").remove());document.querySelector("[data-delete-confirm]").onclick=()=>{commitGanttHistory();deleteTaskById(row.id);document.querySelector(".gantt-modal").remove();refreshGanttTasks(Math.max(0,index-1))}}
function ganttModal(title,body,actions){document.body.insertAdjacentHTML("beforeend",`<div class="cash-modal gantt-modal"><section><header><h2>${title}</h2><button data-gantt-close>×</button></header>${body}<footer><button data-gantt-close>× Đóng</button>${actions}</footer></section></div>`);document.querySelectorAll("[data-gantt-close]").forEach(x=>x.onclick=()=>document.querySelector(".gantt-modal").remove());document.querySelectorAll("[data-gantt-save]").forEach(x=>x.onclick=()=>{alert("Đã lưu thao tác tiến độ demo.");document.querySelector(".gantt-modal").remove()});bindPopupDateFields()}
const taskEdits={};
const ganttUndoStack=[],ganttRedoStack=[];
const projectMembers=["TÀI KHOẢN TRẢI NGHIỆM","Nguyễn Minh Anh","Trần Hoàng Long","Lê Thanh Hà","Phạm Thu Trang","Vũ Đức Nam"];
function toDateInput(value){const parts=String(value||"").split("/");return parts.length===3?`${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`:`2026-${(parts[1]||"05").padStart(2,"0")}-${(parts[0]||"01").padStart(2,"0")}`}
function fromDateInput(value){const parts=String(value||"").split("-");return parts.length===3?`${parts[2]}/${parts[1]}/${parts[0]}`:value}
function dateFromDisplay(value){const parts=String(value||"").trim().split(/\s+/)[0].split("/").map(Number);if(parts.length===2&&parts[1])return new Date(2026,parts[1]-1,parts[0]);return parts.length===3&&parts[2]?new Date(parts[2],parts[1]-1,parts[0]):new Date(2026,5,1)}
function dateDisplay(date){return `${String(date.getDate()).padStart(2,"0")}/${String(date.getMonth()+1).padStart(2,"0")}/${date.getFullYear()}`}
function addDays(date,days){const next=new Date(date);next.setDate(next.getDate()+days);return next}
const textKey=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const isApartmentSchedule=()=>textKey(projectInfoValue(currentProject||{},"buildingType","Căn hộ"))==="can ho";
const isWeekendDate=date=>date.getDay()===0||date.getDay()===6;
function nextWorkday(date){const next=new Date(date);while(isWeekendDate(next))next.setDate(next.getDate()+1);return next}
function prevWorkday(date){const next=new Date(date);while(isWeekendDate(next))next.setDate(next.getDate()-1);return next}
function normalizeScheduleDate(value,field="planStart"){if(!isApartmentSchedule()||!value)return value;const date=dateFromDisplay(value);if(!isWeekendDate(date))return dateDisplay(date);return /end$/i.test(field)?dateDisplay(prevWorkday(date)):dateDisplay(nextWorkday(date))}
function normalizeTaskSchedule(next){["plan","actual"].forEach(prefix=>{const startKey=`${prefix}Start`,endKey=`${prefix}End`;if(next[startKey])next[startKey]=normalizeScheduleDate(next[startKey],startKey);if(next[endKey])next[endKey]=normalizeScheduleDate(next[endKey],endKey);if(next[startKey]&&next[endKey]&&dateFromDisplay(next[endKey])<dateFromDisplay(next[startKey]))next[endKey]=next[startKey]});return next}
function taskDuration(start,end){const a=dateFromDisplay(start),b=dateFromDisplay(end);if(!Number.isFinite(a.getTime())||!Number.isFinite(b.getTime())||b<a)return 0;if(!isApartmentSchedule())return Math.round((b-a)/86400000)+1;let count=0,date=new Date(a);while(date<=b){if(!isWeekendDate(date))count++;date.setDate(date.getDate()+1)}return count}
function closeDatePicker(){document.querySelector(".task-date-picker")?.remove()}
function openDatePicker(anchor,value,onSelect){
  closeDatePicker();
  let view=dateFromDisplay(value);
  const selected=dateDisplay(view);
  const blocksWeekend=isApartmentSchedule()&&!!anchor.closest(".gantt-view,.gantt-modal,.task-detail");
  const draw=()=>{
    const first=new Date(view.getFullYear(),view.getMonth(),1),start=new Date(first);
    start.setDate(first.getDate()-((first.getDay()+6)%7));
    const days=Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d});
    const picker=document.querySelector(".task-date-picker")||document.createElement("div");
    picker.className=`task-date-picker ${blocksWeekend?"blocks-weekend":""}`;
    picker.innerHTML=`<header><button type="button" data-prev-month>‹</button><b>Tháng ${view.getMonth()+1} ${view.getFullYear()}</b><button type="button" data-next-month>›</button></header><div class="weekdays">${["T2","T3","T4","T5","T6","T7","CN"].map(x=>`<strong>${x}</strong>`).join("")}</div><div class="days">${days.map(d=>{const blocked=blocksWeekend&&isWeekendDate(d);return `<button type="button" class="${d.getMonth()!==view.getMonth()?"muted":""} ${dateDisplay(d)===selected?"selected":""} ${blocked?"blocked":""}" data-date="${dateDisplay(d)}" ${blocked?'disabled title="Căn hộ chung cư không thi công T7/CN"':""}>${d.getDate()}</button>`}).join("")}</div>`;
    if(!picker.parentNode)document.body.appendChild(picker);
    const rect=anchor.getBoundingClientRect();
    picker.style.left=`${rect.left+window.scrollX}px`;
    picker.style.top=`${rect.bottom+window.scrollY+2}px`;
    picker.querySelector("[data-prev-month]").onclick=e=>{e.stopPropagation();view=new Date(view.getFullYear(),view.getMonth()-1,1);draw()};
    picker.querySelector("[data-next-month]").onclick=e=>{e.stopPropagation();view=new Date(view.getFullYear(),view.getMonth()+1,1);draw()};
    picker.querySelectorAll("[data-date]:not(:disabled)").forEach(btn=>btn.onclick=e=>{e.stopPropagation();onSelect(btn.dataset.date);closeDatePicker()});
    setTimeout(()=>document.addEventListener("pointerdown",outsideDatePicker,{once:true}),0);
  };
  const outsideDatePicker=e=>{if(!e.target.closest(".task-date-picker")&&e.target!==anchor)closeDatePicker()};
  draw();
}
function bindPopupDateFields(root=document){root.querySelectorAll("[data-popup-date]").forEach(input=>input.onclick=()=>openDatePicker(input,input.value||input.placeholder,value=>{input.value=value}))}
function cloneGanttState(){return {tasks:JSON.parse(JSON.stringify(ensureGanttTaskList())),edits:JSON.parse(JSON.stringify(taskEdits))}}
function restoreGanttState(state){ganttTaskList=JSON.parse(JSON.stringify(state.tasks||[]));Object.keys(taskEdits).forEach(key=>delete taskEdits[key]);Object.assign(taskEdits,JSON.parse(JSON.stringify(state.edits||{})))}
function commitGanttHistory(){ganttUndoStack.push(cloneGanttState());if(ganttUndoStack.length>60)ganttUndoStack.shift();ganttRedoStack.length=0}
function undoGantt(){if(!ganttUndoStack.length)return ganttToast("Không còn thao tác để hoàn tác.");ganttRedoStack.push(cloneGanttState());restoreGanttState(ganttUndoStack.pop());refreshGanttTasks(0);ganttToast("Đã hoàn tác.")}
function redoGantt(){if(!ganttRedoStack.length)return ganttToast("Không còn thao tác để làm lại.");ganttUndoStack.push(cloneGanttState());restoreGanttState(ganttRedoStack.pop());refreshGanttTasks(0);ganttToast("Đã làm lại.")}
function bindGanttKeyboard(){if(window.__ganttKeyboardBound)return;window.__ganttKeyboardBound=true;document.addEventListener("keydown",e=>{if(!document.querySelector(".gantt-view"))return;if(!e.ctrlKey)return;const key=e.key.toLowerCase();if(key==="z"&&!e.shiftKey){e.preventDefault();undoGantt()}else if(key==="y"||key==="z"&&e.shiftKey){e.preventDefault();redoGantt()}})}
function taskIndexById(id){return ensureGanttTaskList().findIndex(task=>task.id===id)}
function taskParentName(task){return task.parentId?taskById(task.parentId)?.name||"":"Không thuộc giai đoạn nào"}
function moveTaskSmart(sourceId,targetId,mode="after"){if(!sourceId||!targetId||sourceId===targetId)return;const list=ensureGanttTaskList();const movingIds=[sourceId,...taskDescendantIds(sourceId)];if(movingIds.includes(targetId))return;const source=taskById(sourceId),target=taskById(targetId);if(!source||!target)return;source.parentId=mode==="child"?targetId:target.parentId;if(mode==="child")target.isGroup=true;const moving=list.filter(task=>movingIds.includes(task.id));const remaining=list.filter(task=>!movingIds.includes(task.id));let insertIndex=remaining.findIndex(task=>task.id===targetId);if(mode==="after"){const family=[targetId,...taskDescendantIds(targetId)];insertIndex=Math.max(...family.map(id=>remaining.findIndex(task=>task.id===id)).filter(i=>i>=0))+1}else if(mode==="child"){const family=[targetId,...taskDescendantIds(targetId)];insertIndex=Math.max(...family.map(id=>remaining.findIndex(task=>task.id===id)).filter(i=>i>=0))+1}remaining.splice(Math.max(0,insertIndex),0,...moving);ganttTaskList=remaining}
function indentTask(taskId){const index=taskIndexById(taskId);if(index<=0)return;moveTaskSmart(taskId,ensureGanttTaskList()[index-1].id,"child")}
function outdentTask(taskId){const task=taskById(taskId);if(!task?.parentId)return;const parent=taskById(task.parentId);task.parentId=parent?.parentId||""}
function setTaskParent(taskId,parentId){if(taskId===parentId)return;const task=taskById(taskId);if(!task||taskDescendantIds(taskId).includes(parentId))return;task.parentId=parentId;task.isGroup=task.isGroup||taskChildren(taskId).length>0}
function deleteTaskById(taskId){const ids=[taskId,...taskDescendantIds(taskId)];ganttTaskList=ensureGanttTaskList().filter(task=>!ids.includes(task.id));ids.forEach(id=>delete taskEdits[id])}
function taskCode(row){const list=ensureGanttTaskList(),stageRows=list.filter(task=>task.isGroup),stageIndex=stageRows.findIndex(task=>task.id===row.id||task.id===row.parentId);if(row.isGroup)return String(Math.max(1,stageIndex+1));const siblings=list.filter(task=>task.parentId===row.parentId),childIndex=siblings.findIndex(task=>task.id===row.id)+1;return `${Math.max(1,stageIndex+1)}.${Math.max(1,childIndex)}`}
function taskMeta(i){const row=ensureGanttTaskList()[i]||ensureGanttTaskList()[0];const baseIndex=row.baseIndex;const group=row.isGroup;const progress=group?64:baseIndex<3?100:baseIndex===3?85:baseIndex===4?45:0;const plannedQty=group?0:(baseIndex+1)*4;const actualQty=group?0:Math.round(plannedQty*progress)/100;const base={index:i,id:row.id,name:row.name,code:taskCode(row),planStart:baseIndex%2?"28/05":"29/05",planEnd:baseIndex%3?"03/06":"11/06",actualStart:baseIndex<5?"28/05":"06/06",actualEnd:baseIndex<3?"29/05":"",progress,unit:group?"":baseIndex%4?"m2":"bộ",plannedQty,actualQty,parent:taskParentName(row),assignee:group?"TÀI KHOẢN TRẢI NGHIỆM":baseIndex%3?"Chưa phân công":"TÀI KHOẢN TRẢI NGHIỆM",follower:"TÀI KHOẢN TRẢI NGHIỆM",status:progress===100?"Hoàn thành":progress>0?"Đang làm":"Chưa làm",description:""};const merged={...base,...(taskEdits[row.id]||{})};merged.duration=taskDuration(merged.planStart,merged.planEnd);row.name=merged.name;return merged}
function taskInput(label,name,value,type="text"){return `<label><span>${label}</span><input data-task-field="${name}" type="${type}" value="${String(value??"").replaceAll('"',"&quot;")}"></label>`}
function taskDate(label,name,value){return `<label><span>${label}</span><input data-task-field="${name}" data-task-date readonly value="${value||""}"></label>`}
function taskMember(label,name,value){return `<label><span>${label}</span><select data-task-field="${name}">${projectMembers.map(member=>`<option ${member===value?"selected":""}>${member}</option>`).join("")}</select></label>`}
function taskParentSelect(task){const row=taskById(task.id);return `<select data-task-parent>${taskParentOptions(task.id,row?.parentId||"")}</select>`}
function taskDetail(index){const selected=document.querySelector("[data-gantt-row].selected");const task=taskMeta(Number.isFinite(index)?index:Number(selected?.dataset.ganttRow||2));document.querySelector(".task-detail")?.remove();document.body.insertAdjacentHTML("beforeend",`<section class="task-detail"><header><button data-task-close>‹ Quay lại bảng tiến độ</button><h2>Chi tiết công việc</h2><div><button data-task-save>Lưu thay đổi</button></div></header><article class="task-head"><h3>ⓘ <input data-task-field="name" value="${task.name.replaceAll('"',"&quot;")}"></h3><p>Mã số: <input data-task-field="code" value="${task.code}">　 Dự án: ${currentProject.name}　 Công việc cha: ${taskParentSelect(task)}　 Chế độ: <a>Nội bộ</a></p><div><em><input readonly value="${task.duration}"> ngày</em><em><input data-task-field="planStart" data-task-date readonly value="${task.planStart}"></em><em><input data-task-field="planEnd" data-task-date readonly value="${task.planEnd}"></em><b><select data-task-field="status"><option ${task.status==="Chưa làm"?"selected":""}>Chưa làm</option><option ${task.status==="Đang làm"?"selected":""}>Đang làm</option><option ${task.status==="Hoàn thành"?"selected":""}>Hoàn thành</option></select></b><b><input data-task-field="progress" type="number" value="${task.progress}">%</b></div></article><div class="task-body"><aside><h3>Danh sách người thực hiện</h3>${taskMember("Người thực hiện","assignee",task.assignee)}<h3>Danh sách người theo dõi</h3>${taskMember("Người theo dõi","follower",task.follower)}<h3>Thông tin kế hoạch</h3>${taskDate("Bắt đầu kế hoạch","planStart",task.planStart)}${taskDate("Kết thúc kế hoạch","planEnd",task.planEnd)}${taskDate("Bắt đầu thực tế","actualStart",task.actualStart)}${taskDate("Kết thúc thực tế","actualEnd",task.actualEnd||"")}${taskInput("Khối lượng kế hoạch","plannedQty",task.plannedQty,"number")}${taskInput("Khối lượng thực tế","actualQty",task.actualQty,"number")}${taskInput("Đơn vị","unit",task.unit)}</aside><main><div id="task-tab-content"></div></main></div></section>`);document.querySelector("[data-task-close]").onclick=()=>document.querySelector(".task-detail").remove();document.querySelector("[data-task-save]").onclick=()=>saveTaskDetail(task.index);bindDetailDatePickers();renderTaskOverview(task)}
function refreshGanttTasks(index){const body=document.querySelector(".gantt-table tbody");if(body)body.innerHTML=ganttRows();const bars=document.querySelector(".gantt-bars");if(bars)bars.innerHTML=ganttBars(true);if(body||bars){bindGantt();document.querySelector(`[data-gantt-row="${index}"]`)?.classList.add("selected")}}
function bindDetailDatePickers(){document.querySelectorAll("[data-task-date]").forEach(input=>input.onclick=()=>openDatePicker(input,input.value,value=>{document.querySelectorAll(`[data-task-field="${input.dataset.taskField}"]`).forEach(x=>x.value=normalizeScheduleDate(value,input.dataset.taskField))}))}
function saveTaskDetail(index){const task=taskMeta(index);commitGanttHistory();const next={};document.querySelectorAll("[data-task-field]").forEach(x=>next[x.dataset.taskField]=x.type==="number"?Number(x.value):x.value);normalizeTaskSchedule(next);taskEdits[task.id]={...(taskEdits[task.id]||{}),...next};setTaskParent(task.id,document.querySelector("[data-task-parent]")?.value||"");const nextIndex=taskIndexById(task.id);refreshGanttTasks(nextIndex);taskDetail(nextIndex)}
function reminderPopup(){const aside=document.querySelector(".task-body aside");aside.insertAdjacentHTML("beforeend",`<div class="reminder-pop"><b>Thay đổi nhắc nhở</b><button data-reminder-close>×</button><label>Nhắc nhở thực hiện<select><option>Không nhắc</option></select></label><label>Nhắc nhở hạn hoàn thành<select><option>Nhắc tự động</option></select></label><label>Người nhắc nhở<input value="Người thực hiện"></label><button data-reminder-save>Lưu thay đổi</button></div>`);aside.querySelector("[data-reminder-close]").onclick=()=>aside.querySelector(".reminder-pop").remove();aside.querySelector("[data-reminder-save]").onclick=()=>alert("Đã lưu lịch nhắc việc.")}
function renderTaskOverview(task=taskMeta(2)){const box=document.querySelector("#task-tab-content");box.innerHTML=`<h3>☷　Công việc con - phụ thuộc</h3><div class="mini-gantt"><b>${task.parent}</b><i style="width:${Math.max(8,Number(task.progress)||0)}%"></i><span>${task.name}</span></div>`}
function statTable(headers,rows){return `<table class="stat-table"><thead><tr>${headers.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table>`}
const diaryImages=["site-thumb-1.jpg","site-thumb-2.jpg","site-thumb-3.jpg","site-thumb-4.jpg","site-thumb-5.jpg","site-thumb-6.jpg"].map(name=>`/diary-assets/${name}`);
const diaryEntries=[
  {date:"28/05/2026",day:"Thứ 5",text:"HẠNG MỤC: NỘI THẤT SÀN TẦNG 1, Bả mattit vào cột, dầm, trần...",images:diaryImages},
  {date:"29/05/2026",day:"Thứ 6",text:"HẠNG MỤC: NỘI THẤT SÀN TẦNG 1, Sơn tường nhà đã bả 1 nước lót + 2 nước phủ...",images:diaryImages.slice(0,4)},
  {date:"31/05/2026",day:"Chủ nhật",text:"Lắp máy lạnh lầu 1 Toshiba, Máy bơm nước lên bồn Panasonic",images:diaryImages.slice(1,6)}
];
function diaryThumb(src,i=0){return `<button class="diary-thumb" data-diary-image="${src}"><img src="${src}" alt="Ảnh hiện trường ${i+1}"></button>`}
function diaryModeMenu(mode){return `<span class="diary-mode-wrap"><button data-diary-mode-toggle>${mode==="month"?"Tháng":mode==="list"?"Danh sách":"Hình ảnh"}⌄</button><menu><button data-diary-mode="month">▦ Lịch biểu</button><button data-diary-mode="list">☷ Danh sách</button><button data-diary-mode="image">▧ Hình ảnh</button></menu></span>`}
function diaryUtilityMenu(){return `<span class="diary-util-wrap"><button data-diary-util-toggle>Tiện ích⌄</button><menu><button data-diary-export>↧ Xuất nhật ký hệ thống</button><button>▣ Sao chép thành dự án thực tế</button><button>▣ Sao chép thành dự án mẫu</button></menu></span>`}
function diaryToolbar(mode){return `<div class="diary-toolbar"><button data-diary-reload>⟳ Tải lại</button><input data-diary-search placeholder="⌕ Tìm kiếm nhật ký thi công...">${diaryModeMenu(mode)}<button class="green" data-diary-add>+ Nhật ký</button>${diaryUtilityMenu()}</div>`}
function diaryCalendar(){const cells=Array.from({length:42},(_,i)=>{const day=i+1;const inMonth=day<=30;return `<i class="${day===1?"today":""}"><small>${inMonth?day:day-30}</small>${day===1?`<button data-diary-entry="0">Nhật ký thi công<br><b>Nội thất sàn tầng 1</b></button>`:""}</i>`}).join("");return `<div class="diary-calendar-head"><button data-diary-prev>‹</button><button data-diary-next>›</button><button data-diary-today>Hôm nay</button><h2>Tháng 6, 2026</h2><div><button class="active">Tháng</button><button data-diary-mode="list">Lịch biểu tuần</button><button data-diary-mode="list">Lịch biểu tháng</button></div></div><div class="diary-week">${["T2","T3","T4","T5","T6","T7","CN"].map(x=>`<b>${x}</b>`).join("")}</div><div class="diary-calendar">${cells}</div>`}
function diaryList(){return `<div class="diary-list">${diaryEntries.map((entry,i)=>`<section><h3>${entry.day}, ${entry.date}</h3><button data-diary-entry="${i}"><i></i> Nhật ký thi công của <b>TÀI KHOẢN TRẢI NGHIỆM</b> - Công việc: ${entry.text}</button></section>`).join("")}</div>`}
function diaryGallery(){return `<div class="diary-gallery">${diaryEntries.map((entry,i)=>`<section><h3>${entry.date} (${entry.images.length})</h3><div>${entry.images.map((src,j)=>`${diaryThumb(src,j)}<small>Ảnh hiện trường ${j+1}<br>${entry.date}</small>`).join("")}</div></section>`).join("")}</div>`}
function bindDiaryCommon(){document.querySelector("[data-diary-reload]")?.addEventListener("click",()=>diaryView("month"));document.querySelector("[data-diary-add]")?.addEventListener("click",()=>diaryEditor(true));document.querySelector("[data-diary-mode-toggle]")?.addEventListener("click",()=>document.querySelector(".diary-mode-wrap").classList.toggle("open"));document.querySelector("[data-diary-util-toggle]")?.addEventListener("click",()=>document.querySelector(".diary-util-wrap").classList.toggle("open"));document.querySelectorAll("[data-diary-mode]").forEach(x=>x.onclick=()=>diaryView(x.dataset.diaryMode));document.querySelectorAll("[data-diary-entry]").forEach(x=>x.onclick=()=>diaryEditor(false,Number(x.dataset.diaryEntry)||0));document.querySelectorAll("[data-diary-image]").forEach(x=>x.onclick=()=>diaryLightbox(x.dataset.diaryImage));document.querySelector("[data-diary-export]")?.addEventListener("click",diaryExport);document.querySelector("[data-diary-search]")?.addEventListener("input",e=>{const q=e.target.value.toLowerCase();document.querySelectorAll(".diary-list section,.diary-gallery section").forEach(x=>x.hidden=!x.innerText.toLowerCase().includes(q))})}
function diaryView(mode="month"){history.replaceState(null,"",`${location.pathname}?view=diary&tab=${mode}`);document.querySelector(".toolbar").style.display="none";document.querySelector("#project-app").style.padding="0";document.querySelector("#project-app").innerHTML=`<section class="diary-view box">${diaryToolbar(mode)}${mode==="month"?diaryCalendar():mode==="list"?diaryList():diaryGallery()}</section>`;bindDiaryCommon()}
const diaryToday=()=>{const now=new Date();return new Date(now.getFullYear(),now.getMonth(),now.getDate())};
let diaryAnchorDate=diaryToday();
let diaryReturnMode="month";
const diaryReportStorageKey=`ledome.diary.reports.${id}`;
let diaryReportCache={};
async function loadDiaryReports(){try{const body=await fetch(`/api/v1/projects/${id}/diary-reports`).then(res=>res.json());diaryReportCache=body.data||{}}catch{diaryReportCache={}}}
async function saveDiaryReports(){await fetch(`/api/v1/projects/${id}/diary-reports`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({reports:diaryReportCache})})}
const diaryDateKey=(date)=>`${String(date.getDate()).padStart(2,"0")}/${String(date.getMonth()+1).padStart(2,"0")}/${date.getFullYear()}`;
const diaryEntryIndex=(date)=>diaryEntries.findIndex(entry=>entry.date===diaryDateKey(date));
function diaryReports(){return diaryReportCache}
function isDiaryReported(dateKey){return !!diaryReports()[dateKey]}
function setDiaryReported(dateKey){diaryReportCache[dateKey]={sentAt:new Date().toISOString(),sentBy:currentLoginId()};saveDiaryReports().catch(console.warn)}
function diaryEntryForDate(date){
  const key=diaryDateKey(date),index=diaryEntryIndex(date),entry=diaryEntries[index];
  if(entry)return {...entry,index,date:key,reported:isDiaryReported(key)};
  const tasks=diaryTasksForDate(key).map(task=>task[0]);
  return {index:-1,date:key,text:tasks.length?tasks.slice(0,3).join(", "):"Phiếu nhật ký thi công trong ngày",images:[],reported:isDiaryReported(key)};
}
const diaryEntryCard=(entry,index,compact=false)=>`<button class="diary-entry-card ${compact?"compact":""} ${entry.reported?"reported":""}" data-diary-date-open="${entry.date}" data-diary-entry="${index}"><span class="diary-entry-top"><b>Nhật ký thi công</b><em>${entry.reported?"Đã gửi báo cáo":"Chờ báo cáo"}</em></span><span class="diary-entry-text">${entry.text}</span><small>${entry.reported?"Đã khóa phiếu":"Người chịu trách nhiệm cập nhật"} <i></i> ${entry.images.length} ảnh hiện trường</small></button>`;
function diaryModeMenu(mode){return `<div class="diary-period-switch" aria-label="Ch\u1ebf \u0111\u1ed9 xem nh\u1eadt k\u00fd"><button class="${mode==="day"?"active":""}" data-diary-mode="day">Ng\u00e0y</button><button class="${mode==="week"?"active":""}" data-diary-mode="week">Tu\u1ea7n</button><button class="${mode==="month"?"active":""}" data-diary-mode="month">Th\u00e1ng</button></div>`}
function diaryToolbar(mode){return `<div class="diary-toolbar"><div class="diary-toolbar-title"><b>Nh\u1eadt k\u00fd thi c\u00f4ng</b><span>Theo d\u00f5i b\u00e1o c\u00e1o hi\u1ec7n tr\u01b0\u1eddng theo th\u1eddi gian</span></div><input data-diary-search placeholder="T\u00ecm ki\u1ebfm nh\u1eadt k\u00fd thi c\u00f4ng...">${diaryModeMenu(mode)}<button class="green" data-diary-add>+ Nh\u1eadt k\u00fd</button>${diaryUtilityMenu()}</div>`}
function diaryPeriodTitle(mode){
  if(mode==="day")return diaryDateKey(diaryAnchorDate);
  if(mode==="week"){const start=diaryWeekStart(diaryAnchorDate),end=new Date(start);end.setDate(start.getDate()+6);return `${diaryDateKey(start)} - ${diaryDateKey(end)}`}
  return `Th\u00e1ng ${diaryAnchorDate.getMonth()+1}, ${diaryAnchorDate.getFullYear()}`;
}
function diaryWeekStart(date){const start=new Date(date);start.setDate(date.getDate()-((date.getDay()+6)%7));return start}
function diaryPeriodNav(mode){return `<div class="diary-period-nav"><div><button data-diary-prev title="K\u1ef3 tr\u01b0\u1edbc">\u2039</button><button data-diary-next title="K\u1ef3 sau">\u203a</button><button data-diary-today>H\u00f4m nay</button></div><h2>${diaryPeriodTitle(mode)}</h2><span>${mode==="day"?"Chi ti\u1ebft theo ng\u00e0y":mode==="week"?"T\u1ed5ng h\u1ee3p theo tu\u1ea7n":"T\u1ed5ng quan theo th\u00e1ng"}</span></div>`}
function diarySummary(){
  const imageCount=diaryEntries.reduce((sum,entry)=>sum+entry.images.length,0);
  return `<div class="diary-summary"><article><small>T\u1ed5ng nh\u1eadt k\u00fd</small><b>${diaryEntries.length}</b><span>Nh\u1eadt k\u00fd \u0111\u00e3 ghi nh\u1eadn</span></article><article><small>T\u01b0 li\u1ec7u hi\u1ec7n tr\u01b0\u1eddng</small><b>${imageCount}</b><span>\u1ea2nh \u0111\u00e3 t\u1ea3i l\u00ean</span></article><article><small>T\u1ea7n su\u1ea5t c\u1eadp nh\u1eadt</small><b>3</b><span>Ng\u00e0y c\u00f3 b\u00e1o c\u00e1o</span></article></div>`;
}
function diaryDayView(){
  const index=diaryEntryIndex(diaryAnchorDate),entry=diaryEntryForDate(diaryAnchorDate);
  const isToday=diaryDateKey(diaryAnchorDate)===diaryDateKey(diaryToday());
  return `${diaryPeriodNav("day")}<div class="diary-day-layout"><section class="diary-day-main ${isToday?"today":""}"><header><div><b>${diaryDateKey(diaryAnchorDate)} ${isToday?"<em>Hôm nay</em>":""}</b><span>${entry.reported?"Phiếu đã gửi báo cáo và khóa chỉnh sửa":"Phiếu nhật ký đang chờ gửi báo cáo"}</span></div><button data-diary-date-open="${entry.date}">Mở phiếu nhật ký</button></header>${diaryEntryCard(entry,index)}</section><aside>${diarySummary()}</aside></div>`;
}
function diaryWeekView(){
  const start=diaryWeekStart(diaryAnchorDate);
  const days=Array.from({length:7},(_,i)=>{const date=new Date(start);date.setDate(start.getDate()+i);const index=diaryEntryIndex(date),entry=diaryEntryForDate(date);return `<article class="diary-week-day ${diaryDateKey(date)===diaryDateKey(diaryToday())?"today":""} ${entry.reported?"reported":""}"><header><b>${["T2","T3","T4","T5","T6","T7","CN"][i]}</b><span>${date.getDate()}/${date.getMonth()+1}</span></header>${diaryEntryCard(entry,index,true)}</article>`}).join("");
  return `${diaryPeriodNav("week")}${diarySummary()}<div class="diary-week-grid">${days}</div>`;
}
function diaryMonthView(){
  const first=new Date(diaryAnchorDate.getFullYear(),diaryAnchorDate.getMonth(),1),start=diaryWeekStart(first);
  const cells=Array.from({length:42},(_,i)=>{const date=new Date(start);date.setDate(start.getDate()+i);const index=diaryEntryIndex(date),entry=diaryEntryForDate(date),outside=date.getMonth()!==diaryAnchorDate.getMonth();return `<i class="${outside?"outside":""} ${diaryDateKey(date)===diaryDateKey(diaryToday())?"today":""} ${entry.reported?"reported":""}"><small>${date.getDate()}</small>${diaryEntryCard(entry,index,true)}</i>`}).join("");
  return `${diaryPeriodNav("month")}${diarySummary()}<section class="diary-month-panel"><div class="diary-week">${["T2","T3","T4","T5","T6","T7","CN"].map(day=>`<b>${day}</b>`).join("")}</div><div class="diary-calendar">${cells}</div></section>`;
}
function bindDiaryCommon(){
  const mode=new URLSearchParams(location.search).get("tab")||"month";
  diaryReturnMode=mode;
  document.querySelectorAll("[data-diary-add]").forEach(button=>button.onclick=()=>diaryEditor(true));
  document.querySelector("[data-diary-util-toggle]")?.addEventListener("click",()=>document.querySelector(".diary-util-wrap").classList.toggle("open"));
  document.querySelectorAll("[data-diary-mode]").forEach(button=>button.onclick=()=>diaryView(button.dataset.diaryMode));
  document.querySelectorAll("[data-diary-date-open]").forEach(button=>button.onclick=()=>diaryEditor(false,Number(button.dataset.diaryEntry)||0,mode,button.dataset.diaryDateOpen));
  document.querySelector("[data-diary-prev]")?.addEventListener("click",()=>moveDiaryPeriod(mode,-1));
  document.querySelector("[data-diary-next]")?.addEventListener("click",()=>moveDiaryPeriod(mode,1));
  document.querySelector("[data-diary-today]")?.addEventListener("click",()=>{diaryAnchorDate=diaryToday();diaryView(mode)});
  document.querySelector("[data-diary-export]")?.addEventListener("click",diaryExport);
  document.querySelector("[data-diary-search]")?.addEventListener("input",event=>{const query=event.target.value.toLowerCase();document.querySelectorAll(".diary-entry-card").forEach(card=>card.hidden=!card.innerText.toLowerCase().includes(query))});
}
function moveDiaryPeriod(mode,direction){
  const next=new Date(diaryAnchorDate);
  if(mode==="month")next.setMonth(next.getMonth()+direction);
  else next.setDate(next.getDate()+direction*(mode==="week"?7:1));
  diaryAnchorDate=next;
  diaryView(mode);
}
function diaryView(mode="month"){
  if(mode==="list")mode=diaryReturnMode;
  if(!["day","week","month"].includes(mode))mode="day";
  diaryReturnMode=mode;
  history.replaceState(null,"",`${location.pathname}?view=diary&tab=${mode}`);
  document.querySelector(".toolbar").style.display="none";
  document.querySelector("#project-app").style.padding="0";
  const content=mode==="day"?diaryDayView():mode==="week"?diaryWeekView():diaryMonthView();
  document.querySelector("#project-app").innerHTML=`<section class="diary-view diary-smart box">${diaryToolbar(mode)}${content}</section>`;
  bindDiaryCommon();
}
function bindFileOpeners(scope=document){scope.querySelectorAll("[data-open-file]").forEach(card=>card.onclick=event=>{if(event.target.closest("footer,a,button"))return;openFileViewer(card.dataset.openFile,card.dataset.openTitle||"File",card.dataset.openType||"file")})}
function openFileViewer(src,title,type="image"){document.querySelector(".diary-lightbox")?.remove();const safeTitle=contractEscape(title),imageSrc=src.includes("site-thumb")?"/diary-assets/site-stairs.jpg":src,body=type==="pdf"?`<iframe src="${imageSrc}" title="${safeTitle}"></iframe>`:`<img src="${imageSrc}" alt="${safeTitle}">`;document.body.insertAdjacentHTML("beforeend",`<div class="diary-lightbox file-viewer-modal ${type==="pdf"?"pdf-viewer":""}"><button data-diary-lightbox-close aria-label="Đóng">×</button>${body}<p>${safeTitle}</p></div>`);const box=document.querySelector(".diary-lightbox"),close=()=>{box?.remove();document.removeEventListener("keydown",onKey)},onKey=e=>{if(e.key==="Escape")close()};box.querySelector("[data-diary-lightbox-close]").onclick=close;document.addEventListener("keydown",onKey)}
function diaryLightbox(src){openFileViewer(src,"Ảnh hiện trường","image")}

function diaryExport(){const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent("Ngày nhật ký,Người tạo,Công việc\n"+diaryEntries.map(x=>`${x.date},TÀI KHOẢN TRẢI NGHIỆM,${x.text}`).join("\n"));a.download=`Nhat_ky_thi_cong_${Date.now()}.csv`;a.click()}
function diaryRating(label,mid=false){return `<div class="diary-rating"><span>${label}</span><label><input type="radio" checked name="${label}"> Tốt</label><label><input type="radio" name="${label}"> Trung bình</label><label><input type="radio" name="${label}"> Kém</label></div>`}
function diaryGanttShortcut(diaryDate){
  const calendar=ganttCalendar(),weekdays=["CN","T2","T3","T4","T5","T6","T7"],day=dateFromDisplay(diaryDate);
  const tasks=ensureGanttTaskList().map((row,index)=>({...taskMeta(index),isGroup:row.isGroup,level:taskLevel(row)})).filter((task,index)=>index>0);
  const active=tasks.filter(task=>!task.isGroup&&dateFromDisplay(task.planStart)<=day&&day<=dateFromDisplay(task.planEnd)).length;
  const done=tasks.filter(task=>!task.isGroup&&Number(task.progress)>=100).length;
  const days=calendar.dates.map((date,index)=>`<b class="${date.getDay()===0||date.getDay()===6?"weekend":""} ${index===calendar.todayIndex?"today":""}">${weekdays[date.getDay()]}<em>${String(date.getDate()).padStart(2,"0")}</em></b>`).join("");
  const rows=tasks.map(task=>{const metrics=ganttBarMetrics(task),progress=Math.max(0,Math.min(100,Number(task.progress)||0));return `<div class="diary-gantt-row ${task.isGroup?"group":""} ${dateFromDisplay(task.planStart)<=day&&day<=dateFromDisplay(task.planEnd)?"active-day":""}"><strong style="padding-left:${8+task.level*10}px" title="${task.name}">${task.code}. ${task.name}</strong><span><i style="margin-left:${metrics.leftPct}%;width:${metrics.widthPct}%"><em style="width:${progress}%"></em></i></span></div>`}).join("");
  return `<section class="diary-gantt-shortcut"><header><div><h4>Bảng tiến độ thi công</h4><p>Shortcut đầy đủ từ bảng tiến độ, đối chiếu theo ngày nhật ký.</p></div><button type="button" data-view-link="gantt">Mở bảng tiến độ</button></header><div class="diary-gantt-stats"><span>Task trong ngày <b>${active}</b></span><span>Hoàn thành <b>${done}</b></span><span>Tổng task <b>${tasks.filter(task=>!task.isGroup).length}</b></span></div><div class="schedule-gantt-legend"><span><i></i>Kế hoạch</span><span><i></i>Đã thực hiện</span><small>Hiển thị đủ ${tasks.length} dòng</small></div><div class="diary-gantt-scroll"><div class="diary-gantt-grid"><div class="diary-gantt-head"><strong>Công việc</strong><span>${days}</span></div>${rows}</div></div></section>`;
}
function diaryInfoPanel(isNew,diaryDate){return `<aside class="diary-info"><h3>THÔNG TIN NHẬT KÝ</h3><b>Ảnh hiện trường</b><div class="diary-upload">▣<small>Ảnh hiện trường</small></div>${isNew?"":`<div class="diary-info-thumbs">${diaryImages.slice(0,5).map(diaryThumb).join("")}</div>`}<div class="diary-upload">▧<small>BIM</small></div><div class="diary-upload">⌘<small>Tệp đính kèm</small></div><label>Mã nhật ký<input placeholder="Nhập mã nhật ký" value="${isNew?"":"P00052_NK/0101/2024"}"></label><label>Nhật ký ngày *<input data-popup-date data-diary-date readonly value="${diaryDate}"></label><label>Người theo dõi<select>${companyPeople.map((person,i)=>`<option ${i===0?"selected":""}>${person}</option>`).join("")}</select></label><h4>Tình hình thi công trong ngày</h4>${diaryRating("Công tác an toàn")}${diaryRating("Chất lượng thi công")}${diaryRating("Tiến độ thi công")}${diaryRating("Công tác vệ sinh")}${diaryGanttShortcut(diaryDate)}</aside>`}
function diaryTaskCard(task,i,open=i===0){return `<article class="diary-task ${open?"open":""}"><header><b>${i+1}. ${task[0]}</b><button data-diary-task-close>×</button></header><div class="diary-task-metrics"><label>Khu vực thi công<input></label><label>KL kế hoạch<input value="${task[1]}"></label><label>KL thi công<input value="${task[2]}"></label><label>Tích lũy<input value="${task[3]}"></label><label>Còn lại<input value="${task[4]}"></label><label>Đơn vị<input value="${task[5]}"></label></div><h4>VẬT LIỆU ${open?"(5)":""}<button data-diary-resource-toggle>Chi tiết vật liệu⌄</button></h4>${open?statTable(["STT","Vật liệu","Kho xuất *","Thời gian xuất","Số lượng","Đơn vị"],[["1","Bột trét tường","Kho dự án","18:00","23","hộp"],["2","Sơn ICI Dulux cao cấp Weather Shield ngoài nhà","Kho dự án","18:00","45","kg"],["3","Sơn ICI Dulux Supreme cao cấp trong nhà","Kho dự án","18:00","35","kg"]]):""}<h4>NHÂN CÔNG ${open?"(2)":""}<button>Chi tiết nhân công⌄</button></h4>${open?statTable(["STT","Nhân công","Giờ làm","Số lượng","Đơn vị"],[["1","Công chính","07:00 - 18:00","7","công"],["2","Công phụ","07:00 - 18:00","14","công"]]):""}<h4>MÁY THI CÔNG <button>Chi tiết máy thi công⌄</button></h4></article>`}
function diaryTasksForDate(value){const day=dateFromDisplay(value);return ensureGanttTaskList().map((row,index)=>({row,task:taskMeta(index)})).filter(({row,task})=>!row.isGroup&&dateFromDisplay(task.planStart)<=day&&day<=dateFromDisplay(task.planEnd)).map(({task})=>[task.name,fmt(task.plannedQty),fmt(task.actualQty),fmt(task.actualQty),fmt(Math.max(0,Number(task.plannedQty)-Number(task.actualQty))),task.unit])}
function diaryTaskCards(value){const tasks=diaryTasksForDate(value);return tasks.length?tasks.map((task,i)=>diaryTaskCard(task,i,i===0)).join(""):'<div class="diary-empty">Không có công việc trong bảng tiến độ vào ngày này.</div>'}
function renderDiaryTaskCards(value){const content=document.querySelector("[data-diary-editor-content]");if(content)content.innerHTML=diaryTaskCards(value)}
function diaryEditor(isNew=true,index=0,returnMode=diaryReturnMode,forcedDate=""){const diaryDate=forcedDate|| (isNew?diaryDateKey(diaryAnchorDate):diaryEntries[index]?.date||diaryDateKey(diaryAnchorDate));const reported=isDiaryReported(diaryDate);history.replaceState(null,"",`${location.pathname}?view=diary&entry=${encodeURIComponent(diaryDate)}`);document.querySelector(".toolbar").style.display="none";document.querySelector("#project-app").style.padding="0";document.querySelector("#project-app").innerHTML=`<section class="form-page diary-editor ${reported?"reported readonly":""}" data-diary-editor-date="${diaryDate}"><header><h2>Chi tiết nhật ký thi công</h2><div><button class="blue" ${reported?"disabled":""}>↥ Tải dữ liệu</button><button data-diary-editor-save ${reported?"disabled":""}>▣ Lưu</button>${reported?'<span class="diary-report-badge">Đã gửi báo cáo - phiếu đã khóa</span>':'<button data-diary-report-send class="orange">Gửi báo cáo</button>'}<button data-diary-editor-close>× Đóng</button></div></header><div class="diary-editor-body"><main><input class="diary-task-search" placeholder="⌕ Tìm công việc theo tên ..." ${reported?"disabled":""}><div data-diary-editor-content>${diaryTaskCards(diaryDate)}</div></main>${diaryInfoPanel(false,diaryDate)}</div></section>`;bindDiaryEditor(returnMode)}
function lockDiaryEditor(){document.querySelectorAll(".diary-editor input,.diary-editor textarea,.diary-editor select,.diary-editor [data-diary-resource-toggle]").forEach(input=>input.disabled=true)}
function bindDiaryEditor(returnMode=diaryReturnMode){const editor=document.querySelector(".diary-editor"),editorDate=editor?.dataset.diaryEditorDate;document.querySelector("[data-diary-editor-close]").onclick=()=>diaryView(returnMode==="list"?"month":returnMode);document.querySelector("[data-diary-editor-save]").onclick=()=>isDiaryReported(editorDate)?alert("Phiếu nhật ký đã gửi báo cáo nên không sửa được nữa."):alert("Đã lưu nhật ký thi công demo.");document.querySelector("[data-diary-report-send]")?.addEventListener("click",()=>{if(!confirm("Gửi báo cáo nhật ký thi công và khóa phiếu này?"))return;setDiaryReported(editorDate);diaryEditor(false,0,returnMode,editorDate)});if(isDiaryReported(editorDate))lockDiaryEditor();document.querySelectorAll("[data-diary-image]").forEach(x=>x.onclick=()=>diaryLightbox(x.dataset.diaryImage));document.querySelectorAll("[data-view-link]").forEach(x=>x.onclick=()=>showView(x.dataset.viewLink));bindPopupDateFields();const date=document.querySelector("[data-diary-date]");if(date&&!isDiaryReported(editorDate))date.onclick=()=>openDatePicker(date,date.value,value=>{date.value=value;renderDiaryTaskCards(value);const old=document.querySelector(".diary-gantt-shortcut");if(old)old.outerHTML=diaryGanttShortcut(value);document.querySelector(".diary-editor").dataset.diaryEditorDate=value;document.querySelectorAll("[data-view-link]").forEach(x=>x.onclick=()=>showView(x.dataset.viewLink))});document.querySelector(".diary-task-search")?.addEventListener("input",event=>{const query=event.target.value.toLowerCase();document.querySelectorAll(".diary-task").forEach(card=>card.hidden=!card.innerText.toLowerCase().includes(query))})}
const settingsTabs=[["info","Thông tin"],["members","Thành viên"],["followers","Người theo dõi"],["stages","Giai đoạn"],["workdays","Lịch làm việc"],["permissions","Phân quyền"],["config","Cấu hình"],["proposal","Loại đề xuất"],["reports","Lịch gửi báo cáo"]];
const settingsMembers=["TÀI KHOẢN TRẢI NGHIỆM"];
function settingsButton(label,extra=""){return `<button ${extra}>${label}</button>`}
function settingsSwitch(on=false){return `<button class="settings-switch ${on?"on":""}" data-settings-switch aria-label="Bật tắt"><i></i></button>`}
function settingsField(label,value="",type="input"){const isDate=/ng\u00e0y/i.test(label);return `<label><span>${label}</span>${type==="textarea"?`<textarea placeholder="${value}"></textarea>`:type==="select"?`<select><option>${value}</option></select>`:`<input value="${value}" placeholder="${value}" ${isDate?"data-popup-date readonly":""}>`}</label>`}
function settingsSummary(){return `<aside class="settings-summary"><h2>[Mẫu] Nội thất</h2>${[["Ngày bắt đầu dự án","16/05/2024"],["Ngày kết thúc dự án","30/05/2024"],["Ngân sách","0"],["Trạng thái","Đang thực hiện"],["Tình trạng","Chậm trễ"],["Tiến độ","0%"],["Số thành viên",settingsMembers.length],["Số người theo dõi","0"],["Người tạo","TÀI KHOẢN TRẢI NGHIỆM"],["Ngày tạo","31/05/2026"]].map(([a,b])=>`<p><span>${a}</span><b>${b}</b></p>`).join("")}</aside>`}
function settingsInfo(){return `<div class="settings-info-grid"><section>${settingsField("Mã dự án","P00052")}${settingsField("Ngày bắt đầu dự án","16/05/2024")}${settingsField("Mô tả","Nhập mô tả","textarea")}${settingsField("Khách hàng","Tìm kiếm khách hàng")}${settingsField("Gói thầu","Nhập gói thầu")}${settingsField("Hạng mục thi công","Nhập hạng mục thi công")}${settingsField("Địa điểm thi công","Nhập địa điểm thi công")}<div class="settings-map"><b>⌕　Tìm kiếm trên bản đồ</b><i>●</i><small>Bản đồ địa điểm thi công</small></div></section><section>${settingsField("Tên dự án *","[Mẫu] Nội thất")}${settingsField("Ngày kết thúc dự án","30/05/2024")}${settingsField("Nhóm dự án","Chọn nhóm dự án","select")}${settingsField("Lĩnh vực","Chọn lĩnh vực","select")}${settingsField("Ngân sách","0")}${settingsField("Trạng thái","Đang thực hiện","select")}${settingsField("Tình trạng","Chậm trễ","select")}${settingsField("Thẻ","Nhập thẻ")}<label><span>Màu đặc trưng</span><input type="color" value="#1aaa9f"></label><label><span>Ảnh đại diện</span><b class="settings-logo">▥</b></label></section></div>`}
function settingsMembersPanel(followers=false){const title=followers?"Thêm người theo dõi":"Thêm thành viên";return `<div class="settings-members"><button class="settings-outline" data-settings-replace>⟳ Thay thế người tham gia</button><header><b>${title}</b><div><button>♟⌄</button><button class="green" data-settings-add-member>+ Thêm</button></div></header>${settingsMembers.map((name,i)=>`<article><img src="/diary-assets/site-thumb-1.jpg"><b>${name}${i===0&&!followers?" (Giám đốc dự án)":""}</b><span>${i?"":'<button data-settings-edit-member>✎</button>'}</span></article>`).join("")}</div>`}
function settingsStages(){return `<div class="settings-stages"><header><button class="green" data-settings-add-stage>+ Thêm giai đoạn</button></header>${["Chuẩn bị thi công","Thi công phần móng","Thi công phần thân","Hoàn thiện và bàn giao"].map((x,i)=>`<p><b>${i+1}</b><span>${x}</span><button>✎</button><button>×</button></p>`).join("")}</div>`}
function settingsWorkdays(){return `<div class="settings-workdays">${["Thứ hai","Thứ ba","Thứ tư","Thứ năm","Thứ sáu","Thứ bảy","Chủ nhật"].map((x,i)=>`<label><input type="checkbox" ${i<6?"checked":""}><b>${x}</b><span>Giờ làm việc:</span><input type="number" value="${i===5?4:i===6?0:8}"></label>`).join("")}</div>`}
function settingsPermissions(){const roles=["Kế toán","Mua hàng","Thủ kho","Quản lý hợp đồng","QS"];const features=["Cập nhật thông tin dự án","Sao chép","Xóa","Quản lý giai đoạn","Quản lý thành viên","Quản lý người theo dõi","Thêm công việc","Xem tổng quan","Xem thu/chi","Trao đổi","Thêm nhật ký"];return `<div class="settings-permissions">${roles.map(x=>`<article><h3>${x}</h3><p>Có quyền thực hiện các chức năng trong phân quản lý của dự án</p><label>Chọn người dùng<input placeholder="Chọn người dùng"></label></article>`).join("")}<table><thead><tr><th>Chức năng</th><th>Chỉ huy</th><th>Thành viên</th><th>Người theo dõi</th></tr></thead><tbody>${features.map((x,i)=>`<tr><td>${x}</td>${[0,1,2].map(j=>`<td><input type="checkbox" ${j===0||i===7||i===9?"checked":""}></td>`).join("")}</tr>`).join("")}</tbody></table></div>`}
function configRow(title,desc,on=false){return `<label class="settings-option"><span><b>${title}</b><small>${desc}</small></span>${settingsSwitch(on)}<em>${on?"Có":""}</em></label>`}
function settingsAccordion(title,body,open=true){return `<section class="settings-accordion ${open?"open":""}"><header data-settings-accordion><b>${title}</b><span>⌄</span></header><div>${body}</div></section>`}
function settingsConfig(){return `<div class="settings-config">${settingsAccordion("Cấu hình chung",`<div class="settings-radio"><b>Chế độ hiển thị dự án</b><label><input type="radio" checked name="scope"> Nội bộ</label><label><input type="radio" name="scope"> Riêng tư</label><label><input type="radio" name="scope"> Công khai</label></div>${configRow("Sử dụng vật liệu định mức","Chỉ hiển thị vật liệu trong định mức dự án khi chọn vật liệu",false)}${configRow("Duyệt định mức","Yêu cầu duyệt định mức",false)}`)}${settingsAccordion("Bảng tiến độ",`${configRow("Giám sát sử dụng vật liệu","Giám sát sử dụng vật liệu so với tiến độ thi công",true)}${configRow("Hoàn thành công việc","Tự động chuyển trạng thái công việc sang Hoàn thành",false)}${configRow("Giới hạn thời gian thực hiện công việc","Thời gian thực hiện công việc phải nằm trong giai đoạn",false)}${configRow("Tiền tố tên công việc","Tự động gắn mã giai đoạn vào tên công việc",false)}`)}${settingsAccordion("Kế hoạch thi công",configRow("Duyệt kế hoạch thi công","Yêu cầu duyệt kế hoạch thi công",false))}${settingsAccordion("Nhật ký thi công",`<div class="settings-radio"><b>Mẫu nhật ký</b><label><input type="radio" checked name="diary-template"> Mẫu số 1</label><label><input type="radio" name="diary-template"> Mẫu số 2</label></div>${configRow("Chụp ảnh hiện trường","Yêu cầu chụp ảnh hiện trường khi làm NKTC",false)}${configRow("Nhóm ảnh hiện trường NKTC","Thiết lập nhóm ảnh hiện trường trong NKTC",false)}${configRow("Tải ảnh hiện trường","Cho phép tải ảnh hiện trường từ bộ sưu tập",true)}${configRow("Xác nhận nhật ký","Yêu cầu xác nhận nhật ký thi công",false)}${configRow("Thời gian tạo NKTC","Cho phép tạo nhật ký thi công ở bất kỳ thời gian nào",true)}${configRow("Gửi thông báo","Gửi thông báo khi có nhật ký thi công mới",true)}`)}${settingsAccordion("Hợp đồng nhận thầu",`${configRow("VAT hạng mục","Sử dụng VAT trên từng hạng mục",false)}${configRow("Chiết khấu hạng mục","Sử dụng chiết khấu trên từng hạng mục",false)}`,false)}${settingsAccordion("Kế hoạch tháng nhận thầu",configRow("Duyệt kế hoạch tháng","Yêu cầu duyệt kế hoạch tháng",false),false)}</div>`}
function proposalCard(title,on=true){return `<section class="settings-proposal-card"><header><label><input type="checkbox" ${on?"checked":""}> ${title}</label><div><button>Chi tiết loại đề xuất</button><button data-proposal-permission>⚙ Quyền cập nhật đề xuất</button></div></header><div><label><input type="radio" checked name="${title}"> Chỉ cần một người duyệt</label><label><input type="radio" name="${title}"> Cần duyệt đồng thời</label><label><input type="radio" name="${title}"> Duyệt theo trình tự</label><p><b>Người xét duyệt *</b></p><strong>▣ TÀI KHOẢN TRẢI NGHIỆM</strong>${configRow("Cho phép duyệt lại","Cho phép duyệt lại khi người phê duyệt tiếp theo chưa phê duyệt",false)}</div></section>`}
function settingsProposal(){return `<div class="settings-proposal">${proposalCard("Đề xuất mua vật tư làm theo dự án")}${proposalCard("Đề xuất thanh toán làm theo dự án")}${proposalCard("Đề xuất cấp thiết bị làm theo dự án",false)}${proposalCard("Đề xuất mua thiết bị làm theo dự án",false)}</div>`}
function settingsReports(){return `<div class="settings-reports">${settingsField("Lịch gửi báo cáo","Hàng ngày","select")}${settingsField("Thời gian gửi *","18:00")}<label><span>Người nhận báo cáo *</span><strong>▣ TÀI KHOẢN TRẢI NGHIỆM</strong></label></div>`}
function settingsTabContent(tab){return tab==="info"?settingsInfo():tab==="members"?settingsMembersPanel():tab==="followers"?settingsMembersPanel(true):tab==="stages"?settingsStages():tab==="workdays"?settingsWorkdays():tab==="permissions"?settingsPermissions():tab==="config"?settingsConfig():tab==="proposal"?settingsProposal():settingsReports()}
function settingsModal(type){const replacement=type==="replace";document.body.insertAdjacentHTML("beforeend",`<div class="cash-modal settings-modal"><section><header><h2>${replacement?"Thay thế hoặc xóa người thực hiện công việc trong dự án?":"Phân quyền loại đề xuất"}</h2><button data-settings-modal-close>×</button></header>${replacement?`${settingsField("Người cần thay","Người cần thay","select")}${settingsField("Người thay","Người thay","select")}<label>Công việc　<input type="checkbox" checked> Chưa thực hiện　<input type="checkbox"> Đang thực hiện　<input type="checkbox"> Tất cả</label>${settingsField("Từ ngày","01/06/2026")}`:`<table><thead><tr><th>Chức năng</th><th>Người đề xuất</th><th>Người theo dõi</th><th>Người xét duyệt</th><th>Người thực hiện</th></tr></thead><tbody>${["Hoàn thành đề xuất","Hủy đề xuất","Thay đổi người xét duyệt","Thay đổi người theo dõi","Thay đổi người thực hiện"].map(x=>`<tr><td>${x}</td>${Array(4).fill("<td><input type='checkbox'></td>").join("")}</tr>`).join("")}</tbody></table>`}<footer><button data-settings-modal-close>× Đóng</button><button data-settings-modal-save>▣ Lưu thay thế</button></footer></section></div>`);document.querySelectorAll("[data-settings-modal-close]").forEach(x=>x.onclick=()=>document.querySelector(".settings-modal").remove());document.querySelector("[data-settings-modal-save]").onclick=()=>{document.querySelector(".settings-modal").remove();settingsToast("Đã lưu thay đổi thành công")};bindPopupDateFields(document.querySelector(".settings-modal"))}
function settingsToast(text){document.querySelector(".settings-toast")?.remove();document.querySelector(".settings-page").insertAdjacentHTML("beforeend",`<div class="settings-toast">${text}</div>`);setTimeout(()=>document.querySelector(".settings-toast")?.remove(),1800)}
function settingsView(tab="info"){history.replaceState(null,"",`${location.pathname}?view=settings&tab=${tab}`);document.querySelector("#project-app").innerHTML=`<section class="settings-page"><header><b>Chi tiết dự án</b><div>${settingsButton("▣ Lưu thay đổi","data-settings-save")}${settingsButton("▣ Xóa dự án",'class="danger"')}${settingsButton("× Đóng","data-settings-close")}</div></header><div class="settings-layout">${settingsSummary()}<main><nav>${settingsTabs.map(([id,label])=>`<button class="${id===tab?"active":""}" data-settings-tab="${id}">${label}</button>`).join("")}</nav><div class="settings-content">${settingsTabContent(tab)}</div></main></div></section>`;bindSettings()}
function bindSettings(){document.querySelector("[data-settings-close]").onclick=()=>render();document.querySelector("[data-settings-save]").onclick=()=>settingsToast("Đã lưu thay đổi thành công");document.querySelectorAll("[data-settings-tab]").forEach(x=>x.onclick=()=>settingsView(x.dataset.settingsTab));document.querySelectorAll("[data-settings-switch]").forEach(x=>x.onclick=()=>{x.classList.toggle("on");x.nextElementSibling.innerText=x.classList.contains("on")?"Có":""});document.querySelectorAll("[data-settings-accordion]").forEach(x=>x.onclick=()=>x.closest(".settings-accordion").classList.toggle("open"));document.querySelector("[data-settings-replace]")?.addEventListener("click",()=>settingsModal("replace"));document.querySelectorAll("[data-proposal-permission]").forEach(x=>x.onclick=()=>settingsModal("permission"));document.querySelector("[data-settings-add-member]")?.addEventListener("click",()=>settingsToast("Bạn chưa chọn nhân viên"));document.querySelector("[data-settings-add-stage]")?.addEventListener("click",()=>settingsToast("Đã thêm giai đoạn mới"));bindPopupDateFields(document.querySelector(".settings-page"))}
const contractQuoteSources=[
  {id:"tay-son",name:"BG_LEDOME_TÂY SƠN (TỔNG HỢP).xlsx",groups:["PHẦN THÔ","NỘI THẤT TẦNG 6","NỘI THẤT TẦNG 7","NỘI THẤT TẦNG 8","PHỤ KIỆN"],items:[
    ["PHẦN THÔ","Xây mới tường bếp tầng 6 + xây chậu cây tầng 8","Nhân công + vật tư","m2",16,0],
    ["PHẦN THÔ","Thi công điện nước cả 3 tầng","Nhân công + vận chuyển","gói",1,0],
    ["NỘI THẤT TẦNG 6","Lắp trần thạch cao","Khung xương Vĩnh Tường, tấm tiêu chuẩn 9mm","m2",45,0],
    ["NỘI THẤT TẦNG 6","Sơn bả trần thạch cao","Sơn 2 lớp - 1 lớp lót - 1 lớp nước Dulux","m2",45,0],
    ["NỘI THẤT TẦNG 6","Sơn bả tường","Sơn 2 lớp - 1 lớp lót - 1 lớp nước Dulux","m2",70,0],
    ["NỘI THẤT TẦNG 7","Chống thấm vệ sinh","Chống thấm bằng sika hoặc vật liệu tương đương","m2",4,0],
    ["NỘI THẤT TẦNG 8","Xây vách cenboard phòng tắm ngoài ban công","","m2",7,0],
    ["NỘI THẤT TẦNG 8","Cửa lùa 2 cánh","Nhôm xingfa tiêu chuẩn","m2",5,0],
    ["PHỤ KIỆN","Đèn downlight","D75-10W-Sáng trung tính 4000k","cái",30,160000]
  ]},
  {id:"mr-luyen",name:"251028_BGDT_LEDOME_MR.LUYEN -chốt nội dung.xlsx",groups:["PHÒNG KHÁCH","BẾP","PHÒNG NGỦ MASTER","PHÒNG NGỦ BÉ","PHỤ KIỆN NỘI THẤT"],items:[
    ["PHÒNG KHÁCH","Tủ giày","Gỗ MDF chống ẩm Thái Lan phủ Melamine","m2",5.7575,2100000],
    ["PHÒNG KHÁCH","Vách ốp cột","Gỗ MDF chống ẩm Thái Lan phủ Melamine","m2",4.0915,1000000],
    ["BẾP","Tủ bếp dưới","Gỗ MDF chống ẩm Thái Lan phủ Melamine","md",3.05,2500000],
    ["BẾP","Tủ bếp trên","Gỗ MDF chống ẩm Thái Lan phủ Melamine","md",3.05,2000000],
    ["BẾP","Bàn đảo","Gỗ MDF chống ẩm Thái Lan phủ Melamine","md",1.6,2750000],
    ["PHÒNG NGỦ MASTER","Tủ quần áo 1","Gỗ MDF chống ẩm Thái Lan phủ Melamine","m2",4.335,2550000],
    ["PHÒNG NGỦ BÉ","Giường ngủ","Gỗ MDF chống ẩm Thái Lan phủ Melamine","cái",1,9000000],
    ["PHỤ KIỆN NỘI THẤT","Bản lề giảm chấn","Eurogold","cái",180,50000],
    ["PHỤ KIỆN NỘI THẤT","Led thanh","Led nhôm profile mặt mica","md",10,275000]
  ]}
];
let activeContractQuote="tay-son",activeContractGroup="VẬN CHUYỂN";
const contractEscape=(value)=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;");
const contractMoney=(value)=>new Intl.NumberFormat("vi-VN").format(Number(value)||0);
function contractDropZone(kind,title,desc){const sheetKinds=["quote","estimate","settlement"];return `<section class="contract-drop" data-contract-drop="${kind}"><input type="file" hidden multiple data-contract-file="${kind}" accept="${sheetKinds.includes(kind)?".xlsx,.xls,.csv":".pdf,.doc,.docx,.xls,.xlsx,.dwg"}"><div><b>${title}</b><span>${desc}</span></div><button type="button" data-contract-pick="${kind}">Chọn file</button></section>`}
function contractSection(title,desc,body){return `<section class="contract-docs contract-block"><header><div><h3>${title}</h3><p>${desc}</p></div></header>${body}</section>`}
function contractEstimateFiles(){return contractSection("Dự toán","Lưu hồ sơ dự toán và các file Excel dự toán dùng để kiểm soát chi phí.",`<div class="contract-drop-grid single">${contractDropZone("estimate","Hồ sơ dự toán","Excel, CSV hoặc bảng dự toán")}</div><div class="contract-file-list" data-contract-kind-list="estimate"><span>Đang tải danh sách hồ sơ dự toán...</span></div>`)}
function contractSignedFiles(){return `<div class="contract-drop-grid">${contractDropZone("contract","Hợp đồng ký kết","PDF, Word hoặc Excel")}${contractDropZone("drawing","Hồ sơ bản vẽ hợp đồng","PDF, CAD, Word hoặc Excel")}</div><div class="contract-file-list" data-contract-kind-list="contract,drawing"><span>Đang tải hồ sơ hợp đồng...</span></div>`}
function contractQuoteFiles(){return `<div class="contract-drop-grid single">${contractDropZone("quote","Báo giá hợp đồng","Excel báo giá gửi Chủ đầu tư")}</div><div class="contract-file-list" data-contract-kind-list="quote"><span>Đang tải báo giá hợp đồng...</span></div>`}
function contractOwnerFiles(){return contractSection("Hợp đồng nhận thầu","Quản lý hợp đồng ký kết, báo giá hợp đồng và hồ sơ bản vẽ hợp đồng.",`<div class="contract-subsection"><h4>Hợp đồng ký kết và hồ sơ bản vẽ hợp đồng</h4>${contractSignedFiles()}</div><div class="contract-subsection quote-subsection"><h4>Báo giá hợp đồng</h4>${contractQuoteFiles()}${contractQuoteManager()}</div>`)}
function contractExtraRows(){const rows=[["PS-CDT-001","Thay đổi vật liệu hoàn thiện khu WC","Chờ CDT xác nhận","02/06/2026",18500000],["PS-CDT-002","Bổ sung đèn hắt khu phòng khách","Đang báo giá","31/05/2026",9200000],["PS-CDT-003","Điều chỉnh kích thước tủ giày theo bản vẽ mới","Đã duyệt","28/05/2026",12600000]];return `<table class="contract-extra-table"><thead><tr><th>Mã phát sinh</th><th>Nội dung phát sinh của CDT</th><th>Trạng thái</th><th>Ngày ghi nhận</th><th>Giá trị</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td>${contractMoney(row[4])}</td></tr>`).join("")}</tbody></table>`}
function contractExtraSection(){return contractSection("Phát sinh","Danh sách phát sinh của Chủ đầu tư trong quá trình thi công.",`<div class="contract-extra-head"><button class="green">+ Thêm phát sinh</button><button>Xuất dữ liệu</button></div>${contractExtraRows()}`)}
function contractSettlementFiles(){return contractSection("Quyết toán","Lưu hồ sơ quyết toán, bảng tổng hợp và tài liệu chốt giá trị cuối dự án.",`<div class="contract-drop-grid single">${contractDropZone("settlement","Hồ sơ quyết toán","Excel, CSV, PDF hoặc Word")}</div><div class="contract-file-list" data-contract-kind-list="settlement"><span>Đang tải hồ sơ quyết toán...</span></div>`)}
const contractItemSections=["VẬN CHUYỂN","CHE PHỦ","PHÁ DỠ","VỆ SINH","TRẦN","TƯỜNG","SÀN","ĐIỆN NƯỚC","GỖ","KÍNH","SẮT","ĐÁ","RÈM","ĐIỀU HÒA","ĐỆM","LẮP ĐẶT THIẾT BỊ","CHIẾU SÁNG"];
function contractItemSection(item){const text=`${item[0]} ${item[1]} ${item[2]}`.toLocaleUpperCase("vi");if(/VẬN CHUYỂN|TRẠC THẢI|RÁC/.test(text))return "VẬN CHUYỂN";if(/BẢO VỆ|BỌC|DÁN LÓT|CHE PHỦ/.test(text))return "CHE PHỦ";if(/PHÁ|THÁO|ĐẬP|RÓC/.test(text))return "PHÁ DỠ";if(/VỆ SINH|VSCN/.test(text))return "VỆ SINH";if(/TRẦN/.test(text))return "TRẦN";if(/TƯỜNG|VÁCH/.test(text))return "TƯỜNG";if(/SÀN|ỐP LÁT|GẠCH|NẸP|PHÀO/.test(text))return "SÀN";if(/ĐIỆN NƯỚC|THIẾT BỊ ĐIỆN|CHỐNG THẤM/.test(text))return "ĐIỆN NƯỚC";if(/GỖ|TỦ|KỆ|BÀN|GHẾ|GIƯỜNG|SOFA|QUẦY|PANTRY|BẾP|BAN THỜ|TATAMI|MDF|MELAMINE/.test(text))return "GỖ";if(/KÍNH|GƯƠNG|CỬA LÙA|CỬA SỔ/.test(text))return "KÍNH";if(/SẮT|THÉP|INOX/.test(text))return "SẮT";if(/ĐÁ/.test(text))return "ĐÁ";if(/RÈM/.test(text))return "RÈM";if(/ĐIỀU HÒA|MÁY LẠNH/.test(text))return "ĐIỀU HÒA";if(/ĐỆM|MÚT/.test(text))return "ĐỆM";if(/LẮP|NHÂN CÔNG/.test(text))return "LẮP ĐẶT THIẾT BỊ";if(/ĐÈN|LED|CHIẾU SÁNG|DOWNLIGHT|RỌI/.test(text))return "CHIẾU SÁNG";return "GỖ"}

function contractQuoteSidebar(){return `<aside class="contract-quote-side"><h3>HẠNG MỤC</h3>${contractItemSections.map(group=>`<button class="${activeContractGroup===group?"active":""}" data-contract-group="${group}">${group}</button>`).join("")}</aside>`}
function contractQuoteTable(){const source=contractQuoteSources.find(item=>item.id===activeContractQuote)||contractQuoteSources[0],items=source.items.filter(item=>activeContractGroup==="all"||contractItemSection(item)===activeContractGroup);return `<div class="contract-quote-main"><header><div><h3>Thông tin báo giá với CDT</h3><p>Hiển thị các đầu mục, khối lượng và giá trị báo giá gửi Chủ đầu tư.</p></div><div><button data-contract-check-all>Chọn tất cả</button><button class="green" data-contract-create-schedule>Cập nhật đầu mục báo giá</button></div></header><div class="contract-quote-tools"><input data-contract-item-search placeholder="Tìm thông tin báo giá..."><span>${items.length} đầu mục</span></div><table><thead><tr><th></th><th>Nhóm</th><th>Đầu mục báo giá</th><th>Mô tả / quy cách</th><th>Đơn vị</th><th>Khối lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>${items.map((item,index)=>`<tr><td><input type="checkbox" data-contract-item="${index}"></td><td><b>${item[0]}</b></td><td>${item[1]}</td><td>${item[2]}</td><td>${item[3]}</td><td>${item[4]}</td><td>${contractMoney(item[5])}</td><td>${contractMoney(Number(item[4])*Number(item[5]))}</td></tr>`).join("")}</tbody></table></div>`}
function contractQuoteManager(){return `<section class="contract-quotes">${contractQuoteSidebar()}${contractQuoteTable()}</section>`}
function contractOwnerView(){history.replaceState(null,"",`${location.pathname}?view=contract-owner`);document.querySelector("#project-app").innerHTML=`<section class="contract-owner-page">${contractEstimateFiles()}${contractOwnerFiles()}${contractExtraSection()}${contractSettlementFiles()}</section>`;bindContractOwner();loadContractFiles()}
function contractFileKindLabel(kind){return kind==="quote"?"Báo giá hợp đồng":kind==="estimate"?"Dự toán":kind==="drawing"?"Bản vẽ hợp đồng":kind==="settlement"?"Quyết toán":"Hợp đồng ký kết"}
async function loadContractFiles(){const lists=[...document.querySelectorAll("[data-contract-kind-list]")];if(!lists.length)return;try{const response=await fetch(`/api/v1/projects/${id}/contract-files`),body=await response.json();const render=(list)=>{const kinds=list.dataset.contractKindList.split(","),files=body.data.filter(file=>kinds.includes(file.kind)),empty=`Chưa có ${kinds.map(contractFileKindLabel).join(", ")} nào được lưu.`;list.innerHTML=files.length?files.map(file=>`<article><div><b>${contractFileKindLabel(file.kind)}</b><span>${contractEscape(file.name)}</span><small>${contractMoney(Math.ceil(file.size/1024))} KB</small></div><a href="/api/v1/projects/${id}/contract-files/download?storedName=${encodeURIComponent(file.storedName)}">Tải xuống</a><button data-contract-delete="${contractEscape(file.storedName)}">×</button></article>`).join(""):`<span>${empty}</span>`;list.querySelectorAll("[data-contract-delete]").forEach(button=>button.onclick=async()=>{await fetch(`/api/v1/projects/${id}/contract-files?storedName=${encodeURIComponent(button.dataset.contractDelete)}`,{method:"DELETE"});loadContractFiles()})};lists.forEach(render)}catch{lists.forEach(list=>list.innerHTML="<span>Không tải được danh sách hồ sơ.</span>")}}
async function uploadContractFiles(kind,files){for(const file of files){await fetch(`/api/v1/projects/${id}/contract-files?kind=${kind}&name=${encodeURIComponent(file.name)}`,{method:"POST",body:file})}loadContractFiles()}
function renderContractQuoteManager(){const current=document.querySelector(".contract-quotes");if(current){current.outerHTML=contractQuoteManager();bindContractQuoteManager()}}
function createScheduleFromQuote(){const selected=[...document.querySelectorAll("[data-contract-item]:checked")];if(!selected.length)return alert("Chọn ít nhất một đầu mục báo giá để cập nhật.");alert(`Đã cập nhật ${selected.length} đầu mục báo giá với CDT.`)}
function bindContractQuoteManager(){document.querySelectorAll("[data-contract-group]").forEach(button=>button.onclick=()=>{activeContractGroup=button.dataset.contractGroup;renderContractQuoteManager()});document.querySelector("[data-contract-check-all]")?.addEventListener("click",()=>document.querySelectorAll("[data-contract-item]").forEach(input=>input.checked=true));document.querySelector("[data-contract-create-schedule]")?.addEventListener("click",createScheduleFromQuote);document.querySelector("[data-contract-item-search]")?.addEventListener("input",event=>{const query=event.target.value.toLowerCase();document.querySelectorAll(".contract-quote-main tbody tr").forEach(row=>row.hidden=!row.innerText.toLowerCase().includes(query))})}
function bindContractOwner(){document.querySelector("[data-back-dashboard]")?.addEventListener("click",()=>{history.replaceState(null,"",location.pathname);render()});document.querySelectorAll("[data-contract-pick]").forEach(button=>button.onclick=()=>document.querySelector(`[data-contract-file="${button.dataset.contractPick}"]`).click());document.querySelectorAll("[data-contract-file]").forEach(input=>input.onchange=()=>uploadContractFiles(input.dataset.contractFile,[...input.files]));document.querySelectorAll("[data-contract-drop]").forEach(zone=>{zone.ondragover=event=>{event.preventDefault();zone.classList.add("dragging")};zone.ondragleave=()=>zone.classList.remove("dragging");zone.ondrop=event=>{event.preventDefault();zone.classList.remove("dragging");uploadContractFiles(zone.dataset.contractDrop,[...event.dataTransfer.files])}});bindContractQuoteManager()}

function showView(view){
  const requestedTab=new URLSearchParams(location.search).get("tab");
  const labels={gantt:"Bảng tiến độ",plan:"Kế hoạch thi công",diary:"Nhật ký thi công","contract-owner":"Hợp đồng nhận thầu","boq-owner":"Bảng khối lượng nhận thầu","month-owner":"Kế hoạch tháng","log-owner":"Nhật ký khối lượng","payment-owner":"Nghiệm thu, thanh toán","debt-owner":"Công nợ CDT theo DA","extra-owner":"Phát sinh hợp đồng nhận thầu","contract-vendor":"Hợp đồng giao thầu","boq-vendor":"Bảng khối lượng giao thầu","debt-vendor":"Công nợ nhà thầu theo DA","extra-vendor":"Phát sinh hợp đồng giao thầu",supplier:"Hóa đơn","material-plan":"Kế hoạch vật tư",warehouse:"Quản lý kho","material-slip":"Phiếu nhập kho","debt-supplier":"Công nợ NCC",rfi:"Yêu cầu Phát sinh của CDT",rfa:"Yêu cầu phê duyệt","owner-request":"Yêu cầu của CDT",issues:"Vấn đề sự cố","project-existing":"Hiện trạng","project-design-3d":"Hồ sơ thiết kế 3D","project-technical":"Hồ sơ kỹ thuật","project-design-construction":"Hồ sơ thiết kế thi công","project-technical-construction":"Hồ sơ kỹ thuật thi công","project-owner-request":"Hồ sơ phát sinh","project-other":"Khác",cash:"Quản lý thu chi",approval:"Đề xuất và phê duyệt"};
  history.replaceState(null,"",`${location.pathname}?view=${view}`);
  document.querySelector(".toolbar").style.display="";
  document.querySelector("#project-app").style.padding="";
  document.querySelectorAll("[data-view]").forEach(x=>x.classList.toggle("active",x.dataset.view===view));
  if(view==="warehouse")return warehouseView();
  if(view==="gantt")return ganttView();
  if(view==="diary")return diaryView(requestedTab||"month");
  if(view==="settings")return settingsView(requestedTab||"info");
  if(view==="contract-owner")return contractOwnerView();
  if(view==="contract-vendor")return contractVendorView();
  if(view==="debt-owner")return debtView("owner");
  if(view==="debt-vendor")return debtView("vendor");
  if(view==="debt-supplier")return debtView("supplier");
  if(view==="project-existing")return existingView();
  if(view==="project-design-3d")return design3dView();
  if(view==="project-technical")return technicalView();
  if(view==="project-design-construction")return dossierView("project-design-construction", "Hồ sơ thiết kế thi công", "design-construction");
  if(view==="project-technical-construction")return dossierView("project-technical-construction", "Hồ sơ kỹ thuật thi công", "technical-construction");
  if(view==="project-owner-request")return dossierView("project-owner-request", "Hồ sơ phát sinh", "owner-request");
  if(view==="project-other")return dossierView("project-other", "Khác", "other");
  const title=labels[view]||view;
  const rows=["Thi công phần móng","Xây tường tầng 1","Lắp đặt hệ thống điện","Hoàn thiện trần thạch cao","Kiểm tra vật tư nhập kho"].map((name,i)=>`<tr><td>${i+1}</td><td><a>${name}</a></td><td>HM-${String(i+1).padStart(3,"0")}</td><td>${i%2?"Đang thực hiện":"Kế hoạch"}</td><td>${i*18}%</td><td>${fmt((i+1)*12500000)}</td><td><button>⋮</button></td></tr>`).join("");
  document.querySelector("#project-app").innerHTML=`<section class="module-view box"><header><h2>${title}</h2><div><button data-add-module>+ Thêm mới</button><button data-import>↥ Nhập dữ liệu</button><button data-back-dashboard>← Tổng quan</button></div></header><div class="module-tools"><input placeholder="⌕ Tìm kiếm ${title.toLowerCase()}"><button>Lọc dữ liệu⌄</button><button>Tải lại</button></div><table class="module-table"><thead><tr><th>STT</th><th>Nội dung</th><th>Mã số</th><th>Trạng thái</th><th>Tiến độ</th><th>Giá trị</th><th></th></tr></thead><tbody>${rows}</tbody></table></section>`;
  document.querySelector("[data-back-dashboard]").onclick=()=>{history.replaceState(null,"",location.pathname);render()};
  document.querySelector("[data-import]").onclick=()=>importModal();
  document.querySelector("[data-add-module]").onclick=()=>alert(`Tạo mới ${title} sẽ được lưu trong dự án ${currentProject.name}.`);
}
document.querySelector("[data-reload]").onclick=()=>render();
document.querySelector("[data-utility]").onclick=()=>document.querySelector(".utility").classList.toggle("open");
document.querySelector("[data-export]").onclick=()=>{const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(`LE DOME Project,${document.querySelector("#crumb-name").innerText}`);a.download="ledome-project.csv";a.click()};
document.querySelector("[data-members]").onclick=()=>alert("Danh sách thành viên dự án sẽ được bổ sung.");
document.querySelectorAll("[data-group]").forEach(x=>x.onclick=()=>{
  x.nextElementSibling.classList.toggle("hidden");
  const hidden=x.nextElementSibling.classList.contains("hidden");
  x.classList.toggle("collapsed",hidden);
  const arrow=x.querySelector("i");
  if(arrow)arrow.innerText=hidden?"▸":"▾";
});
document.querySelectorAll("[data-view]").forEach(x=>x.onclick=()=>x.dataset.view==="dashboard"?render():showView(x.dataset.view));
document.querySelectorAll("[data-subgroup-toggle]").forEach(button=>button.onclick=()=>{const target=document.querySelector(`[data-subgroup="${button.dataset.subgroupToggle}"]`);target?.classList.toggle("collapsed");const collapsed=target?.classList.contains("collapsed");button.classList.toggle("collapsed",collapsed);const arrow=button.querySelector("i");if(arrow)arrow.innerText=collapsed?"▸":"▾"});
document.querySelector("[data-home]")?.addEventListener("click",()=>location.href="/#projects");
function technicalDropZone(kind,title,desc){return `<section class="existing-drop technical-drop" data-technical-drop="${kind}"><input type="file" hidden multiple data-technical-file="${kind}" accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.zip"><strong>${title}</strong><span>${desc}</span><button data-technical-pick="${kind}">Chọn từ máy</button></section>`}

function technicalView(){
  history.replaceState(null,"",`${location.pathname}?view=project-technical`);
  document.querySelector("#project-app").innerHTML=`<section class="existing-view technical-view"><header><div><h2>Hồ sơ kỹ thuật</h2><p>Quản lý Hồ sơ kỹ thuật chính và các bản bóc tách gói thầu phục vụ giao thầu.</p></div></header><div class="technical-layout design3d-layout"><section class="technical-panel design3d-panel technical-main-panel"><header><div><h3>Hồ sơ kỹ thuật</h3><p>Lưu trữ hồ sơ kỹ thuật chính của dự án.</p></div><button data-technical-pick="main">+ Tải lên HSKT</button></header>${technicalDropZone("main","Tải lên Hồ sơ kỹ thuật chính","Kéo thả file bản vẽ kỹ thuật CAD, PDF, Word hoặc Excel vào đây.")}<div class="existing-gallery design3d-gallery proposal-panel" data-technical-list="main"><div class="existing-empty">Đang tải hồ sơ chính...</div></div></section><section class="technical-panel design3d-panel technical-extract-panel"><header><div><h3>Bóc tách</h3><p>Tách tự động HSKT thành các hồ sơ con gửi nhà thầu.</p></div></header><div class="technical-extract-control" id="technical-extract-control"></div><div class="existing-gallery design3d-gallery" data-technical-list="child"><div class="existing-empty">Đang tải các hồ sơ bóc tách...</div></div></section></div></section>`;
  bindTechnicalView();
  loadTechnicalFiles();
}

function bindTechnicalView(){
  document.querySelectorAll("[data-technical-pick]").forEach(button=>button.onclick=()=>document.querySelector(`[data-technical-file="${button.dataset.technicalPick}"]`).click());
  document.querySelectorAll("[data-technical-file]").forEach(input=>input.onchange=e=>uploadTechnicalFiles(input.dataset.technicalFile,[...e.target.files]));
  document.querySelectorAll("[data-technical-drop]").forEach(drop=>{
    drop.ondragover=e=>{e.preventDefault();drop.classList.add("dragging")};
    drop.ondragleave=()=>drop.classList.remove("dragging");
    drop.ondrop=e=>{e.preventDefault();drop.classList.remove("dragging");uploadTechnicalFiles(drop.dataset.technicalDrop,[...e.dataTransfer.files])}
  });
}

async function loadTechnicalFiles(){
  const mainList=document.querySelector('[data-technical-list="main"]');
  const childList=document.querySelector('[data-technical-list="child"]');
  const control=document.querySelector("#technical-extract-control");
  if(!mainList||!childList)return;
  try{
    const body=await fetch(`/api/v1/projects/${id}/technical-files`).then(res=>res.json());
    const files=body.data||[];
    const mainFiles=files.filter(f=>f.kind==="main");
    const childFiles=files.filter(f=>f.kind==="child");
    
    mainList.innerHTML=mainFiles.length?mainFiles.map(technicalCard).join(""):'<div class="existing-empty">Chưa có Hồ sơ kỹ thuật chính. Kéo thả file để tải lên.</div>';
    childList.innerHTML=childFiles.length?childFiles.map(technicalCard).join(""):'<div class="existing-empty">Chưa có hồ sơ bóc tách. Bấm nút bóc tách ở trên để thực hiện.</div>';
    
    if(mainFiles.length===0){
      control.innerHTML=`<div class="technical-empty-notice">Vui lòng tải lên hồ sơ kỹ thuật chính ở ô bên trái để bóc tách.</div>`;
    }else{
      const firstMain=mainFiles[0];
      if(childFiles.length===0){
        control.innerHTML=`<div class="technical-action-box"><button class="technical-btn-extract animate-pulse" id="btn-start-extract">⚡ Bóc tách tự động HSKT</button><p>Hệ thống sẽ tự động phân tích và chia nhỏ file thành các gói thầu thi công con độc lập.</p></div>`;
        document.querySelector("#btn-start-extract").onclick=()=>extractTechnicalFile(firstMain.storedName);
      }else{
        control.innerHTML=`<div class="technical-action-box complete"><div class="technical-status-label"><span>Đã bóc tách thành công</span><b>${childFiles.length} gói thầu thi công con</b></div><button class="technical-btn-reextract" id="btn-re-extract">Bóc tách lại</button></div>`;
        document.querySelector("#btn-re-extract").onclick=()=>{
          if(confirm("Bạn có chắc chắn muốn thực hiện bóc tách lại? Các file con cũ sẽ bị ghi đè.")){
            extractTechnicalFile(firstMain.storedName);
          }
        };
      }
    }
    
    document.querySelectorAll("[data-technical-delete]").forEach(button=>button.onclick=async()=>{
      if(confirm(`Bạn có chắc chắn muốn xóa file này?`)){
        await fetch(`/api/v1/projects/${id}/technical-files?storedName=${encodeURIComponent(button.dataset.technicalDelete)}`,{method:"DELETE"});
        loadTechnicalFiles();
      }
    });
    
    document.querySelectorAll("[data-technical-send]").forEach(button=>button.onclick=()=>sendTechnicalToContractorModal(button.dataset.technicalSend));
    
    bindFileOpeners(document.querySelector(".technical-view")||document);
  }catch(err){
    mainList.innerHTML='<div class="existing-empty">Không tải được Hồ sơ chính.</div>';
    childList.innerHTML='<div class="existing-empty">Không tải được các hồ sơ con.</div>';
  }
}

async function uploadTechnicalFiles(kind,files){
  for(const file of files){
    await fetch(`/api/v1/projects/${id}/technical-files?kind=${kind}&name=${encodeURIComponent(file.name)}`,{method:"POST",body:file});
  }
  loadTechnicalFiles();
}

function technicalFileUrl(file){return `/api/v1/projects/${id}/technical-files/download?storedName=${encodeURIComponent(file.storedName)}`}

function technicalCard(file){
  const url=technicalFileUrl(file);
  const isImage=file.category==="image";
  const isPdf=/\.pdf$/i.test(file.name);
  const canOpen=isImage||isPdf;
  const openType=isPdf?"pdf":"image";
  const preview=isImage?`<img src="${url}" alt="${contractEscape(file.name)}">`:file.category==="video"?`<video src="${url}" muted controls></video>`:`<div class="existing-file-icon ${isPdf?"pdf":""}">${isPdf?"PDF":existingFileIcon(file)}</div>`;
  
  let sentBadge="";
  let sendButton="";
  
  if(file.kind==="child"){
    if(file.sent){
      const formattedDate=new Date(file.sent.sentAt).toLocaleString("vi-VN",{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'});
      sentBadge=`<div class="technical-sent-badge">✓ Đã gửi: <b>${contractEscape(file.sent.contractor)}</b> <small>(${formattedDate})</small></div>`;
      sendButton=`<button class="technical-send-button sent" data-technical-send="${contractEscape(file.storedName)}">Gửi lại NT</button>`;
    }else{
      sentBadge=`<div class="technical-sent-badge unsent">○ Chưa gửi nhà thầu</div>`;
      sendButton=`<button class="technical-send-button green" data-technical-send="${contractEscape(file.storedName)}">Gửi nhà thầu</button>`;
    }
  }
  
  return `<article class="existing-card design3d-card technical-card ${canOpen?"clickable":""}" data-existing-category="${file.category}" ${canOpen?`data-open-file="${url}" data-open-type="${openType}" data-open-title="${contractEscape(file.name)}"`:""}><div class="existing-preview ${canOpen?"clickable":""}">${preview}</div><div class="existing-meta"><b title="${contractEscape(file.name)}">${contractEscape(file.name)}</b><span>${existingFileIcon(file)} · ${contractMoney(Math.ceil(file.size/1024))} KB</span>${sentBadge}</div><footer><a href="${url}" download>Tải</a>${sendButton}<button data-technical-delete="${contractEscape(file.storedName)}">Xóa</button></footer></article>`;
}

function extractTechnicalFile(storedName){
  const control=document.querySelector("#technical-extract-control");
  const listContainer=document.querySelector('[data-technical-list="child"]');
  if(!control||!listContainer)return;
  listContainer.innerHTML='';
  
  const steps=[
    "Đang phân tích cấu trúc file Hồ sơ kỹ thuật chính...",
    "Nhận diện các trang bản vẽ và sơ đồ mặt bằng...",
    "Phân tách cấu trúc tệp thành các hạng mục thi công...",
    "Hoàn thành bóc tách! Đang khởi tạo các gói thầu..."
  ];
  
  control.innerHTML=`<div class="technical-progress-box"><h4>⚡ TIẾN TRÌNH BÓC TÁCH AI</h4><div class="technical-progress-bar-wrap"><div class="technical-progress-bar" style="width: 0%"></div></div><ul class="technical-progress-steps"><li class="active" id="step-0">○ ${steps[0]}</li><li id="step-1">○ ${steps[1]}</li><li id="step-2">○ ${steps[2]}</li><li id="step-3">○ ${steps[3]}</li></ul></div>`;
  const bar=control.querySelector(".technical-progress-bar");
  
  let currentStep=0;
  const interval=setInterval(async()=>{
    currentStep++;
    bar.style.width=`${currentStep*25}%`;
    const prev=control.querySelector(`#step-${currentStep-1}`);
    if(prev){
      prev.className="done";
      prev.innerHTML=`✓ ${steps[currentStep-1]}`;
    }
    const curr=control.querySelector(`#step-${currentStep}`);
    if(curr)curr.className="active";
    
    if(currentStep>=4){
      clearInterval(interval);
      try{
        const response=await fetch(`/api/v1/projects/${id}/technical-files/extract`,{
          method:"POST",
          headers:{"content-type":"application/json"},
          body:JSON.stringify({storedName})
        });
        if(response.ok)loadTechnicalFiles();
        else alert("Lỗi khi bóc tách tệp.");
      }catch(err){
        alert("Lỗi hệ thống khi bóc tách tệp.");
      }
    }
  },1000);
}

function sendTechnicalToContractorModal(storedName){
  const contractors=[
    "Công ty Xây dựng Hưng Thịnh (Nhà thầu phần thô)",
    "Cơ điện M&E Thành Công (Nhà thầu điện nước)",
    "Nội thất Minh Long (Nhà thầu gỗ nội thất)",
    "Hạ tầng Giao thông Việt (Nhà thầu cảnh quan & sân vườn)"
  ];
  const originalName=storedName.includes("__")?storedName.slice(storedName.indexOf("__")+2):storedName;
  document.body.insertAdjacentHTML("beforeend",`<div class="cash-modal technical-send-modal"><section><header><h2>Gửi hồ sơ kỹ thuật cho Nhà thầu</h2><button data-technical-send-close>×</button></header><div class="project-info-form"><label class="wide"><span>Hồ sơ gửi</span><input type="text" readonly value="${originalName}" style="font-weight:bold; color:#117f77;"></label><label class="wide"><span>Chọn nhà thầu nhận *</span><select name="contractor" id="send-contractor-select">${contractors.map(c=>`<option value="${contractEscape(c)}">${contractEscape(c)}</option>`).join("")}</select></label><label class="wide"><span>Lời nhắn kèm theo</span><textarea id="send-contractor-message" style="min-height:80px;">Gửi anh/chị hồ sơ kỹ thuật hạng mục ${originalName.split('_').pop().replace('.pdf','')} để xem xét và gửi báo giá thi công.</textarea></label></div><footer><button data-technical-send-close>Hủy bỏ</button><button id="send-contractor-confirm" class="green">Xác nhận gửi</button></footer></section></div>`);
  document.querySelectorAll("[data-technical-send-close]").forEach(btn=>btn.onclick=()=>document.querySelector(".technical-send-modal").remove());
  document.querySelector("#send-contractor-confirm").onclick=async()=>{
    const contractor=document.querySelector("#send-contractor-select").value;
    const response=await fetch(`/api/v1/projects/${id}/technical-files/send`,{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({storedName,contractor})
    });
    if(response.ok){
      document.querySelector(".technical-send-modal").remove();
      if(typeof ganttToast==="function")ganttToast(`Đã gửi hồ sơ thành công cho nhà thầu ${contractor}!`);
      else alert(`Đã gửi hồ sơ thành công cho nhà thầu ${contractor}!`);
      loadTechnicalFiles();
    }else{
      alert("Lỗi khi gửi hồ sơ.");
    }
  };
}

const initialView=new URLSearchParams(location.search).get("view");
loadDiaryReports().finally(()=>render().then(()=>{if(initialView)showView(initialView)}));


/* ==========================================================================
   GENERIC DOSSIER FUNCTIONS (DESIGN CONSTRUCTION, TECHNICAL CONSTRUCTION, OWNER REQUEST)
   ========================================================================== */

function dossierDropZone(kind,title,desc,apiType){
  return `<section class="existing-drop technical-drop" data-dossier-drop="${kind}" data-dossier-type="${apiType}"><input type="file" hidden multiple data-dossier-file="${kind}" accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.zip"><strong>${title}</strong><span>${desc}</span><button data-dossier-pick="${kind}">Chọn từ máy</button></section>`;
}

function dossierView(viewKey, dossierTitle, apiType){
  history.replaceState(null,"",`${location.pathname}?view=${viewKey}`);
  
  const hasExtract = (apiType !== "owner-request" && apiType !== "design-construction" && apiType !== "other");
  
  if (!hasExtract) {
    const importBtn = apiType === "design-construction" ? `<button class="btn-import-approved" id="btn-import-approved-3d" style="margin-right:8px; border:1px solid #168f87; color:#168f87; background:none; padding:7px 14px; border-radius:4px; cursor:pointer; font-weight:500; font-size:11px;">📥 Xuất từ GD Thiết kế</button>` : "";
    document.querySelector("#project-app").innerHTML=`<section class="existing-view technical-view"><header><div><h2>${dossierTitle}</h2><p>Quản lý ${dossierTitle} của dự án.</p></div></header><div class="technical-layout design3d-layout" style="grid-template-columns: 1fr;"><section class="technical-panel design3d-panel technical-main-panel"><header><div><h3>${dossierTitle}</h3><p>Lưu trữ ${dossierTitle.toLowerCase()} của dự án.</p></div><div>${importBtn}<button data-dossier-pick="main">+ Tải lên tệp</button></div></header>${dossierDropZone("main", `Tải lên ${dossierTitle}`, "Kéo thả file bản vẽ kỹ thuật CAD, PDF, Word hoặc Excel vào đây.", apiType)}<div class="existing-gallery design3d-gallery proposal-panel" data-dossier-list="main" data-dossier-type="${apiType}"><div class="existing-empty">Đang tải hồ sơ...</div></div></section></div></section>`;
  } else {
    document.querySelector("#project-app").innerHTML=`<section class="existing-view technical-view"><header><div><h2>${dossierTitle}</h2><p>Quản lý ${dossierTitle} chính và các bản bóc tách gói thầu phục vụ giao thầu.</p></div></header><div class="technical-layout design3d-layout"><section class="technical-panel design3d-panel technical-main-panel"><header><div><h3>${dossierTitle}</h3><p>Lưu trữ ${dossierTitle.toLowerCase()} chính của dự án.</p></div><button data-dossier-pick="main">+ Tải lên tệp</button></header>${dossierDropZone("main", `Tải lên ${dossierTitle} chính`, "Kéo thả file bản vẽ kỹ thuật CAD, PDF, Word hoặc Excel vào đây.", apiType)}<div class="existing-gallery design3d-gallery proposal-panel" data-dossier-list="main" data-dossier-type="${apiType}"><div class="existing-empty">Đang tải hồ sơ chính...</div></div></section><section class="technical-panel design3d-panel technical-extract-panel"><header><div><h3>Bóc tách</h3><p>Tách tự động tài liệu thành các hồ sơ con gửi nhà thầu.</p></div></header><div class="technical-extract-control" id="dossier-extract-control-${apiType}"></div><div class="existing-gallery design3d-gallery" data-dossier-list="child" data-dossier-type="${apiType}"><div class="existing-empty">Đang tải các hồ sơ bóc tách...</div></div></section></div></section>`;
  }
  
  bindDossierView(apiType);
  
  if (apiType === "design-construction") {
    const btnImport = document.querySelector("#btn-import-approved-3d");
    if (btnImport) {
      btnImport.onclick = async () => {
        try {
          const res = await fetch(`/api/v1/projects/${id}/dossiers/design-construction/import-approved-3d`, { method: "POST" });
          const body = await res.json();
          if (res.ok) {
            if (typeof ganttToast === "function") ganttToast("Đã xuất bản Hồ sơ thiết kế 3D được duyệt sang Hồ sơ thiết kế thi công thành công!");
            else alert("Đã xuất bản Hồ sơ thiết kế 3D được duyệt sang Hồ sơ thiết kế thi công thành công!");
            loadDossierFiles(apiType, dossierTitle);
          } else {
            alert(body.error || "Có lỗi xảy ra khi xuất hồ sơ.");
          }
        } catch (e) {
          alert("Lỗi kết nối máy chủ.");
        }
      };
    }
  }
  
  loadDossierFiles(apiType, dossierTitle);
}

function bindDossierView(apiType){
  const pickBtns = document.querySelectorAll(`[data-dossier-pick]`);
  pickBtns.forEach(button=>{
    button.onclick=()=>{
      const fileInput = button.closest('section, .technical-panel').querySelector(`[data-dossier-file]`);
      if(fileInput) fileInput.click();
      else {
        const kind = button.dataset.dossierPick;
        document.querySelector(`[data-dossier-file="${kind}"]`)?.click();
      }
    };
  });
  
  document.querySelectorAll("[data-dossier-file]").forEach(input=>input.onchange=e=>uploadDossierFiles(apiType, input.dataset.dossierFile, [...e.target.files]));
  document.querySelectorAll("[data-dossier-drop]").forEach(drop=>{
    drop.ondragover=e=>{e.preventDefault();drop.classList.add("dragging")};
    drop.ondragleave=()=>drop.classList.remove("dragging");
    drop.ondrop=e=>{e.preventDefault();drop.classList.remove("dragging");uploadDossierFiles(apiType, drop.dataset.dossierDrop, [...e.dataTransfer.files])}
  });
}

async function loadDossierFiles(apiType, dossierTitle){
  const mainList=document.querySelector(`[data-dossier-list="main"][data-dossier-type="${apiType}"]`);
  const childList=document.querySelector(`[data-dossier-list="child"][data-dossier-type="${apiType}"]`);
  const control=document.querySelector(`#dossier-extract-control-${apiType}`);
  if(!mainList)return;
  try{
    const body=await fetch(`/api/v1/projects/${id}/dossiers/${apiType}`).then(res=>res.json());
    const files=body.data||[];
    const mainFiles=files.filter(f=>f.kind==="main");
    
    mainList.innerHTML=mainFiles.length?mainFiles.map(f=>dossierCard(f, apiType)).join(""):'<div class="existing-empty">Chưa có tài liệu chính. Kéo thả file để tải lên.</div>';
    
    if (childList && control) {
      const childFiles=files.filter(f=>f.kind==="child");
      childList.innerHTML=childFiles.length?childFiles.map(f=>dossierCard(f, apiType)).join(""):'<div class="existing-empty">Chưa có hồ sơ bóc tách. Bấm nút bóc tách ở trên để thực hiện.</div>';
      
      if(mainFiles.length===0){
        control.innerHTML=`<div class="technical-empty-notice">Vui lòng tải lên tài liệu chính ở ô bên trái để bóc tách.</div>`;
      }else{
        const firstMain=mainFiles[0];
        if(childFiles.length===0){
          control.innerHTML=`<div class="technical-action-box"><button class="technical-btn-extract animate-pulse" id="btn-start-extract-${apiType}">⚡ Bóc tách tự động</button><p>Hệ thống sẽ tự động phân tích và chia nhỏ file thành các gói thầu thi công con độc lập.</p></div>`;
          document.querySelector(`#btn-start-extract-${apiType}`).onclick=()=>extractDossierFile(apiType, firstMain.storedName, dossierTitle);
        }else{
          control.innerHTML=`<div class="technical-action-box complete"><div class="technical-status-label"><span>Đã bóc tách thành công</span><b>${childFiles.length} gói thầu thi công con</b></div><button class="technical-btn-reextract" id="btn-re-extract-${apiType}">Bóc tách lại</button></div>`;
          document.querySelector(`#btn-re-extract-${apiType}`).onclick=()=>{
            if(confirm("Bạn có chắc chắn muốn thực hiện bóc tách lại? Các file con cũ sẽ bị ghi đè.")){
              extractDossierFile(apiType, firstMain.storedName, dossierTitle);
            }
          };
        }
      }
      
      childList.querySelectorAll("[data-dossier-delete], [data-technical-delete]").forEach(button=>{
        const storedName = button.dataset.dossierDelete || button.dataset.technicalDelete;
        button.onclick=async(e)=>{
          e.stopPropagation();
          if(confirm(`Bạn có chắc chắn muốn xóa file này?`)){
            await fetch(`/api/v1/projects/${id}/dossiers/${apiType}?storedName=${encodeURIComponent(storedName)}`,{method:"DELETE"});
            loadDossierFiles(apiType, dossierTitle);
          }
        };
      });
    }
    
    mainList.querySelectorAll("[data-dossier-delete], [data-technical-delete]").forEach(button=>{
      const storedName = button.dataset.dossierDelete || button.dataset.technicalDelete;
      button.onclick=async(e)=>{
        e.stopPropagation();
        if(confirm(`Bạn có chắc chắn muốn xóa file này?`)){
          await fetch(`/api/v1/projects/${id}/dossiers/${apiType}?storedName=${encodeURIComponent(storedName)}`,{method:"DELETE"});
          loadDossierFiles(apiType, dossierTitle);
        }
      };
    });
    
    document.querySelectorAll(`[data-dossier-send][data-dossier-type="${apiType}"]`).forEach(button=>button.onclick=()=>sendDossierToContractorModal(apiType, button.dataset.dossierSend, dossierTitle));
    
    bindFileOpeners(document.querySelector(".technical-view")||document);
  }catch(err){
    mainList.innerHTML='<div class="existing-empty">Không tải được tài liệu chính.</div>';
    if (childList) childList.innerHTML='<div class="existing-empty">Không tải được các hồ sơ con.</div>';
  }
}

async function uploadDossierFiles(apiType, kind, files){
  for(const file of files){
    await fetch(`/api/v1/projects/${id}/dossiers/${apiType}?kind=${kind}&name=${encodeURIComponent(file.name)}`,{method:"POST",body:file});
  }
  const viewMap = {
    "design-construction": "Hồ sơ thiết kế thi công",
    "technical-construction": "Hồ sơ kỹ thuật thi công",
    "owner-request": "Hồ sơ phát sinh",
    "other": "Khác"
  };
  loadDossierFiles(apiType, viewMap[apiType] || "Tài liệu");
}

function dossierFileUrl(apiType, file){return `/api/v1/projects/${id}/dossiers/${apiType}/download?storedName=${encodeURIComponent(file.storedName)}`}

function dossierCard(file, apiType){
  const url=dossierFileUrl(apiType, file);
  const isImage=file.category==="image";
  const isPdf=/\.pdf$/i.test(file.name);
  const canOpen=isImage||isPdf;
  const openType=isPdf?"pdf":"image";
  const preview=isImage?`<img src="${url}" alt="${contractEscape(file.name)}">`:file.category==="video"?`<video src="${url}" muted controls></video>`:`<div class="existing-file-icon ${isPdf?"pdf":""}">${isPdf?"PDF":existingFileIcon(file)}</div>`;
  
  let sentBadge="";
  let sendButton="";
  
  if(file.kind==="child"){
    if(file.sent){
      const formattedDate=new Date(file.sent.sentAt).toLocaleString("vi-VN",{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'});
      sentBadge=`<div class="technical-sent-badge">✓ Đã gửi: <b>${contractEscape(file.sent.contractor)}</b> <small>(${formattedDate})</small></div>`;
      sendButton=`<button class="technical-send-button sent" data-dossier-send="${contractEscape(file.storedName)}" data-dossier-type="${apiType}">Gửi lại NT</button>`;
    }else{
      sentBadge=`<div class="technical-sent-badge unsent">○ Chưa gửi nhà thầu</div>`;
      sendButton=`<button class="technical-send-button green" data-dossier-send="${contractEscape(file.storedName)}" data-dossier-type="${apiType}">Gửi nhà thầu</button>`;
    }
  }
  
  return `<article class="existing-card design3d-card technical-card ${canOpen?"clickable":""}" data-existing-category="${file.category}" ${canOpen?`data-open-file="${url}" data-open-type="${openType}" data-open-title="${contractEscape(file.name)}"`:""}><div class="existing-preview ${canOpen?"clickable":""}">${preview}</div><div class="existing-meta"><b title="${contractEscape(file.name)}">${contractEscape(file.name)}</b><span>${existingFileIcon(file)} · ${contractMoney(Math.ceil(file.size/1024))} KB</span>${sentBadge}</div><footer><a href="${url}" download>Tải</a>${sendButton}<button data-dossier-delete="${contractEscape(file.storedName)}">Xóa</button></footer></article>`;
}

function extractDossierFile(apiType, storedName, dossierTitle){
  const control=document.querySelector(`#dossier-extract-control-${apiType}`);
  const listContainer=document.querySelector(`[data-dossier-list="child"][data-dossier-type="${apiType}"]`);
  if(!control||!listContainer)return;
  listContainer.innerHTML='';
  
  const steps=[
    "Đang phân tích cấu trúc tài liệu chính...",
    "Nhận diện các phần và hạng mục trong bản vẽ...",
    "Phân tách cấu trúc tệp thành các hạng mục thi công...",
    "Hoàn thành bóc tách! Đang khởi tạo các gói thầu..."
  ];
  
  control.innerHTML=`<div class="technical-progress-box"><h4>⚡ TIẾN TRÌNH BÓC TÁCH AI</h4><div class="technical-progress-bar-wrap"><div class="technical-progress-bar" id="dossier-bar-${apiType}" style="width: 0%"></div></div><ul class="technical-progress-steps"><li class="active" id="dossier-step-0-${apiType}">○ ${steps[0]}</li><li id="dossier-step-1-${apiType}">○ ${steps[1]}</li><li id="dossier-step-2-${apiType}">○ ${steps[2]}</li><li id="dossier-step-3-${apiType}">○ ${steps[3]}</li></ul></div>`;
  const bar=control.querySelector(`#dossier-bar-${apiType}`);
  
  let currentStep=0;
  const interval=setInterval(async()=>{
    currentStep++;
    bar.style.width=`${currentStep*25}%`;
    const prev=control.querySelector(`#dossier-step-${currentStep-1}-${apiType}`);
    if(prev){
      prev.className="done";
      prev.innerHTML=`✓ ${steps[currentStep-1]}`;
    }
    const curr=control.querySelector(`#dossier-step-${currentStep}-${apiType}`);
    if(curr)curr.className="active";
    
    if(currentStep>=4){
      clearInterval(interval);
      try{
        const response=await fetch(`/api/v1/projects/${id}/dossiers/${apiType}/extract`,{
          method:"POST",
          headers:{"content-type":"application/json"},
          body:JSON.stringify({storedName})
        });
        if(response.ok)loadDossierFiles(apiType, dossierTitle);
        else alert("Lỗi khi bóc tách tệp.");
      }catch(err){
        alert("Lỗi hệ thống khi bóc tách tệp.");
      }
    }
  },1000);
}

function sendDossierToContractorModal(apiType, storedName, dossierTitle){
  const contractors=[
    "Công ty Xây dựng Hưng Thịnh (Nhà thầu phần thô)",
    "Cơ điện M&E Thành Công (Nhà thầu điện nước)",
    "Nội thất Minh Long (Nhà thầu gỗ nội thất)",
    "Hạ tầng Giao thông Việt (Nhà thầu cảnh quan & sân vườn)"
  ];
  const originalName=storedName.includes("__")?storedName.slice(storedName.indexOf("__")+2):storedName;
  document.body.insertAdjacentHTML("beforeend",`<div class="cash-modal technical-send-modal"><section><header><h2>Gửi hồ sơ kỹ thuật cho Nhà thầu</h2><button data-technical-send-close>×</button></header><div class="project-info-form"><label class="wide"><span>Hồ sơ gửi</span><input type="text" readonly value="${originalName}" style="font-weight:bold; color:#117f77;"></label><label class="wide"><span>Chọn nhà thầu nhận *</span><select name="contractor" id="send-contractor-select">${contractors.map(c=>`<option value="${contractEscape(c)}">${contractEscape(c)}</option>`).join("")}</select></label><label class="wide"><span>Lời nhắn kèm theo</span><textarea id="send-contractor-message" style="min-height:80px;">Gửi anh/chị hồ sơ kỹ thuật hạng mục ${originalName.split('_').pop().replace('.pdf','')} để xem xét và gửi báo giá thi công.</textarea></label></div><footer><button data-technical-send-close>Hủy bỏ</button><button id="send-contractor-confirm" class="green">Xác nhận gửi</button></footer></section></div>`);
  document.querySelectorAll("[data-technical-send-close]").forEach(btn=>btn.onclick=()=>document.querySelector(".technical-send-modal").remove());
  document.querySelector("#send-contractor-confirm").onclick=async()=>{
    const contractor=document.querySelector("#send-contractor-select").value;
    const response=await fetch(`/api/v1/projects/${id}/dossiers/${apiType}/send`,{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({storedName,contractor})
    });
    if(response.ok){
      document.querySelector(".technical-send-modal").remove();
      if(typeof ganttToast==="function")ganttToast(`Đã gửi hồ sơ thành công cho nhà thầu ${contractor}!`);
      else alert(`Đã gửi hồ sơ thành công cho nhà thầu ${contractor}!`);
      loadDossierFiles(apiType, dossierTitle);
    }else{
      alert("Lỗi khi gửi hồ sơ.");
    }
  };
}

/* ==========================================================================
   VENDOR CONTRACT FUNCTIONS (HỢP ĐỒNG GIAO THẦU)
   ========================================================================== */

function contractDropZoneVendor(kind,title,desc){
  const sheetKinds=["quote","estimate","settlement"];
  return `<section class="contract-drop" data-vendor-contract-drop="${kind}"><input type="file" hidden multiple data-vendor-contract-file="${kind}" accept="${sheetKinds.includes(kind)?".xlsx,.xls,.csv":".pdf,.doc,.docx,.xls,.xlsx,.dwg"}"><div><b>${title}</b><span>${desc}</span></div><button type="button" data-vendor-contract-pick="${kind}">Chọn file</button></section>`
}

function contractSignedFilesVendor(){
  return `<div class="contract-drop-grid">${contractDropZoneVendor("contract","Hợp đồng ký kết","PDF, Word hoặc Excel")}${contractDropZoneVendor("drawing","Hồ sơ bản vẽ hợp đồng","PDF, CAD, Word hoặc Excel")}</div><div class="contract-file-list" data-vendor-contract-kind-list="contract,drawing"><span>Đang tải hồ sơ hợp đồng...</span></div>`
}

function contractQuoteFilesVendor(){
  return `<div class="contract-drop-grid single">${contractDropZoneVendor("quote","Báo giá hợp đồng","Excel báo giá nhận từ nhà thầu")}</div><div class="contract-file-list" data-vendor-contract-kind-list="quote"><span>Đang tải báo giá hợp đồng...</span></div>`
}

function contractQuoteSidebarVendor(){
  return `<aside class="contract-quote-side"><h3>HẠNG MỤC</h3>${contractItemSections.map(group=>`<button class="${activeContractGroup===group?"active":""}" data-vendor-contract-group="${group}">${group}</button>`).join("")}</aside>`
}

function contractQuoteTableVendor(){
  const source=contractQuoteSources.find(item=>item.id===activeContractQuote)||contractQuoteSources[0];
  const items=source.items.filter(item=>activeContractGroup==="all"||contractItemSection(item)===activeContractGroup);
  return `<div class="contract-quote-main"><header><div><h3>Thông tin báo giá với Nhà thầu</h3><p>Hiển thị các đầu mục, khối lượng và giá trị báo giá nhận từ Nhà thầu.</p></div><div><button data-vendor-contract-check-all>Chọn tất cả</button><button class="green" data-vendor-contract-create-schedule>Cập nhật đầu mục báo giá</button></div></header><div class="contract-quote-tools"><input data-vendor-contract-item-search placeholder="Tìm thông tin báo giá..."><span>${items.length} đầu mục</span></div><table><thead><tr><th></th><th>Nhóm</th><th>Đầu mục báo giá</th><th>Mô tả / quy cách</th><th>Đơn vị</th><th>Khối lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>${items.map((item,index)=>`<tr><td><input type="checkbox" data-vendor-contract-item="${index}"></td><td><b>${item[0]}</b></td><td>${item[1]}</td><td>${item[2]}</td><td>${item[3]}</td><td>${item[4]}</td><td>${contractMoney(item[5])}</td><td>${contractMoney(Number(item[4])*Number(item[5]))}</td></tr>`).join("")}</tbody></table></div>`
}

function contractQuoteManagerVendor(){
  return `<section class="contract-quotes">${contractQuoteSidebarVendor()}${contractQuoteTableVendor()}</section>`
}

function contractExtraRowsVendor(){
  const rows=[
    ["PS-NT-001","Thay đổi chủng loại vật tư thạch cao","Chờ xác nhận","02/06/2026",15200000],
    ["PS-NT-002","Bổ dung ổ cắm và thiết bị điện phát sinh","Đang báo giá","31/05/2026",4500000],
    ["PS-NT-003","Sửa đổi thiết kế cánh tủ áo theo thực tế","Đã duyệt","28/05/2026",6800000]
  ];
  return `<table class="contract-extra-table"><thead><tr><th>Mã phát sinh</th><th>Nội dung phát sinh của Nhà thầu</th><th>Trạng thái</th><th>Ngày ghi nhận</th><th>Giá trị</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td>${contractMoney(row[4])}</td></tr>`).join("")}</tbody></table>`
}

function contractExtraSectionVendor(){
  return contractSection("Phát sinh","Danh sách phát sinh của Nhà thầu trong quá trình thi công.",`<div class="contract-extra-head"><button class="green">+ Thêm phát sinh</button><button>Xuất dữ liệu</button></div>${contractExtraRowsVendor()}`)
}

function contractSettlementFilesVendor(){
  return contractSection("Quyết toán","Lưu hồ sơ quyết toán, bảng tổng hợp và tài liệu chốt giá trị cuối với nhà thầu.",`<div class="contract-drop-grid single">${contractDropZoneVendor("settlement","Hồ sơ quyết toán","Excel, CSV, PDF hoặc Word")}</div><div class="contract-file-list" data-vendor-contract-kind-list="settlement"><span>Đang tải hồ sơ quyết toán...</span></div>`)
}

function contractVendorFiles(){
  return contractSection("Hợp đồng giao thầu","Quản lý hợp đồng ký kết, báo giá hợp đồng và hồ sơ bản vẽ hợp đồng.",`<div class="contract-subsection"><h4>Hợp đồng ký kết và hồ sơ bản vẽ hợp đồng</h4>${contractSignedFilesVendor()}</div><div class="contract-subsection quote-subsection"><h4>Báo giá hợp đồng</h4>${contractQuoteFilesVendor()}${contractQuoteManagerVendor()}</div>`)
}

function contractVendorView(){
  history.replaceState(null,"",`${location.pathname}?view=contract-vendor`);
  document.querySelector("#project-app").innerHTML=`<section class="contract-owner-page">${contractVendorFiles()}${contractExtraSectionVendor()}${contractSettlementFilesVendor()}</section>`;
  bindContractVendor();
  loadVendorContractFiles();
}

async function loadVendorContractFiles(){
  const lists=[...document.querySelectorAll("[data-vendor-contract-kind-list]")];
  if(!lists.length)return;
  try{
    const response=await fetch(`/api/v1/projects/${id}/vendor-contract-files`),
          body=await response.json();
    const render=(list)=>{
      const kinds=list.dataset.vendorContractKindList.split(","),
            files=body.data.filter(file=>kinds.includes(file.kind)),
            empty=`Chưa có ${kinds.map(contractFileKindLabel).join(", ")} nào được lưu.`;
      list.innerHTML=files.length?files.map(file=>`<article><div><b>${contractFileKindLabel(file.kind)}</b><span>${contractEscape(file.name)}</span><small>${contractMoney(Math.ceil(file.size/1024))} KB</small></div><a href="/api/v1/projects/${id}/vendor-contract-files/download?storedName=${encodeURIComponent(file.storedName)}">Tải xuống</a><button data-vendor-contract-delete="${contractEscape(file.storedName)}">×</button></article>`).join(""):`<span>${empty}</span>`;
      
      list.querySelectorAll("[data-vendor-contract-delete]").forEach(button=>button.onclick=async()=>{
        await fetch(`/api/v1/projects/${id}/vendor-contract-files?storedName=${encodeURIComponent(button.dataset.vendorContractDelete)}`,{method:"DELETE"});
        loadVendorContractFiles();
      });
    };
    lists.forEach(render);
  }catch{
    lists.forEach(list=>list.innerHTML="<span>Không tải được danh sách hồ sơ.</span>");
  }
}

async function uploadVendorContractFiles(kind,files){
  for(const file of files){
    await fetch(`/api/v1/projects/${id}/vendor-contract-files?kind=${kind}&name=${encodeURIComponent(file.name)}`,{method:"POST",body:file});
  }
  loadVendorContractFiles();
}

function bindContractQuoteManagerVendor(){
  document.querySelectorAll("[data-vendor-contract-group]").forEach(button=>button.onclick=()=>{
    activeContractGroup=button.dataset.vendorContractGroup;
    renderContractQuoteManagerVendor();
  });
  document.querySelector("[data-vendor-contract-check-all]")?.addEventListener("click",()=>document.querySelectorAll("[data-vendor-contract-item]").forEach(input=>input.checked=true));
  document.querySelector("[data-vendor-contract-create-schedule]")?.addEventListener("click",()=>{
    const selected=[...document.querySelectorAll("[data-vendor-contract-item]:checked")];
    if(!selected.length)return alert("Chọn ít nhất một đầu mục báo giá để cập nhật.");
    alert(`Đã cập nhật ${selected.length} đầu mục báo giá với Nhà thầu.`);
  });
  document.querySelector("[data-vendor-contract-item-search]")?.addEventListener("input",event=>{
    const query=event.target.value.toLowerCase();
    document.querySelectorAll(".contract-quote-main tbody tr").forEach(row=>row.hidden=!row.innerText.toLowerCase().includes(query));
  });
}

function renderContractQuoteManagerVendor(){
  const current=document.querySelector(".contract-quotes");
  if(current){
    current.outerHTML=contractQuoteManagerVendor();
    bindContractQuoteManagerVendor();
  }
}

function bindContractVendor(){
  document.querySelector("[data-back-dashboard]")?.addEventListener("click",()=>{
    history.replaceState(null,"",location.pathname);
    render();
  });
  document.querySelectorAll("[data-vendor-contract-pick]").forEach(button=>button.onclick=()=>document.querySelector(`[data-vendor-contract-file="${button.dataset.vendorContractPick}"]`).click());
  document.querySelectorAll("[data-vendor-contract-file]").forEach(input=>input.onchange=()=>uploadVendorContractFiles(input.dataset.vendorContractFile,[...input.files]));
  document.querySelectorAll("[data-vendor-contract-drop]").forEach(zone=>{
    zone.ondragover=event=>{
      event.preventDefault();
      zone.classList.add("dragging");
    };
    zone.ondragleave=()=>zone.classList.remove("dragging");
    zone.ondrop=event=>{
      event.preventDefault();
      zone.classList.remove("dragging");
      uploadVendorContractFiles(zone.dataset.vendorContractDrop,[...event.dataTransfer.files]);
    };
  });
  bindContractQuoteManagerVendor();
}

// ==========================================
// DEBT MANAGEMENT (CÔNG NỢ)
// ==========================================

function debtView(type){
  history.replaceState(null,"",`${location.pathname}?view=debt-${type}`);
  const titleText = type === "owner" 
    ? "Công nợ Chủ đầu tư theo DA" 
    : type === "vendor" 
      ? "Công nợ Nhà thầu theo DA" 
      : "Công nợ Nhà cung cấp";
  document.querySelector("#project-app").innerHTML=`
    <div class="debt-dashboard-container">
      <div class="debt-header-row">
        <div>
          <h2>${titleText}</h2>
          <p class="debt-subtitle">Theo dõi tình hình thanh toán, tạm ứng và công nợ chi tiết theo tiến độ hợp đồng.</p>
        </div>
        <div class="debt-header-actions">
          <button class="debt-btn green" id="btn-add-debt-phase">+ Thêm đợt thanh toán</button>
          <button class="debt-btn" id="btn-export-debt-csv">Xuất báo cáo (CSV)</button>
        </div>
      </div>
      
      <div class="debt-layout-grid">
        <div class="debt-main-content">
          <div class="debt-table-wrapper">
            <table class="debt-table">
              <thead>
                <tr>
                  <th style="width: 100px;">Lần thanh toán</th>
                  <th>Nội dung / Mô tả</th>
                  <th style="text-align: right; width: 140px;">Số tiền đề nghị</th>
                  <th style="width: 120px;">Ngày thanh toán</th>
                  <th style="width: 100px;">Trạng thái</th>
                  <th style="text-align: center; width: 120px;">Xác nhận</th>
                  <th>Chứng từ đính kèm</th>
                  <th style="width: 110px;">Thao tác</th>
                </tr>
              </thead>
              <tbody id="debt-table-body">
                <tr><td colspan="8" class="debt-loading">Đang tải dữ liệu công nợ...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="debt-side-panel" id="debt-summary-panel-container">
          <!-- Bảng tóm tắt công nợ được tải động tại đây -->
        </div>
      </div>
    </div>
  `;
  bindDebtView(type);
  loadDebtData(type);
}

let currentDebtData = [];

function renderDebtDashboard(type, data) {
  currentDebtData = data;
  const tbody = document.querySelector("#debt-table-body");
  if (!tbody) return;
  
  const isOwner = type === "owner";
  const isSupplier = type === "supplier";
  const contractVal = isOwner ? 10419962702 : (isSupplier ? 155924000 : 1429623737);
  const executedVal = isOwner ? 16385814818 : 958201030;
  const acceptedVal = isOwner ? 2779314400 : 252527868;
  const requestedVal = isOwner ? 2042461974 : (isSupplier ? 1900329517 : 258279892);
  const retentionVal = 0;
  const extraApproved = isOwner ? 12600000 : 6800000;
  const extraPending = isOwner ? 27700000 : 19700000;
  
  let totalCollected = 0;
  data.forEach(item => {
    if (item.status === "collected") {
      totalCollected += Number(item.amountCollected || item.amountRequested || 0);
    }
  });
  
  const balance = Math.max(0, requestedVal - totalCollected);
  
  const summaryContainer = document.querySelector("#debt-summary-panel-container");
  if (summaryContainer) {
    let summaryRowsHtml = "";
    let headerTitle = "";
    let dashedBorderColor = "";
    
    if (isSupplier) {
      headerTitle = "NHÀ CUNG CẤP";
      dashedBorderColor = "#fae5cc";
      summaryRowsHtml = `
        <div class="debt-summary-row">
          <span>Hợp đồng</span>
          <b>${fmt(contractVal)}</b>
        </div>
        <div class="debt-summary-row">
          <span>Đề nghị thanh toán</span>
          <b>${fmt(requestedVal)}</b>
        </div>
        <div class="debt-summary-row">
          <span>Trả thực tế</span>
          <b style="color: #2eab6b;">${fmt(totalCollected)}</b>
        </div>
        <div class="debt-summary-row balance-row" style="margin-top: 5px; border-top: 1px dashed ${dashedBorderColor}; padding-top: 10px;">
          <span>Còn nợ NCC</span>
          <b class="balance-val">${fmt(balance)}</b>
        </div>
      `;
    } else if (isOwner) {
      headerTitle = "CHỦ ĐẦU TƯ";
      dashedBorderColor = "#d0ebe7";
      summaryRowsHtml = `
        <div class="debt-summary-row">
          <span>Hợp đồng</span>
          <b>${fmt(contractVal)}</b>
        </div>
        <div class="debt-summary-row">
          <span>Phát sinh đã duyệt</span>
          <b style="color: #2da4ae;">+ ${fmt(extraApproved)}</b>
        </div>
        <div class="debt-summary-row">
          <span>Phát sinh chưa duyệt</span>
          <b style="color: #e57e25;">+ ${fmt(extraPending)}</b>
        </div>
        <div class="debt-summary-row">
          <span>Đã thực hiện</span>
          <b>${fmt(executedVal)}</b>
        </div>
        <div class="debt-summary-row">
          <span>Đã nghiệm thu</span>
          <b>${fmt(acceptedVal)}</b>
        </div>
        <div class="debt-summary-row">
          <span>Đề nghị thanh toán</span>
          <b>${fmt(requestedVal)}</b>
        </div>
        <div class="debt-summary-row">
          <span>Giá trị giữ lại</span>
          <b>${fmt(retentionVal)}</b>
        </div>
        <div class="debt-summary-row">
          <span>Thu thực tế</span>
          <b style="color: #2eab6b;">${fmt(totalCollected)}</b>
        </div>
        <div class="debt-summary-row balance-row" style="margin-top: 5px; border-top: 1px dashed ${dashedBorderColor}; padding-top: 10px;">
          <span>CDT còn nợ</span>
          <b class="balance-val">${fmt(balance)}</b>
        </div>
      `;
    } else {
      headerTitle = "NHÀ THẦU";
      dashedBorderColor = "#fbdada";
      summaryRowsHtml = `
        <div class="debt-summary-row">
          <span>Hợp đồng</span>
          <b>${fmt(contractVal)}</b>
        </div>
        <div class="debt-summary-row">
          <span>Đã thực hiện</span>
          <b>${fmt(executedVal)}</b>
        </div>
        <div class="debt-summary-row">
          <span>Đã nghiệm thu</span>
          <b>${fmt(acceptedVal)}</b>
        </div>
        <div class="debt-summary-row">
          <span>Đề nghị thanh toán</span>
          <b>${fmt(requestedVal)}</b>
        </div>
        <div class="debt-summary-row">
          <span>Giá trị giữ lại</span>
          <b>${fmt(retentionVal)}</b>
        </div>
        <div class="debt-summary-row">
          <span>Trả thực tế</span>
          <b style="color: #2eab6b;">${fmt(totalCollected)}</b>
        </div>
        <div class="debt-summary-row balance-row" style="margin-top: 5px; border-top: 1px dashed ${dashedBorderColor}; padding-top: 10px;">
          <span>Còn nợ NT</span>
          <b class="balance-val">${fmt(balance)}</b>
        </div>
      `;
    }
    
    summaryContainer.innerHTML = `
      <section class="debt-summary-panel ${type}">
        <h3>${headerTitle}</h3>
        <div class="debt-summary-rows">
          ${summaryRowsHtml}
        </div>
      </section>
    `;
  }
  
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="debt-empty">Chưa có đợt thanh toán nào được ghi nhận. Bấm "+ Thêm đợt thanh toán" để bắt đầu.</td></tr>`;
  } else {
    tbody.innerHTML = data.map((item, index) => {
      const isLocked = item.status === "collected";
      const phaseLabel = `Lần ${index + 1}`;
      const formattedRequested = fmt(item.amountRequested) + " ₫";
      const statusLabel = item.status === "collected" 
        ? `<span class="debt-badge green">${isOwner ? "Đã thu" : "Đã trả"}</span>` 
        : item.status === "overdue" 
          ? '<span class="debt-badge red">Quá hạn</span>' 
          : '<span class="debt-badge blue">Chờ duyệt</span>';
      
      let confirmBtnHtml = "";
      if (isLocked) {
        confirmBtnHtml = `<button class="debt-confirm-btn locked" disabled>✓ ${isOwner ? "Đã nhận" : "Đã trả"}</button>`;
      } else {
        confirmBtnHtml = `<button class="debt-confirm-btn active" data-debt-confirm="${item.id}">Xác nhận</button>`;
      }
      
      let docHtml = "";
      if (item.invoiceFile) {
        const cleanName = item.invoiceFile.includes("__") ? item.invoiceFile.slice(item.invoiceFile.indexOf("__") + 2) : item.invoiceFile;
        docHtml = `
          <div class="debt-attached-file">
            <a href="/api/v1/projects/${id}/debts/${type}/download?file=${encodeURIComponent(item.invoiceFile)}" target="_blank" title="${cleanName}">📄 ${cleanName}</a>
            ${isLocked ? "" : `<button class="debt-file-remove" data-debt-file-clear="${item.id}" title="Xóa đính kèm">×</button>`}
          </div>
        `;
      } else {
        if (isLocked) {
          docHtml = `<span style="color: #b0babc; font-style: italic;">Không có chứng từ</span>`;
        } else {
          docHtml = `
            <div class="debt-file-upload-cell">
              <input type="file" hidden data-debt-file-input="${item.id}">
              <button class="debt-upload-btn" data-debt-file-pick="${item.id}">↥ Tải lên</button>
            </div>
          `;
        }
      }
      
      let actionsHtml = "";
      if (isLocked) {
        actionsHtml = `<span style="color: #718a90; font-style: italic; font-size: 11px;">🔒 Đã nhận (Khóa)</span>`;
      } else {
        actionsHtml = `
          <div class="debt-actions">
            <button class="debt-action-edit" data-debt-edit="${item.id}">Sửa</button>
            <button class="debt-action-delete" data-debt-delete="${item.id}">Xóa</button>
          </div>
        `;
      }
      
      const descText = item.description 
        ? `<br><small style="color: #718a90; font-size: 10px; font-weight: normal;">${contractEscape(item.description)}</small>` 
        : "";
      
      return `
        <tr class="${isLocked ? "locked-row" : ""}">
          <td style="font-weight: bold; color: #168f87;">${phaseLabel}</td>
          <td>
            <b>${contractEscape(item.phase)}</b>
            ${descText}
          </td>
          <td class="num" style="text-align: right;">${formattedRequested}</td>
          <td>${isLocked ? (item.dateCollected || "-") : (item.dateRequested || "-")}</td>
          <td>${statusLabel}</td>
          <td style="text-align: center;">${confirmBtnHtml}</td>
          <td>${docHtml}</td>
          <td>${actionsHtml}</td>
        </tr>
      `;
    }).join("");
  }
  
  bindDebtTableActions(type);
}

function bindDebtTableActions(type) {
  document.querySelectorAll("[data-debt-confirm]").forEach(btn => {
    btn.onclick = () => {
      const item = currentDebtData.find(x => x.id === btn.dataset.debtConfirm);
      if (item) showConfirmPaymentModal(type, item);
    };
  });

  document.querySelectorAll("[data-debt-edit]").forEach(btn => {
    btn.onclick = () => {
      const item = currentDebtData.find(x => x.id === btn.dataset.debtEdit);
      if (item) showAddDebtPhaseModal(type, item);
    };
  });
  
  document.querySelectorAll("[data-debt-delete]").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("Bạn có chắc chắn muốn xóa đợt thanh toán này?")) return;
      try {
        const response = await fetch(`/api/v1/projects/${id}/debts/${type}/${btn.dataset.debtDelete}`, {
          method: "DELETE"
        });
        if (response.ok) {
          loadDebtData(type);
        } else {
          alert("Lỗi khi xóa đợt thanh toán.");
        }
      } catch {
        alert("Không kết nối được tới server.");
      }
    };
  });
  
  document.querySelectorAll("[data-debt-file-pick]").forEach(btn => {
    btn.onclick = () => {
      const input = document.querySelector(`input[data-debt-file-input="${btn.dataset.debtFilePick}"]`);
      input?.click();
    };
  });
  
  document.querySelectorAll("input[data-debt-file-input]").forEach(input => {
    input.onchange = async () => {
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];
      const phaseId = input.dataset.debtFileInput;
      
      const btn = document.querySelector(`button[data-debt-file-pick="${phaseId}"]`);
      if (btn) btn.textContent = "Đang tải...";
      
      try {
        const response = await fetch(`/api/v1/projects/${id}/debts/${type}/${phaseId}/upload?name=${encodeURIComponent(file.name)}`, {
          method: "POST",
          body: file
        });
        if (response.ok) {
          loadDebtData(type);
        } else {
          alert("Lỗi khi tải chứng từ lên.");
          loadDebtData(type);
        }
      } catch {
        alert("Lỗi kết nối mạng.");
        loadDebtData(type);
      }
    };
  });
  
  document.querySelectorAll("[data-debt-file-clear]").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("Xóa chứng từ đính kèm của đợt thanh toán này?")) return;
      const phaseId = btn.dataset.debtFileClear;
      const item = currentDebtData.find(x => x.id === phaseId);
      if (!item) return;
      
      const updatedItem = { ...item, invoiceFile: "" };
      try {
        const response = await fetch(`/api/v1/projects/${id}/debts/${type}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(updatedItem)
        });
        if (response.ok) {
          loadDebtData(type);
        } else {
          alert("Lỗi khi xóa đính kèm.");
        }
      } catch {
        alert("Lỗi kết nối mạng.");
      }
    };
  });
}

function bindDebtView(type) {
  document.querySelector("#btn-add-debt-phase").onclick = () => showAddDebtPhaseModal(type);
  document.querySelector("#btn-export-debt-csv").onclick = () => exportDebtCSV(type, currentDebtData);
}

async function loadDebtData(type) {
  const tbody = document.querySelector("#debt-table-body");
  if (!tbody) return;
  try {
    const response = await fetch(`/api/v1/projects/${id}/debts/${type}`);
    if (response.ok) {
      const body = await response.json();
      renderDebtDashboard(type, body.data || []);
    } else {
      tbody.innerHTML = `<tr><td colspan="8" class="debt-error">Không tải được dữ liệu từ server.</td></tr>`;
    }
  } catch {
    tbody.innerHTML = `<tr><td colspan="8" class="debt-error">Lỗi kết nối tới server.</td></tr>`;
  }
}

function showAddDebtPhaseModal(type, item = null) {
  const isEdit = !!item;
  const title = isEdit ? "Sửa đợt thanh toán" : "Thêm đợt thanh toán";
  const html = `
    <div class="debt-modal cash-modal">
      <section style="max-width: 500px; padding: 20px;">
        <header>
          <h2>${title}</h2>
          <button data-dismiss>×</button>
        </header>
        <form id="debt-phase-form" style="display: flex; flex-direction: column; gap: 12px; margin-top: 15px;">
          <input type="hidden" name="id" value="${item ? item.id : ""}">
          <label style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 11px; font-weight: bold; color: #52676d;">Tên đợt / Hạng mục *</span>
            <input type="text" name="phase" required placeholder="Ví dụ: Tạm ứng đợt 2" value="${item ? item.phase : ""}" style="padding: 8px; border: 1px solid #cce0e3; border-radius: 4px;">
          </label>
          <label style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 11px; font-weight: bold; color: #52676d;">Mô tả chi tiết</span>
            <textarea name="description" placeholder="Mô tả nội dung thanh toán..." style="width:100%;height:60px;padding:8px;border:1px solid #cce0e3;border-radius:4px;box-sizing:border-box;">${item ? item.description : ""}</textarea>
          </label>
          <label style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 11px; font-weight: bold; color: #52676d;">Số tiền đề nghị thanh toán *</span>
            <input type="number" name="amountRequested" required placeholder="Nhập số tiền..." value="${item ? item.amountRequested : ""}" style="padding: 8px; border: 1px solid #cce0e3; border-radius: 4px;">
          </label>
          <label style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 11px; font-weight: bold; color: #52676d;">Ngày đề nghị *</span>
            <input type="text" data-popup-date name="dateRequested" required readonly placeholder="Chọn ngày..." value="${item ? item.dateRequested : ""}" style="padding: 8px; border: 1px solid #cce0e3; border-radius: 4px; background: #fff; cursor: pointer;">
          </label>
          
          <label style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 11px; font-weight: bold; color: #52676d;">Trạng thái thanh toán</span>
            <select name="status" style="padding: 8px; border: 1px solid #cce0e3; border-radius: 4px;">
              <option value="pending" ${item && item.status === "pending" ? "selected" : ""}>Chờ duyệt / Đang đề nghị</option>
              <option value="collected" ${item && item.status === "collected" ? "selected" : ""}>Đã giải ngân / Đã thu</option>
              <option value="overdue" ${item && item.status === "overdue" ? "selected" : ""}>Quá hạn thanh toán</option>
            </select>
          </label>
          
          <div class="collected-only-fields" style="display: ${item && item.status === "collected" ? "flex" : "none"}; flex-direction: column; gap: 12px;">
            <label style="display: flex; flex-direction: column; gap: 4px; margin-top: 10px;">
              <span style="font-size: 11px; font-weight: bold; color: #52676d;">Số tiền thực tế đã giải ngân</span>
              <input type="number" name="amountCollected" placeholder="Nhập số tiền..." value="${item ? item.amountCollected : ""}" style="padding: 8px; border: 1px solid #cce0e3; border-radius: 4px;">
            </label>
            <label style="display: flex; flex-direction: column; gap: 4px; margin-top: 10px;">
              <span style="font-size: 11px; font-weight: bold; color: #52676d;">Ngày giải ngân thực tế</span>
              <input type="text" data-popup-date name="dateCollected" readonly placeholder="Chọn ngày..." value="${item ? item.dateCollected : ""}" style="padding: 8px; border: 1px solid #cce0e3; border-radius: 4px; background: #fff; cursor: pointer;">
            </label>
          </div>
        </form>
        <footer style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;">
          <button data-dismiss type="button" style="padding: 8px 16px; border: 1px solid #cce0e3; background: #fff; border-radius: 4px; cursor: pointer;">Hủy bỏ</button>
          <button id="btn-save-debt-phase" type="button" class="green" style="padding: 8px 16px; border: 0; background: #168f87; color: #fff; border-radius: 4px; cursor: pointer; font-weight: bold;">Lưu lại</button>
        </footer>
      </section>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", html);
  bindPopupDateFields(document.querySelector(".debt-modal"));
  
  const modal = document.querySelector(".debt-modal");
  modal.querySelectorAll("[data-dismiss]").forEach(x => x.onclick = () => modal.remove());
  
  const statusSelect = modal.querySelector('select[name="status"]');
  const collectedFields = modal.querySelector('.collected-only-fields');
  statusSelect.onchange = () => {
    collectedFields.style.display = statusSelect.value === "collected" ? "flex" : "none";
  };
  
  modal.querySelector("#btn-save-debt-phase").onclick = async () => {
    const form = modal.querySelector("#debt-phase-form");
    if (!form.reportValidity()) return;
    
    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => data[key] = value);
    
    if (data.status !== "collected") {
      data.amountCollected = 0;
      data.dateCollected = "";
    } else {
      data.amountCollected = Number(data.amountCollected || data.amountRequested || 0);
      if (!data.dateCollected) {
        data.dateCollected = new Date().toISOString().split("T")[0];
      }
    }
    
    try {
      const response = await fetch(`/api/v1/projects/${id}/debts/${type}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data)
      });
      if (response.ok) {
        modal.remove();
        loadDebtData(type);
      } else {
        alert("Lỗi khi lưu thông tin đợt thanh toán.");
      }
    } catch {
      alert("Không kết nối được tới server.");
    }
  };
}

function showConfirmPaymentModal(type, item) {
  const isOwner = type === "owner";
  const actionText = isOwner ? "Đã nhận" : "Đã trả";
  const labelText = isOwner ? "ghi nhận thu tiền" : "ghi nhận thanh toán";
  const html = `
    <div class="debt-modal cash-modal confirm-payment-modal">
      <section style="max-width: 400px; padding: 20px;">
        <header>
          <h2>Xác nhận ${actionText}</h2>
          <button data-dismiss>×</button>
        </header>
        <div style="margin-top: 15px; font-size: 13px; color: #31535c; line-height: 1.5;">
          Bạn đang thực hiện ${labelText} cho <b>${contractEscape(item.phase)}</b> với số tiền <b>${fmt(item.amountRequested)} ₫</b>.
        </div>
        <form id="confirm-payment-form" style="margin-top: 15px; display: flex; flex-direction: column; gap: 12px;">
          <label style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 11px; font-weight: bold; color: #52676d;">Ngày thanh toán thực tế *</span>
            <input type="text" data-popup-date name="dateCollected" required readonly value="${new Date().toISOString().split("T")[0]}" style="padding: 8px; border: 1px solid #cce0e3; border-radius: 4px; background: #fff; cursor: pointer;">
          </label>
          <label style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 11px; font-weight: bold; color: #52676d;">Số tiền thực tế *</span>
            <input type="number" name="amountCollected" required value="${item.amountRequested}" style="padding: 8px; border: 1px solid #cce0e3; border-radius: 4px;">
          </label>
        </form>
        <footer style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;">
          <button data-dismiss type="button" style="padding: 8px 16px; border: 1px solid #cce0e3; background: #fff; border-radius: 4px; cursor: pointer;">Hủy</button>
          <button id="btn-submit-confirm-payment" type="button" class="green" style="padding: 8px 16px; border: 0; background: #168f87; color: #fff; border-radius: 4px; cursor: pointer; font-weight: bold;">Xác nhận</button>
        </footer>
      </section>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", html);
  bindPopupDateFields(document.querySelector(".confirm-payment-modal"));
  
  const modal = document.querySelector(".confirm-payment-modal");
  modal.querySelectorAll("[data-dismiss]").forEach(x => x.onclick = () => modal.remove());
  
  modal.querySelector("#btn-submit-confirm-payment").onclick = async () => {
    const form = modal.querySelector("#confirm-payment-form");
    if (!form.reportValidity()) return;
    
    const dateCollected = form.querySelector('[name="dateCollected"]').value;
    const amountCollected = Number(form.querySelector('[name="amountCollected"]').value || item.amountRequested);
    
    const updatedItem = {
      ...item,
      status: "collected",
      dateCollected,
      amountCollected
    };
    
    try {
      const response = await fetch(`/api/v1/projects/${id}/debts/${type}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updatedItem)
      });
      if (response.ok) {
        modal.remove();
        loadDebtData(type);
      } else {
        alert("Lỗi khi ghi nhận thanh toán.");
      }
    } catch {
      alert("Lỗi kết nối mạng.");
    }
  };
}

function exportDebtCSV(type, data) {
  const headers = ["Dot thanh toan", "Ten dot", "Mo ta", "So tien de nghi", "Ngay thanh toan", "Trang thai"];
  const rows = data.map((item, index) => [
    `Lan ${index + 1}`,
    item.phase,
    item.description,
    item.amountRequested,
    item.dateCollected || item.dateRequested || "-",
    item.status === "collected" ? "Da thanh toan" : item.status === "overdue" ? "Qua han" : "Cho duyet"
  ]);
  
  const csvContent = [headers.join(","), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `cong-no-${type}-${id}.csv`;
  a.click();
}
