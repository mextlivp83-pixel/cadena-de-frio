// api/hospital.js
// Busca hospitales cercanos usando Overpass API, pero desde el servidor
// (Vercel), no desde el navegador. Así evitamos los bloqueos de CORS que
// pasan cuando el navegador llama directo a overpass-api.de.

const SERVIDORES_OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
];

module.exports = async function handler(req, res) {
    const { lat, lng, radio } = req.query;

    if (!lat || !lng || !radio) {
        return res.status(400).json({ error: "Faltan parámetros: lat, lng y radio son obligatorios." });
    }

    const consulta = `[out:json][timeout:25];(node["amenity"="hospital"](around:${radio},${lat},${lng});way["amenity"="hospital"](around:${radio},${lat},${lng}););out center 15;`;

    let ultimoError = null;

    for (const servidor of SERVIDORES_OVERPASS) {
        try {
            const respuesta = await fetch(servidor, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: consulta
            });

            if (!respuesta.ok) {
                throw new Error(`Overpass (${servidor}) respondió con código ${respuesta.status}`);
            }

            const datos = await respuesta.json();
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