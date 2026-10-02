// Variables para el Modal
let imagenesActuales = [];
let indiceImagenActual = 0;
let productoSeleccionado = null;

// Variables para la Paginación y Filtrado
let todosLosProductos = [];
let productosFiltrados = [];
let paginaActual = 1;
const PRODUCTOS_POR_PAGINA = 28;
let filtroActual = 'todo';

// Cargar datos desde el servidor
async function cargarProductos() {
    try {
        const respuesta = await fetch('/api/productos');
        todosLosProductos = await respuesta.json(); 
        productosFiltrados = todosLosProductos;
        paginaActual = 1;
        mostrarProductos(); 
    } catch (error) {
        console.error("Error cargando los productos:", error);
        document.getElementById('contenedor-productos').innerHTML = '<p>Error al cargar el catálogo desde el servidor.</p>';
    }
}

// Aplicar el filtro de navegación
function aplicarFiltro(nuevoFiltro) {
    filtroActual = nuevoFiltro;
    paginaActual = 1;

    if (filtroActual === 'todo') {
        productosFiltrados = todosLosProductos;
    } else if (filtroActual === 'novedades') {
        productosFiltrados = todosLosProductos.slice().reverse().slice(0, 10);
    } else {
        productosFiltrados = todosLosProductos.filter(p => p.categoria === filtroActual);
    }

    mostrarProductos();
}

// Mostrar solo los productos de la página seleccionada
function mostrarProductos() {
    const contenedor = document.getElementById('contenedor-productos');
    contenedor.innerHTML = ''; 

    const inicio = (paginaActual - 1) * PRODUCTOS_POR_PAGINA;
    const fin = inicio + PRODUCTOS_POR_PAGINA;
    const productosPagina = productosFiltrados.slice(inicio, fin);

    productosPagina.forEach(producto => {
        let primeraImagen = '';
        if (producto.imagen) {
            const lista = producto.imagen.split(',');
            primeraImagen = lista[0];
        }

        // Crear la etiqueta <article> de forma segura
        const tarjeta = document.createElement('article');
        tarjeta.classList.add('product-card');
        tarjeta.style.cursor = 'pointer';
        tarjeta.addEventListener('click', () => abrirModal(producto));

        // Crear y sanitizar la imagen
        const img = document.createElement('img');
        img.src = primeraImagen;
        img.alt = producto.nombre;

        // Crear y sanitizar el título
        const h3 = document.createElement('h3');
        h3.textContent = producto.nombre;

        // Crear y sanitizar el precio
        const pPrecio = document.createElement('p');
        pPrecio.classList.add('price');
        pPrecio.textContent = `$${Number(producto.precio).toLocaleString('es-CO')} COP`;

        // Ensamblar la tarjeta de manera segura
        tarjeta.appendChild(img);
        tarjeta.appendChild(h3);
        tarjeta.appendChild(pPrecio);

        contenedor.appendChild(tarjeta);
    });

    renderizarControlesPaginacion();
}

