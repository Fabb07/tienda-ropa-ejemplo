// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { createClient } = require('@libsql/client');
const jwt = require('jsonwebtoken');        // <-- Nueva librería para tokens
const cookieParser = require('cookie-parser'); // <-- Nueva librería para leer cookies

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'urbana_seguridad_extrema_2026';

app.use(cors());
app.use(express.json());
app.use(cookieParser()); // Activar la lectura de cookies en el servidor

// --- 1. SISTEMA DE LOGIN Y GENERACIÓN DE TOKENS ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // Aquí defines tus credenciales maestras
    if (username === 'admin' && password === 'tiendaejemplo2026') {
        // Se crea un token digital con un tiempo de vida exacto de 30 minutos ('30m')
        const token = jwt.sign({ rol: 'administrador' }, JWT_SECRET, { expiresIn: '30m' });
        
        // Se guarda el token en una cookie segura del navegador
        res.cookie('token_acceso', token, {
            httpOnly: true, // Evita robo de sesión vía JavaScript
            maxAge: 30 * 60 * 1000 // La cookie se borra del navegador a los 30 min (en milisegundos)
        });
        return res.json({ mensaje: 'Autenticación exitosa' });
    }
    
    res.status(401).json({ error: 'Credenciales inválidas' });
});

// Middleware que intercepta las rutas y verifica el tiempo del token
const verificarSeguridad = (req, res, next) => {
    const token = req.cookies.token_acceso; // Buscar la cookie
    
    if (!token) {
        return res.redirect('/login.html'); // Si no hay token, enviar al login
    }
    try {
        jwt.verify(token, JWT_SECRET); // Verificar que el token sea válido y no haya expirado
        next(); // Todo está en orden, dejarlo pasar al panel
    } catch (err) {
        res.clearCookie('token_acceso'); // Limpiar token vencido
        return res.redirect('/login.html'); // Enviar al login
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
// Opcional: También podrías agregar 'verificarSeguridad' a los métodos POST, DELETE y PUT para doble protección.
app.get('/api/productos', async (req, res) => {
    try {
        const resultado = await db.execute("SELECT * FROM productos");
        res.json(resultado.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/productos/:id', async (req, res) => {
    try {
        const resultado = await db.execute({ sql: "DELETE FROM productos WHERE id = ?", args: [req.params.id] });
        res.json({ message: "Producto eliminado", cambios: resultado.rowsAffected });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/productos', upload.array('imagenes', 5), async (req, res) => {
    const { nombre, precio, descripcion } = req.body;
    let tallas = req.body.tallas ? (Array.isArray(req.body.tallas) ? req.body.tallas.join(',') : req.body.tallas) : '';
    const rutasImagenes = req.files && req.files.length > 0 ? req.files.map(file => file.path).join(',') : '';

    try {
        const resultado = await db.execute({
            sql: "INSERT INTO productos (nombre, precio, imagen, descripcion, tallas) VALUES (?, ?, ?, ?, ?)",
            args: [nombre, precio, rutasImagenes, descripcion || '', tallas]
        });
        res.json({ id: Number(resultado.lastInsertRowid), message: "Guardado con éxito" });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/productos/:id', async (req, res) => {
    try {
        await db.execute({ sql: 'UPDATE productos SET precio = ? WHERE id = ?', args: [req.body.precio, req.params.id] });
        res.json({ mensaje: "Actualizado" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/productos/:id/tallas', express.json(), async (req, res) => {
    try {
        await db.execute({ sql: 'UPDATE productos SET tallas = ? WHERE id = ?', args: [req.body.tallas, req.params.id] });
        res.json({ mensaje: "Actualizado" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => { console.log(`Servidor corriendo en el puerto ${PORT}`); });