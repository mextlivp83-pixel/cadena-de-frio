// api/hospital.js
// Busca hospitales cercanos usando Overpass API, pero desde el servidor
// (Vercel), no desde el navegador. Así evitamos los bloqueos de CORS que
// pasan cuando el navegador llama directo a overpass-api.de.

const SERVIDORES_OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
];

function esperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Llama a un servidor Overpass. Si responde 429 (demasiadas peticiones,
// típico de las instancias públicas gratuitas), espera un momento y
// reintenta ese mismo servidor una vez antes de darlo por perdido.
async function llamarOverpass(servidor, consulta) {
    for (let intento = 0; intento < 2; intento++) {
        const respuesta = await fetch(servidor, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: consulta
        });

        if (respuesta.status === 429) {
            if (intento === 0) {
                await esperar(1500);
                continue; // reintenta este mismo servidor una vez
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

    const consulta = `[out:json][timeout:25];(node["amenity"="hospital"](around:${radio},${lat},${lng});way["amenity"="hospital"](around:${radio},${lat},${lng}););out center 15;`;

    let ultimoError = null;

    for (const servidor of SERVIDORES_OVERPASS) {
        try {
            const datos = await llamarOverpass(servidor, consulta);
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