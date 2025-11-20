// src/rutas/adminRutas.js
const express = require('express');
const router = express.Router();
const { verifyBearerToken } = require('../controladores/authControlador');
const { listarUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario, listarPrestamosAdmin } = require('../controladores/adminControlador');

// Middleware para verificar rol de admin
const verificarAdmin = (req, res, next) => {
  if (req.role !== 'admin') {
    return res.status(403).json({ mensaje: 'No autorizado. Se requiere rol de administrador.' });
  }
  next();
};

// Middleware para debugging de rutas
router.use((req, res, next) => {
  console.log('\n=== Admin Route Debug ===');
  console.log(`${req.method} ${req.baseUrl}${req.path}`);
  console.log('Params:', req.params);
  console.log('Query:', req.query);
  console.log('Headers:', {
    authorization: req.headers.authorization ? 'Bearer [...]' : 'No token',
    ...req.headers
  });
  console.log('Body:', req.body);
  console.log('User Role:', req.role);
  console.log('======================\n');
  next();
});

// Rutas CRUD de usuarios
router.get('/usuarios', verifyBearerToken, verificarAdmin, listarUsuarios);
router.post('/usuarios', verifyBearerToken, verificarAdmin, crearUsuario);
router.put('/usuarios/:uid', verifyBearerToken, verificarAdmin, actualizarUsuario);
router.delete('/usuarios/:uid', verifyBearerToken, verificarAdmin, eliminarUsuario);

// Ruta de prueba para verificar que el router está funcionando
router.get('/test', (req, res) => {
  res.json({ message: 'Admin routes working' });
});

module.exports = router;
