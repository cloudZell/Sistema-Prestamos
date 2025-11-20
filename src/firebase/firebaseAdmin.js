// src/firebase/firebaseAdmin.js
// Configuración de Firebase Admin SDK (CommonJS)
// En producción leer las credenciales desde la variable de entorno
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const SECRET_FILE = '/etc/secrets/serviceAccountKey.json';

let serviceAccount;

// 1) Si existe un Secret File montado por Render, usarlo (recomendado)
if (fs.existsSync(SECRET_FILE)) {
  try {
    const raw = fs.readFileSync(SECRET_FILE, 'utf8');
    serviceAccount = JSON.parse(raw);
  } catch (err) {
    console.error(`Error al parsear el Secret File ${SECRET_FILE}:`, err.message || err);
    process.exit(1);
  }
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // 2) Si hay variable de entorno, intentar parsearla
  const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  try {
    serviceAccount = JSON.parse(rawEnv);
  } catch (err) {
    // Mostramos solo un fragmento del contenido para depurar sin revelar la clave completa
    const snippet = (rawEnv || '').slice(0, 200).replace(/\s+/g, ' ');
    console.error('FIREBASE_SERVICE_ACCOUNT no es JSON válido. Primeros 200 caracteres del valor:', snippet);
    console.error('Error JSON.parse:', err.message || err);
    // Intentar fallback local para desarrollo
    try {
      serviceAccount = require(path.join(__dirname, '..', '..', 'serviceAccountKey.json'));
      console.warn('Usando fallback local serviceAccountKey.json (dev).');
    } catch (e) {
      console.error('No se pudo usar fallback local. Asegúrate de configurar correctamente la variable o el Secret File.');
      process.exit(1);
    }
  }
} else {
  // 3) Fallback para desarrollo local: archivo en la raíz (NO comitearlo)
  try {
    serviceAccount = require(path.join(__dirname, '..', '..', 'serviceAccountKey.json'));
  } catch (err) {
    console.error('No se encontró serviceAccountKey.json y no hay FIREBASE_SERVICE_ACCOUNT ni Secret File. En entorno de producción debería existir la variable o el Secret File.');
    if (process.env.NODE_ENV === 'production') process.exit(1);
  }
}

if (!serviceAccount) {
  console.error('Credenciales de Firebase no disponibles. Abortando inicialización.');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://prestamosapp-p01-default-rtdb.firebaseio.com/'
});

module.exports = {
  admin,
  authAdmin: admin.auth(),
  dbAdmin: admin.database(),
};
