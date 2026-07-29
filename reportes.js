import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDoc, 
  doc, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
  getDatabase, 
  ref, 
  get, 
  child 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// 1. Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDBXlO9v0ECZtyDXVCcx4ukLkf-rPxl0HE",
  authDomain: "cadenafrio.firebaseapp.com",
  databaseURL: "https://cadenafrio-default-rtdb.firebaseio.com",
  projectId: "cadenafrio",
  storageBucket: "cadenafrio.firebasestorage.app",
  messagingSenderId: "666585058735",
  appId: "1:666585058735:web:3601ee3b941da7c67a335a",
  measurementId: "G-4H7697P55M"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const rtdb = getDatabase(app);

// Referencias de Firestore
const monitoreoRef = collection(db, "monitoreo");

// Variable global para almacenar temporalmente los viajes renderizados
let viajesData = {};

// 2. Escuchador en tiempo real para renderizar la tabla del historial
function cargarHistorialViajes() {
  const tbody = document.getElementById("tabla-historial-body");
  if (!tbody) return;

  onSnapshot(monitoreoRef, async (snapshot) => {
    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4">No hay viajes registrados.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    viajesData = {};

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const idViaje = docSnap.id;
      viajesData[idViaje] = { id: idViaje, ...data };

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${idViaje}</strong></td>
        <td>${data.unidadId || data.idCamion || 'CAM-01'}</td>
        <td>${data.origen || 'N/A'}</td>
        <td>${data.destino || 'N/A'}</td>
        <td>${data.inicioViaje || data.fechaInicio || 'N/A'}</td>
        <td>${data.terminoViaje || data.fechaFin || 'En progreso'}</td>
        <td>
          <button type="button" class="btn btn-warning btn-sm btn-descargar-pdf" data-id="${idViaje}">
            <i class="bi bi-file-earmark-pdf-fill"></i> PDF
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll(".btn-descargar-pdf").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const viajeId = e.currentTarget.getAttribute("data-id");
        generarPDFViaje(viajeId);
      });
    });
  });
}

// 3. Generación del gráfico térmico en memoria
async function generarGraficaBase64(lecturas) {
  const ctx = document.getElementById("pdfChartCanvas").getContext("2d");

  const labels = Object.values(lecturas).map((l, index) => {
    if (l.generadoEn) {
      const fecha = new Date(l.generadoEn);
      return `${fecha.getHours().toString().padStart(2, '0')}:${fecha.getMinutes().toString().padStart(2, '0')}`;
    }
    return `#${index + 1}`;
  });

  const temperaturas = Object.values(lecturas).map((l) => l.temperaturaAnalizadaC || 0);
  const humedades = Object.values(lecturas).map((l) => l.humedad || 0);

  if (window.pdfChartInstance) {
    window.pdfChartInstance.destroy();
  }

  window.pdfChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Temperatura Analizada (°C)",
          data: temperaturas,
          borderColor: "#dc3545",
          backgroundColor: "rgba(220, 53, 69, 0.1)",
          fill: true,
          tension: 0.3
        },
        {
          label: "Humedad (%)",
          data: humedades,
          borderColor: "#0d6efd",
          backgroundColor: "rgba(13, 110, 253, 0.1)",
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        legend: { position: "top" }
      },
      scales: {
        y: {
          // Ajustamos un poco la escala para que la gráfica no se vea aplastada
          suggestedMin: 0,
          suggestedMax: 60
        }
      }
    }
  });

  return document.getElementById("pdfChartCanvas").toDataURL("image/png");
}

