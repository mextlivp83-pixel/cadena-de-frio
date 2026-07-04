import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Ocultar el cuerpo del documento inmediatamente para evitar el parpadeo visual del dashboard
document.body.style.opacity = "0";
document.body.style.transition = "opacity 0.2s ease";

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        console.log("Acceso denegado: Sin sesión activa.");
        // Comprobación robusta: si la URL no contiene "login", redirige
        if (!window.location.pathname.toLowerCase().includes("login")) {
            // Usamos la ruta absoluta con "/" al inicio para que busque en la raíz de Vercel
            window.location.href = "/login.html";
        } else {
            // Si ya estamos en la página de login, nos aseguramos de que sea visible
            document.body.style.opacity = "1";
        }
    } else {
        try {
            const userDocRef = doc(db, "usuarios", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const datosUsuario = userDoc.data();
                const rol = datosUsuario.rol;
                
                const txtNombre = document.getElementById('user-display-name');
                if (txtNombre) {
                    txtNombre.textContent = datosUsuario.nombre || user.email;
                }

                // Control estricto de roles y permisos
                if (rol === "Operator") {
                    // Convertimos la URL actual a minúsculas para una validación segura
                    const rutaCompleta = window.location.pathname.toLowerCase();

                    // Lista de módulos prohibidos para el rol Operator
                    const paginasProhibidas = ["catalogo", "reportes", "ia", "mapa_admin"];

                    // Validación robusta compatible con extensiones .html (local) y URLs limpias (Vercel)
                    const esPaginaProhibida = paginasProhibidas.some(pagina => {
                        // Extraemos el último fragmento de la ruta para compararlo con precisión
                        const segmentoActual = rutaCompleta.split("/").pop();
                        return segmentoActual.startsWith(pagina);
                    });

                    if (esPaginaProhibida) {
                        mostrarAccesoDenegadoEstetico();
                        return; 
                    }

                    ocultarModulosProhibidos();
                }

                // Si todo está en orden, mostramos la interfaz con una transición suave
                document.body.style.opacity = "1";

            } else {
                console.error("El usuario no tiene documento en Firestore.");
                await signOut(auth);
                window.location.href = "login.html";
            }
        } catch (error) {
            console.error("Error en el Guardián:", error);
            document.body.style.opacity = "1";
        }
    }
});

function mostrarAccesoDenegadoEstetico() {
    document.body.style.opacity = "1";
    document.body.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #0f172a; display: flex; justify-content: center; align-items: center; font-family: 'Segoe UI', Roboto, sans-serif; z-index: 99999;">
            <div style="background: #1e293b; padding: 40px; border-radius: 12px; text-align: center; max-width: 450px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); border: 1px solid #334155;">
                <div style="font-size: 50px; color: #f43f5e; margin-bottom: 20px;">🛡️</div>
                <h2 style="color: #f8fafc; margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">Acceso Restringido</h2>
                <p style="color: #94a3b8; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
                    No cuentas con los permisos de <strong>Administrador</strong> requeridos para visualizar este módulo de la cadena de frío.
                </p>
                <button id="btn-redirect-now" style="background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: background 0.2s; font-size: 14px; width: 100%;">
                    Volver al Inicio (5s...)
                </button>
            </div>
        </div>
    `;

    let segundos = 5;
    const btn = document.getElementById('btn-redirect-now');
    
    const intervalo = setInterval(() => {
        segundos--;
        if (btn) btn.textContent = `Volver al Inicio (${segundos}s...)`;
        if (segundos <= 0) {
            clearInterval(intervalo);
            window.location.href = "index.html";
        }
    }, 1000);

    if (btn) {
        btn.addEventListener('click', () => {
            clearInterval(intervalo);
            window.location.href = "index.html";
        });
    }
}

function ocultarModulosProhibidos() {
    const elementosA_Ocultar = document.querySelectorAll('.restringido-operator');
    elementosA_Ocultar.forEach(elemento => {
        elemento.remove();
    });
    console.log("Menú lateral adaptado para rol Operator.");
}

document.addEventListener('DOMContentLoaded', () => {
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await signOut(auth);
                window.location.href = "login.html";
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
            }
        });
    }
});