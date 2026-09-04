// public/panel.js
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
            cargarInventario(); 
        } else {
            const error = await respuesta.json();
            alert("Error al guardar: " + (error.error || "Error desconocido"));
        }
    } catch (error) {
        console.error("Error en la petición:", error);
    }
});

async function cargarInventario() {
    try {
        const respuesta = await fetch('/api/productos');
        const productos = await respuesta.json();
        
        const tabla = document.getElementById('lista-inventario');
        tabla.innerHTML = ''; 

        productos.forEach(producto => {
            let miniatura = '';
            if (producto.imagen) {
                const listaImagenes = producto.imagen.split(',');
                // Se toma directamente la primera URL devuelta por Cloudinary
                miniatura = listaImagenes[0]; 
            }

            const fila = `
                <tr>
                    <td><img src="${miniatura}" class="miniatura" alt="Vista previa"></td>
                    <td>${producto.nombre}</td>
                    <td>$${Number(producto.precio).toLocaleString('es-CO')}</td>
                    <td>
                        <button class="btn-editar" onclick="editarPrecio(${producto.id}, ${producto.precio})">Precio</button>
                        <button class="btn-editar" onclick="editarTallas(${producto.id}, '${producto.tallas || ''}')">Tallas</button>
                        <button class="btn-eliminar" onclick="eliminarProducto(${producto.id})">Eliminar</button>
                    </td>
                </tr>
            `;
            tabla.innerHTML += fila;
        });
    } catch (error) {
        console.error("Error cargando inventario:", error);
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

cargarInventario();