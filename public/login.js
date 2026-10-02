document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Enviar datos al servidor
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    if (response.ok) {
        // Si el login es exitoso, redirigir al panel protegido
        window.location.href = '/admin/panel.html';
    } else {
        // Mostrar error si la contraseña es mala
        document.getElementById('error-msg').style.display = 'block';
    }
});