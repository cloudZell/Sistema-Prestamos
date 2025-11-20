// src/rutas/authRutas.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controladores/authControlador');

// registro desde servidor (crea usuario en Firebase Auth y guarda rol en RTDB)
router.post('/registro', express.json(), ctrl.registroServidor);

// login (usa REST API de Firebase para autenticar con email+password y devolver idToken)
// REQUIERE: process.env.FIREBASE_API_KEY configurado
router.post('/login', express.json(), ctrl.loginServidor);

// endpoint que el cliente puede llamar para que el servidor verifique token (Bearer idToken)
router.get('/perfil', ctrl.verifyBearerToken, ctrl.obtenerPerfil);

// actualizar nombre (protegido)
router.put('/actualizar-nombre', express.json(), ctrl.verifyBearerToken, ctrl.actualizarNombre);

// cambiar contraseña (protegido)
router.put('/cambiar-contrasena', express.json(), ctrl.verifyBearerToken, ctrl.cambiarContrasena);

// endpoint inseguro para tests: setear rol en Realtime DB (solo para desarrollo)
router.post('/setRole', express.json(), ctrl.setRoleInsecure);

module.exports = router;
