require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { createClient } = require('@libsql/client');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("ERROR FATAL: JWT_SECRET no está definido. Servidor detenido.");
    process.exit(1);
}

// Configuración de Helmet estricto (ya no permite scripts en línea)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "https://res.cloudinary.com"],
        },
    },
}));

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiting para Login
const limitadorLogin = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 5, 
    message: { error: 'Demasiados intentos fallidos. Por favor, espera 15 minutos.' },
    standardHeaders: true, 
    legacyHeaders: false,
});

// Configuración Turso
const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function inicializarBaseDatos() {
    try {
        await db.execute(`CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL,
            precio INTEGER NOT NULL, imagen TEXT NOT NULL, descripcion TEXT, tallas TEXT, categoria TEXT
        )`);
        
        // Intenta añadir la columna a la tabla si no existe
        try {
            await db.execute("ALTER TABLE productos ADD COLUMN categoria TEXT DEFAULT 'general'");
        } catch (e) {}

        console.log("Base de datos conectada en Turso.");
    } catch (err) { console.error("Error BD:", err.message); }
}
inicializarBaseDatos();

// Configuración Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: 'tienda_ropa', allowed_formats: ['jpg', 'png', 'jpeg', 'webp'] }
});
const upload = multer({ storage: storage });

// Middleware de autenticación
function verificarSeguridad(req, res, next) {
    const token = req.cookies.token_acceso;
    if (!token) return res.status(401).json({ error: 'Acceso denegado' });
    try {
        jwt.verify(token, JWT_SECRET);
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
}

// Rutas
app.post('/api/login', limitadorLogin, async (req, res) => {
    const { username, password } = req.body;
    const usuarioCorrecto = process.env.ADMIN_USERNAME;
    const hashGuardado = process.env.ADMIN_PASSWORD_HASH;

    if (username === usuarioCorrecto) {
        const contrasenaValida = await bcrypt.compare(password, hashGuardado);
        if (contrasenaValida) {
            const token = jwt.sign({ rol: 'administrador' }, JWT_SECRET, { expiresIn: '8h' });
            const esProduccion = process.env.NODE_ENV === 'production';
            
            res.cookie('token_acceso', token, {
                httpOnly: true, 
                secure: esProduccion, 
                sameSite: 'lax', 
                maxAge: 8 * 60 * 60 * 1000
            });
            res.json({ mensaje: 'Autenticación exitosa' });
        } else {
            res.status(401).json({ error: 'Credenciales inválidas' });
        }
    } else {
        res.status(401).json({ error: 'Credenciales inválidas' });
    }
});

app.get('/api/productos', async (req, res) => {
    try {
        const resultado = await db.execute("SELECT * FROM productos ORDER BY id DESC");
        res.json(resultado.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/productos', verificarSeguridad, upload.array('imagenes', 5), async (req, res) => {
    const { nombre, precio, descripcion, categoria } = req.body;
    let tallas = req.body.tallas ? (Array.isArray(req.body.tallas) ? req.body.tallas.join(',') : req.body.tallas) : '';
    const rutasImagenes = req.files && req.files.length > 0 ? req.files.map(file => file.path).join(',') : '';

    let mensajeError = null;

    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2 || nombre.trim().length > 100) {
        mensajeError = "El nombre es obligatorio (2 a 100 caracteres).";
    } else {
        const precioNum = Number(precio);
        if (isNaN(precioNum) || !Number.isInteger(precioNum) || precioNum <= 0) {
            mensajeError = "El precio debe ser un número entero mayor a 0.";
        } else {
            if (!categoria) {
                mensajeError = "Debe seleccionar una categoría.";
            } else {
                if (descripcion && descripcion.length > 500) {
                    mensajeError = "La descripción no puede superar 500 caracteres.";
                }
            }
        }
    }

    if (mensajeError) {
        res.status(400).json({ error: mensajeError });
    } else {
        try {
            const resultado = await db.execute({
                sql: "INSERT INTO productos (nombre, precio, imagen, descripcion, tallas, categoria) VALUES (?, ?, ?, ?, ?, ?)",
                args: [nombre.trim(), Number(precio), rutasImagenes, descripcion ? descripcion.trim() : '', tallas, categoria]
            });
            res.json({ id: Number(resultado.lastInsertRowid), message: "Guardado" });
        } catch (err) { res.status(400).json({ error: err.message }); }
    }
});

app.delete('/api/productos/:id', verificarSeguridad, async (req, res) => {
    try {
        await db.execute({ sql: "DELETE FROM productos WHERE id = ?", args: [req.params.id] });
        res.json({ message: "Eliminado con éxito" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));