// Generar los botones de navegación numéricos
function renderizarControlesPaginacion() {
    const contenedorPaginacion = document.getElementById('paginacion');
    contenedorPaginacion.innerHTML = '';

    const totalPaginas = Math.ceil(productosFiltrados.length / PRODUCTOS_POR_PAGINA);

    if (totalPaginas > 1) {
        // Botón "Anterior"
        const btnAnterior = document.createElement('button');
        btnAnterior.textContent = '« Anterior';
        btnAnterior.disabled = (paginaActual === 1);
        btnAnterior.addEventListener('click', () => {
            if (paginaActual > 1) {
                paginaActual--;
                mostrarProductos();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
        contenedorPaginacion.appendChild(btnAnterior);

        // Botones Numerados
        for (let i = 1; i <= totalPaginas; i++) {
            const btnNumero = document.createElement('button');
            btnNumero.textContent = i;
            if (i === paginaActual) {
                btnNumero.classList.add('activo');
            }
            btnNumero.addEventListener('click', () => {
                paginaActual = i;
                mostrarProductos();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            contenedorPaginacion.appendChild(btnNumero);
        }

        // Botón "Siguiente"
        const btnSiguiente = document.createElement('button');
        btnSiguiente.textContent = 'Siguiente »';
        btnSiguiente.disabled = (paginaActual === totalPaginas);
        btnSiguiente.addEventListener('click', () => {
            if (paginaActual < totalPaginas) {
                paginaActual++;
                mostrarProductos();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
        contenedorPaginacion.appendChild(btnSiguiente);
    }
}

// --- Funciones del Modal ---
function abrirModal(producto) {
    productoSeleccionado = producto;
    imagenesActuales = producto.imagen ? producto.imagen.split(',') : [];
    indiceImagenActual = 0;

    document.getElementById('modal-nombre').innerText = producto.nombre;
    document.getElementById('modal-precio').innerText = `$${Number(producto.precio).toLocaleString('es-CO')} COP`;
    document.getElementById('modal-descripcion').innerText = producto.descripcion || 'Sin descripción disponible.';

    const contenedorTallas = document.querySelector('.tallas-list');
    contenedorTallas.innerHTML = ''; 
            
    if (producto.tallas) {
        const listaTallas = producto.tallas.split(',');
        listaTallas.forEach(talla => {
            const spanTalla = document.createElement('span');
            spanTalla.textContent = talla.trim(); 
            contenedorTallas.appendChild(spanTalla);
        });
    } else {
        const spanUnica = document.createElement('span');
        spanUnica.textContent = 'Única';
        contenedorTallas.appendChild(spanUnica);
    }

    actualizarImagenCarrusel();

    const flechas = document.querySelectorAll('.flecha-carrusel');
    flechas.forEach(f => f.style.display = imagenesActuales.length > 1 ? 'block' : 'none');

    const numeroTelefono = "573001234567"; 
    const mensaje = encodeURIComponent(`Hola, estoy interesado en el producto "${producto.nombre}" con precio de $${producto.precio}.`);
    document.getElementById('modal-whatsapp').href = `https://wa.me/${numeroTelefono}?text=${mensaje}`;

    document.getElementById('modal-producto').style.display = 'flex';
}

function cambiarImagen(direccion) {
    if (imagenesActuales.length > 1) {
        indiceImagenActual = (indiceImagenActual + direccion + imagenesActuales.length) % imagenesActuales.length;
        actualizarImagenCarrusel();
    }
}

function actualizarImagenCarrusel() {
    const imgElement = document.getElementById('modal-imagen');
    if (imagenesActuales.length > 0) {
        imgElement.src = imagenesActuales[indiceImagenActual];
    }
}

function cerrarModal() {
    document.getElementById('modal-producto').style.display = 'none';
}

// --- Configuración Inicial y Eventos ---
// Vinculamos los eventos de los botones del modal
document.getElementById('btn-cerrar-modal').addEventListener('click', cerrarModal);
document.getElementById('btn-carrusel-izq').addEventListener('click', () => cambiarImagen(-1));
document.getElementById('btn-carrusel-der').addEventListener('click', () => cambiarImagen(1));

// Lógica del Menú Hamburguesa
document.getElementById('btn-menu').addEventListener('click', () => {
    const navLinks = document.getElementById('nav-links');
    navLinks.classList.toggle('active');
});

// Lógica de los botones de navegación
document.querySelectorAll('.nav-filtro').forEach(boton => {
    boton.addEventListener('click', (e) => {
        e.preventDefault();
        const nuevoFiltro = e.target.getAttribute('data-filtro');
        aplicarFiltro(nuevoFiltro);
        
        // Cierra el menú en la versión móvil tras seleccionar una opción
        document.getElementById('nav-links').classList.remove('active');
    });
});

// Inicializar la carga al abrir la web
cargarProductos();