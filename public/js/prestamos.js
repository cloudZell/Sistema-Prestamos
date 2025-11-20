// prestamos.js
// Maneja el listado, creación y pagos de préstamos desde el cliente

document.addEventListener("DOMContentLoaded", () => {
  const token = sessionStorage.getItem("token");
  const rol = sessionStorage.getItem("rol");

  if (!token) {
    window.location.href = "/vistas/login.html";
    return;
  }

  const btnCerrarSesion = document.getElementById("btnCerrarSesion");
  if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener("click", () => {
      sessionStorage.clear();
      window.location.href = "/vistas/login.html";
    });
  }

  const tablaPrestamosBody = document.getElementById("tablaPrestamos")?.querySelector("tbody");
  const btnNuevoPrestamo = document.getElementById("btnNuevoPrestamo");

  // Cargar préstamos
  async function cargarPrestamos() {
    try {
      const respuesta = await fetch("/prestamos/listar", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await respuesta.json();

      if (!respuesta.ok) throw new Error(data.mensaje || "Error al obtener préstamos");
      // Si la página no tiene la tabla de préstamos, salimos silenciosamente
      if (!tablaPrestamosBody) return;

      // We request enriched loan data per item (includes totals computed by API)
      tablaPrestamosBody.innerHTML = "";
      // fetch details for each loan with a small concurrency limit to avoid spikes
      const limit = 6;
      let i = 0;
      async function worker(){
        while(i < data.length){
          const idx = i++; const item = data[idx];
          try{
            const dresp = await fetch(`/prestamos/${item.id}`, { headers: { Authorization: `Bearer ${token}` } });
            const dj = await dresp.json();
            const p = (dresp.ok && dj.prestamo) ? dj.prestamo : item;
            const fila = document.createElement("tr");
            const progresoPago = p.montoTotal ? (((p.totalPagado || 0) / p.montoTotal) * 100).toFixed(1) : '0.0';
            fila.innerHTML = `
              <td>${p.id}</td>
              <td>
                <div>Principal: ${Number(p.principal||p.monto||0).toFixed(2)}</div>
                <div>Total: ${Number(p.montoTotal||0).toFixed(2)}</div>
                <div>Cuota mensual: ${Number(p.cuotaMensual||0).toFixed(2)}</div>
              </td>
              <td>${p.tasa}%</td>
              <td>${p.plazo} meses</td>
              <td>${Number(p.interesTotal||0).toFixed(2)}</td>
              <td>${Number(p.totalPagado||0).toFixed(2)}</td>
              <td>
                <div>${Number(p.saldoPendiente||0).toFixed(2)}</div>
                <div class="progreso-pago">
                  <div class="barra-progreso" style="width: ${progresoPago}%"></div>
                  <span>${progresoPago}%</span>
                </div>
              </td>
              <td>
                ${p.estado !== 'pagado' ? 
                  `<button class="btnPago" data-id="${p.id}" data-saldo="${p.saldoPendiente}">Registrar Pago</button>` :
                  '<span class="estado-pagado">Pagado</span>'
                }
              </td>
            `;
            tablaPrestamosBody.appendChild(fila);
          }catch(e){ console.error('error loading loan detail', e); }
        }
      }
      const workers = Array.from({length: Math.min(limit, data.length)}, ()=> worker());
      await Promise.all(workers);
    } catch (error) {
      if(window.UI && window.UI.showToast) window.UI.showToast('Error al cargar préstamos: '+error.message,'error'); else console.error('Error al cargar préstamos:', error);
    }
  }

  // Nuevo préstamo
  if (btnNuevoPrestamo) {
    btnNuevoPrestamo.addEventListener("click", async () => {
      // use simple inline prompts via UI or fallback to prompt
          if(!(window.UI && window.UI.inputModal)){
            console.warn('UI.inputModal not available - cannot open new loan modal');
            return;
          }
          const res = await window.UI.inputModal('Nuevo préstamo', [ 
            { name:'monto', label:'Monto del préstamo', type:'number' }, 
            { name:'interes', label:'Tasa de interés (%)', type:'number' }, 
            { name:'plazo', label:'Plazo (meses)', type:'number' } 
          ]);
          if(!res) return;
          // basic validation
          if(!res.monto || Number(res.monto) <= 0) return window.UI.showToast('Monto inválido','error');
          try{
            const resp = await fetch('/prestamos/crear',{
              method:'POST', 
              headers:{ 
                'Content-Type':'application/json', 
                Authorization:`Bearer ${token}` 
              }, 
              body: JSON.stringify({ 
                monto: Number(res.monto), 
                interes: Number(res.interes), 
                plazo: Number(res.plazo) 
              }) 
            });
            const j = await resp.json(); 
            if(!resp.ok) throw new Error(j.mensaje||'Error');
            window.UI.showToast('Préstamo creado correctamente.','success'); 
            cargarPrestamos();
          }catch(e){ 
            window.UI.showToast('Error: '+e.message,'error'); 
          }
        });
      }

  // Manejar el registro de pagos
  if (tablaPrestamosBody) {
    tablaPrestamosBody.addEventListener('click', async (e) => {
      if (!e.target.classList.contains('btnPago')) return;
      
      const id = e.target.dataset.id;
      const saldoPendiente = parseFloat(e.target.dataset.saldo);
      
      const res = await window.UI.inputModal('Registrar Pago', [
        { name: 'monto', label: 'Monto a pagar', type: 'number', max: saldoPendiente }
      ]);
      
      if (!res) return;
      
      const monto = parseFloat(res.monto);
      if (!monto || monto <= 0) {
        return window.UI.showToast('Monto inválido', 'error');
      }
      
      if (monto > saldoPendiente) {
        return window.UI.showToast(`El monto no puede exceder el saldo pendiente (${saldoPendiente})`, 'error');
      }
      
      try {
        const resp = await fetch(`/prestamos/${id}/pagos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ monto })
        });
        
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.mensaje || 'Error al registrar pago');
        
        window.UI.showToast('Pago registrado correctamente', 'success');
        cargarPrestamos(); // Recargar la lista de préstamos
      } catch (error) {
        window.UI.showToast('Error: ' + error.message, 'error');
      }
    });
    
    cargarPrestamos();
  }
});
