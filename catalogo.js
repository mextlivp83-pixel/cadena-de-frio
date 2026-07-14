import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, 
  collection,
  getDocs, 
  setDoc, 
  onSnapshot, 
  deleteDoc, 
  query,     
  orderBy,   
  limit,     
  doc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDBXlO9v0ECZtyDXVCcx4ukLkf-rPxl0HE",
  authDomain: "cadenafrio.firebaseapp.com",
  projectId: "cadenafrio",
  storageBucket: "cadenafrio.firebasestorage.app",
  messagingSenderId: "666585058735",
  appId: "1:666585058735:web:3601ee3b941da7c67a335a",
  measurementId: "G-4H7697P55M"
}; 

// Inicializar Firebase y Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app); 
const camionesRef = collection(db, "Camiones");
const esp32Ref = collection(db, "ESP32");
const productosRef = collection(db, "Productos");

// ==========================================
// 1. SECCIÓN CAMIONES
// ==========================================
const formularioCamiones = document.getElementById("form-camion");
if (formularioCamiones) {
  formularioCamiones.addEventListener("submit", async (event) => {
    event.preventDefault(); 
    const marca = document.getElementById("camion-marca").value;
    const operador = document.getElementById("camion-operador").value;
    const modelo = document.getElementById("camion-modelo").value;
    const año = document.getElementById("camion-año").value;
    const matricula = document.getElementById("camion-matricula").value;
    const esp32 = document.getElementById("camion-esp32").value;

    try {
      const q = query(camionesRef, orderBy("numeroSecuencia", "desc"), limit(1));
      const querySnapshot = await getDocs(q);
      let nuevoNumero = 1; 
      if (!querySnapshot.empty) {
        const ultimo = querySnapshot.docs[0].data();
        if (ultimo.numeroSecuencia) nuevoNumero = ultimo.numeroSecuencia + 1;
      }
      const numeroFormateado = nuevoNumero < 10 ? `0${nuevoNumero}` : nuevoNumero;
      const nuevoIdPersonalizado = `CAM-${numeroFormateado}`;

      await setDoc(doc(db, "Camiones", nuevoIdPersonalizado), {
        unidadId: nuevoIdPersonalizado, 
        numeroSecuencia: nuevoNumero,   
        marca, modelo, operador, año: parseInt(año), matricula, esp32
      });

      formularioCamiones.reset(); 
      if (typeof closeModal === 'function') closeModal('modal-camion'); 
      alert(`¡Camión registrado: ${nuevoIdPersonalizado}!`);
    } catch (error) { console.error("Error camión: ", error); }
  });
}

// Render Camiones
const camionesTabla = document.getElementById("tabla-camiones-body");
if (camionesTabla) {
  onSnapshot(query(camionesRef, orderBy("numeroSecuencia", "asc")), (querySnapshot) => {
    camionesTabla.innerHTML = ""; 
    let filasHTML = "";
    querySnapshot.forEach((docSnap) => {
      const camion = docSnap.data(); 
      filasHTML += `
        <tr class="align-middle text-center text-white" style="background: transparent;">
          <td><strong>${docSnap.id}</strong></td>
          <td>${camion.marca || ''}</td>
          <td>${camion.operador || 'Sin operador'}</td> 
          <td>${camion.modelo || ''}</td>
          <td>${camion.año || ''}</td>
          <td>${camion.matricula || ''}</td>
          <td>${camion.esp32 || ''}</td>
          <td>
            <div class="d-flex justify-content-center gap-2">
              <button type="button" class="btn btn-sm btn-warning text-dark" onclick="openModal('modal-editCamion')"><i class="bi bi-pencil-square"></i></button>
              <button type="button" class="btn btn-sm btn-danger btn-delete-camion" data-id="${docSnap.id}"><i class="bi bi-trash"></i></button>
            </div>
          </td>
        </tr>`;
    });
    camionesTabla.innerHTML = filasHTML;
    document.querySelectorAll(".btn-delete-camion").forEach(b => b.addEventListener("click", e => eliminarDoc("Camiones", e.currentTarget.getAttribute("data-id"))));
  });
}

