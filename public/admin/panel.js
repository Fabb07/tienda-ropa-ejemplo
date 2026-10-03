let todosLosProductos = [];
let paginaActual = 1;
const PRODUCTOS_POR_PAGINA = 15;

let editandoId = null;
let editandoTipo = null;

const selectCategoria = document.getElementById('categoria');
const contenedorTallas = document.getElementById('contenedor-tallas-dinamico');

selectCategoria.addEventListener('change', (e) => {
    const categoriaSeleccionada = e.target.value;
    
    while (contenedorTallas.firstChild) {
        contenedorTallas.removeChild(contenedorTallas.firstChild);
    }

    let opcionesTallas = [];
    if (categoriaSeleccionada === 'camisetas') {
        opcionesTallas = ['S', 'M', 'L', 'XL'];
    } else if (categoriaSeleccionada === 'pantalones') {
        opcionesTallas = ['28', '30', '32', '34', '36', '38'];
    } else if (categoriaSeleccionada === 'zapatos') {
        opcionesTallas = ['35', '36', '37', '38', '39', '40', '41', '42'];
    } else {
        opcionesTallas = ['Única'];
    }

    opcionesTallas.forEach(talla => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'tallas';
        checkbox.value = talla;
        
        if (talla === 'Única') { 
            checkbox.checked = true; 
            checkbox.style.display = 'none'; 
        }

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + talla));
        contenedorTallas.appendChild(label);
    });
});

document.getElementById('formulario-producto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    try {
        const response = await fetch('/api/productos', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            document.getElementById('mensaje').innerText = 'Producto agregado exitosamente';
            document.getElementById('mensaje').style.color = 'green';
            e.target.reset();
            contenedorTallas.innerHTML = '<p style="color: #666; font-size: 14px;">Selecciona una categoría primero.</p>';
            
            paginaActual = 1; 
            cargarInventario();
        } else {
            document.getElementById('mensaje').innerText = 'Error: ' + result.error;
            document.getElementById('mensaje').style.color = 'red';
        }
    } catch (error) {
        document.getElementById('mensaje').innerText = 'Error de conexión con el servidor.';
        document.getElementById('mensaje').style.color = 'red';
    }
});

async function cargarInventario() {
    try {
        const response = await fetch('/api/productos');
        todosLosProductos = await response.json();
        mostrarInventario();
    } catch (error) {
        console.error("Error cargando inventario:", error);
    }
}

async function eliminarProducto(id) {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
        try {
            await fetch(`/api/productos/${id}`, { method: 'DELETE' });
            cargarInventario();
        } catch (error) {
            alert('Error al eliminar el producto');
        }
    }
}

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

        const fila = document.createElement('tr');

        const tdImg = document.createElement('td');
        const img = document.createElement('img');
        img.src = miniatura;
        img.style.width = '50px';
        img.style.borderRadius = '4px';
        tdImg.appendChild(img);

        const tdNombre = document.createElement('td');
        tdNombre.textContent = producto.nombre;

        const tdPrecio = document.createElement('td');
        tdPrecio.textContent = `$${Number(producto.precio).toLocaleString('es-CO')}`;

        const tdAcciones = document.createElement('td');
        
        const btnPrecio = document.createElement('button');
        btnPrecio.textContent = 'Precio';
        btnPrecio.style.cssText = 'margin-right: 5px; padding: 5px 10px; background-color: #f39c12; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px;';
        btnPrecio.addEventListener('click', () => abrirModalEdicion(producto.id, 'precio', producto.precio));

        const btnTallas = document.createElement('button');
        btnTallas.textContent = 'Tallas';
        btnTallas.style.cssText = 'margin-right: 5px; padding: 5px 10px; background-color: #f39c12; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px;';
        btnTallas.addEventListener('click', () => abrirModalEdicion(producto.id, 'tallas', producto.tallas || ''));

        const btnEliminar = document.createElement('button');
        btnEliminar.className = 'btn-eliminar';
        btnEliminar.textContent = 'Eliminar';
        btnEliminar.addEventListener('click', () => eliminarProducto(producto.id));
        
        tdAcciones.appendChild(btnPrecio);
        tdAcciones.appendChild(btnTallas);
        tdAcciones.appendChild(btnEliminar);

        fila.appendChild(tdImg);
        fila.appendChild(tdNombre);
        fila.appendChild(tdPrecio);
        fila.appendChild(tdAcciones);

        tabla.appendChild(fila);
    });

    renderizarControlesPaginacionAdmin();
}

