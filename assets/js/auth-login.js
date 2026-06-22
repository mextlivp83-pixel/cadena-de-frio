
import { auth, db, googleProvider } from './firebase-config.js';

import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signInWithPopup,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { 
    doc, 
    getDoc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


const viewLogin = document.getElementById('view-login');
const viewRegister = document.getElementById('view-register');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const btnGoogle = document.getElementById('btn-google');
const authAlert = document.getElementById('auth-alert');

function mostrarAlerta(mensaje, tipo = 'success') {
    authAlert.textContent = mensaje;
    authAlert.className = ''; 
    
    if (tipo === 'success') {
        authAlert.classList.add('alert-success');
    } else {
        authAlert.classList.add('alert-danger');
    }
    
    authAlert.style.display = 'block'; 
}

tabRegister.addEventListener('click', () => {
    tabLogin.classList.remove('active');
    tabRegister.classList.add('active');
    viewLogin.style.display = 'none';
    viewRegister.style.display = 'block';
    authAlert.style.display = 'none'; 
});

tabLogin.addEventListener('click', () => {
    tabRegister.classList.remove('active');
    tabLogin.classList.add('active');
    viewRegister.style.display = 'none';
    viewLogin.style.display = 'block';
    authAlert.style.display = 'none'; 
});


async function verificarYAsignarRol(user, nameCustom = null) {
    try {
        const userDocRef = doc(db, "usuarios", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            // 1. Registramos al usuario nuevo con rol 'Operator'
            await setDoc(userDocRef, {
                correo: user.email,
                nombre: nameCustom || user.displayName || "Usuario Registrado",
                rol: "Operator", 
                fechaRegistro: new Date().toISOString()
            });
            console.log("Nuevo usuario detectado. Registrado en Firestore como Operator.");

            await signOut(auth);
            
            mostrarAlerta("¡Cuenta creada con éxito! Por favor, inicia sesión para ingresar.", "success");
            
            registerForm.reset();
            viewRegister.style.display = 'none';
            viewLogin.style.display = 'block';
            tabRegister.classList.remove('active');
            tabLogin.classList.add('active');

        } else {
            console.log("Usuario existente verificado. Redirigiendo al sistema...");
            window.location.href = "index.html";
        }

    } catch (error) {
        console.error("Error en el proceso de validación en Firestore:", error);
        mostrarAlerta("Ocurrió un problema al validar tus permisos de usuario.", "danger");
    }
}

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await verificarYAsignarRol(userCredential.user, name);

    } catch (error) {
        console.error("Error durante el registro:", error.code);
        if (error.code === 'auth/email-already-in-use') {
            mostrarAlerta("Este correo electrónico ya se encuentra registrado.", "danger");
        } else if (error.code === 'auth/weak-password') {
            mostrarAlerta("Contraseña demasiado débil (mínimo 6 caracteres).", "danger");
        } else {
            mostrarAlerta("Error al registrar la cuenta: " + error.message, "danger");
        }
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await verificarYAsignarRol(userCredential.user);

    } catch (error) {
        console.error("Error durante el inicio de sesión:", error.code);
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            mostrarAlerta("Credenciales incorrectas. Revisa tu correo y contraseña.", "danger");
        } else {
            mostrarAlerta("Error al ingresar al sistema: " + error.message, "danger");
        }
    }
});


btnGoogle.addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        
        await verificarYAsignarRol(result.user);
        
    } catch (error) {
        console.error("Error durante el inicio de sesión con Google:", error);
        if (error.code !== 'auth/popup-closed-by-user') {
            mostrarAlerta("No se pudo establecer la conexión con Google.", "danger");
        }
    }
});