// ==========================================
// 2. SECCIÓN ESP32 (Dispositivos)
// ==========================================

// 🟢 FUNCIÓN AUTÓNOMA: Carga y escucha los camiones existentes para rellenar el selector en el modal
function inicializarSelectorCamiones() {
  const selectCamionId = document.getElementById("camion-id");
  if (!selectCamionId) return;

  // Escuchamos la colección de camiones en tiempo real para mantener el select actualizado
  onSnapshot(query(collection(db, "Camiones"), orderBy("numeroSecuencia", "asc")), (querySnapshot) => {
    let opcionesHTML = '<option value="" disabled selected>Seleccione un camión...</option>';
    
    querySnapshot.forEach((docSnap) => {
      const idCamion = docSnap.id; // Ejemplo: CAM-01
      const camionData = docSnap.data();
      opcionesHTML += `<option value="${idCamion}">${idCamion} (${camionData.marca || ''} - ${camionData.operador || 'Sin Op.'})</option>`;
    });
    
    selectCamionId.innerHTML = opcionesHTML;
  });
}

// Inicializamos la carga del selector
inicializarSelectorCamiones();

// Formulario para guardar el registro de relación
const formularioEsp32 = document.getElementById("form-esp32");
if (formularioEsp32) {
  formularioEsp32.addEventListener("submit", async (event) => {
    event.preventDefault();
    const idDispositivo = document.getElementById("dispositivo-id").value;
    const idCamion = document.getElementById("camion-id").value; // Toma el CAM-## seleccionado

    try {
      const q = query(esp32Ref, orderBy("numeroSecuencia", "desc"), limit(1));
      const querySnapshot = await getDocs(q);
      let nuevoNumero = 1; 
      if (!querySnapshot.empty) {
        const ultimo = querySnapshot.docs[0].data();
        if (ultimo.numeroSecuencia) nuevoNumero = ultimo.numeroSecuencia + 1;
      }
      const numeroFormateado = nuevoNumero < 10 ? `0${nuevoNumero}` : nuevoNumero;
      const nuevoIdPersonalizado = `DISP-${numeroFormateado}`;

      // Guardamos el documento usando su ID incremental único (DISP-01, DISP-02...)
      await setDoc(doc(db, "ESP32", nuevoIdPersonalizado), {
        unidadId: nuevoIdPersonalizado, 
        numeroSecuencia: nuevoNumero,   
        idDispositivo: idDispositivo, // Nombre/código físico del hardware
        idCamion: idCamion            // Relación con el ID del Camión (CAM-##)
      });

      formularioEsp32.reset(); 
      if (typeof closeModal === 'function') closeModal('modal-dispositivo'); 
      alert(`¡Dispositivo y Relación registrados con éxito: ${nuevoIdPersonalizado}!`);
    } catch (error) { console.error("Error ESP32: ", error); }
  });
}

// Render de la Tabla de Relaciones ESP32
const esp32Tabla = document.getElementById("tabla-esp32-body");
if (esp32Tabla) {
  onSnapshot(query(esp32Ref, orderBy("numeroSecuencia", "asc")), (querySnapshot) => {
    console.log("Relaciones ESP32 cargadas en tiempo real:");
    esp32Tabla.innerHTML = ""; 
    let filasHTML = "";
    
    querySnapshot.forEach((docSnap) => {
      const esp = docSnap.data(); 
      filasHTML += `
        <tr class="align-middle text-center text-white" style="background: transparent;">
          <td><strong>${docSnap.id}</strong></td> <td>${esp.idDispositivo || ''}</td>
          <td>
            <div class="d-flex justify-content-center gap-2">
              <button type="button" class="btn btn-sm btn-warning text-dark" onclick="openModal('modal-editDispositivo')"><i class="bi bi-pencil-square"></i> Editar</button>
              <button type="button" class="btn btn-sm btn-danger btn-delete-esp32" data-id="${docSnap.id}"><i class="bi bi-trash"></i> Eliminar</button>
            </div>
          </td>
        </tr>`;
    });
    esp32Tabla.innerHTML = filasHTML;
    document.querySelectorAll(".btn-delete-esp32").forEach(b => b.addEventListener("click", e => eliminarDoc("ESP32", e.currentTarget.getAttribute("data-id"))));
  });
}