function abrirModalEdicion(id, tipo, valorActual) {
    editandoId = id;
    editandoTipo = tipo;
    
    const modal = document.getElementById('modal-edicion');
    const titulo = document.getElementById('modal-edicion-titulo');
    const desc = document.getElementById('modal-edicion-desc');
    const input = document.getElementById('modal-edicion-input');
    
    if (tipo === 'precio') {
        titulo.textContent = 'Editar Precio';
        desc.textContent = `Precio actual: $${Number(valorActual).toLocaleString('es-CO')}`;
    } else {
        titulo.textContent = 'Editar Tallas';
        desc.textContent = `Tallas actuales: ${valorActual}`;
    }
    
    input.value = valorActual;
    modal.style.display = 'flex';
}

document.getElementById('btn-cancelar-edicion').addEventListener('click', () => {
    document.getElementById('modal-edicion').style.display = 'none';
});

document.getElementById('btn-guardar-edicion').addEventListener('click', async () => {
    const nuevoValor = document.getElementById('modal-edicion-input').value;
    
    if (nuevoValor !== null && nuevoValor.trim() !== '') {
        const endpoint = `/api/productos/${editandoId}/${editandoTipo}`;
        let bodyData = null;
        
        if (editandoTipo === 'precio') {
            bodyData = { precio: nuevoValor };
        } else {
            bodyData = { tallas: nuevoValor };
        }

        try {
            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });
            
            if (response.ok) {
                document.getElementById('modal-edicion').style.display = 'none';
                cargarInventario(); 
            } else {
                const data = await response.json();
                alert('Error al actualizar: ' + data.error);
            }
        } catch (error) {
            alert('Error de conexión con el servidor.');
        }
    }
});

function renderizarControlesPaginacionAdmin() {
    const contenedorPaginacion = document.getElementById('paginacion-admin');
    
    if (contenedorPaginacion) {
        contenedorPaginacion.innerHTML = '';

        const totalPaginas = Math.ceil(todosLosProductos.length / PRODUCTOS_POR_PAGINA);

        if (totalPaginas > 1) {
            const estiloBoton = "padding: 5px 10px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px; background: white;";
            
            const btnAnterior = document.createElement('button');
            btnAnterior.textContent = '« Anterior';
            btnAnterior.style.cssText = estiloBoton;
            btnAnterior.disabled = (paginaActual === 1);
            if (btnAnterior.disabled) {
                btnAnterior.style.opacity = '0.5';
            }
            
            btnAnterior.addEventListener('click', () => {
                if (paginaActual > 1) {
                    paginaActual--;
                    mostrarInventario();
                }
            });
            contenedorPaginacion.appendChild(btnAnterior);

            for (let i = 1; i <= totalPaginas; i++) {
                const btnNumero = document.createElement('button');
                btnNumero.textContent = i;
                btnNumero.style.cssText = estiloBoton;
                
                if (i === paginaActual) {
                    btnNumero.style.backgroundColor = '#222';
                    btnNumero.style.color = '#fff';
                    btnNumero.style.fontWeight = 'bold';
                }
                
                btnNumero.addEventListener('click', () => {
                    paginaActual = i;
                    mostrarInventario();
                });
                contenedorPaginacion.appendChild(btnNumero);
            }

            const btnSiguiente = document.createElement('button');
            btnSiguiente.textContent = 'Siguiente »';
            btnSiguiente.style.cssText = estiloBoton;
            btnSiguiente.disabled = (paginaActual === totalPaginas);
            if (btnSiguiente.disabled) {
                btnSiguiente.style.opacity = '0.5';
            }
            
            btnSiguiente.addEventListener('click', () => {
                if (paginaActual < totalPaginas) {
                    paginaActual++;
                    mostrarInventario();
                }
            });
            contenedorPaginacion.appendChild(btnSiguiente);
        }
    }
}

cargarInventario();