import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, 
  collection,
  getDocs, 
  getDoc,
  setDoc, 
  updateDoc,
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

    // Revisamos si el formulario tiene un ID de edición asignado
    const editId = formularioCamiones.dataset.editId;

    try {
      if (editId) {
        // 🔄 MODO EDICIÓN: Actualizamos el documento existente
        const docRef = doc(db, "Camiones", editId);
        await updateDoc(docRef, {
          marca, 
          modelo, 
          operador, 
          año: parseInt(año) || 0, 
          matricula, 
          esp32
        });

        // Limpiamos el dataset para futuros usos
        delete formularioCamiones.dataset.editId;
        alert(`¡Camión ${editId} actualizado con éxito!`);

      } else {
        // 🆕 MODO CREACIÓN: Generamos un nuevo ID secuencial
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
          marca, modelo, operador, año: parseInt(año) || 0, matricula, esp32
        });

        alert(`¡Camión registrado: ${nuevoIdPersonalizado}!`);
      }

      formularioCamiones.reset(); 
      if (typeof closeModal === 'function') closeModal('modal-camion'); 

    } catch (error) { 
      console.error("Error procesando camión: ", error); 
    }
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
              <button type="button" class="btn btn-sm btn-warning text-dark btn-edit-camion" data-id="${docSnap.id}"><i class="bi bi-pencil-square"></i></button>
              <button type="button" class="btn btn-sm btn-danger btn-delete-camion" data-id="${docSnap.id}"><i class="bi bi-trash"></i></button>
            </div>
          </td>
        </tr>`;
    });
    
    camionesTabla.innerHTML = filasHTML;

    // Asignar evento al botón de Edición
    document.querySelectorAll(".btn-edit-camion").forEach(button => {
      button.addEventListener("click", async (e) => {
        const camionId = e.currentTarget.dataset.id;
        console.log("Cargando camión para edición:", camionId); 
        
        try {
          const docRef = doc(db, "Camiones", camionId);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const camionData = docSnap.data();
            
            // Llenamos los inputs del modal con los datos actuales
            document.getElementById("camion-marca").value = camionData.marca || '';
            document.getElementById("camion-operador").value = camionData.operador || '';
            document.getElementById("camion-modelo").value = camionData.modelo || '';
            document.getElementById("camion-año").value = camionData.año || '';
            document.getElementById("camion-matricula").value = camionData.matricula || '';
            document.getElementById("camion-esp32").value = camionData.esp32 || '';

            // Marcamos el formulario con el ID que estamos editando
            document.getElementById("form-camion").dataset.editId = camionId;

            // Abrimos el modal con los datos ya cargados
            if (typeof openModal === 'function') openModal("modal-camion");

          } else {
            console.warn("No se encontró el camión con ID:", camionId);
          }
        } catch (error) {
          console.error("Error al obtener el camión:", error);
        }
      });
    });

    // Asignar evento al botón de Eliminación
    document.querySelectorAll(".btn-delete-camion").forEach(b => {
      b.addEventListener("click", e => eliminarDoc("Camiones", e.currentTarget.getAttribute("data-id")));
    });
  });
}


// ==========================================
// 2. SECCIÓN ESP32 (Dispositivos)
// ==========================================

function inicializarSelectorCamiones() {
  const selectCamionId = document.getElementById("camion-id");
  if (!selectCamionId) return;

  onSnapshot(query(collection(db, "Camiones"), orderBy("numeroSecuencia", "asc")), (querySnapshot) => {
    let opcionesHTML = '<option value="" disabled selected>Seleccione un camión...</option>';
    
    querySnapshot.forEach((docSnap) => {
      const idCamion = docSnap.id;
      const camionData = docSnap.data();
      opcionesHTML += `<option value="${idCamion}">${idCamion} (${camionData.marca || ''} - ${camionData.operador || 'Sin Op.'})</option>`;
    });
    
    selectCamionId.innerHTML = opcionesHTML;
  });
}

inicializarSelectorCamiones();

// Formulario ESP32 (Crear / Actualizar)
const formularioEsp32 = document.getElementById("form-esp32");
if (formularioEsp32) {
  formularioEsp32.addEventListener("submit", async (event) => {
    event.preventDefault();
    const idDispositivo = document.getElementById("dispositivo-id").value;
    const idCamion = document.getElementById("camion-id").value;

    const editId = formularioEsp32.dataset.editId;

    try {
      if (editId) {
        // 🔄 MODO EDICIÓN
        const docRef = doc(db, "ESP32", editId);
        await updateDoc(docRef, {
          idDispositivo: idDispositivo,
          idCamion: idCamion
        });

        delete formularioEsp32.dataset.editId;
        alert(`¡Dispositivo ${editId} actualizado con éxito!`);

      } else {
        // 🆕 MODO CREACIÓN
        const q = query(esp32Ref, orderBy("numeroSecuencia", "desc"), limit(1));
        const querySnapshot = await getDocs(q);
        let nuevoNumero = 1; 
        if (!querySnapshot.empty) {
          const ultimo = querySnapshot.docs[0].data();
          if (ultimo.numeroSecuencia) nuevoNumero = ultimo.numeroSecuencia + 1;
        }
        const numeroFormateado = nuevoNumero < 10 ? `0${nuevoNumero}` : nuevoNumero;
        const nuevoIdPersonalizado = `ESP32-${numeroFormateado}`;

        await setDoc(doc(db, "ESP32", nuevoIdPersonalizado), {
          unidadId: nuevoIdPersonalizado, 
          numeroSecuencia: nuevoNumero,   
          idDispositivo: idDispositivo,
          idCamion: idCamion 
        });

        alert(`¡Dispositivo registrado con éxito: ${nuevoIdPersonalizado}!`);
      }

      formularioEsp32.reset(); 
      if (typeof closeModal === 'function') closeModal('modal-dispositivo'); 

    } catch (error) { 
      console.error("Error ESP32: ", error); 
    }
  });
}

// Render Tabla ESP32
const esp32Tabla = document.getElementById("tabla-esp32-body");
if (esp32Tabla) {
  onSnapshot(query(esp32Ref, orderBy("numeroSecuencia", "asc")), (querySnapshot) => {
    esp32Tabla.innerHTML = ""; 
    let filasHTML = "";
    
    querySnapshot.forEach((docSnap) => {
      const esp = docSnap.data(); 
      filasHTML += `
        <tr class="align-middle text-center text-white" style="background: transparent;">
          <td><strong>${docSnap.id}</strong></td>
          <td>${esp.idDispositivo || ''}</td>
          <td>
            <div class="d-flex justify-content-center gap-2">
              <button type="button" class="btn btn-sm btn-warning text-dark btn-edit-esp32" data-id="${docSnap.id}">
                <i class="bi bi-pencil-square"></i> Editar
              </button>
              <button type="button" class="btn btn-sm btn-danger btn-delete-esp32" data-id="${docSnap.id}">
                <i class="bi bi-trash"></i> Eliminar
              </button>
            </div>
          </td>
        </tr>`;
    });
    esp32Tabla.innerHTML = filasHTML;

    // Listener para Editar ESP32
    document.querySelectorAll(".btn-edit-esp32").forEach(button => {
      button.addEventListener("click", async (e) => {
        const esp32Id = e.currentTarget.dataset.id;
        
        try {
          const docRef = doc(db, "ESP32", esp32Id);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const espData = docSnap.data();

            document.getElementById("dispositivo-id").value = espData.idDispositivo || '';
            document.getElementById("camion-id").value = espData.idCamion || '';

            document.getElementById("form-esp32").dataset.editId = esp32Id;

            if (typeof openModal === 'function') openModal('modal-dispositivo');
          } else {
            console.warn("No se encontró el dispositivo con ID:", esp32Id);
          }
        } catch (error) {
          console.error("Error al obtener dispositivo:", error);
        }
      });
    });

    // Listener para Eliminar ESP32
    document.querySelectorAll(".btn-delete-esp32").forEach(b => {
      b.addEventListener("click", e => eliminarDoc("ESP32", e.currentTarget.getAttribute("data-id")));
    });
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

    const editId = formularioProductos.dataset.editId;

    try {
      if (editId) {
        // 🔄 MODO EDICIÓN: Actualiza el producto existente
        const docRef = doc(db, "Productos", editId);
        await updateDoc(docRef, {
          tipo: tipoProducto,
          nombre: nombreProducto,
          especialidad: especialidad,
          rangoTermico: rangoTermico,
          cantidad: parseInt(cantidad) || 0
        });

        delete formularioProductos.dataset.editId;
        alert(`¡Producto ${editId} actualizado con éxito!`);

      } else {
        // 🆕 MODO CREACIÓN: Genera ID secuencial PRO-01, PRO-02...
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
          tipo: tipoProducto, 
          nombre: nombreProducto, 
          especialidad: especialidad, 
          rangoTermico: rangoTermico, 
          cantidad: parseInt(cantidad) || 0
        });

        alert(`¡Producto registrado: ${nuevoIdPersonalizado}!`);
      }

      formularioProductos.reset(); 
      if (typeof closeModal === 'function') closeModal('modal-producto'); 

    } catch (error) { 
      console.error("Error producto: ", error); 
    }
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
              <button type="button" class="btn btn-sm btn-warning text-dark btn-edit-producto" data-id="${docSnap.id}">
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

    // Asignar evento al botón de Edición
    document.querySelectorAll(".btn-edit-producto").forEach(button => {
      button.addEventListener("click", async (e) => {
        const productoId = e.currentTarget.dataset.id;
        console.log("Cargando producto para edición:", productoId);

        try {
          const docRef = doc(db, "Productos", productoId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const prodData = docSnap.data();

            // Cargar los campos en el modal
            document.getElementById("prod-tipo").value = prodData.tipo || '';
            document.getElementById("producto-nombre").value = prodData.nombre || '';
            document.getElementById("producto-especialidad").value = prodData.especialidad || '';
            document.getElementById("producto-rango-termico").value = prodData.rangoTermico || '';
            document.getElementById("producto-cantidad").value = prodData.cantidad || '0';

            // Guardar el ID en el dataset del formulario
            document.getElementById("form-producto").dataset.editId = productoId;

            // Abrir el modal
            if (typeof openModal === 'function') openModal('modal-producto');
          } else {
            console.warn("No se encontró el producto con ID:", productoId);
          }
        } catch (error) {
          console.error("Error al obtener producto:", error);
        }
      });
    });

    // Asignar evento al botón de Eliminación
    document.querySelectorAll(".btn-delete-producto").forEach(b => {
      b.addEventListener("click", e => eliminarDoc("Productos", e.currentTarget.getAttribute("data-id")));
    });
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