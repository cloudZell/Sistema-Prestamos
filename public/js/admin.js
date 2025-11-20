// public/js/admin.js
// Admin panel: list users and aggregate loans per user

// Funciones globales para el manejo de usuarios y préstamos
async function fetchUsuarios(){
  const token = sessionStorage.getItem('token');
  try{
    const r = await fetch('/admin/usuarios', { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if(!r.ok) throw new Error(j.error || 'Error');
    return j.usuarios || [];
  }catch(e){ console.error(e); return []; }
}

async function fetchPrestamos(){
  const token = sessionStorage.getItem('token');
  const r = await fetch('/prestamos/listar', { headers: { Authorization: `Bearer ${token}` } });
  if(!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j) ? j : j.prestamos || [];
}

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', async ()=>{
  const token = sessionStorage.getItem('token');
  if(!token) return window.location.href = '/vistas/login.html';

  const tablaUsuariosBody = document.getElementById('tablaUsuarios')?.querySelector('tbody');
  const tablaResumenBody = document.getElementById('tablaResumenUsuarios')?.querySelector('tbody');
  const tablaPrestamosBody = document.getElementById('tablaPrestamosAdmin')?.querySelector('tbody');

  async function fetchPrestamos(){
    const r = await fetch('/prestamos/listar', { headers: { Authorization: `Bearer ${token}` } });
    if(!r.ok) return [];
    const j = await r.json();
    const prestamos = Array.isArray(j) ? j : j.prestamos || [];
    
    // Obtener detalles completos de cada préstamo para tener los pagos actualizados
    const detallesPrestamos = await Promise.all(prestamos.map(async (p) => {
      try {
        const resp = await fetch(`/prestamos/${p.id}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await resp.json();
        return data.prestamo || p;
      } catch(e) {
        console.error('Error al obtener detalles del préstamo:', e);
        return p;
      }
    }));
    
    return detallesPrestamos;
  }

  function formatCurrency(v){ try{ return new Intl.NumberFormat('es-PE',{ style:'currency', currency:'PEN' }).format(Number(v||0)); }catch(e){ return 'S/ ' + Number(v||0).toFixed(2); } }

  function computeExpectedInterest(p){
    const P = Number(p.principal || p.monto || p.capital || 0);
    const annualRate = Number(p.tasa || p.interes || 0) / 100;
    const n = Number(p.plazo || p.plazoMeses || p.termMonths || 1);
    const r = annualRate / 12;
    if(n <= 0) return 0;
    if((p.tipo_pago||p.tipoPago||'amortizado') === 'amortizado'){
      const factor = r === 0 ? 1 : (r * Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
      const monthly = r === 0 ? P / n : P * factor;
      let balance = P, totalInterest = 0;
      for(let i=1;i<=n;i++){ const interest = balance * r; totalInterest += interest; const capital = monthly - interest; balance = Math.max(0, balance - capital); }
      return totalInterest;
    } else if((p.tipo_pago||p.tipoPago||'interes_mensual') === 'interes_mensual'){
      return P * r * n;
    }
    return 0;
  }

  // Aggregate per-user
  async function renderAdmin(){
    const [usuarios, prestamos] = await Promise.all([ fetchUsuarios(), fetchPrestamos() ]);

    // render users list
    if(tablaUsuariosBody){ 
      tablaUsuariosBody.innerHTML = ''; 
      usuarios.forEach(u => {
        const tr = document.createElement('tr');
        
        // Crear la fila con los datos del usuario
        const tdNombre = document.createElement('td');
        tdNombre.textContent = u.displayName || '-';
        
        const tdEmail = document.createElement('td');
        tdEmail.textContent = u.email || '-';
        
        const tdRol = document.createElement('td');
        tdRol.textContent = u.rol || 'cliente';
        
        const tdAcciones = document.createElement('td');
        tdAcciones.className = 'text-center';
        
        // Crear botones con event listeners
        const btnEditar = document.createElement('button');
        btnEditar.className = 'btn small';
        btnEditar.textContent = 'Editar';
        btnEditar.addEventListener('click', () => editarUsuario(u.uid));
        
        const btnEliminar = document.createElement('button');
        btnEliminar.className = 'btn small secondary';
        btnEliminar.textContent = 'Eliminar';
        btnEliminar.addEventListener('click', () => eliminarUsuario(u.uid));
        
        // Agregar botones al contenedor de acciones
        tdAcciones.appendChild(btnEditar);
        tdAcciones.appendChild(document.createTextNode(' ')); // Espacio entre botones
        tdAcciones.appendChild(btnEliminar);
        
        // Agregar todas las celdas a la fila
        tr.appendChild(tdNombre);
        tr.appendChild(tdEmail);
        tr.appendChild(tdRol);
        tr.appendChild(tdAcciones);
        
        tablaUsuariosBody.appendChild(tr);
      });
    }
    
    // Agregar manejador para nuevo usuario
    document.getElementById('btnNuevoUsuario').addEventListener('click', crearNuevoUsuario);

    // Crear mapeo de UIDs a nombres de usuario
    const userMap = {};
    usuarios.forEach(u => {
      userMap[u.uid] = {
        nombre: u.displayName || 'Sin nombre',
        email: u.email || '-'
      };
    });

    // map loans by user
    const byUser = {};
    for(const p of prestamos){ 
      const owner = p.creado_por_uid || p.creado_por || p.owner || 'unknown'; 
      if(!byUser[owner]) byUser[owner] = []; 
      byUser[owner].push(p); 
    }

    // render resumen por usuario
    if(tablaResumenBody){ 
      tablaResumenBody.innerHTML = ''; 
      Object.keys(byUser).forEach(uid => {
        const list = byUser[uid];
        const totalCapital = list.reduce((s,x)=> s + Number(x.principal || x.monto || x.capital || 0), 0);
        const totalEarnings = list.reduce((s,x)=> s + computeExpectedInterest(x), 0);
        const totalPaid = list.reduce((s,x)=> s + Number(x.totalPagado || 0), 0);
        
        const userData = userMap[uid] || { nombre: 'Usuario desconocido', email: '-' };
        const nombreMostrado = `${userData.nombre} (${userData.email})`;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td title="${uid}">${nombreMostrado}</td>
          <td class="text-right">${list.length}</td>
          <td class="text-right">${formatCurrency(totalCapital)}</td>
          <td class="text-right">${formatCurrency(totalEarnings)}</td>
          <td class="text-right">${formatCurrency(totalPaid)}</td>
        `;
        tablaResumenBody.appendChild(tr);
      });
    }

    // render detailed loans list with actions (fetch enriched loan for totals)
    if(tablaPrestamosBody){
      tablaPrestamosBody.innerHTML = '';
      const limit = 6; let i = 0;
      async function worker(){
        while(i < prestamos.length){
          const idx = i++; const p0 = prestamos[idx];
          try{
            const resp = await fetch(`/prestamos/${p0.id}`, { headers: { Authorization: `Bearer ${token}` } });
            const j = await resp.json();
            const p = (resp.ok && j.prestamo) ? j.prestamo : p0;
            const owner = p.creado_por_uid || p.creado_por || p.owner || '-';
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td>${owner}</td>
              <td class="text-right">${formatCurrency(p.principal||p.monto||p.capital||0)}</td>
              <td class="text-right">${p.tasa||p.interes||0}%</td>
              <td class="text-right">${p.plazo||p.term||'-'}</td>
              <td class="text-right">${formatCurrency(p.interesTotal||computeExpectedInterest(p))}</td>
              <td class="text-right">${formatCurrency(p.totalPagado||0)}</td>
              <td class="text-right">${formatCurrency(p.saldoPendiente||0)}</td>
              <td class="text-center">
                <button class="btn small" data-action="edit" data-id="${p.id}">Editar</button>
                <button class="btn small secondary" data-action="delete" data-id="${p.id}">Eliminar</button>
              </td>`;
            tablaPrestamosBody.appendChild(tr);
          }catch(e){ console.error('error loading loan detail', e); }
        }
      }
      const workers = Array.from({length: Math.min(limit, prestamos.length)}, ()=> worker());
      await Promise.all(workers);
    }
  }

  // Tabs
  function showTab(name){ document.querySelectorAll('[data-panel]').forEach(el=> el.style.display = (el.getAttribute('data-panel') === name) ? '' : 'none'); }
  document.querySelectorAll('.admin-nav button').forEach(b=> b.addEventListener('click', ()=>{ const t = b.getAttribute('data-tab'); showTab(t); }));

  // New loan button
  const newLoanBtn = document.getElementById('adminNewLoanBtn');
  if(newLoanBtn) newLoanBtn.addEventListener('click', async ()=>{
    if(!(window.UI && window.UI.inputModal)){ return window.UI && window.UI.showToast ? window.UI.showToast('Funcionalidad no disponible','error') : null; }
    const users = await fetchUsuarios();
    const userOptions = users.map(u=> ({ value: u.uid, label: u.email || u.displayName || u.uid }));
    const fields = [
      { name:'cliente_nombre', label:'Nombre cliente', type:'text' },
      { name:'principal', label:'Monto', type:'number' },
      { name:'tasa', label:'Tasa (%)', type:'number' },
      { name:'plazo', label:'Plazo (meses)', type:'number' },
      { name:'fecha_inicio', label:'Fecha inicio', type:'date' },
      { name:'creado_por_uid', label:'Asignar a (usuario)', type:'select', options: userOptions }
    ];
    const res = await window.UI.inputModal('Nuevo préstamo (admin)', fields);
    if(!res) return;
    try{
      const resp = await fetch('/prestamos/crear', { method:'POST', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ cliente_nombre: res.cliente_nombre, principal: Number(res.principal), tasa: Number(res.tasa), plazo: Number(res.plazo), fecha_inicio: res.fecha_inicio, creado_por_uid: res.creado_por_uid }) });
      const j = await resp.json(); if(!resp.ok) throw new Error(j.mensaje||'Error');
      window.UI.showToast('Préstamo creado','success'); renderAdmin();
    }catch(e){ window.UI.showToast('Error: '+e.message,'error'); }
  });

  // Delegate edit/delete clicks
  document.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button[data-action]');
    if(!btn) return;
    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');
    if(action === 'delete'){
      const ok = window.UI && window.UI.confirmModal ? await window.UI.confirmModal('Confirmar','Eliminar préstamo?') : confirm('Eliminar préstamo?');
      if(!ok) return;
      const resp = await fetch(`/prestamos/${id}`, { method:'DELETE', headers: { Authorization:`Bearer ${token}` } });
      const j = await resp.json(); if(!resp.ok) return window.UI.showToast(j.mensaje||'Error','error');
      window.UI.showToast('Eliminado','success'); renderAdmin();
    }
    if(action === 'edit'){
      // fetch loan and open modal
      const r = await fetch(`/prestamos/${id}`, { headers: { Authorization:`Bearer ${token}` } });
      const j = await r.json(); if(!r.ok) return window.UI.showToast(j.mensaje||'Error','error');
      const p = j.prestamo;
      const res = await window.UI.inputModal('Editar préstamo', [
        { name:'cliente_nombre', label:'Nombre cliente', type:'text', value: p.cliente_nombre },
        { name:'principal', label:'Monto', type:'number', value: p.principal },
        { name:'tasa', label:'Tasa (%)', type:'number', value: p.tasa },
        { name:'plazo', label:'Plazo (meses)', type:'number', value: p.plazo },
        { name:'fecha_inicio', label:'Fecha inicio', type:'date', value: p.fecha_inicio }
      ]);
      if(!res) return;
      const resp = await fetch(`/prestamos/${id}`, { method:'PATCH', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ cliente_nombre: res.cliente_nombre, principal: Number(res.principal), tasa: Number(res.tasa), plazo: Number(res.plazo), fecha_inicio: res.fecha_inicio }) });
      const jj = await resp.json(); if(!resp.ok) return window.UI.showToast(jj.mensaje||'Error','error');
      window.UI.showToast('Actualizado','success'); renderAdmin();
    }
  });

  // Inicializar la vista
  renderAdmin();

  // Hacer accesible renderAdmin globalmente para las funciones CRUD
  window.renderAdmin = renderAdmin;
});

// Funciones CRUD para usuarios
async function crearNuevoUsuario() {
  if (!window.UI?.inputModal) {
    return window.UI?.showToast('No se puede crear usuario en este momento', 'error');
  }

  const fields = [
    { name: 'email', label: 'Correo electrónico', type: 'email' },
    { name: 'password', label: 'Contraseña', type: 'password' },
    { name: 'displayName', label: 'Nombre completo', type: 'text' },
    { name: 'rol', label: 'Rol', type: 'select', options: [
      { value: 'cliente', label: 'Cliente' },
      { value: 'admin', label: 'Administrador' }
    ]}
  ];

  const data = await window.UI.inputModal('Crear nuevo usuario', fields);
  if (!data) return;

  try {
    const resp = await fetch('/admin/usuarios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionStorage.getItem('token')}`
      },
      body: JSON.stringify(data)
    });

    const json = await resp.json();
    if (!resp.ok) throw new Error(json.mensaje || 'Error al crear usuario');

    window.UI.showToast('Usuario creado exitosamente', 'success');
    window.renderAdmin(); // Actualizar la lista
  } catch (error) {
    window.UI.showToast('Error: ' + error.message, 'error');
  }
}

async function editarUsuario(uid) {
  if (!window.UI?.inputModal) {
    return window.UI?.showToast('No se puede editar usuario en este momento', 'error');
  }

  // Obtener datos actuales del usuario
  const usuarios = await fetchUsuarios();
  const usuario = usuarios.find(u => u.uid === uid);
  if (!usuario) return;

  const fields = [
    { name: 'displayName', label: 'Nombre completo', type: 'text', value: usuario.displayName || '' },
    { name: 'email', label: 'Correo electrónico', type: 'email', value: usuario.email || '' },
    { name: 'password', label: 'Nueva contraseña (dejar vacío para no cambiar)', type: 'password' },
    { name: 'rol', label: 'Rol', type: 'select', value: usuario.rol || 'cliente', options: [
      { value: 'cliente', label: 'Cliente' },
      { value: 'admin', label: 'Administrador' }
    ]}
  ];

  const data = await window.UI.inputModal('Editar usuario', fields);
  if (!data) return;

  // Eliminar campos vacíos
  if (!data.password) delete data.password;

  try {
    const resp = await fetch(`/admin/usuarios/${uid}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionStorage.getItem('token')}`
      },
      body: JSON.stringify(data)
    });

    const json = await resp.json();
    if (!resp.ok) throw new Error(json.mensaje || 'Error al actualizar usuario');

    window.UI.showToast('Usuario actualizado exitosamente', 'success');
    window.renderAdmin(); // Actualizar la lista
  } catch (error) {
    window.UI.showToast('Error: ' + error.message, 'error');
  }
}

async function eliminarUsuario(uid) {
  if (!window.UI?.confirmModal) {
    return window.UI?.showToast('No se puede eliminar usuario en este momento', 'error');
  }

  const confirmar = await window.UI.confirmModal(
    'Eliminar usuario',
    '¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer.'
  );

  if (!confirmar) return;

  try {
    console.log('Intentando eliminar usuario con UID:', uid);
    const token = sessionStorage.getItem('token');
    
    if (!token) {
      throw new Error('No hay sesión activa');
    }
    
    const resp = await fetch(`/admin/usuarios/${uid}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('Respuesta del servidor:', resp.status, resp.statusText);
    
    if (!resp.ok) {
      const text = await resp.text();
      console.log('Respuesta de error completa:', text);
      let errorMsg;
      try {
        const json = JSON.parse(text);
        errorMsg = json.mensaje || `Error ${resp.status}: ${resp.statusText}`;
      } catch {
        errorMsg = `Error ${resp.status}: ${resp.statusText}`;
      }
      throw new Error(errorMsg);
    }

    const json = await resp.json();
    window.UI.showToast('Usuario eliminado exitosamente', 'success');
    await window.renderAdmin(); // Actualizar la lista
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    window.UI.showToast('Error: ' + error.message, 'error');
  }
}
