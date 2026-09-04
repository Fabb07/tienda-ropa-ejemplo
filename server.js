// server.js

/*
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./tienda.db', (err) => {
    if (err) {
        console.error("Error al abrir la base de datos:", err.message);
    } else {
        console.log("Conectado exitosamente a la base de datos SQLite.");
        db.run(`CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            precio INTEGER NOT NULL,
            imagen TEXT NOT NULL,
            descripcion TEXT,
            tallas TEXT
        )`);
    }
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public', 'img'));
    },
    filename: (req, file, cb) => {
        const nombreUnico = Date.now() + '-' + file.originalname.toLowerCase().replace(/\s+/g, '-');
        cb(null, nombreUnico);
    }
});
const upload = multer({ storage: storage });

app.get('/api/productos', (req, res) => {
    db.all("SELECT * FROM productos", [], (err, filas) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(filas);
    });
});

app.delete('/api/productos/:id', (req, res) => {
    const id = req.params.id;
    const sql = "DELETE FROM productos WHERE id = ?";
    db.run(sql, id, function(err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ message: "Producto eliminado con éxito", cambios: this.changes });
    });
});

// Endpoint para guardar producto con múltiples imágenes, descripción y tallas
app.post('/api/productos', upload.array('imagenes', 5), (req, res) => {
    const { nombre, precio, descripcion } = req.body;
    
    let tallas = '';
    if (req.body.tallas) {
        tallas = Array.isArray(req.body.tallas) ? req.body.tallas.join(',') : req.body.tallas;
    }

    const rutasImagenes = req.files && req.files.length > 0 
        ? req.files.map(file => file.filename).join(',')
        : '';

    const sql = "INSERT INTO productos (nombre, precio, imagen, descripcion, tallas) VALUES (?, ?, ?, ?, ?)";
    db.run(sql, [nombre, precio, rutasImagenes, descripcion || '', tallas], function(err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, message: "Producto guardado con éxito" });
    });
});

// Endpoint para actualizar el precio
app.put('/api/productos/:id', (req, res) => {
    const id = req.params.id;
    const nuevoPrecio = req.body.precio;

    const sql = 'UPDATE productos SET precio = ? WHERE id = ?';

    db.run(sql, [nuevoPrecio, id], function(err) {
        if (err) {
            console.error("Error en la base de datos:", err.message);
            return res.status(500).json({ error: "Error al actualizar el precio" });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: "Producto no encontrado en la base de datos" });
        }
        
        res.json({ mensaje: "Precio actualizado correctamente" });
    });
});

// Endpoint para actualizar las tallas
app.put('/api/productos/:id/tallas', express.json(), (req, res) => {
    const sql = 'UPDATE productos SET tallas = ? WHERE id = ?';
    db.run(sql, [req.body.tallas, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Tallas actualizadas correctamente" });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
*/


// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { createClient } = require('@libsql/client');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Configuración de Cloudinary
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

// 2. Configuración de Turso (Base de datos en la nube)
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

// 3. Rutas de la API adaptadas a funciones asíncronas (async/await)

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
