// src/rutas/prestamoRutas.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controladores/prestamoControlador');
const { verifyBearerToken } = require('../controladores/authControlador');

router.get('/listar', verifyBearerToken, ctrl.listar);        // GET /prestamos/listar
router.post('/crear', verifyBearerToken, express.json(), ctrl.crear); // POST /prestamos/crear
router.patch('/:id', verifyBearerToken, express.json(), ctrl.actualizar);
router.get('/:id', verifyBearerToken, ctrl.obtener);
router.delete('/:id', verifyBearerToken, ctrl.eliminar);
router.post('/:id/pagos', verifyBearerToken, express.json(), ctrl.registrarPago);
router.get('/:id/pagos', verifyBearerToken, ctrl.listarPagos);

module.exports = router;
