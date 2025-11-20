// src/controladores/prestamoControlador.js
const modelo = require('../modelos/prestamoModelo');
const { calcularMontoTotal, calcularSaldoActual } = require('../modelos/calculosPrestamo');
const { v4: uuidv4 } = require('uuid');

async function listar(req, res){
  try{
    const role = req.role;
    if(role === 'admin'){
      const todos = await modelo.listarTodos();
      return res.json(todos);
    }
    const prestamos = await modelo.listarPorUsuario(req.uid || req.email);
    return res.json(prestamos);
  }catch(err){ console.error('listar', err); res.status(500).json({ mensaje:'Error al listar' }); }
}

async function crear(req, res){
  try{
    const body = req.body;
    const principal = Number(body.principal || body.monto || 0);
    const tasa = Number(body.tasa || body.interes || 0);
    const plazo = Number(body.plazo || 1);
    
    const { montoTotal, cuotaMensual, interesTotal } = calcularMontoTotal(principal, tasa, plazo);
    
    const nuevo = {
      id: uuidv4(),
      cliente_nombre: body.cliente_nombre || '',
      cliente_email: body.cliente_email || req.email || '',
      principal: principal,
      tasa: tasa,
      plazo: plazo,
      montoTotal: montoTotal,
      cuotaMensual: cuotaMensual,
      interesTotal: interesTotal,
      saldoPendiente: montoTotal,
      totalPagado: 0,
      fecha_inicio: body.fecha_inicio || new Date().toISOString().slice(0,10),
      tipo_pago: body.tipo_pago || 'amortizado',
      estado: 'pendiente',
      creado_por_uid: req.uid || req.email,
      creado_en: new Date().toISOString()
    };
    await modelo.crear(nuevo);
    res.json({ ok:true, prestamo: nuevo });
  }catch(err){ console.error('crear', err); res.status(500).json({ mensaje:'Error al crear' }); }
}

async function obtener(req, res){
  try{
    const p = await modelo.obtener(req.params.id);
    if(!p) return res.status(404).json({ mensaje:'No encontrado' });
    // Only admins or the creator can fetch the loan
    if(req.role !== 'admin' && String(p.creado_por_uid) !== String(req.uid)) return res.status(403).json({ mensaje:'No tienes permiso' });
    // Ensure response includes computed totals (montoTotal, totalPagado, saldoPendiente)
    try{
      const pagos = await modelo.listarPagos(req.params.id);
      const totalPagado = Array.isArray(pagos) ? pagos.reduce((s,x)=> s + Number(x.monto || x.amount || 0), 0) : 0;
      const principal = Number(p.principal || p.monto || 0);
      const tasa = Number(p.tasa || p.interes || 0);
      const plazo = Number(p.plazo || 1);
      const calc = calcularMontoTotal(principal, tasa, plazo);
      const montoTotal = p.montoTotal || calc.montoTotal || 0;
      const saldoPendiente = Math.max(0, montoTotal - totalPagado);
      p.montoTotal = montoTotal;
      p.totalPagado = totalPagado;
      p.saldoPendiente = saldoPendiente;
      p.estado = saldoPendiente <= 0 ? 'pagado' : (p.estado || 'pendiente');
    }catch(e){ /* non-fatal: continue with raw p */ }
    res.json({ prestamo: p });
  }catch(err){ console.error('obtener', err); res.status(500).json({ mensaje:'Error' }) }
}

async function eliminar(req, res){
  try{
    const p = await modelo.obtener(req.params.id);
    if(!p) return res.status(404).json({ mensaje:'No encontrado' });
    if(req.role !== 'admin' && String(p.creado_por_uid) !== String(req.uid)) return res.status(403).json({ mensaje:'No tienes permiso' });
    await modelo.eliminar(req.params.id);
    res.json({ ok:true });
  }catch(err){ console.error('eliminar', err); res.status(500).json({ mensaje:'Error al eliminar' }) }
}

async function registrarPago(req, res){
  try{
    const p = await modelo.obtener(req.params.id);
    if(!p) return res.status(404).json({ mensaje:'No encontrado' });
    if(req.role !== 'admin' && String(p.creado_por_uid) !== String(req.uid)) return res.status(403).json({ mensaje:'No tienes permiso' });
    
    const montoAPagar = Number(req.body.monto) || 0;
    if (montoAPagar <= 0) {
      return res.status(400).json({ mensaje: 'El monto debe ser mayor a 0' });
    }
    
    if (montoAPagar > p.saldoPendiente) {
      return res.status(400).json({ mensaje: 'El monto no puede exceder el saldo pendiente' });
    }
    
    const pago = { 
      id: uuidv4(), 
      monto: montoAPagar, 
      fecha: req.body.fecha || new Date().toISOString().slice(0,10) 
    };
    
    await modelo.agregarPago(req.params.id, pago);
    
    // Actualizar el saldo y estado del préstamo
    const nuevoTotalPagado = p.totalPagado + montoAPagar;
    const nuevoSaldo = p.montoTotal - nuevoTotalPagado;
    
    const actualizacion = {
      saldoPendiente: Math.max(0, nuevoSaldo),
      totalPagado: nuevoTotalPagado,
      estado: nuevoSaldo <= 0 ? 'pagado' : 'pendiente'
    };
    
    await modelo.actualizar(req.params.id, actualizacion);
    
    res.json({ 
      ok: true, 
      pago, 
      estado: actualizacion.estado,
      saldoPendiente: actualizacion.saldoPendiente,
      totalPagado: actualizacion.totalPagado
    });
  }catch(err){ console.error('registrarPago', err); res.status(500).json({ mensaje:'Error al registrar pago' }) }
}

async function listarPagos(req, res){
  try{
    const p = await modelo.obtener(req.params.id);
    if(!p) return res.status(404).json({ mensaje:'No encontrado' });
    if(req.role !== 'admin' && String(p.creado_por_uid) !== String(req.uid)) return res.status(403).json({ mensaje:'No tienes permiso' });
    const pagos = await modelo.listarPagos(req.params.id);
    res.json({ pagos });
  }catch(err){ console.error(err); res.status(500).json({ mensaje:'Error' }) }
}

module.exports = { listar, crear, obtener, eliminar, registrarPago, listarPagos, actualizar };

async function actualizar(req, res){
  try{
    const id = req.params.id;
    const cambios = req.body;
    const p = await modelo.obtener(id);
    if(!p) return res.status(404).json({ mensaje:'No encontrado' });
    if(req.role !== 'admin' && String(p.creado_por_uid) !== String(req.uid)) return res.status(403).json({ mensaje:'No tienes permiso' });
    const updated = await modelo.actualizar(id, cambios);
    res.json({ ok:true, prestamo: updated });
  }catch(err){ console.error('actualizar', err); res.status(500).json({ mensaje:'Error al actualizar' }); }
}
