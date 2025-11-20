// login.js
// Maneja el inicio de sesión de usuarios con Firebase Auth

document.addEventListener("DOMContentLoaded", () => {
  const formLogin = document.getElementById("formLogin");

  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    // inline validation
    const emailEl = document.getElementById('email');
    const passEl = document.getElementById('password');
    if(!email){ if(window.UI && window.UI.showInlineError) window.UI.showInlineError(emailEl, 'Correo requerido'); return; }
    if(!password){ if(window.UI && window.UI.showInlineError) window.UI.showInlineError(passEl, 'Contraseña requerida'); return; }

    try {
      // Llamada al backend para iniciar sesión
      const respuesta = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await respuesta.json();

      if (!respuesta.ok) throw new Error(data.mensaje || "Error al iniciar sesión");

      // Guardamos el token JWT de Firebase en sessionStorage
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("rol", data.rol);

      // Redirigimos según el rol
      if (data.rol === "admin") {
        window.location.href = "/vistas/admin.html";
      } else {
        window.location.href = "/vistas/dashboard.html";
      }

    } catch (error) {
      const errMsg = 'Error: ' + error.message;
      if(window.UI && window.UI.showToast) window.UI.showToast(errMsg,'error'); else console.error(errMsg);
    }
  });

  // clear inline errors on input
  ['email','password'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', ()=>{ if(window.UI && window.UI.clearInlineError) window.UI.clearInlineError(el); });
  });
});