// ==========================================
// 3. SECCIÓN PRODUCTOS
// ==========================================
const formularioProductos = document.getElementById("form-producto");
if (formularioProductos) {
  formularioProductos.addEventListener("submit", async (event) => {
    event.preventDefault();
    const tipoProducto = document.getElementById("prod-tipo").value;
    const nombreProducto = document.getElementById("producto-nombre").value;
    const especialidad = document.getElementById("producto-especialidad").value;
    const rangoTermico = document.getElementById("producto-rango-termico").value;
    const cantidad = document.getElementById("producto-cantidad").value;

    try {
      const q = query(productosRef, orderBy("numeroSecuencia", "desc"), limit(1));
      const querySnapshot = await getDocs(q);
      let nuevoNumero = 1; 
      if (!querySnapshot.empty) {
        const ultimo = querySnapshot.docs[0].data();
        if (ultimo.numeroSecuencia) nuevoNumero = ultimo.numeroSecuencia + 1;
      }
      const numeroFormateado = nuevoNumero < 10 ? `0${nuevoNumero}` : nuevoNumero;
      const nuevoIdPersonalizado = `PRO-${numeroFormateado}`;

      await setDoc(doc(db, "Productos", nuevoIdPersonalizado), {
        unidadId: nuevoIdPersonalizado, 
        numeroSecuencia: nuevoNumero,   
        tipo: tipoProducto, nombre: nombreProducto, especialidad: especialidad, rangoTermico, cantidad: parseInt(cantidad)
      });

      formularioProductos.reset(); 
      if (typeof closeModal === 'function') closeModal('modal-producto'); 
      alert(`¡Producto registrado: ${nuevoIdPersonalizado}!`);
    } catch (error) { console.error("Error producto: ", error); }
  });
}

// Render Productos
const productosTabla = document.getElementById("tabla-productos-body");
if (productosTabla) {
  onSnapshot(query(productosRef, orderBy("numeroSecuencia", "asc")), (querySnapshot) => {
    console.log("Productos cargados en tiempo real:");
    productosTabla.innerHTML = ""; 
    let filasHTML = "";
    querySnapshot.forEach((docSnap) => {
      const prod = docSnap.data(); 
      filasHTML += `
        <tr class="align-middle text-center text-white" style="background: transparent;">
          <td><strong>${docSnap.id}</strong></td>
          <td>${prod.tipo || ''}</td>
          <td>${prod.nombre || ''}</td>
          <td>${prod.especialidad || ''}</td>
          <td>${prod.rangoTermico || ''}</td>
          <td>${prod.cantidad || '0'}</td>
          <td>
            <div class="d-flex justify-content-center gap-2">
              <button type="button" class="btn btn-sm btn-warning text-dark" onclick="openModal('modal-editProducto')">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button type="button" class="btn btn-sm btn-danger btn-delete-producto" data-id="${docSnap.id}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>`;
    });
    productosTabla.innerHTML = filasHTML;
    document.querySelectorAll(".btn-delete-producto").forEach(b => b.addEventListener("click", e => eliminarDoc("Productos", e.currentTarget.getAttribute("data-id"))));
  });
}

// ==========================================
// FUNCIÓN CENTRAL DE ELIMINACIÓN
// ==========================================
async function eliminarDoc(coleccion, docId) {
  const confirmar = confirm(`¿Estás seguro de eliminar ${docId} de ${coleccion}?`);
  if (!confirmar) return;
  try {
    await deleteDoc(doc(db, coleccion, docId));
    console.log(`Eliminado de ${coleccion}: `, docId);
  } catch (error) { console.error("Error al eliminar: ", error); }
}