require('dotenv').config();

async function verModelos() {
    try {
        const respuesta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const datos = await respuesta.json();
        
        console.log("📦 Modelos disponibles en tu depósito:");
        if (datos.models) {
            datos.models.forEach(m => {
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`- ${m.name.replace('models/', '')}`);
                }
            });
        } else {
            console.log("No se encontraron modelos o la llave rebotó:", datos);
        }
    } catch (error) {
        console.error("Error consultando a Google:", error);
    }
}

verModelos();