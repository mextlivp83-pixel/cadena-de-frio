const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// 1. URL PURA Y DIRECTA (Sin el auth por ahora para probar)
const FIREBASE_URL = 'https://cadenafrio-default-rtdb.firebaseio.com/monitoreo/camion_01.json';
const PUERTO_COM = 'COM16'; 

const port = new SerialPort({ path: PUERTO_COM, baudRate: 115200 });
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

console.log(`[+] Escuchando al ESP32 en el puerto ${PUERTO_COM}...`);
console.log(`[+] Apuntando a la URL: ${FIREBASE_URL}`); // Imprimimos la URL para revisarla

parser.on('data', async (linea) => {
  try {
    if(linea.startsWith('{')) {
      const datos = JSON.parse(linea);
      console.log('\n[->] Datos listos para subir:', datos);

      const respuesta = await fetch(FIREBASE_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      });

      if(respuesta.ok) {
        console.log('[ÉXITO] Base de datos actualizada en la nube');
      } else {
        // AQUÍ ESTÁ EL TRUCO: Leemos el mensaje de error EXACTO de Google
        const detalleError = await respuesta.text();
        console.log(`[ERROR] Firebase dice - Código ${respuesta.status}:`, detalleError);
      }
    }
  } catch (error) {
    console.error('[ERROR] Analizando datos:', error.message);
  }
});