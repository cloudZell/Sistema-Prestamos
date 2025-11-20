// src/modelos/prestamoModelo.js
const { dbAdmin: db } = require('../firebase/firebaseAdmin');
const PATH_PRESTAMOS = 'prestamos';
const PATH_PAGOS = 'pagos';

async function crear(prestamo){
  await db.ref(`${PATH_PRESTAMOS}/${prestamo.id}`).set(prestamo);
  return prestamo;
}

async function listarTodos(){
  const snap = await db.ref(PATH_PRESTAMOS).once('value');
  const val = snap.val() || {};
  return Object.keys(val).map(k => val[k]);
}

async function listarPorUsuario(uid){
  // Prefer direct lookup by creado_por_uid for correctness and privacy
  const snap = await db.ref(PATH_PRESTAMOS).orderByChild('creado_por_uid').equalTo(uid).once('value');
  const val = snap.val() || {};
  return Object.keys(val).map(k => val[k]);
}

async function obtener(id){
  const snap = await db.ref(`${PATH_PRESTAMOS}/${id}`).once('value');
  return snap.val();
}

async function eliminar(id){
  await db.ref(`${PATH_PRESTAMOS}/${id}`).remove();
  await db.ref(`${PATH_PAGOS}/${id}`).remove();
}

async function agregarPago(prestamoId, pago){
  await db.ref(`${PATH_PAGOS}/${prestamoId}/${pago.id}`).set(pago);
  return pago;
}

async function listarPagos(prestamoId){
  const snap = await db.ref(`${PATH_PAGOS}/${prestamoId}`).once('value');
  const val = snap.val() || {};
  return Object.keys(val).map(k => val[k]);
}



// Actualizar campos de un préstamo existente
async function actualizar(id, cambios){
  const ref = db.ref(`${PATH_PRESTAMOS}/${id}`);
  const snap = await ref.once('value');
  if(!snap.exists()) throw new Error('No encontrado');
  await ref.update(cambios);
  const updated = (await ref.once('value')).val();
  return updated;
}

module.exports = { crear, listarTodos, listarPorUsuario, obtener, eliminar, agregarPago, listarPagos, actualizar };
