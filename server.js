// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { createClient } = require('@libsql/client');
const jwt = require('jsonwebtoken');        // <-- Nueva librería para tokens
const cookieParser = require('cookie-parser'); // <-- Nueva librería para leer cookies
const bcrypt = require('bcrypt'); // <-- Nueva librería de encriptación
const rateLimit = require('express-rate-limit');
const helmet = require('helmet'); // <-- Nueva capa de seguridad HTTP

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Helmet con soporte para imágenes externas de Cloudinary
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "https://res.cloudinary.com"],
        },
    },
}));

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("ERROR FATAL: JWT_SECRET no está definido en las variables de entorno. Servidor detenido.");
    process.exit(1);
}

app.use(express.json());
app.use(cookieParser()); // Activar la lectura de cookies en el servidor

// Configuración de límite de intentos para el login
const limitadorLogin = rateLimit({
    windowMs: 15 * 60 * 1000, // Tiempo de bloqueo: 15 minutos
    max: 5, // Límite de 5 intentos por IP en esa ventana de tiempo
    message: { error: 'Demasiados intentos fallidos. Por favor, espera 15 minutos antes de volver a intentarlo.' },
    standardHeaders: true, 
    legacyHeaders: false,
});


// --- 1. SISTEMA DE LOGIN Y GENERACIÓN DE TOKENS ---
app.post('/api/login', limitadorLogin, async (req, res) => {
    const { username, password } = req.body;

    const usuarioCorrecto = process.env.ADMIN_USERNAME;
    const hashGuardado = process.env.ADMIN_PASSWORD_HASH;

    if (username === usuarioCorrecto) {
        const contrasenaValida = await bcrypt.compare(password, hashGuardado);

        if (contrasenaValida) {
            const token = jwt.sign({ rol: 'administrador' }, JWT_SECRET, { expiresIn: '30m' });

            // Detecta si el servidor está en Render o en tu Mac local
            const esProduccion = process.env.NODE_ENV === 'production';

            res.cookie('token_acceso', token, {
                httpOnly: true, // Evita robo de cookie mediante JavaScript
                secure: esProduccion, // true en Render (HTTPS), false en tu Mac (HTTP)
                sameSite: 'lax', // Protege contra ataques de falsificación de peticiones (CSRF)
                maxAge: 30 * 60 * 1000
            });
            res.json({ mensaje: 'Autenticación exitosa' });
        } else {
            res.status(401).json({ error: 'Credenciales inválidas' });
        }
    } else {
        res.status(401).json({ error: 'Credenciales inválidas' });
    }
});


// Middleware que intercepta las rutas y verifica el tiempo del token
const verificarSeguridad = (req, res, next) => {
    const token = req.cookies.token_acceso;
    let accesoConcedido = false;
    
    if (token) {
        try {
            jwt.verify(token, JWT_SECRET);
            accesoConcedido = true;
        } catch (err) {
            res.clearCookie('token_acceso');
        }
    }

    if (accesoConcedido) {
        next();
    } else if (req.originalUrl.startsWith('/api/')) {
        // Si el intruso ataca directo a la API, se bloquea con formato JSON
        res.status(401).json({ error: 'Acceso no autorizado a la base de datos' });
    } else {
        // Si el usuario entra al panel web sin sesión, se envía al login
        res.redirect('/login.html');
    }
};

// --- 2. PROTEGER LAS RUTAS DE ADMINISTRACIÓN ---
// Cualquier intento de acceder a archivos dentro de la carpeta admin debe pasar por el filtro
app.use('/admin', verificarSeguridad);

// --- 3. SERVIR ARCHIVOS ESTÁTICOS ---
app.use(express.static(path.join(__dirname, 'public')));


// --- 4. CONFIGURACIÓN DE CLOUDINARY Y TURSO (Sin cambios) ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: 'urbana-productos', allowed_formats: ['jpg', 'png', 'jpeg', 'webp'] }
});
const upload = multer({ storage: storage });

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function inicializarBaseDatos() {
    try {
        await db.execute(`CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL,
            precio INTEGER NOT NULL, imagen TEXT NOT NULL, descripcion TEXT, tallas TEXT
        )`);
        console.log("Base de datos conectada en Turso.");
    } catch (err) { console.error("Error BD:", err.message); }
}
inicializarBaseDatos();

// --- 5. RUTAS DE PRODUCTOS ---
app.get('/api/productos', async (req, res) => {
    try {
        const resultado = await db.execute("SELECT * FROM productos");
        res.json(resultado.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/productos/:id', verificarSeguridad, async (req, res) => {
    try {
        const resultado = await db.execute({ sql: "DELETE FROM productos WHERE id = ?", args: [req.params.id] });
        res.json({ message: "Producto eliminado", cambios: resultado.rowsAffected });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/productos', verificarSeguridad, upload.array('imagenes', 5), async (req, res) => {
    const { nombre, precio, descripcion } = req.body;
    let tallas = req.body.tallas ? (Array.isArray(req.body.tallas) ? req.body.tallas.join(',') : req.body.tallas) : '';
    const rutasImagenes = req.files && req.files.length > 0 ? req.files.map(file => file.path).join(',') : '';

    let mensajeError = null;

    // 1. Validar Nombre (obligatorio, string, entre 2 y 100 caracteres)
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2 || nombre.trim().length > 100) {
        mensajeError = "El nombre del producto es obligatorio y debe tener entre 2 y 100 caracteres.";
    } else {
        // 2. Validar Precio (número entero mayor a 0)
        const precioNum = Number(precio);
        if (isNaN(precioNum) || !Number.isInteger(precioNum) || precioNum <= 0) {
            mensajeError = "El precio debe ser un número entero mayor a 0.";
        } else {
            // 3. Validar Descripción (máximo 500 caracteres si se proporciona)
            if (descripcion && descripcion.length > 500) {
                mensajeError = "La descripción no puede superar los 500 caracteres.";
            }
        }
    }

    // Responder según el resultado de la validación
    if (mensajeError) {
        res.status(400).json({ error: mensajeError });
    } else {
        try {
            const resultado = await db.execute({
                sql: "INSERT INTO productos (nombre, precio, imagen, descripcion, tallas) VALUES (?, ?, ?, ?, ?)",
                args: [nombre.trim(), Number(precio), rutasImagenes, descripcion ? descripcion.trim() : '', tallas]
            });
            res.json({ id: Number(resultado.lastInsertRowid), message: "Guardado con éxito" });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
});

app.put('/api/productos/:id', verificarSeguridad, async (req, res) => {
    try {
        await db.execute({ sql: 'UPDATE productos SET precio = ? WHERE id = ?', args: [req.body.precio, req.params.id] });
        res.json({ mensaje: "Actualizado" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/productos/:id/tallas', verificarSeguridad, express.json(), async (req, res) => {
    try {
        await db.execute({ sql: 'UPDATE productos SET tallas = ? WHERE id = ?', args: [req.body.tallas, req.params.id] });
        res.json({ mensaje: "Actualizado" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => { console.log(`Servidor corriendo en el puerto ${PORT}`); });