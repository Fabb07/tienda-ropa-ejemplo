let imagenesActuales = [];
let indiceImagenActual = 0;
let todosLosProductos = [];
let productosFiltrados = [];
let paginaActual = 1;
const PRODUCTOS_POR_PAGINA = 28;
let filtroActual = 'todo';

async function cargarProductos() {
    try {
        const respuesta = await fetch('/api/productos');
        todosLosProductos = await respuesta.json(); 
        productosFiltrados = todosLosProductos;
        paginaActual = 1;
        mostrarProductos(); 
    } catch (error) {
        document.getElementById('contenedor-productos').innerHTML = '<p>Error al cargar el catálogo.</p>';
    }
}

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

        const tarjeta = document.createElement('article');
        tarjeta.classList.add('product-card');
        tarjeta.style.cursor = 'pointer';
        tarjeta.addEventListener('click', () => abrirModal(producto));

        // Crear y sanitizar la imagen
        const img = document.createElement('img');
        img.src = primeraImagen;
        img.alt = producto.nombre;
        img.loading = 'lazy'; // <-- Obliga al navegador a descargar la imagen solo cuando el cliente hace scroll

        const h3 = document.createElement('h3');
        h3.textContent = producto.nombre;

        const pPrecio = document.createElement('p');
        pPrecio.classList.add('price');
        pPrecio.textContent = `$${Number(producto.precio).toLocaleString('es-CO')} COP`;

        tarjeta.appendChild(img);
        tarjeta.appendChild(h3);
        tarjeta.appendChild(pPrecio);

        contenedor.appendChild(tarjeta);
    });

    renderizarControlesPaginacion();
}

function renderizarControlesPaginacion() {
    const contenedorPaginacion = document.getElementById('paginacion');
    contenedorPaginacion.innerHTML = '';

    const totalPaginas = Math.ceil(productosFiltrados.length / PRODUCTOS_POR_PAGINA);

    if (totalPaginas > 1) {
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

        for (let i = 1; i <= totalPaginas; i++) {
            const btnNumero = document.createElement('button');
            btnNumero.textContent = i;
            if (i === paginaActual) btnNumero.classList.add('activo');
            btnNumero.addEventListener('click', () => {
                paginaActual = i;
                mostrarProductos();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            contenedorPaginacion.appendChild(btnNumero);
        }

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

function abrirModal(producto) {
    imagenesActuales = producto.imagen ? producto.imagen.split(',') : [];
    indiceImagenActual = 0;

    document.getElementById('modal-nombre').innerText = producto.nombre;
    document.getElementById('modal-precio').innerText = `$${Number(producto.precio).toLocaleString('es-CO')} COP`;
    document.getElementById('modal-descripcion').innerText = producto.descripcion || 'Sin descripción disponible.';

    const contenedorTallas = document.querySelector('.tallas-list');
    contenedorTallas.innerHTML = ''; 
            
    if (producto.tallas) {
        // Separa, limpia espacios extra y vuelve a unir con coma y espacio
        const arregloTallas = producto.tallas.split(',');
        const tallasLimpias = arregloTallas.map(talla => talla.trim());
        const textoFinal = tallasLimpias.join(', ');

        const spanTalla = document.createElement('span');
        spanTalla.textContent = textoFinal; 
        contenedorTallas.appendChild(spanTalla);
    } else {
        const spanUnica = document.createElement('span');
        spanUnica.textContent = 'Única';
        contenedorTallas.appendChild(spanUnica);
    }

    actualizarImagenCarrusel();

    const flechas = document.querySelectorAll('.flecha-carrusel');
    flechas.forEach(f => f.style.display = imagenesActuales.length > 1 ? 'block' : 'none');

    const numeroTelefono = "573154396296"; 
    const mensaje = encodeURIComponent(`Hola, me interesa esta prenda: ${producto.nombre}. ¿Me podrían dar más información?`);
    
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

document.getElementById('btn-cerrar-modal').addEventListener('click', cerrarModal);
document.getElementById('btn-carrusel-izq').addEventListener('click', () => cambiarImagen(-1));
document.getElementById('btn-carrusel-der').addEventListener('click', () => cambiarImagen(1));

document.getElementById('btn-menu').addEventListener('click', () => {
    document.getElementById('nav-links').classList.toggle('active');
});

document.querySelectorAll('.nav-filtro').forEach(boton => {
    boton.addEventListener('click', (e) => {
        e.preventDefault();
        const nuevoFiltro = e.target.getAttribute('data-filtro');
        aplicarFiltro(nuevoFiltro);
        document.getElementById('nav-links').classList.remove('active');
        
        // Scroll automático hacia la parte superior
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});

// Cerrar modal al hacer clic fuera de la tarjeta
window.addEventListener('click', (e) => {
    const modal = document.getElementById('modal-producto');
    if (e.target === modal) {
        cerrarModal();
    }
});

cargarProductos();