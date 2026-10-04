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

app.use('/admin', (req, res, next) => {
    const token = req.cookies.token_acceso;
    let esValido = false;

    if (token) {
        try {
            jwt.verify(token, JWT_SECRET);
            esValido = true;
        } catch (error) {}
    }

    if (esValido) {
        next(); 
    } else {
        res.redirect('/login.html');
    }
});

app.use(express.static(path.join(__dirname, 'public')));

const limitadorLogin = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 5, 
    message: { error: 'Demasiados intentos fallidos. Por favor, espera 15 minutos.' },
    standardHeaders: true, 
    legacyHeaders: false,
});

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
        
        try {
            await db.execute("ALTER TABLE productos ADD COLUMN categoria TEXT DEFAULT 'general'");
        } catch (e) {}

        console.log("Base de datos conectada en Turso.");
    } catch (err) { console.error("Error BD:", err.message); }
}
inicializarBaseDatos();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuración Cloudinary optimizada
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { 
        folder: 'tienda_ropa', 
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        transformation: [
            { width: 1000, crop: "limit" }, // Evita resoluciones extremas
            { quality: "auto" }, // Compresión inteligente
            { fetch_format: "auto" } // Convierte automáticamente a WebP/AVIF
        ]
    }
});

// Configuración Multer con límite de peso
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5 MB por imagen
});

function verificarSeguridad(req, res, next) {
    const token = req.cookies.token_acceso;
    let validado = false;

    if (token) {
        try {
            jwt.verify(token, JWT_SECRET);
            validado = true;
        } catch (error) {}
    }

    if (validado) {
        next();
    } else {
        res.status(401).json({ error: 'Acceso denegado o sesión expirada' });
    }
}

app.post('/api/login', limitadorLogin, async (req, res) => {
    const { username, password } = req.body;
    const usuarioCorrecto = process.env.ADMIN_USERNAME;
    const hashGuardado = process.env.ADMIN_PASSWORD_HASH;
    let loginExitoso = false;

    if (username === usuarioCorrecto) {
        const contrasenaValida = await bcrypt.compare(password, hashGuardado);
        if (contrasenaValida) {
            loginExitoso = true;
        }
    }

    if (loginExitoso) {
        const token = jwt.sign({ rol: 'administrador' }, JWT_SECRET, { expiresIn: '15m' });
        const esProduccion = process.env.NODE_ENV === 'production';
        
        res.cookie('token_acceso', token, {
            httpOnly: true, 
            secure: esProduccion, 
            sameSite: 'lax', 
            maxAge: 15 * 60 * 1000 
        });
        res.json({ mensaje: 'Autenticación exitosa' });
    } else {
        res.status(401).json({ error: 'Credenciales inválidas' });
    }
});

app.post('/api/logout', (req, res) => {
    const esProduccion = process.env.NODE_ENV === 'production';
    res.clearCookie('token_acceso', {
        httpOnly: true,
        secure: esProduccion,
        sameSite: 'lax'
    });
    res.json({ mensaje: 'Sesión cerrada exitosamente' });
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

// --- NUEVA RUTA UNIFICADA DE EDICIÓN ---
app.put('/api/productos/:id', verificarSeguridad, upload.array('imagenes', 5), async (req, res) => {
    const { nombre, precio, descripcion, categoria } = req.body;
    let tallas = req.body.tallas ? (Array.isArray(req.body.tallas) ? req.body.tallas.join(',') : req.body.tallas) : '';
    const nuevasRutasImagenes = req.files && req.files.length > 0 ? req.files.map(file => file.path).join(',') : '';

    let mensajeError = null;
    const precioNum = Number(precio);

    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2 || nombre.trim().length > 100) {
        mensajeError = "El nombre es obligatorio (2 a 100 caracteres).";
    } else if (isNaN(precioNum) || !Number.isInteger(precioNum) || precioNum <= 0) {
        mensajeError = "El precio debe ser un número entero mayor a 0.";
    } else if (!categoria) {
        mensajeError = "Debe seleccionar una categoría.";
    } else if (descripcion && descripcion.length > 500) {
        mensajeError = "La descripción no puede superar 500 caracteres.";
    }

    if (mensajeError) {
        res.status(400).json({ error: mensajeError });
    } else {
        try {
            let sqlQuery = "";
            let sqlArgs = [];

            if (nuevasRutasImagenes !== '') {
                sqlQuery = "UPDATE productos SET nombre = ?, precio = ?, imagen = ?, descripcion = ?, tallas = ?, categoria = ? WHERE id = ?";
                sqlArgs = [nombre.trim(), precioNum, nuevasRutasImagenes, descripcion ? descripcion.trim() : '', tallas, categoria, req.params.id];
            } else {
                sqlQuery = "UPDATE productos SET nombre = ?, precio = ?, descripcion = ?, tallas = ?, categoria = ? WHERE id = ?";
                sqlArgs = [nombre.trim(), precioNum, descripcion ? descripcion.trim() : '', tallas, categoria, req.params.id];
            }

            await db.execute({ sql: sqlQuery, args: sqlArgs });
            res.json({ message: "Producto actualizado con éxito" });
        } catch (err) { 
            res.status(500).json({ error: err.message }); 
        }
    }
});

app.delete('/api/productos/:id', verificarSeguridad, async (req, res) => {
    try {
        await db.execute({ sql: "DELETE FROM productos WHERE id = ?", args: [req.params.id] });
        res.json({ message: "Eliminado con éxito" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Manejador de errores para imágenes demasiado pesadas
app.use((err, req, res, next) => {
    let mensajeError = err.message;
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        mensajeError = "Una o más imágenes superan el límite máximo de 5 MB.";
    }
    res.status(400).json({ error: mensajeError });
});

app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));