// api/hospital.js
// Busca hospitales cercanos usando Overpass API, pero desde el servidor
// (Vercel), no desde el navegador. Así evitamos los bloqueos de CORS que
// pasan cuando el navegador llama directo a overpass-api.de.

const SERVIDORES_OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
];

// La política de uso de Overpass pide identificar la app con un
// User-Agent descriptivo (no genérico de librería). Sin esto, algunas
// instancias públicas priorizan aún menos tus peticiones cuando están
// saturadas, lo que agrava los 429.
const USER_AGENT = "CadenaDeFrio-App/1.0 (contacto: soporte@cadena-de-frio.vercel.app)";

// Caché simple en memoria: mientras la función serverless siga "caliente"
// (Vercel reutiliza la misma instancia entre llamadas seguidas),
// reutilizamos resultados recientes para el mismo punto/radio en vez de
// volver a golpear Overpass. Los hospitales no cambian de lugar cada
// minuto, así que esto elimina la mayoría de las peticiones repetidas
// durante pruebas o cuando varios choferes consultan zonas parecidas.
const TTL_CACHE_MS = 10 * 60 * 1000; // 10 minutos
const cache = new Map();

function claveCache(lat, lng, radio) {
    // Redondeamos a ~1km para que puntos casi iguales compartan caché.
    const latRedondeada = Number(lat).toFixed(2);
    const lngRedondeada = Number(lng).toFixed(2);
    return `${latRedondeada},${lngRedondeada},${radio}`;
}

function esperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Llama a un servidor Overpass. Si responde 429 (demasiadas peticiones,
// típico de las instancias públicas gratuitas), espera con backoff
// creciente y reintenta ese mismo servidor un par de veces antes de
// darlo por perdido.
async function llamarOverpass(servidor, consulta) {
    const esperasEntreIntentos = [2000, 4000]; // backoff creciente

    for (let intento = 0; intento <= esperasEntreIntentos.length; intento++) {
        const respuesta = await fetch(servidor, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain",
                "User-Agent": USER_AGENT
            },
            body: consulta
        });

        if (respuesta.status === 429) {
            if (intento < esperasEntreIntentos.length) {
                await esperar(esperasEntreIntentos[intento]);
                continue; // reintenta este mismo servidor
            }
            throw new Error(`Overpass (${servidor}) respondió con código 429 (límite de peticiones)`);
        }

        if (!respuesta.ok) {
            throw new Error(`Overpass (${servidor}) respondió con código ${respuesta.status}`);
        }

        return respuesta.json();
    }
}

module.exports = async function handler(req, res) {
    const { lat, lng, radio } = req.query;

    if (!lat || !lng || !radio) {
        return res.status(400).json({ error: "Faltan parámetros: lat, lng y radio son obligatorios." });
    }

    const clave = claveCache(lat, lng, radio);
    const enCache = cache.get(clave);
    if (enCache && Date.now() - enCache.guardadoEn < TTL_CACHE_MS) {
        return res.status(200).json(enCache.datos);
    }

    const consulta = `[out:json][timeout:25];(node["amenity"="hospital"](around:${radio},${lat},${lng});way["amenity"="hospital"](around:${radio},${lat},${lng}););out center 15;`;

    let ultimoError = null;

    for (const servidor of SERVIDORES_OVERPASS) {
        try {
            const datos = await llamarOverpass(servidor, consulta);
            cache.set(clave, { datos, guardadoEn: Date.now() });
            return res.status(200).json(datos);
        } catch (error) {
            console.error(`Error consultando ${servidor}:`, error.message);
            ultimoError = error.message;
            // probamos el siguiente servidor espejo
        }
    }

    return res.status(502).json({
        error: `Todos los servidores Overpass fallaron. Último error: ${ultimoError}`
    });
}