// 4. Función principal para compilar los datos y emitir el PDF
async function generarPDFViaje(viajeId) {
  try {
    const infoViaje = viajesData[viajeId] || {};
    const camionId = infoViaje.unidadId || "CAM-01";

    // A) Obtener datos del camión desde Firestore
    let datosCamion = { marca: "N/A", modelo: "N/A", matricula: "N/A", operador: "N/A" };
    try {
      const camionSnap = await getDoc(doc(db, "Camiones", camionId));
      if (camionSnap.exists()) {
        datosCamion = camionSnap.data();
      }
    } catch (err) {
      console.warn("No se pudo obtener el camión:", err);
    }

    // B) Obtener datos del usuario/operador
    let datosUsuario = { nombre: datosCamion.operador || "Juan Pérez", correo: "N/A", rol: "Operator" };
    try {
      if (infoViaje.usuarioId) {
        const userSnap = await getDoc(doc(db, "usuarios", infoViaje.usuarioId));
        if (userSnap.exists()) {
          datosUsuario = userSnap.data();
        }
      }
    } catch (err) {
      console.warn("No se pudo obtener el usuario:", err);
    }

    // C) SIMULACIÓN DE DATOS (En lugar de traerlos de RTDB)
    let lecturas = {};
    const ahora = new Date();
    
    // Generamos 15 puntos de datos simulados
    for (let i = 0; i < 15; i++) {
      // Simulamos que las lecturas fueron tomadas cada 10 minutos
      const fechaSimulada = new Date(ahora.getTime() - ((15 - i) * 10 * 60000));
      
      // Temperatura alta (aleatoria entre 35 y 42 grados)
      const tempAlta = parseFloat((Math.random() * (42 - 35) + 35).toFixed(1));

      lecturas[`sim_${i}`] = {
        temperaturaAnalizadaC: tempAlta,
        humedad: 53, // Constante como pediste
        generadoEn: fechaSimulada.toISOString()
      };
    }

    // D) Construir PDF con jsPDF
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF();

    // Encabezado
    docPdf.setFillColor(30, 41, 59);
    docPdf.rect(0, 0, 210, 30, "F");
    
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFontSize(18);
    docPdf.text("REPORTE DE AUDITORÍA Y CADENA DE FRÍO", 14, 20);

    // Metadata General
    docPdf.setTextColor(40, 40, 40);
    docPdf.setFontSize(12);
    docPdf.text(`ID del Viaje: ${viajeId}`, 14, 42);
    docPdf.setFontSize(10);
    docPdf.text(`Fecha de emisión: ${new Date().toLocaleString()}`, 14, 48);

    docPdf.setDrawColor(200, 200, 200);
    docPdf.line(14, 52, 196, 52);
    
    // Sección 1: Datos del Camión y Conductor
    docPdf.setFontSize(12);
    docPdf.setTextColor(15, 23, 42);
    docPdf.text("1. Vehículo y Operador Responsable", 14, 62);

    docPdf.setFontSize(10);
    docPdf.setTextColor(70, 70, 70);
    docPdf.text(`Unidad ID: ${camionId}`, 14, 70);
    docPdf.text(`Marca / Modelo: ${datosCamion.marca || 'N/A'} ${datosCamion.modelo || ''}`, 110, 70);
    docPdf.text(`Matrícula: ${datosCamion.matricula || 'N/A'}`, 14, 77);
    docPdf.text(`Operador: ${datosUsuario.nombre || datosCamion.operador}`, 110, 77);
    docPdf.text(`Correo: ${datosUsuario.correo || 'N/A'}`, 14, 84);
    docPdf.text(`Rol: ${datosUsuario.rol || 'Operador'}`, 110, 84);

    // Sección 2: Gráfica de Comportamiento Térmico
    docPdf.setFontSize(12);
    docPdf.setTextColor(15, 23, 42);
    docPdf.text("2. Comportamiento Térmico del Recorrido ", 14, 98);

    if (Object.keys(lecturas).length > 0) {
      const imgChartBase64 = await generarGraficaBase64(lecturas);
      docPdf.addImage(imgChartBase64, "PNG", 14, 103, 180, 85);
    }

    // Pie de página
    docPdf.setFontSize(8);
    docPdf.setTextColor(120, 120, 120);
    docPdf.text("Cold Chain Tactical Solutions - Reporte generado automáticamente.", 14, 285);

    // Guardar archivo PDF
    docPdf.save(`Reporte_Viaje_${viajeId}.pdf`);

  } catch (error) {
    console.error("Error al generar el PDF:", error);
    alert("Ocurrió un error al generar el reporte PDF.");
  }
}

// Inicializar la escucha al cargar la vista
document.addEventListener("DOMContentLoaded", cargarHistorialViajes);