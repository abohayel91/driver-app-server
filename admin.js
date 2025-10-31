// admin.js — ALSAQQAF LOGISTICS LLC Admin Panel
const tabs = document.querySelectorAll('.nav-link');
const tabSections = document.querySelectorAll('.tab');
const toast = document.getElementById('toast');

tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(b => b.classList.remove('active'));
    tabSections.forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab)?.classList.add('active');
  });
});

// Toast popup
function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `show ${type}`;
  setTimeout(() => toast.className = toast.className.replace('show', ''), 2500);
}

// Fetch applications
async function fetchApplications() {
  try {
    const res = await fetch('/api/applications');
    if (!res.ok) throw new Error('Failed to load data');
    const data = await res.json();
    renderApplications(data);
    updateStats(data);
  } catch (err) {
    console.error(err);
    showToast('Error loading applications', 'error');
  }
}

// Render Applications
function renderApplications(apps) {
  const appsBody = document.getElementById('apps-body');
  const rejectedBody = document.getElementById('rejected-body');
  appsBody.innerHTML = '';
  rejectedBody.innerHTML = '';

  apps.forEach((app, index) => {
    const row = `
      <tr>
        <td>${index + 1}</td>
        <td>${app.fullName || '—'}</td>
        <td>${app.email || '—'}</td>
        <td>${app.status || 'Pending'}</td>
        <td>${app.date || new Date().toLocaleDateString()}</td>
        <td>
          ${app.status === 'Rejected' ? `
            <button onclick="restoreApplication('${app.id}')">Restore</button>
          ` : `
            <button onclick="approveApplication('${app.id}')">Approve</button>
            <button onclick="rejectApplication('${app.id}')">Reject</button>
          `}
          <button onclick="downloadPDF(${JSON.stringify(app)})">Download PDF</button>
        </td>
      </tr>
    `;

    if (app.status === 'Rejected') rejectedBody.innerHTML += row;
    else appsBody.innerHTML += row;
  });
}

// Update Stats
function updateStats(apps) {
  const total = apps.length;
  const pending = apps.filter(a => a.status === 'Pending').length;
  const approved = apps.filter(a => a.status === 'Approved').length;
  const month = apps.filter(a => {
    const d = new Date(a.date);
    return d.getMonth() === new Date().getMonth();
  }).length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-pending').textContent = pending;
  document.getElementById('stat-approved').textContent = approved;
  document.getElementById('stat-thisMonth').textContent = month;

  renderCharts(total, pending, approved);
}

// Approve / Reject / Restore
async function updateStatus(id, status) {
  try {
    await fetch(`/api/applications/${id}`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ status })
    });
    showToast(`Application ${status}`);
    fetchApplications();
  } catch (err) {
    console.error(err);
    showToast('Failed to update application', 'error');
  }
}

function approveApplication(id) { updateStatus(id, 'Approved'); }
function rejectApplication(id) { updateStatus(id, 'Rejected'); }
function restoreApplication(id) { updateStatus(id, 'Pending'); }

// Download PDF (single)
function downloadPDF(app) {
  const pdfContent = `
    ALSAQQAF LOGISTICS LLC
    ------------------------
    Name: ${app.fullName}
    Email: ${app.email}
    Phone: ${app.phone || 'N/A'}
    Status: ${app.status}
    Submitted: ${app.date}
  `;
  const blob = new Blob([pdfContent], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${app.fullName || 'application'}.pdf`;
  link.click();
}

// Download All PDFs
document.getElementById('downloadAllBtn').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/applications');
    const apps = await res.json();

    const zip = new JSZip();
    apps.forEach(app => {
      const text = `
        ALSAQQAF LOGISTICS LLC
        ------------------------
        Name: ${app.fullName}
        Email: ${app.email}
        Status: ${app.status}
        Date: ${app.date}
      `;
      zip.file(`${app.fullName || 'application'}.pdf`, text);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = 'applications.zip';
    link.click();
  } catch (err) {
    showToast('Error downloading all PDFs', 'error');
  }
});

// Charts
function renderCharts(total, pending, approved) {
  const barCtx = document.getElementById('barChart');
  const pieCtx = document.getElementById('pieChart');

  new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: ['Total', 'Pending', 'Approved'],
      datasets: [{
        data: [total, pending, approved],
        backgroundColor: ['#2a4db6', '#c7b208', '#1ca36e']
      }]
    },
    options: { plugins: { legend: { display: false } } }
  });

  new Chart(pieCtx, {
    type: 'doughnut',
    data: {
      labels: ['Pending', 'Approved'],
      datasets: [{
        data: [pending, approved],
        backgroundColor: ['#c7b208', '#1ca36e']
      }]
    },
    options: { cutout: '70%' }
  });
}

// Initialize
fetchApplications();
