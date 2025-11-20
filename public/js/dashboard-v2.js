
// dashboard-v2.js
// Cliente para el nuevo dashboard que se adapta al backend existente

document.addEventListener('DOMContentLoaded', ()=>{
  const token = sessionStorage.getItem('token');
  if(!token){ window.location.href = '/vistas/login.html'; return; }

  const headers = { 'Content-Type':'application/json', Authorization: `Bearer ${token}` };
  const userEmailEl = document.getElementById('userEmail');
  const loansList = document.getElementById('loansList');
  const loanForm = document.getElementById('loanForm');
  const loanId = document.getElementById('loanId');
  const clientName = document.getElementById('clientName');
  const principal = document.getElementById('principal');
  const annualRate = document.getElementById('annualRate');
  const termMonths = document.getElementById('termMonths');
  const startDate = document.getElementById('startDate');
  const paymentType = document.getElementById('paymentType');
  const loansDetailWrap = document.getElementById('loanDetails');
  const noSelection = document.getElementById('noSelection');
  const detailClient = document.getElementById('detailClient');
  const detailMeta = document.getElementById('detailMeta');
  const detailBalance = document.getElementById('detailBalance');
  const paymentsTableBody = document.querySelector('#paymentsTable tbody');

  // safe binder: attach handler only if element exists
  function bind(id, handler, opts){ const el = document.getElementById(id); if(!el) return null; if(opts && opts.useOnclick) el.onclick = handler; else el.addEventListener('click', handler); return el; }

  // Toast helper (use UI if available)
  function showToast(msg, type='info', ms=3000){
    if(window.UI && typeof window.UI.showToast === 'function') return window.UI.showToast(msg, type, ms);
    let container = document.querySelector('.toast-container');
    if(!container){ container = document.createElement('div'); container.className='toast-container'; document.body.appendChild(container); }
    const t = document.createElement('div'); t.className = 'toast ' + (type||'info'); t.textContent = msg; container.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(),300); }, ms);
  }

  function setLoading(btn, on=true){
    if(!btn) return;
    if(on){ btn.classList.add('loading'); if(!btn.querySelector('.spinner')){ const s=document.createElement('span'); s.className='spinner'; btn.appendChild(s); } }
    else { btn.classList.remove('loading'); const s = btn.querySelector('.spinner'); if(s) s.remove(); }
  }

  async function fetchLoans(){
    const resp = await fetch('/prestamos/listar', { headers: { Authorization: `Bearer ${token}` } });
    const data = await resp.json();
    if(!resp.ok){ showToast(data.mensaje || 'Error al cargar','error'); return; }
    renderLoans(data);
    // quick reports: total loans, capital prestado, total pagado
    try{
      const totalLoansEl = document.getElementById('totalLoans');
      const totalPrincipalEl = document.getElementById('totalPrincipal');
      const totalPaidEl = document.getElementById('totalPaid');
      const totalEarningsEl = document.getElementById('totalEarnings');
      const totalLoans = Array.isArray(data) ? data.length : 0;
      // sum principal (try several field names)
      const totalPrincipal = (Array.isArray(data) ? data.reduce((s,p)=> s + Number(p.principal || p.monto || p.capital || 0), 0) : 0);

      // For accurate totalPaid and expected earnings, fetch payments per loan (limit concurrency)
      let totalPaid = 0;
      let totalEarnings = 0;
      if(Array.isArray(data) && data.length){
        // concurrency limit
        const limit = 5;
        let i = 0;
        async function worker(){
          while(i < data.length){
            const idx = i++; const loan = data[idx];
            try{
              const pr = await fetch(`/prestamos/${loan.id}/pagos`, { headers: { Authorization: `Bearer ${token}` } });
              const pj = await pr.json();
              if(pr.ok && Array.isArray(pj.pagos)){
                totalPaid += pj.pagos.reduce((s,x)=> s + Number(x.monto || 0), 0);
              } else if(loan.pagado){ totalPaid += Number(loan.pagado||0); }
            }catch(e){ if(loan.pagado) totalPaid += Number(loan.pagado||0); }
            // estimate expected interest for loan
            try{ totalEarnings += computeExpectedInterest(loan); }catch(e){}
          }
        }
        const workers = Array.from({length: Math.min(limit, data.length)}, ()=> worker());
        await Promise.all(workers);
      }

      if(totalLoansEl) totalLoansEl.textContent = totalLoans;
      if(totalPrincipalEl) totalPrincipalEl.textContent = formatCurrency(totalPrincipal);
      if(totalPaidEl) totalPaidEl.textContent = formatCurrency(totalPaid);
      if(totalEarningsEl) totalEarningsEl.textContent = formatCurrency(totalEarnings);
    }catch(e){ console.error('Error computing quick reports', e); }
  }

  // compute expected total interest for a loan using amortization schedule
  function computeExpectedInterest(p){
    const P = Number(p.principal || p.monto || 0);
    const annualRate = Number(p.tasa || p.interes || 0) / 100;
    const n = Number(p.plazo || 1);
    const r = annualRate / 12;
    if(n <= 0) return 0;
    if((p.tipo_pago||p.tipoPago||'amortizado') === 'amortizado'){
      const factor = r === 0 ? 1 : (r * Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
      const monthly = r === 0 ? P / n : P * factor;
      let balance = P; let totalInterest = 0;
      for(let i=1;i<=n;i++){ const interest = balance * r; totalInterest += interest; const capital = monthly - interest; balance = Math.max(0, balance - capital); }
      return totalInterest;
    } else if((p.tipo_pago||p.tipoPago||'interes_mensual') === 'interes_mensual'){
      // interest-only until last payment
      return P * r * n;
    }
    return 0;
  }

  // compute montoTotal and monthly payment for frontend
  function computeMontoTotalFrontend(p){
    const P = Number(p.principal || p.monto || 0);
    const annualRate = Number(p.tasa || p.interes || 0) / 100;
    const n = Number(p.plazo || 1);
    const r = annualRate / 12;
    const tipo = (p.tipo_pago || p.tipoPago || 'amortizado');
    if(n <= 0) return { montoTotal: 0, monthly: 0 };
    if(tipo === 'amortizado'){
      const factor = r === 0 ? 1 : (r * Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
      const monthly = r === 0 ? P / n : P * factor;
      const montoTotal = monthly * n;
      return { montoTotal: Number(montoTotal.toFixed(2)), monthly: Number(monthly.toFixed(2)) };
    } else {
      // interest-only then capital at end
      const monthlyInterest = P * r;
      const montoTotal = monthlyInterest * n + P;
      return { montoTotal: Number(montoTotal.toFixed(2)), monthly: Number(monthlyInterest.toFixed(2)) };
    }
  }

  function renderLoans(list){
    loansList.innerHTML = '';
    // Mantener el id seleccionado globalmente
    if(typeof window.selectedLoanId === 'undefined') window.selectedLoanId = null;
    list.forEach(p=>{
      const el = document.createElement('div');
      el.className = 'loan-item';
      el.dataset.id = p.id;
      el.innerHTML = `
        <div>
          <div style="font-weight:600">${p.cliente_nombre||p.cliente_email||p.id}</div>
          <div class="small muted">
            ${p.fecha_inicio||''}
            ${p.estado === 'pagado' ? '<span class="estado-pagado">• PAGADO</span>' : ''}
          </div>
        </div>
        <div class="flex" style="align-items:center;gap:10px">
          <div class="small muted">${formatCurrency(Number(p.principal||p.monto||0))}</div>
          <div class="actions">
            <button data-id="${p.id}" class="btn small select-btn">${window.selectedLoanId === p.id ? 'Deseleccionar' : 'Seleccionar'}</button>
          </div>
        </div>
      `;
      loansList.appendChild(el);
      // bind buttons
      el.querySelectorAll('button').forEach(btn=>{
        const id = btn.getAttribute('data-id');
        if(btn.textContent.trim().toLowerCase() === 'ver') btn.addEventListener('click', ()=> selectLoan(id));
        else {
          btn.addEventListener('click', function(){
            const isSelected = el.classList.contains('selected');
            if(isSelected) {
              el.classList.remove('selected');
              btn.textContent = 'Seleccionar';
              loansDetailWrap.style.display = 'none';
              noSelection.style.display = '';
              window.selectedLoanId = null;
            } else {
              // Deselecciona todos
              document.querySelectorAll('#loansList .loan-item').forEach(x=>{
                x.classList.remove('selected');
                const b = x.querySelector('.select-btn');
                if(b) b.textContent = 'Seleccionar';
              });
              el.classList.add('selected');
              btn.textContent = 'Deseleccionar';
              selectLoan(id);
              window.selectedLoanId = id;
            }
          });
        }
      });
      // Si está seleccionado, marca visualmente
      if(window.selectedLoanId === p.id) {
        el.classList.add('selected');
      }
    });
  }

  async function selectLoan(id){
    const resp = await fetch(`/prestamos/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await resp.json();
    if(!resp.ok) return (window.UI && window.UI.showToast) ? window.UI.showToast(data.mensaje || 'Error','error') : console.error(data.mensaje || 'Error');
    const p = data.prestamo;
    noSelection.style.display = 'none';
    loansDetailWrap.style.display = '';
    detailClient.textContent = p.cliente_nombre || p.cliente_email || p.id;

    // Fetch pagos and compute totals dynamically
    const payResp = await fetch(`/prestamos/${id}/pagos`, { headers: { Authorization: `Bearer ${token}` } });
    const payJson = await payResp.json();
    const pagos = (payResp.ok && Array.isArray(payJson.pagos)) ? payJson.pagos : [];
    const totalPagado = pagos.reduce((s, x) => s + Number(x.monto || x.amount || 0), 0);

    // compute montoTotal from stored values or calculate
    const computed = computeMontoTotalFrontend(p);
    const montoTotal = p.montoTotal || computed.montoTotal || 0;
    const saldoPendiente = Math.max(0, Number(montoTotal) - Number(totalPagado));
    const estaPagado = saldoPendiente <= 0;
    p.montoTotal = montoTotal;
    p.totalPagado = totalPagado;
    p.saldoPendiente = saldoPendiente;
    p.estado = estaPagado ? 'pagado' : (p.estado || 'pendiente');

    // Update UI
    detailMeta.textContent = `Inicio: ${p.fecha_inicio} • Plazo: ${p.plazo} meses • Tasa: ${p.tasa}% • Estado: ${p.estado === 'pagado' ? 'PAGADO' : 'Pendiente'}`;
    detailBalance.innerHTML = `
      <div class="balance-detail">
        <div class="monto-total">Monto total: ${formatCurrency(montoTotal)}</div>
        <div class="saldo-pendiente">Saldo pendiente: ${formatCurrency(saldoPendiente)}</div>
        ${p.estado === 'pagado' ? '<div class="estado-pagado">PRÉSTAMO PAGADO</div>' : ''}
      </div>
    `;

    // Deshabilitar el botón de registro de pago si está pagado
    const recordPaymentBtn = document.getElementById('recordPaymentBtn');
    const paymentFormWrap = document.getElementById('paymentFormWrap');
    if (recordPaymentBtn) recordPaymentBtn.style.display = p.estado === 'pagado' ? 'none' : 'block';
    if (paymentFormWrap && p.estado === 'pagado') paymentFormWrap.style.display = 'none';

    // render schedule and payments
    renderSchedule(p);
    paymentsTableBody.innerHTML = '';
    if(pagos.length){
      pagos.forEach(pay=>{
        const row = document.createElement('tr');
        row.innerHTML = `<td>${pay.fecha}</td><td>${formatCurrency(Number(pay.monto||pay.amount||0))}</td><td>Pago</td><td></td>`;
        paymentsTableBody.appendChild(row);
      });
    } else {
      const row = document.createElement('tr');
      row.className = 'empty-row';
      row.innerHTML = `<td colspan="4" class="muted">No hay pagos registrados</td>`;
      paymentsTableBody.appendChild(row);
    }

    // ensure payments header columns remain visible even when empty (match screenshot)
    // if no pagos, leave tbody empty but the thead stays visible

    // toggle schedule button behaviour
    const scheduleWrap = document.getElementById('scheduleWrap');
    const showBtn = document.getElementById('showScheduleBtn');
    if(showBtn){
      showBtn.textContent = (scheduleWrap && scheduleWrap.style.display !== 'none') ? 'Ocultar calendario' : 'Ver calendario';
      // remove previous handler(s)
      showBtn.onclick = null;
      showBtn.addEventListener('click', ()=>{
        if(!scheduleWrap) return;
        if(scheduleWrap.style.display === 'none' || scheduleWrap.style.display === ''){ scheduleWrap.style.display = 'block'; showBtn.textContent = 'Ocultar calendario'; }
        else { scheduleWrap.style.display = 'none'; showBtn.textContent = 'Ver calendario'; }
      });
    }

    // bind actions (safely). Use onclick assignment so re-selecting the same loan
    // doesn't add multiple event listeners (prevents duplicate submissions)
    bind('recordPaymentBtn', ()=>{ const pf = document.getElementById('paymentFormWrap'); if(pf) pf.style.display='block'; }, { useOnclick: true });
    bind('cancelPaymentBtn', ()=>{ const pf = document.getElementById('paymentFormWrap'); if(pf) pf.style.display='none'; }, { useOnclick: true });
    bind('savePaymentBtn', async ()=>{
      const btn = document.getElementById('savePaymentBtn');
      const amountEl = document.getElementById('paymentAmount');
      const dateEl = document.getElementById('paymentDate');
      
      // prevent duplicate submissions
      if(btn && btn.dataset && btn.dataset.busy === '1') return;
      if(btn) { btn.dataset.busy = '1'; btn.disabled = true; }
      
      try{
        const amount = Number(amountEl.value || 0);
        const date = dateEl.value || new Date().toISOString().slice(0,10);
        
  // Obtener el préstamo y sus pagos actuales para validar el saldo
  const loanResp = await fetch(`/prestamos/${id}`, { headers });
  const loanData = await loanResp.json();
  if (!loanResp.ok) throw new Error(loanData.mensaje || 'Error al obtener préstamo');
  const prestamo = loanData.prestamo;
  // fetch pagos y calcular totalPagado
  const pagosResp = await fetch(`/prestamos/${id}/pagos`, { headers });
  const pagosJson = await pagosResp.json();
  const pagosArr = (pagosResp.ok && Array.isArray(pagosJson.pagos)) ? pagosJson.pagos : [];
  const totalPagado = pagosArr.reduce((s, x) => s + Number(x.monto || x.amount || 0), 0);
  const computed = computeMontoTotalFrontend(prestamo);
  const montoTotal = prestamo.montoTotal || computed.montoTotal || 0;
  const saldoPendiente = Math.max(0, montoTotal - totalPagado);
        
        // Validar que el monto no exceda el saldo pendiente
        if (amount > saldoPendiente) {
          window.UI.showToast(`El monto excede el saldo pendiente (${formatCurrency(saldoPendiente)})`, 'error');
          return;
        }
        
        // validate payment
        if(!validatePayment(amountEl, amount)) return;
        setLoading(btn, true);
        const resp = await fetch(`/prestamos/${id}/pagos`, { method:'POST', headers, body: JSON.stringify({ monto: amount, fecha: date }) });
        const j = await resp.json();
        if(!resp.ok){ setLoading(btn, false); showToast(j.mensaje || 'Error','error'); return; }
        showToast('Pago registrado','success');
        // refresh details and reports dynamically
        await Promise.all([ selectLoan(id), fetchLoans() ]);
      }catch(e){ console.error('payment error', e); showToast('Error registrando pago','error'); }
      finally{ if(btn) { setLoading(btn, false); btn.dataset.busy = '0'; btn.disabled = false; } }
    }, { useOnclick: true });

    bind('editLoanBtn', ()=>{
      loanId.value = p.id;
      clientName.value = p.cliente_nombre || '';
      principal.value = p.principal || p.monto || '';
      annualRate.value = p.tasa || p.interes || '';
      termMonths.value = p.plazo || '';
      startDate.value = p.fecha_inicio ? p.fecha_inicio.slice(0,10) : '';
      paymentType.value = p.tipo_pago || p.tipoPago || 'amortizado';
      window.scrollTo({ top: 0, behavior: 'smooth' });
  }, { useOnclick: true });

    bind('deleteLoanBtn', async ()=>{
      const confirmed = window.UI && window.UI.confirmModal ? await window.UI.confirmModal('Confirmar', '¿Eliminar este préstamo?') : false;
      if(!confirmed) return;
      const btn = document.getElementById('deleteLoanBtn'); setLoading(btn, true);
      const resp = await fetch(`/prestamos/${id}`, { method:'DELETE', headers });
      const j = await resp.json(); setLoading(btn, false);
      if(!resp.ok){ showToast(j.mensaje || 'Error','error'); return; }
      showToast('Eliminado','success');
      loansDetailWrap.style.display='none'; noSelection.style.display=''; fetchLoans();
    }, { useOnclick: true });
  }

  loanForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const body = {
      cliente_nombre: clientName.value,
      principal: Number(principal.value||0),
      tasa: Number(annualRate.value||0),
      plazo: Number(termMonths.value||0),
      fecha_inicio: startDate.value,
      tipo_pago: paymentType.value
    };
    // validation (inline) - improved
    if(!validateLoanFields(body)) return;
    const submitBtn = loanForm.querySelector('button[type="submit"]'); setLoading(submitBtn, true);
    let resp;
    if(loanId.value){
      resp = await fetch(`/prestamos/${loanId.value}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
    } else {
      resp = await fetch('/prestamos/crear', { method:'POST', headers, body: JSON.stringify(body) });
    }
    const j = await resp.json(); setLoading(submitBtn, false);
    if(!resp.ok){ showToast(j.mensaje || 'Error','error'); return; }
    showToast('Préstamo guardado','success');
    loanForm.reset();
    await fetchLoans();
    const newId = j && (j.id || (j.prestamo && j.prestamo.id));
    if(newId) selectLoan(newId);
  });

  bind('resetFormBtn', ()=> loanForm.reset());
  bind('exportBtn', async ()=>{
    const resp = await fetch('/prestamos/listar', { headers: { Authorization: `Bearer ${token}` } });
    const data = await resp.json();
    const blob = new Blob([JSON.stringify(data,null,2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'prestamos.json'; a.click(); URL.revokeObjectURL(url);
  });
  bind('clearAllBtn', async ()=>{
    const confirmed = window.UI && window.UI.confirmModal ? await window.UI.confirmModal('Confirmar', 'Borrar todos los préstamos visibles?') : false;
    if(!confirmed) return;
    const resp = await fetch('/prestamos/listar', { headers: { Authorization: `Bearer ${token}` } });
    const data = await resp.json();
    for(const p of data){ await fetch(`/prestamos/${p.id}`, { method:'DELETE', headers }); }
    if(window.UI && window.UI.showToast) window.UI.showToast('Borrado completo','success'); else console.log('Borrado completo'); fetchLoans();
  });

  bind('importBtn', ()=>{
    const input = document.createElement('input'); input.type='file'; input.accept='application/json';
    input.onchange = async ()=>{
      const file = input.files[0]; if(!file) return; const txt = await file.text();
      try{ const arr = JSON.parse(txt); for(const p of arr){ await fetch('/prestamos/crear', { method:'POST', headers, body: JSON.stringify(p) }); } if(window.UI && window.UI.showToast) window.UI.showToast('Importado','success'); else console.log('Importado'); fetchLoans(); }catch(e){ if(window.UI && window.UI.showToast) window.UI.showToast('JSON inválido','error'); else console.error('JSON inválido'); }
    };
    input.click();
  });

  // --- Amortization schedule renderer ---
  function renderSchedule(p){
    const wrap = document.getElementById('scheduleWrap');
    const tbody = document.querySelector('#scheduleTable tbody');
    tbody.innerHTML = '';
    // supports alternate field names
    const principalVal = Number(p.principal || p.monto || p.capital || 0);
    if(!p || !principalVal) { wrap.style.display='none'; return; }
    const P = principalVal;
    const annualRate = Number(p.tasa || p.interes || 0) / 100;
    const n = Number(p.plazo || p.plazoMeses || p.termMonths || 1);
    const tipo = (p.tipo_pago || p.tipoPago || p.tipo_pago || 'amortizado');
    const r = annualRate / 12; // monthly rate
    if(tipo === 'amortizado'){
      // monthly payment (annuity). Handle zero-rate separately and correct rounding on last payment
      const factor = r === 0 ? 1 : (r * Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
      const monthly = r === 0 ? P / n : P * factor;
      let balance = P;
      let accumulatedPrincipal = 0;
      for(let i=1;i<=n;i++){
        const interest = Number((balance * r).toFixed(8));
        let capital = monthly - interest;
        // rounding correction on last payment
        if(i === n){ capital = balance; }
        accumulatedPrincipal += capital;
        balance = Math.max(0, Number((balance - capital).toFixed(8)));
        const cuota = (interest + capital);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i}</td><td>${formatDateMonth(p.fecha_inicio,i-1)}</td><td>${formatCurrency(cuota)}</td><td>${formatCurrency(capital)}</td><td>${formatCurrency(interest)}</td><td>${formatCurrency(balance)}</td>`;
        tbody.appendChild(tr);
      }
      wrap.style.display='block';
    } else if(tipo === 'interes_mensual'){
      // interest monthly, capital at end
      let balance = P;
      for(let i=1;i<=n;i++){
        const interest = Number((P * r).toFixed(8)); // interest over principal
        const capital = (i === n) ? P : 0;
        balance = (i === n) ? 0 : P;
        const cuota = interest + capital;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i}</td><td>${formatDateMonth(p.fecha_inicio,i-1)}</td><td>${formatCurrency(cuota)}</td><td>${formatCurrency(capital)}</td><td>${formatCurrency(interest)}</td><td>${formatCurrency(balance)}</td>`;
        tbody.appendChild(tr);
      }
      wrap.style.display='block';
    } else { wrap.style.display='none'; }
  }

  function formatCurrency(v){
    const n = Number(v) || 0;
    try{
      return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n);
    }catch(e){ return 'S/ ' + n.toFixed(2); }
  }

  function formatDateMonth(start, addMonths){
    try{
      const d = start ? new Date(start) : new Date();
      d.setMonth(d.getMonth() + addMonths);
      return d.toISOString().slice(0,10);
    }catch(e){ return ''; }
  }

  // inicial
  fetchLoans();

  // mostrar email si está disponible
  (async ()=>{ try{ const r = await fetch('/auth/perfil', { headers: { Authorization: `Bearer ${token}` } }); const j = await r.json(); if(r.ok) userEmailEl.textContent = j.email || ''; }catch(e){} })();

  // clear inline errors for loan form inputs
  [clientName, principal, annualRate, termMonths, startDate].forEach(el=>{ if(el) el.addEventListener('input', ()=>{ if(window.UI && window.UI.clearInlineError) window.UI.clearInlineError(el); }); });

  // clear inline errors for payment inputs
  const paymentAmountEl = document.getElementById('paymentAmount');
  const paymentDateEl = document.getElementById('paymentDate');
  if(paymentAmountEl) paymentAmountEl.addEventListener('input', ()=>{ if(window.UI && window.UI.clearInlineError) window.UI.clearInlineError(paymentAmountEl); });
  if(paymentDateEl) paymentDateEl.addEventListener('input', ()=>{ if(window.UI && window.UI.clearInlineError) window.UI.clearInlineError(paymentDateEl); });

  // Validation helpers
  function validateLoanFields(body){
    // clear previous
    if(window.UI && window.UI.clearInlineError){ [clientName, principal, annualRate, termMonths, startDate].forEach(el=>el && window.UI.clearInlineError(el)); }
    if(!body.cliente_nombre || !body.cliente_nombre.trim()){ if(window.UI && window.UI.showInlineError) window.UI.showInlineError(clientName, 'Nombre del cliente requerido'); else showToast('Nombre del cliente requerido','error'); return false; }
    if(!(Number(body.principal) > 0)){ if(window.UI && window.UI.showInlineError) window.UI.showInlineError(principal, 'Monto debe ser mayor a 0'); else showToast('Monto debe ser mayor a 0','error'); return false; }
    if(!(Number(body.tasa) >= 0 && Number(body.tasa) <= 1000)){ if(window.UI && window.UI.showInlineError) window.UI.showInlineError(annualRate, 'Tasa inválida'); else showToast('Tasa inválida','error'); return false; }
    if(!(Number(body.plazo) >= 1 && Number.isInteger(Number(body.plazo)))){ if(window.UI && window.UI.showInlineError) window.UI.showInlineError(termMonths, 'Plazo debe ser un entero mayor o igual a 1'); else showToast('Plazo inválido','error'); return false; }
    if(body.fecha_inicio && isNaN(new Date(body.fecha_inicio).getTime())){ if(window.UI && window.UI.showInlineError) window.UI.showInlineError(startDate, 'Fecha inválida'); else showToast('Fecha inválida','error'); return false; }
    return true;
  }

  // --- Live schedule preview from form inputs ---
  function buildPreviewLoan(){
    return {
      cliente_nombre: clientName ? clientName.value : '',
      principal: principal ? Number(principal.value || 0) : 0,
      tasa: annualRate ? Number(annualRate.value || 0) : 0,
      plazo: termMonths ? Number(termMonths.value || 0) : 0,
      fecha_inicio: startDate ? startDate.value : new Date().toISOString().slice(0,10),
      tipo_pago: paymentType ? paymentType.value : 'amortizado'
    };
  }

  function updateSchedulePreview(){
    const preview = buildPreviewLoan();
    // only render if have sensible values
    if(preview.principal > 0 && preview.plazo >= 1) renderSchedule(preview);
    else { const wrap = document.getElementById('scheduleWrap'); if(wrap) wrap.style.display='none'; }
  }

  // attach listeners to update preview when user changes fields
  [principal, annualRate, termMonths, startDate, paymentType, clientName].forEach(el=>{ if(!el) return; ['input','change'].forEach(ev=> el.addEventListener(ev, ()=> updateSchedulePreview())); });

  function validatePayment(amountEl, amount){ if(window.UI && window.UI.clearInlineError) window.UI.clearInlineError(amountEl); if(!(Number(amount) > 0)){ if(window.UI && window.UI.showInlineError) window.UI.showInlineError(amountEl, 'Monto debe ser mayor a 0'); else showToast('Monto debe ser mayor a 0','error'); return false; } return true; }

});
