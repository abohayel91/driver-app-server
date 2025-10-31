(() => {
  const qs  = (s,c=document)=>c.querySelector(s);
  const qsa = (s,c=document)=>Array.from(c.querySelectorAll(s));

  function toast(msg){
    let t = qs('#admin-toast');
    if(!t){
      t = document.createElement('div');
      t.id='admin-toast';
      Object.assign(t.style, {
        position:'fixed', right:'20px', bottom:'20px', zIndex:9999,
        background:'#0f172a', color:'#fff', padding:'10px 12px',
        borderRadius:'10px', boxShadow:'0 10px 30px rgba(2,6,23,.25)',
        opacity:'0', transform:'translateY(8px)', transition:'all .25s'
      });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(()=>{ t.style.opacity='1'; t.style.transform='translateY(0)'; });
    setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(8px)'; }, 1600);
  }

  async function j(url, opts={}){
    const res = await fetch(url, { credentials:'include', ...opts });
    if(!res.ok) throw new Error('HTTP '+res.status);
    return res.json();
  }

  // Detect stat targets (data-stat or keyword)
  const statTargets = {
    total:    qs('[data-stat="total"]')    || qsa('*').find(n=>/total/i.test(n.textContent) && n.children.length===0),
    pending:  qs('[data-stat="pending"]')  || qsa('*').find(n=>/pending/i.test(n.textContent) && n.children.length===0),
    approved: qs('[data-stat="approved"]') || qsa('*').find(n=>/approved/i.test(n.textContent) && n.children.length===0),
    rejected: qs('[data-stat="rejected"]') || qsa('*').find(n=>/rejected/i.test(n.textContent) && n.children.length===0),
  };
  const setStat = (el, val)=>{ if(el) el.textContent = String(val); };

  // Use first table for the applications list
  const table = qs('table') || (()=>{ const t=document.createElement('table'); document.body.appendChild(t); return t; })();
  const thead = table.tHead || table.createTHead();
  const tbody = table.tBodies[0] || table.createTBody();
  if(!thead.rows.length){
    const tr = thead.insertRow();
    ['ID','Name','Email','Status','Submitted','Actions'].forEach(h=>{
      const th = document.createElement('th'); th.textContent = h; tr.appendChild(th);
    });
  }

  // Add “Download All” if missing
  let dlAllBtn = qs('#downloadAll') || qs('[data-download-all]');
  if(!dlAllBtn){
    dlAllBtn = document.createElement('button');
    dlAllBtn.id = 'downloadAll';
    dlAllBtn.textContent = 'Download All';
    Object.assign(dlAllBtn.style, { margin:'10px 0', background:'#0f172a', color:'#fff', border:'none', borderRadius:'10px', padding:'8px 12px', cursor:'pointer' });
    table.parentElement?.insertBefore(dlAllBtn, table);
  }

  function renderRows(apps){
    while(tbody.firstChild) tbody.removeChild(tbody.firstChild);
    apps.forEach(a=>{
      const tr = document.createElement('tr');
      const name = [a.firstName,a.lastName].filter(Boolean).join(' ') || a.name || '—';
      const submitted = a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '';
      tr.innerHTML = `
        <td>${a.id}</td>
        <td>${name}</td>
        <td>${a.email || ''}</td>
        <td>${a.status || 'pending'}</td>
        <td>${submitted}</td>
        <td class="actions">
          <button data-act="approve" data-id="${a.id}">Approve</button>
          <button data-act="reject"  data-id="${a.id}">Reject</button>
          <button data-act="restore" data-id="${a.id}">Restore</button>
          <button data-act="pdf"     data-id="${a.id}">Download PDF</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  async function load(){
    let apps = [];
    try { apps = await j('/api/applications'); }
    catch(e){ console.error(e); toast('Please log in at /login'); return; }

    const totals = {
      total: apps.length,
      approved: apps.filter(a=>a.status==='approved').length,
      rejected: apps.filter(a=>a.status==='rejected').length,
    };
    totals.pending = totals.total - totals.approved - totals.rejected;

    setStat(statTargets.total, totals.total);
    setStat(statTargets.pending, totals.pending);
    setStat(statTargets.approved, totals.approved);
    setStat(statTargets.rejected, totals.rejected);

    renderRows(apps);
  }

  document.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button[data-act]');
    if(!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;

    if(act==='pdf'){
      try{
        const res = await fetch(`/api/applications/${id}/pdf`, { credentials:'include' });
        if(!res.ok) throw new Error();
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${id}.pdf`; a.click();
        URL.revokeObjectURL(url);
        toast('Downloading PDF…');
      }catch{ toast('PDF not found'); }
      return;
    }

    const statusMap = { approve:'approved', reject:'rejected', restore:'pending' };
    const status = statusMap[act];
    if(!status) return;

    try{
      await fetch(`/api/applications/${id}/status`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body: JSON.stringify({ status })
      });
      toast(status==='approved'?'Approved':status==='rejected'?'Rejected':'Restored');
      load();
    }catch{ toast('Update failed'); }
  });

  dlAllBtn.addEventListener('click', async ()=>{
    try{
      const apps = await j('/api/applications');
      if(!apps.length) return toast('No applications yet');
      for(const a of apps){
        try{
          const res = await fetch(`/api/applications/${a.id}/pdf`, { credentials:'include' });
          if(!res.ok) continue;
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a'); link.href = url; link.download = `${a.id}.pdf`; link.click();
          URL.revokeObjectURL(url);
        }catch{}
      }
      toast('Downloading all PDFs…');
    }catch{ toast('Failed to download'); }
  });

  load();
  setInterval(load, 20000);
})(); 

