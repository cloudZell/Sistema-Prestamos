// app.js
const fs = require('fs');
const https = require('https');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');

const { admin, db } = require('./src/firebase/firebaseAdmin');
const authRutas = require('./src/rutas/authRutas');
const prestamoRutas = require('./src/rutas/prestamoRutas');
const adminRutas = require('./src/rutas/adminRutas');

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/vistas', express.static(path.join(__dirname, 'vistas')));

// Debugging middleware para ver las rutas
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// RUTAS
app.use('/auth', authRutas);            // registro, login, perfil
app.use('/prestamos', prestamoRutas);  // API prestamos 
app.use('/admin', adminRutas);         // panel admin (lista usuarios)
app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'vistas','login.html')));
app.get('/registro', (req,res)=> res.sendFile(path.join(__dirname,'vistas','registro.html')));

// Manejador de rutas no encontradas (debe ir AL FINAL, después de todas las rutas)
app.use((req, res) => {
	res.status(404).json({ mensaje: `Ruta no encontrada: ${req.method} ${req.path}` });
});

// HTTPS (mkcert-aware) — en producción Render/hosts gestionan TLS.
// En production usaremos HTTP (la plataforma provee TLS). En desarrollo local
// se sigue intentando cargar certificados en ./cert si existen.
const SSL_DIR = path.join(__dirname, 'cert');

function findMkcertCerts(dir){
	if(!fs.existsSync(dir)) return null;
	const files = fs.readdirSync(dir);
	const certCandidates = files.filter(f => /^localhost(\+\d+)?\.pem$/.test(f));
	const prefer = certCandidates.find(f => /\+\d+/.test(f)) || certCandidates.find(f => f === 'localhost.pem');
	if(!prefer) return null;
	const certPath = path.join(dir, prefer);
	const base = prefer.replace(/\.pem$/, '');
	const keyNames = [base + '-key.pem', base + '.key.pem', base + '.key', base + '-key'];
	let keyPath = null;
	for(const k of keyNames){ if(files.includes(k)){ keyPath = path.join(dir,k); break; } }
	if(!keyPath){ if(files.includes('localhost-key.pem')) keyPath = path.join(dir,'localhost-key.pem'); }
	if(!keyPath) return null;
	return { certPath, keyPath };
}

const isProd = process.env.NODE_ENV === 'production' || process.env.FORCE_HTTP === '1';
const puerto = process.env.PORT || 3443;

if (isProd) {
	// En producción (Render, Cloud Run, etc.) escuchar por HTTP; el proveedor gestiona TLS
	app.listen(puerto, '0.0.0.0', () => {
		console.log(`Servidor HTTP en http://0.0.0.0:${puerto} (NODE_ENV=${process.env.NODE_ENV})`);
	});
} else {
	// Intentar HTTPS local con mkcert-style certs; si faltan, informar y usar HTTP temporalmente
	let certPair = findMkcertCerts(SSL_DIR);
	if(!certPair){
		const fallbackCert = path.join(SSL_DIR, 'localhost.pem');
		const fallbackKey = path.join(SSL_DIR, 'localhost-key.pem');
		if(fs.existsSync(fallbackCert) && fs.existsSync(fallbackKey)){
			certPair = { certPath: fallbackCert, keyPath: fallbackKey };
		}
	}

	if(!certPair){
		console.warn('Aviso: certificados SSL locales no encontrados en ./cert. Levantando servidor HTTP en modo desarrollo. Para HTTPS local use mkcert y coloque los archivos en ./cert.');
		app.listen(puerto, '0.0.0.0', () => {
			console.log(`Servidor HTTP en http://localhost:${puerto}`);
		});
	} else {
		console.log('Usando certificados SSL:');
		console.log('  cert:', certPair.certPath);
		console.log('  key :', certPair.keyPath);
		const opciones = { key: fs.readFileSync(certPair.keyPath), cert: fs.readFileSync(certPair.certPath) };
		const server = https.createServer(opciones, app);

		server.on('error', (err) => {
			if (err && err.code === 'EADDRINUSE') {
				console.error(`Error: puerto ${puerto} en uso (EADDRINUSE).`);
				console.error('Opciones: 1) cerrar el proceso que usa ese puerto, 2) arrancar con otra variable de entorno PORT, por ejemplo:');
				console.error("   PowerShell: $env:PORT=3444; node app.js");
				console.error('Comando para encontrar y matar el proceso (PowerShell/admin):');
				console.error("   netstat -ano | findstr :" + puerto);
				console.error("   taskkill /PID <pid> /F");
			} else {
				console.error('Error al iniciar servidor HTTPS:', err);
			}
			process.exit(1);
		});

		server.listen(puerto, '0.0.0.0', () => {
			console.log(`Servidor HTTPS en https://localhost:${puerto}`);
		});
	}
}
