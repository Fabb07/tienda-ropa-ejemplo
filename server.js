// 1. IMPORTAR LAS LIBRERÍAS NECESARIAS
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = 3000; // El puerto de tu computador donde correrá el servidor

// 2. CONFIGURACIONES BÁSICAS (MIDDLEWARES)
app.use(cors()); // Permite que el frontend se comunique con el backend
app.use(express.json()); // Permite al servidor entender datos en formato JSON
app.use(express.static(path.join(__dirname, 'public'))); // Hace pública la carpeta 'public' (HTML, CSS, Imágenes)

// 3. CONFIGURAR LA BASE DE DATOS SQLITE
// Esto creará automáticamente un archivo llamado 'tienda.db' en la raíz de tu proyecto
const db = new sqlite3.Database('./tienda.db', (err) => {
    if (err) {
        console.error("Error al abrir la base de datos:", err.message);
    } else {
        console.log("Conectado exitosamente a la base de datos SQLite.");
        // Crear la tabla de productos si no existe
        db.run(`CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            precio INTEGER NOT NULL,
            imagen TEXT NOT NULL
        )`);
    }
});

// 4. CONFIGURAR MULTER (Para guardar las imágenes que suba el administrador)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Guardamos las fotos directamente en la carpeta de imágenes del frontend
        cb(null, path.join(__dirname, 'public', 'img'));
    },
    filename: (req, file, cb) => {
        // Le damos un nombre único a cada imagen usando la fecha actual para evitar duplicados
        const nombreUnico = Date.now() + '-' + file.originalname.toLowerCase().replace(/\s+/g, '-');
        cb(null, nombreUnico);
    }
});
const upload = multer({ storage: storage });

// ==========================================
// 5. DEFINIR LAS RUTAS DEL SISTEMA (APIs)
// ==========================================

// RUTA A: Obtener todos los productos (Para el Catálogo y el Panel Admin)
app.get('/api/productos', (req, res) => {
    db.all("SELECT * FROM productos", [], (err, filas) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(filas); // Devuelve la lista de productos en formato JSON
    });
});

// RUTA B: Agregar un nuevo producto (Usado por el Administrador)
// 'upload.single('imagen')' intercepta la foto subida y la guarda antes de registrar los datos
app.post('/api/productos', upload.single('imagen'), (req, res) => {
    const { nombre, precio } = req.body;
    
    // Si el usuario subió una foto, guardamos su ruta relativa (ej: img/foto.jpg)
    // Si no, le asignamos una imagen por defecto
    const rutaImagen = req.file ? `img/${req.file.filename}` : 'img/default.jpg';

    const sql = "INSERT INTO productos (nombre, precio, imagen) VALUES (?, ?, ?)";
    db.run(sql, [nombre, precio, rutaImagen], function(err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({
            message: "Producto agregado con éxito",
            id: this.lastID
        });
    });
});

// RUTA C: Eliminar un producto (Usado por el Administrador)
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

// 6. ENCENDER EL SERVIDOR
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});