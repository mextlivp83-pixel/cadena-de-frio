// ============================================================
// PUENTE ESP32 -> FIREBASE -> GEMINI (IA PREDICTIVA)
// ============================================================
// Este script:
//  1. Lee las lecturas del ESP32 por puerto serial.
//  2. Sube la lectura cruda a Firebase (igual que antes).
//  3. Manda esa lectura + el historial reciente a Gemini para
//     que la IA prediga el riesgo de ruptura de cadena de frío.
//  4. Sube el análisis de la IA a Firebase, en un nodo aparte,
//     para que el frontend (mapa.html / ia.html) lo lea en tiempo real.
// ============================================================

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
require('dotenv').config(); // Lee variables desde el archivo .env

// ------------------------------------------------------------
// CONFIGURACIÓN GENERAL
// ------------------------------------------------------------
const CAMION_ID = process.env.CAMION_ID || 'camion_01';
const FIREBASE_BASE = 'https://cadenafrio-default-rtdb.firebaseio.com/monitoreo';
const FIREBASE_URL_LECTURA = `${FIREBASE_BASE}/${CAMION_ID}.json`;
const FIREBASE_URL_ANALISIS_IA = `${FIREBASE_BASE}/${CAMION_ID}/analisisIA.json`;
const FIREBASE_URL_HISTORIAL = `${FIREBASE_BASE}/${CAMION_ID}/historialLecturas.json`;

const PUERTO_COM = process.env.PUERTO_COM || 'COM5';

// Tu API key de Gemini SIEMPRE debe venir de una variable de entorno.
// Nunca la escribas directo en este archivo ni en el frontend.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Umbral solo como referencia para el prompt (la decisión real la hace la IA,
// no un simple if/else como antes).
const TEMP_REFERENCIA_MAX_C = Number(process.env.TEMP_REFERENCIA_MAX_C || 5.5);

// Cuántas lecturas recientes mandamos como contexto a la IA.
const TAMANO_HISTORIAL = 10;

// Para no llamar a Gemini en cada lectura si el ESP32 manda datos muy seguido.
// Tiempo mínimo entre análisis de IA (en milisegundos).
const INTERVALO_MINIMO_ANALISIS_MS = Number(process.env.INTERVALO_MINIMO_ANALISIS_MS || 8000);

if (!GEMINI_API_KEY) {
  console.warn('[AVISO] No encontré GEMINI_API_KEY en tu .env. La IA no va a poder analizar nada hasta que la agregues.');
}

// ------------------------------------------------------------
// ESTADO EN MEMORIA
// ------------------------------------------------------------
const historialLecturas = []; // últimas N lecturas de este camión
let ultimoAnalisisEnviadoEn = 0;

// ------------------------------------------------------------
// CONEXIÓN SERIAL
// ------------------------------------------------------------
const port = new SerialPort({ path: PUERTO_COM, baudRate: 115200 });
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

console.log(`[+] Escuchando al ESP32 en el puerto ${PUERTO_COM}...`);
console.log(`[+] Camión: ${CAMION_ID}`);
console.log(`[+] Lecturas -> ${FIREBASE_URL_LECTURA}`);
console.log(`[+] Análisis IA -> ${FIREBASE_URL_ANALISIS_IA}`);


parser.on('data', async (linea) => {
  try {
    if (!linea.startsWith('{')) return;

    const datos = JSON.parse(linea);
    console.log('\n[->] Datos recibidos del ESP32:', datos);

    // 1) Subir la lectura cruda a Firebase (comportamiento original)
    await subirLecturaCruda(datos);

    // 2) Guardar en el historial en memoria para dar contexto a la IA
    const lectura = normalizarLectura(datos);
    agregarAlHistorial(lectura);

    // 3) Pedirle a Gemini que analice el historial y prediga el riesgo
    const debeAnalizar =
      Date.now() - ultimoAnalisisEnviadoEn >= INTERVALO_MINIMO_ANALISIS_MS;

    if (GEMINI_API_KEY && debeAnalizar) {
      ultimoAnalisisEnviadoEn = Date.now();
      const analisis = await analizarConGemini(historialLecturas);

      if (analisis) {
        console.log('[IA]', analisis);
        await subirAnalisisIA(analisis, lectura);
      }
    }
  } catch (error) {
    console.error('[ERROR] Procesando línea del ESP32:', error.message);
  }
});

