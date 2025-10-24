const tabs = document.querySelectorAll(".nav-link[data-tab]");
const sections = document.querySelectorAll(".tab");
tabs.forEach(btn => btn.addEventListener("click", () => {
  tabs.forEach(b => b.classList.remove("active"));
  sections.forEach(s => s.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById(btn.dataset.tab).classList.add("active");
}));

function toast(msg){const el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),1800);}

let allApps = [];
let rejectedApps = [];

async function fetchStats(){
  const res = await fetch("/api/stats",{credentials:"include"});
  if(!res.ok) return;
  const s = await res.json();
  document.getElementById("stat-total").textContent = s.total ?? 0;
  document.getElementById("stat-pending").textContent = s.pending ?? 0;
  document.getElementById("stat-approved").textContent = s.approved ?? 0;
  document.getElementById("stat-thisMonth").textContent = s.thisMonth ?? 0;
  renderCharts(s);
}

async function fetchApps(){
  const res = await fetch("/api/applications",{credentials:"include"});
  if(!res.ok) return;
  const data = await res.json();
  allApps = data.filter(a => (a.status || "pending") !== "rejected");
  rejectedApps = data.filter(a => a.status === "rejected");
  renderActive();
  renderRejected();
}

function renderActive(){
  const tbody = document.getElementById("apps-body");
  tbody.innerHTML = "";
  allApps.forEach(a => {
    const tr = document.createElement("tr");
    const name = [a.firstName, a.lastName].filter(Boolean).join(" ") || a.name || "—";
    tr.innerHTML = `
      <td>${a.id}</td>
      <td>${name}</td>
      <td>${a.email || ""}</td>
      <td>${a.status || "pending"}</td>
      <td>${a.submittedAt ? new Date(a.submittedAt).toLocaleString() : ""}</td>
      <td>
        <button class="btn ok" data-act="approve" data-id="${a.id}">Approve</button>
        <button class="btn warn" data-act="reject" data-id="${a.id}">Reject</button>
        <button class="btn secondary" data-act="pdf" data-id="${a.id}">Download Application</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function renderRejected(){
  const tbody = document.getElementById("rejected-body");
  tbody.innerHTML = "";
  rejectedApps.forEach(a => {
    const tr = document.createElement("tr");
    const name = [a.firstName, a.lastName].filter(Boolean).join(" ") || a.name || "—";
    tr.innerHTML = `
      <td>${a.id}</td>
      <td>${name}</td>
      <td>${a.email || ""}</td>
      <td>rejected</td>
      <td>${a.submittedAt ? new Date(a.submittedAt).toLocaleString() : ""}</td>
      <td>
        <button class="btn ghost" data-act="restore" data-id="${a.id}">Restore</button>
        <button class="btn secondary" data-act="pdf" data-id="${a.id}">Download Application</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if(!btn) return;
  const id = btn.dataset.id;
  const act = btn.dataset.act;

  if(act === "pdf"){
    try{
      const res = await fetch(`/api/applications/${id}/pdf`,{credentials:"include"});
      if(!res.ok) throw new Error("not found");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${id}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast("Downloading PDF…");
    }catch{
      toast("PDF not found");
    }
    return;
  }

  if(act === "approve"){
    const i = allApps.findIndex(x => x.id === id);
    if(i >= 0){ allApps[i].status = "approved"; renderActive(); toast("✅ Application approved"); }
  }else if(act === "reject"){
    const i = allApps.findIndex(x => x.id === id);
    if(i >= 0){ const app = allApps.splice(i,1)[0]; app.status="rejected"; rejectedApps.unshift(app); renderActive(); renderRejected(); toast("🚫 Application rejected"); }
  }else if(act === "restore"){
    const i = rejectedApps.findIndex(x => x.id === id);
    if(i >= 0){ const app = rejectedApps.splice(i,1)[0]; app.status="pending"; allApps.unshift(app); renderActive(); renderRejected(); toast("↩️ Application restored"); }
  }
});

let barChart, pieChart;
function renderCharts(s){
  const total = s.total ?? 0;
  const approved = s.approved ?? 0;
  const pending = s.pending ?? Math.max(total - approved, 0);
  const rejected = s.rejected ?? 0;

  const bctx = document.getElementById("barChart");
  const pctx = document.getElementById("pieChart");

  if(barChart) barChart.destroy();
  if(pieChart) pieChart.destroy();

  barChart = new Chart(bctx, {
    type:"bar",
    data:{ labels:["Total","Approved","Pending","Rejected"],
      datasets:[{ label:"Applications", data:[total,approved,pending,rejected] }]},
    options:{ responsive:true, maintainAspectRatio:false }
  });

  pieChart = new Chart(pctx, {
    type:"doughnut",
    data:{ labels:["Approved","Pending","Rejected"], datasets:[{ data:[approved,pending,rejected] }]},
    options:{ responsive:true, maintainAspectRatio:false, cutout:"60%" }
  });
}

(async function init(){
  document.querySelector('.nav-link[data-tab="dashboard"]').click();
  await fetchStats();
  await fetchApps();
  setInterval(fetchStats, 20000);
  setInterval(fetchApps, 25000);
})();