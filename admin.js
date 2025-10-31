// === ALSAQQAF LOGISTICS LLC ADMIN PANEL ===
// Connected to https://driver-app-server-k13h.onrender.com

const API_BASE = "https://driver-app-server-k13h.onrender.com/api";
const tabs = document.querySelectorAll(".tab-btn");
const sections = document.querySelectorAll(".tab-content");

// === TAB SWITCHING ===
tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    tabs.forEach(b => b.classList.remove("active"));
    sections.forEach(s => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// === FETCH APPLICATIONS ===
async function fetchApplications() {
  const res = await fetch(`${API_BASE}/applications`);
  const data = await res.json();
  populateTables(data);
  updateDashboard(data);
}

function updateDashboard(apps) {
  const total = apps.length;
  const pending = apps.filter(a => a.status === "pending").length;
  const approved = apps.filter(a => a.status === "approved").length;
  const active = apps.filter(a => a.status === "approved").length;

  document.querySelector("#dashboard .cards .card:nth-child(1) h3").textContent = total;
  document.querySelector("#dashboard .cards .card:nth-child(2) h3").textContent = pending;
  document.querySelector("#dashboard .cards .card:nth-child(3) h3").textContent = approved;
  document.querySelector("#dashboard .cards .card:nth-child(4) h3").textContent = active;

  const recent = apps.slice(-5).reverse();
  const tbody = document.getElementById("recent-apps");
  tbody.innerHTML = "";
  recent.forEach(a => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${new Date(a.submittedAt).toLocaleDateString()}</td>
      <td>${a.name || a.fullName || `${a.firstName || ""} ${a.lastName || ""}`}</td>
      <td>${a.email}</td>
      <td>${a.status}</td>
      <td><button class="view-btn" data-id="${a.id}">View</button></td>
    `;
    tbody.appendChild(row);
  });
}

// === POPULATE TABLES ===
function populateTables(apps) {
  const appsBody = document.getElementById("apps-table");
  appsBody.innerHTML = "";

  apps.forEach(a => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${a.id}</td>
      <td>${new Date(a.submittedAt).toLocaleDateString()}</td>
      <td>${a.name || a.fullName || `${a.firstName || ""} ${a.lastName || ""}`}</td>
      <td>${a.email}</td>
      <td>${a.phone || "—"}</td>
      <td>${a.cdlClass || "—"}</td>
      <td>${a.yearsExperience || "—"}</td>
      <td>${a.status}</td>
      <td>
        <button class="outline-btn view" data-id="${a.id}">View</button>
        ${a.status === "pending" ? `
          <button class="outline-btn approve" data-id="${a.id}">Approve</button>
          <button class="outline-btn reject" data-id="${a.id}">Reject</button>
        ` : ""}
        ${a.status === "rejected" ? `
          <button class="outline-btn restore" data-id="${a.id}">Restore</button>
        ` : ""}
      </td>
    `;
    appsBody.appendChild(row);
  });
}

// === DOWNLOAD APPLICATION AS PDF ===
async function downloadApplication(id) {
  const link = document.createElement("a");
  link.href = `${API_BASE}/applications/${id}/pdf`;
  link.download = `application-${id}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// === ACTION HANDLERS ===
document.body.addEventListener("click", async e => {
  if (e.target.classList.contains("approve")) {
    const id = e.target.dataset.id;
    await updateStatus(id, "approved");
    fetchApplications();
  }
  if (e.target.classList.contains("reject")) {
    const id = e.target.dataset.id;
    await updateStatus(id, "rejected");
    fetchApplications();
  }
  if (e.target.classList.contains("restore")) {
    const id = e.target.dataset.id;
    await updateStatus(id, "pending");
    fetchApplications();
  }
  if (e.target.classList.contains("view")) {
    const id = e.target.dataset.id;
    downloadApplication(id);
  }
});

// === UPDATE STATUS API ===
async function updateStatus(id, status) {
  const res = await fetch(`${API_BASE}/applications`);
  const apps = await res.json();
  const updated = apps.map(a => a.id === id ? { ...a, status } : a);
  await fetch(`${API_BASE}/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updated)
  });
}

// === EXPORT BUTTON ===
document.getElementById("exportBtn").addEventListener("click", () => {
  const table = document.getElementById("apps-table");
  const csv = [];
  const rows = table.querySelectorAll("tr");
  rows.forEach(row => {
    const cols = row.querySelectorAll("th, td");
    const rowData = Array.from(cols).map(c => `"${c.innerText}"`);
    csv.push(rowData.join(","));
  });
  const blob = new Blob([csv.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "applications.csv";
  a.click();
});

// === INIT ===
fetchApplications();
