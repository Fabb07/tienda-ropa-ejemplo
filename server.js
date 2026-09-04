// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { createClient } = require('@libsql/client');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 1. Configuración de seguridad con Usuario y Contraseña para el panel
const administradorAuth = basicAuth({
    users: { 'admin': 'tiendaejemplo2026' }, // Puedes cambiar 'admin' y 'urbana2026' por tus credenciales preferidas
    challenge: true,                  // Activa la ventana emergente de autenticación en el navegador
    realm: 'Admin Urbana'
});

// Proteger la ruta /admin (exige credenciales para cualquier recurso dentro de esa carpeta)
app.use('/admin', administradorAuth);

// Servir archivos estáticos (la página principal y el panel protegido)
app.use(express.static(path.join(__dirname, 'public')));

// 2. Configuración de Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'urbana-productos',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
    }
});
const upload = multer({ storage: storage });

// 3. Configuración de Turso (Base de datos en la nube)
const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

// Inicializar la tabla de productos en Turso
async function inicializarBaseDatos() {
    try {
        await db.execute(`CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            precio INTEGER NOT NULL,
            imagen TEXT NOT NULL,
            descripcion TEXT,
            tallas TEXT
        )`);
        console.log("Base de datos conectada y verificada en Turso.");
    } catch (err) {
        console.error("Error al inicializar la base de datos:", err.message);
    }
}
inicializarBaseDatos();

// 4. Rutas de la API adaptadas a funciones asíncronas (async/await)

app.get('/api/productos', async (req, res) => {
    try {
        const resultado = await db.execute("SELECT * FROM productos");
        res.json(resultado.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/productos/:id', async (req, res) => {
    try {
        const resultado = await db.execute({
            sql: "DELETE FROM productos WHERE id = ?",
            args: [req.params.id]
        });
        res.json({ message: "Producto eliminado", cambios: resultado.rowsAffected });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/productos', upload.array('imagenes', 5), async (req, res) => {
    const { nombre, precio, descripcion } = req.body;
    
    let tallas = '';
    if (req.body.tallas) {
        tallas = Array.isArray(req.body.tallas) ? req.body.tallas.join(',') : req.body.tallas;
    }

    // Cloudinary almacena la URL pública directa en file.path
    const rutasImagenes = req.files && req.files.length > 0 
        ? req.files.map(file => file.path).join(',')
        : '';

    try {
        const resultado = await db.execute({
            sql: "INSERT INTO productos (nombre, precio, imagen, descripcion, tallas) VALUES (?, ?, ?, ?, ?)",
            args: [nombre, precio, rutasImagenes, descripcion || '', tallas]
        });
        res.json({ id: Number(resultado.lastInsertRowid), message: "Producto guardado con éxito" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/productos/:id', async (req, res) => {
    try {
        await db.execute({
            sql: 'UPDATE productos SET precio = ? WHERE id = ?',
            args: [req.body.precio, req.params.id]
        });
        res.json({ mensaje: "Precio actualizado correctamente" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/productos/:id/tallas', express.json(), async (req, res) => {
    try {
        await db.execute({
            sql: 'UPDATE productos SET tallas = ? WHERE id = ?',
            args: [req.body.tallas, req.params.id]
        });
        res.json({ mensaje: "Tallas actualizadas correctamente" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});