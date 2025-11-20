// src/controladores/authControlador.js
// node-fetch v3 es ESM-only. Intentamos acceder a fetch de varias formas para mantener compatibilidad
let fetch;
try {
  // intento de require (funciona si se instaló una versión CommonJS o si hay un wrapper)
  // eslint-disable-next-line global-require
  fetch = require('node-fetch');
  if (fetch && fetch.default) fetch = fetch.default; // en algunos empaques viene en default
} catch (e) {
  // si require falla, comprobamos si globalThis.fetch está disponible (Node 18+ o pollyfill)
  if (typeof globalThis.fetch === 'function') {
    fetch = globalThis.fetch;
  } else {
    // fallback dinámico (import) — esto devuelve una promesa, así que creamos un wrapper
    fetch = async (...args) => {
      const mod = await import('node-fetch');
      const fn = mod.default || mod;
      return fn(...args);
    };
  }
}

const { admin, dbAdmin: db } = require('../firebase/firebaseAdmin');

// Registrar usuario desde servidor (crea usuario en Firebase Auth y guarda rol)
async function registroServidor(req, res){
  try{
    const { nombre, email, password, rol } = req.body;
    if(!nombre || !email || !password) return res.status(400).json({ mensaje: 'Faltan datos' });

    // crear usuario en Firebase Auth
    const userRecord = await admin.auth().createUser({
      email: email.toLowerCase(),
      password,
      displayName: nombre
    });

    // guardar rol en Realtime DB (solo para demo)
    await db.ref(`roles/${userRecord.uid}`).set(rol || 'cliente');

    return res.status(201).json({ ok: true, uid: userRecord.uid });
  }catch(err){
    console.error('registroServidor', err);
    return res.status(500).json({ mensaje: err.message || 'Error al registrar' });
  }
}

// Login servidor: usa Firebase Auth REST API para intercambiar email+password por idToken
// Requiere que definas FIREBASE_API_KEY en variables de entorno
async function loginServidor(req, res){
  try{
  // limpieza: logs de diagnóstico removidos
    const { email, password } = req.body;
    if(!email || !password) return res.status(400).json({ mensaje:'Faltan datos' });

    let apiKey = process.env.FIREBASE_API_KEY;
    if(!apiKey){
      // intentar obtener apiKey desde la configuración del cliente como fallback
      try{
        // require no puede importar ESM directamente; leemos el archivo con require via path to public config
        const clientCfg = require('../../public/js/firebaseClientConfig.js');
        // si el cliente exportara, tomaríamos clientCfg.apiKey, pero el archivo es ESM y no exporta en CommonJS.
        // En su lugar haremos un fallback directo a la cadena conocida (hardcode) si no existe env var.
        apiKey = 'AIzaSyAjoRnEupxT6UX01-vhkKC1q-QRsxq38SA';
      }catch(e){
        apiKey = 'AIzaSyAjoRnEupxT6UX01-vhkKC1q-QRsxq38SA';
      }
    }

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    const json = await resp.json();
    if(resp.status !== 200){
      return res.status(401).json({ mensaje: json.error && json.error.message ? json.error.message : 'No autorizado' });
    }

    // json.idToken contiene idToken (JWT)
    // opcional: obtener rol desde RTDB
    const decoded = await admin.auth().verifyIdToken(json.idToken);
    const uid = decoded.uid || decoded.sub;
    const snap = await db.ref(`roles/${uid}`).once('value');
    const role = snap.exists() ? snap.val() : 'cliente';

    // devolver token al cliente (client JS guardará en sessionStorage)
    return res.json({ token: json.idToken, uid, rol: role, expiresIn: json.expiresIn });
  }catch(err){
    console.error('loginServidor', err);
    return res.status(500).json({ mensaje: err.message || 'Error al iniciar sesión' });
  }
}

// Middleware: verifica Authorization: Bearer <idToken>
async function verifyBearerToken(req, res, next){
  try{
    const auth = req.headers.authorization || '';
    if(!auth.startsWith('Bearer ')) return res.status(401).json({ mensaje:'Token no encontrado' });
    const idToken = auth.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.uid = decoded.uid || decoded.sub;
    req.email = decoded.email || null;
    // leer rol desde RTDB
    const snap = await db.ref(`roles/${req.uid}`).once('value');
    req.role = snap.exists() ? snap.val() : 'cliente';
    next();
  }catch(err){
    console.error('verifyBearerToken', err);
    return res.status(401).json({ mensaje:'Token inválido' });
  }
}

// Obtener perfil (protegido) - retorna nombre, email, rol
async function obtenerPerfil(req, res){
  try{
    // cuando se llama directamente a /perfil con auth header, verifyBearerToken debe ejecutarse antes
    // pero también permitimos que el cliente envíe token por cookie (no usado en este flujo)
    // si req.uid no existe, lo intentamos extraer si hay cookie
    if(!req.uid){
      return res.status(401).json({ mensaje:'No autenticado' });
    }
    const user = await admin.auth().getUser(req.uid);
    return res.json({ nombre: user.displayName || '', email: user.email || '', rol: req.role || 'cliente' });
  }catch(err){
    console.error('obtenerPerfil', err);
    return res.status(500).json({ mensaje: err.message || 'Error' });
  }
}

// Actualizar nombre (protegido)
async function actualizarNombre(req, res){
  try{
    const nuevo = req.body.nombre;
    if(!nuevo) return res.status(400).json({ mensaje:'Nombre vacío' });
    if(!req.uid) return res.status(401).json({ mensaje:'No autenticado' });
    await admin.auth().updateUser(req.uid, { displayName: nuevo });
    return res.json({ ok:true });
  }catch(err){
    console.error('actualizarNombre', err);
    return res.status(500).json({ mensaje: err.message || 'Error' });
  }
}

// Cambiar contraseña (protegido) — servidor cambia password directamente (requiere confianza)
async function cambiarContrasena(req, res){
  try{
    const nueva = req.body.nueva;
    if(!nueva) return res.status(400).json({ mensaje:'Contraseña vacía' });
    if(!req.uid) return res.status(401).json({ mensaje:'No autenticado' });
    await admin.auth().updateUser(req.uid, { password: nueva });
    return res.json({ ok:true });
  }catch(err){
    console.error('cambiarContrasena', err);
    return res.status(500).json({ mensaje: err.message || 'Error' });
  }
}

// Set role (insecure, solo dev)
async function setRoleInsecure(req,res){
  try{
    const { uid, role } = req.body;
    if(!uid || !role) return res.status(400).json({ mensaje:'Faltan parámetros' });
    await db.ref(`roles/${uid}`).set(role);
    return res.json({ ok:true });
  }catch(err){ console.error('setRoleInsecure', err); return res.status(500).json({ mensaje: err.message }) }
}

module.exports = { registroServidor, loginServidor, verifyBearerToken, obtenerPerfil, actualizarNombre, cambiarContrasena, setRoleInsecure };
