// src/controladores/adminControlador.js
// Controlador con funciones administrativas para listar usuarios y préstamos

const { admin, dbAdmin } = require('../firebase/firebaseAdmin');

// Listar todos los usuarios registrados
async function listarUsuarios(req, res) {
  try {
    // Obtener usuarios de Firebase Auth
    const listUsersResult = await admin.auth().listUsers();
    const users = listUsersResult.users.map(user => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '',
      disabled: user.disabled
    }));

    // Obtener roles de la base de datos
    const rolesSnap = await dbAdmin.ref('roles').once('value');
    const roles = rolesSnap.val() || {};

    // Combinar la información
    const usuarios = users.map(user => ({
      ...user,
      rol: roles[user.uid] || 'cliente'
    }));

    res.json({ usuarios });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ mensaje: 'Error al obtener usuarios', error: error.message });
  }
}

// Crear nuevo usuario
async function crearUsuario(req, res) {
  try {
    const { email, password, displayName, rol } = req.body;

    // Crear usuario en Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName
    });

    // Guardar rol en la base de datos
    await dbAdmin.ref(`roles/${userRecord.uid}`).set(rol || 'cliente');

    res.status(201).json({
      mensaje: 'Usuario creado exitosamente',
      usuario: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        rol
      }
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ mensaje: 'Error al crear usuario', error: error.message });
  }
}

// Actualizar usuario
async function actualizarUsuario(req, res) {
  try {
    const { uid } = req.params;
    const { displayName, email, password, rol } = req.body;

    // Actualizar en Firebase Auth
    const updateData = {};
    if (displayName) updateData.displayName = displayName;
    if (email) updateData.email = email;
    if (password) updateData.password = password;

    await admin.auth().updateUser(uid, updateData);

    // Actualizar rol si se proporcionó
    if (rol) {
      await dbAdmin.ref(`roles/${uid}`).set(rol);
    }

    res.json({ mensaje: 'Usuario actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ mensaje: 'Error al actualizar usuario', error: error.message });
  }
}

// Eliminar usuario
async function eliminarUsuario(req, res) {
  try {
    const { uid } = req.params;
    console.log('Iniciando eliminación de usuario:', uid);
    console.log('Rol del solicitante:', req.role);

    // Validar UID
    if (!uid) {
      console.error('UID no proporcionado en la solicitud');
      return res.status(400).json({ mensaje: 'UID requerido' });
    }

    try {
      // Verificar que el usuario existe antes de intentar eliminarlo
      const userRecord = await admin.auth().getUser(uid);
      console.log('Usuario encontrado:', userRecord.email);
    } catch (e) {
      console.error('Usuario no encontrado:', e);
      return res.status(404).json({ mensaje: 'Usuario no encontrado', error: e.message });
    }

    console.log('Eliminando usuario de Firebase Auth...');
    await admin.auth().deleteUser(uid);
    console.log('Usuario eliminado de Firebase Auth');

    console.log('Eliminando rol de la base de datos...');
    await dbAdmin.ref(`roles/${uid}`).remove();
    console.log('Rol eliminado de la base de datos');

    res.json({ mensaje: 'Usuario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      mensaje: 'Error al eliminar usuario', 
      error: error.message,
      stack: error.stack
    });
  }
}

// Listar todos los préstamos del sistema (para administrador)
async function listarPrestamosAdmin(req, res) {
  try {
    const refPrestamos = dbAdmin.ref('prestamos');
    const snapshot = await refPrestamos.once('value');
    const data = snapshot.val() || {};

    const prestamos = Object.values(data);
    res.json(prestamos);
  } catch (error) {
    console.error('Error al obtener préstamos:', error);
    res.status(500).json({ mensaje: 'Error al obtener préstamos', error: error.message });
  }
}

module.exports = { 
  listarUsuarios, 
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  listarPrestamosAdmin 
};