// ------------------------------------------------------------
// NORMALIZAR LA LECTURA QUE MANDA EL ESP32
// Ajusta los nombres de campo aquí si tu ESP32 usa otros nombres.
// ------------------------------------------------------------
function normalizarLectura(datos) {
  // El ESP32 manda "latitud"/"longitud" (string "Buscando..." cuando el GPS
  // todavía no tiene señal). Number("Buscando...") da NaN, así que con
  // Number.isFinite lo convertimos a null automáticamente en ese caso.
  const latCruda = datos.lat ?? datos.latitud ?? null;
  const lngCruda = datos.lng ?? datos.lon ?? datos.longitud ?? null;
  const latNum = Number(latCruda);
  const lngNum = Number(lngCruda);

  return {
    temperaturaC: Number(datos.temperatura ?? datos.temperaturaC ?? datos.temp),
    humedadPct: Number(datos.humedad ?? datos.humedadPct ?? datos.hum),
    puertaAbierta: Boolean(datos.puerta ?? datos.puertaAbierta ?? false),
    lat: Number.isFinite(latNum) ? latNum : null,
    lng: Number.isFinite(lngNum) ? lngNum : null,
    timestamp: new Date().toISOString()
  };
}

function agregarAlHistorial(lectura) {
  historialLecturas.push(lectura);
  if (historialLecturas.length > TAMANO_HISTORIAL) {
    historialLecturas.shift();
  }
}

// ------------------------------------------------------------
// SUBIR LECTURA CRUDA (igual que el puente.js original)
// ------------------------------------------------------------
async function subirLecturaCruda(datos) {
  const respuesta = await fetch(FIREBASE_URL_LECTURA, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });

  if (respuesta.ok) {
    console.log('[ÉXITO] Lectura subida a Firebase');
  } else {
    const detalleError = await respuesta.text();
    console.log(`[ERROR] Firebase (lectura) - Código ${respuesta.status}:`, detalleError);
  }
}

// ------------------------------------------------------------
// LLAMAR A GEMINI PARA EL ANÁLISIS PREDICTIVO
// ------------------------------------------------------------
async function analizarConGemini(historial) {
  const esquemaRespuesta = {
    type: 'object',
    properties: {
      nivelRiesgo: {
        type: 'string',
        enum: ['normal', 'atencion', 'alerta', 'critico']
      },
      probabilidadFallaPct: { type: 'number' },
      prediccion: { type: 'string' },
      mensaje: { type: 'string' },
      accionRecomendada: { type: 'string' }
    },
    required: [
      'nivelRiesgo',
      'probabilidadFallaPct',
      'prediccion',
      'mensaje',
      'accionRecomendada'
    ]
  };

  const prompt = `
Eres el sistema de IA predictiva de una plataforma de cadena de frío para
transporte de productos médicos sensibles (vacunas, medicamentos).

Temperatura de referencia máxima segura: ${TEMP_REFERENCIA_MAX_C} °C.

Analiza el siguiente historial de lecturas recientes del camión ${CAMION_ID},
ordenadas de la más antigua a la más reciente (formato JSON):

${JSON.stringify(historial, null, 2)}

Con base en la TENDENCIA (no solo el último dato), evalúa si el cargamento
está en riesgo de perder la cadena de frío en los próximos minutos.
Considera: velocidad de cambio de temperatura, humedad, si la puerta se
abrió, y cuánto tiempo lleva cerca o por encima del límite.

Responde SOLO con el JSON pedido, en español, dirigido al conductor y al
centro de monitoreo. "accionRecomendada" debe ser una instrucción corta y
concreta (ej: "Detente y revisa el sistema de refrigeración").
`.trim();

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: esquemaRespuesta,
      temperature: 0.2
    }
  };

  try {
    const respuesta = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!respuesta.ok) {
      const detalleError = await respuesta.text();
      console.log(`[ERROR] Gemini - Código ${respuesta.status}:`, detalleError);
      return null;
    }

    const data = await respuesta.json();
    const textoJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textoJson) {
      console.log('[ERROR] Gemini no devolvió contenido usable:', JSON.stringify(data));
      return null;
    }

    return JSON.parse(textoJson);
  } catch (error) {
    console.error('[ERROR] Llamando a Gemini:', error.message);
    return null;
  }
}

// ------------------------------------------------------------
// SUBIR EL ANÁLISIS DE LA IA A FIREBASE
// ------------------------------------------------------------
async function subirAnalisisIA(analisis, lectura) {
  const payload = {
    ...analisis,
    temperaturaAnalizadaC: lectura.temperaturaC,
    // Mandamos lat/lng tal cual los reporta el ESP32 (pueden venir null si el
    // sensor GPS todavía no funciona). El frontend decide qué hacer con eso:
    // si vienen null, usa la ubicación del navegador como respaldo.
    lat: lectura.lat,
    lng: lectura.lng,
    generadoEn: new Date().toISOString()
  };

  const respuesta = await fetch(FIREBASE_URL_ANALISIS_IA, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (respuesta.ok) {
    console.log('[ÉXITO] Análisis de IA subido a Firebase');
  } else {
    const detalleError = await respuesta.text();
    console.log(`[ERROR] Firebase (IA) - Código ${respuesta.status}:`, detalleError);
  }

  // Además guardamos un registro histórico del análisis (opcional pero útil
  // para auditoría / reportes.html).
  await fetch(FIREBASE_URL_HISTORIAL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}