// src/modelos/usuarioModelo.js
// Modelo de datos para representar a un usuario del sistema

export class Usuario {
  constructor(uid, nombre, email, rol) {
    this.uid = uid;        // ID único de Firebase Auth
    this.nombre = nombre;  // Nombre completo
    this.email = email;    // Correo electrónico
    this.rol = rol;        // Rol del usuario (cliente / admin)
  }
}
