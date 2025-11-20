// perfil.js
// Muestra y permite actualizar los datos del perfil del usuario

document.addEventListener("DOMContentLoaded", async () => {
  const token = sessionStorage.getItem("token");
  const userRole = sessionStorage.getItem("rol");

  if (!token) {
    window.location.href = "/vistas/login.html";
    return;
  }

  // Modificar el link de inicio según el rol del usuario
  const linkInicio = document.querySelector('nav a[href="/vistas/dashboard.html"]');
  if (linkInicio && userRole === 'admin') {
    linkInicio.href = '/vistas/admin.html';
  }

  const btnCerrarSesion = document.getElementById("btnCerrarSesion");
  btnCerrarSesion.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/vistas/login.html";
  });

  const perfilNombre = document.getElementById("perfilNombre");
  const perfilCorreo = document.getElementById("perfilCorreo");
  const perfilRol = document.getElementById("perfilRol");
  const nuevoNombre = document.getElementById("nuevoNombre");
  const btnActualizarNombre = document.getElementById("btnActualizarNombre");
  const nuevaContrasena = document.getElementById("nuevaContrasena");
  const btnCambiarContrasena = document.getElementById("btnCambiarContrasena");

  // Cargar datos del perfil
  try {
    const respuesta = await fetch("/auth/perfil", { headers: { Authorization: `Bearer ${token}` } });
    const data = await respuesta.json();
    if (!respuesta.ok) throw new Error(data.mensaje);
    perfilNombre.textContent = data.nombre;
    perfilCorreo.textContent = data.email;
    perfilRol.textContent = data.rol;
  } catch (error) {
    if(window.UI && window.UI.showToast) window.UI.showToast('Error al obtener perfil: '+error.message,'error'); else console.error('Error al obtener perfil: '+error.message);
  }

  // Actualizar nombre
  btnActualizarNombre.addEventListener("click", async () => {
  const nombre = nuevoNombre.value.trim();
  if (!nombre) return (window.UI && window.UI.showInlineError) ? window.UI.showInlineError(nuevoNombre, 'Debes ingresar un nombre.') : (console.warn('Debes ingresar un nombre.'), null);

    try {
      const respuesta = await fetch("/auth/actualizar-nombre", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ nombre })
      });
      const data = await respuesta.json();
      if (!respuesta.ok) throw new Error(data.mensaje);
  if(window.UI && window.UI.showToast) window.UI.showToast('Nombre actualizado correctamente.','success'); else console.log('Nombre actualizado correctamente.');
      perfilNombre.textContent = nombre;
  } catch (error) { if(window.UI && window.UI.showToast) window.UI.showToast('Error: '+error.message,'error'); else console.error('Error: '+error.message); }
  });

  // Cambiar contraseña
  btnCambiarContrasena.addEventListener("click", async () => {
  const nueva = nuevaContrasena.value.trim();
  if (!nueva) return (window.UI && window.UI.showInlineError) ? window.UI.showInlineError(nuevaContrasena, 'Debes ingresar una nueva contraseña.') : (console.warn('Debes ingresar una nueva contraseña.'), null);

    try {
      const respuesta = await fetch("/auth/cambiar-contrasena", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ nueva })
      });
      const data = await respuesta.json();
      if (!respuesta.ok) throw new Error(data.mensaje);
  if(window.UI && window.UI.showToast) window.UI.showToast('Contraseña cambiada correctamente.','success'); else console.log('Contraseña cambiada correctamente.');
      nuevaContrasena.value = "";
  } catch (error) { if(window.UI && window.UI.showToast) window.UI.showToast('Error: '+error.message,'error'); else console.error('Error: '+error.message); }
  });

  // clear inline errors
  if(window.UI && window.UI.clearInlineError){ [nuevoNombre, nuevaContrasena].forEach(el=>{ if(el) el.addEventListener('input', ()=> window.UI.clearInlineError(el)); }); }
});
