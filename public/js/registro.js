// registro.js
// Maneja el registro de nuevos usuarios con Firebase Auth

document.addEventListener("DOMContentLoaded", () => {
  const formRegistro = document.getElementById("formRegistro");

  formRegistro.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = document.getElementById("nombre");
    const email = document.getElementById("email");
    const password = document.getElementById("password");
    const rol = document.getElementById("rol");
    // inline validation
    if(!nombre.value.trim()){ if(window.UI && window.UI.showInlineError) return window.UI.showInlineError(nombre, 'Nombre requerido'); }
    if(!email.value.trim()){ if(window.UI && window.UI.showInlineError) return window.UI.showInlineError(email, 'Email requerido'); }
    if(!password.value.trim()){ if(window.UI && window.UI.showInlineError) return window.UI.showInlineError(password, 'Contraseña requerida'); }

    try {
      const resp = await fetch("/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.value.trim(), email: email.value.trim(), password: password.value.trim(), rol: rol.value })
      });
      const data = await resp.json();
  if(!resp.ok) throw new Error(data.mensaje || 'Error al registrar usuario');
  if(window.UI && window.UI.showToast) window.UI.showToast('Cuenta creada exitosamente. Ahora puedes iniciar sesión.','success'); else console.log('Cuenta creada exitosamente. Ahora puedes iniciar sesión.');
      window.location.href = '/vistas/login.html';
  }catch(e){
    // Manejo específico para correo ya en uso
    let msg = e.message || '';
    if (msg.includes('email address is already in use') || (msg.includes('correo') && msg.includes('uso'))) {
      msg = 'El correo electrónico ya está en uso. Por favor, utiliza otro.';
    } else {
      msg = 'Error: ' + msg;
    }
    // Siempre mostrar visualmente la notificación
    if(window.UI && window.UI.showToast) {
      window.UI.showToast(msg,'error');
    } else {
      alert(msg); // fallback visual si no existe UI
    }
  }
  });

  // clear inline errors
  ['nombre','email','password'].forEach(id=>{ const el=document.getElementById(id); if(el) el.addEventListener('input', ()=>{ if(window.UI && window.UI.clearInlineError) window.UI.clearInlineError(el); }); });
});
// duplicate block removed - single handler above is used
