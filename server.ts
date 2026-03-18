import express, { Request, Response } from 'express';
import multer from 'multer';
import cors from 'cors';
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.send('Socio, el cerebro de la distribuidora está online.');
});

app.post('/procesar-factura', upload.single('factura'), async (req: Request, res: Response): Promise<any> => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Falta la imagen de la factura' });

            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash",
                generationConfig: { responseMimeType: "application/json" ,
                    temperature: 0
                } 
             });
            
        const imagePart = {
            inlineData: {
                data: fs.readFileSync(req.file.path).toString("base64"),
                mimeType: req.file.mimetype
            },
        };

        const prompt = `Actuá como un experto en Data Entry de facturación argentina trabajando en una distribuidora mayorista.
Tu tarea es leer la imagen y extraer los datos de la tabla, con un enfoque CRÍTICO en descubrir el Precio Unitario REAL de un (1) solo producto suelto.

Reglas estrictas para la extracción:
1. "nombre": Copiá el texto de la descripción del producto tal cual está.
2. "cantidad": Extraé la cantidad de bultos/displays facturados. Si no se ve, poné 1.
3. "subtotal": Tomá EXACTAMENTE el número de la columna "SUBTOTAL", "TOTAL" o "IMPORTE".

Reglas de RAZONAMIENTO para el Precio Unitario (MUY IMPORTANTE):
- El objetivo es calcular el "precio_unidad" de UN SOLO PRODUCTO INDIVIDUAL (ej: un alfajor, un paquete de galletitas, una botella de jugo).
- Paso A: Analizá el texto del producto. Buscá indicadores de bulto como "x24u", "x8u", "x 50U", etc.
- Paso B: Mirá la columna de "PRECIO" o "PREC. UNI.". 
- Paso C (Sentido Común Comercial): ¿Ese precio que figura en la factura es el valor de un producto suelto o del bulto entero?
  * EJEMPLO 1: "GALL TEREPEIN PEPAS X24U". Precio en factura: $419. Subtotal: $10.070. 
    Razonamiento: Es ilógico que 24 paquetes salgan $419. Por lo tanto, $419 ES el precio unitario del paquete suelto. No dividas nada. Devolvé 419.
  * EJEMPLO 2: "BAGGIO 1 LT x 8u MANZANA". Precio en factura: $9.781. Subtotal: $39.126 (Cantidad: 4).
    Razonamiento: Es lógico que un bulto de 8 jugos salga $9.781. Por lo tanto, el precio en factura ES POR BULTO. Para sacar el valor de la unidad suelta, tenés que dividir el precio de factura por la cantidad de unidades que trae el bulto (9781 / 8 = 1222). Devolvé 1222.
    Ademas es tambien logico pensar que si el subtotal es $39.126 por 4 bultos, entonces cada bulto cuesta $9.781 (39126 / 4 = 9781), lo que confirma que el precio de factura es por bulto y no por unidad suelta.
- Si la factura ya muestra el precio de la unidad suelta (Paso C, Ejemplo 1), copialo tal cual.
- Si la factura muestra el precio del bulto cerrado (Paso C, Ejemplo 2), DIVIDILO por las unidades que dice el texto ("x8u", "x12", etc.) para obtener el valor del producto suelto.

Reglas de formato:
- Los números usan coma (,) para decimales. Ignorá los centavos y devolvé números enteros (ej: "6.452,00" -> 6452).

Respondé ÚNICAMENTE con un JSON con esta estructura exacta:
{ 
  "total_final": 0, 
  "productos": [{ "nombre": "", "cantidad": 0, "precio_unidad": 0, "subtotal": 0 }] 
}`;

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();
        const inicio = text.indexOf('{');
        const fin = text.lastIndexOf('}');
        
        if (inicio === -1 || fin === -1) {
            throw new Error("La IA no devolvió un JSON válido");
        }

        const jsonLimpio = text.substring(inicio, fin + 1);
        const jsonResponse = JSON.parse(jsonLimpio);
        fs.unlinkSync(req.file.path); 

        res.json(jsonResponse);
    } catch (error) {
        console.error("Error en Gemini:", error);
        res.status(500).json({ error: "Error procesando la factura" });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor volando en el puerto ${PORT}`);
});