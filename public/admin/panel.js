// public/panel.js

// Variables globales para la paginación
let todosLosProductos = [];
let paginaActual = 1;
const PRODUCTOS_POR_PAGINA = 28;

document.getElementById('formulario-producto').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    const form = e.target;
    const formData = new FormData(form); 

    try {
        const respuesta = await fetch('/api/productos', {
            method: 'POST',
            body: formData
        });

        if (respuesta.ok) {
            form.reset(); 
            // Recargar para mostrar el nuevo producto
            cargarInventario(); 
        } else {
            const error = await respuesta.json();
            alert("Error al guardar: " + (error.error || "Error desconocido"));
        }
    } catch (error) {
        console.error("Error en la petición:", error);
    }
});

// 1. Cargar datos del servidor y guardarlos en memoria
async function cargarInventario() {
    try {
        const respuesta = await fetch('/api/productos');
        todosLosProductos = await respuesta.json();
        
        // Ajustar la página si eliminamos el último elemento de la página actual
        const totalPaginas = Math.ceil(todosLosProductos.length / PRODUCTOS_POR_PAGINA);
        if (paginaActual > totalPaginas && totalPaginas > 0) {
            paginaActual = totalPaginas;
        } else if (totalPaginas === 0) {
            paginaActual = 1;
        }
        
        mostrarInventario();
    } catch (error) {
        console.error("Error cargando inventario:", error);
    }
}

// 2. Renderizar solo los productos de la página actual en la tabla
function mostrarInventario() {
    const tabla = document.getElementById('lista-inventario');
    tabla.innerHTML = ''; 

    const inicio = (paginaActual - 1) * PRODUCTOS_POR_PAGINA;
    const fin = inicio + PRODUCTOS_POR_PAGINA;
    const productosPagina = todosLosProductos.slice(inicio, fin);

    productosPagina.forEach(producto => {
        let miniatura = '';
        if (producto.imagen) {
            const listaImagenes = producto.imagen.split(',');
            miniatura = listaImagenes[0]; 
        }

        // Crear elementos de la fila de forma segura
        const fila = document.createElement('tr');

        const tdImg = document.createElement('td');
        const img = document.createElement('img');
        img.src = miniatura;
        img.className = 'miniatura';
        img.alt = 'Vista previa';
        img.style.width = '50px';
        img.style.borderRadius = '4px';
        tdImg.appendChild(img);

        const tdNombre = document.createElement('td');
        tdNombre.textContent = producto.nombre; // Protegido contra XSS

        const tdPrecio = document.createElement('td');
        tdPrecio.textContent = `$${Number(producto.precio).toLocaleString('es-CO')}`; // Protegido contra XSS

        const tdAcciones = document.createElement('td');
        
        const btnPrecio = document.createElement('button');
        btnPrecio.className = 'btn-editar';
        btnPrecio.textContent = 'Precio';
        btnPrecio.addEventListener('click', () => editarPrecio(producto.id, producto.precio));

        const btnTallas = document.createElement('button');
        btnTallas.className = 'btn-editar';
        btnTallas.textContent = 'Tallas';
        btnTallas.addEventListener('click', () => editarTallas(producto.id, producto.tallas || ''));

        const btnEliminar = document.createElement('button');
        btnEliminar.className = 'btn-eliminar';
        btnEliminar.textContent = 'Eliminar';
        btnEliminar.addEventListener('click', () => eliminarProducto(producto.id));

        tdAcciones.appendChild(btnPrecio);
        tdAcciones.appendChild(btnTallas);
        tdAcciones.appendChild(btnEliminar);

        // Adjuntar celdas a la fila
        fila.appendChild(tdImg);
        fila.appendChild(tdNombre);
        fila.appendChild(tdPrecio);
        fila.appendChild(tdAcciones);

        tabla.appendChild(fila);
    });

    renderizarControlesPaginacion();
}

// 3. Crear los botones de paginación dinámicamente debajo de la tabla
function renderizarControlesPaginacion() {
    let contenedorPaginacion = document.getElementById('paginacion-panel');
    
    // Si el contenedor no existe, se crea y se inserta después de la tabla
    if (!contenedorPaginacion) {
        contenedorPaginacion = document.createElement('div');
        contenedorPaginacion.id = 'paginacion-panel';
        contenedorPaginacion.classList.add('paginacion-container');
        
        const elementoTabla = document.getElementById('lista-inventario').closest('table');
        elementoTabla.parentNode.insertBefore(contenedorPaginacion, elementoTabla.nextSibling);
    }

    contenedorPaginacion.innerHTML = '';

    const totalPaginas = Math.ceil(todosLosProductos.length / PRODUCTOS_POR_PAGINA);

    if (totalPaginas > 1) {
        // Botón Anterior
        const btnAnterior = document.createElement('button');
        btnAnterior.textContent = '« Anterior';
        btnAnterior.disabled = (paginaActual === 1);
        btnAnterior.addEventListener('click', () => {
            if (paginaActual > 1) {
                paginaActual--;
                mostrarInventario();
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
                mostrarInventario();
            });
            contenedorPaginacion.appendChild(btnNumero);
        }

        // Botón Siguiente
        const btnSiguiente = document.createElement('button');
        btnSiguiente.textContent = 'Siguiente »';
        btnSiguiente.disabled = (paginaActual === totalPaginas);
        btnSiguiente.addEventListener('click', () => {
            if (paginaActual < totalPaginas) {
                paginaActual++;
                mostrarInventario();
            }
        });
        contenedorPaginacion.appendChild(btnSiguiente);
    }
}

async function eliminarProducto(id) {
    const confirmacion = confirm("¿Estás seguro de que deseas eliminar este producto de la tienda?");
    if (confirmacion) {
        try {
            const respuesta = await fetch(`/api/productos/${id}`, { method: 'DELETE' });
            if (respuesta.ok) {
                cargarInventario(); 
            }
        } catch (error) {
            console.error("Error al eliminar:", error);
        }
    }
}

async function editarPrecio(id, precioActual) {
    const nuevoPrecio = prompt("Ingresa el nuevo precio en COP:", precioActual);
    
    if (nuevoPrecio !== null && nuevoPrecio.trim() !== "") {
        try {
            const respuesta = await fetch(`/api/productos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ precio: parseInt(nuevoPrecio) })
            });

            if (respuesta.ok) {
                cargarInventario(); 
            }
        } catch (error) {
            console.error("Error al editar precio:", error);
        }
    }
}

async function editarTallas(id, tallasActuales) {
    const nuevasTallas = prompt("Ingresa las tallas separadas por coma (ejemplo: S,M,L,XL):", tallasActuales);
    
    if (nuevasTallas !== null) {
        const tallasFormateadas = nuevasTallas.split(',').map(t => t.trim().toUpperCase()).filter(t => t).join(',');
        
        try {
            const respuesta = await fetch(`/api/productos/${id}/tallas`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tallas: tallasFormateadas })
            });

            if (respuesta.ok) {
                cargarInventario(); 
            }
        } catch (error) {
            console.error("Error al editar tallas:", error);
        }
    }
}

// Iniciar la carga al abrir el panel
cargarInventario();