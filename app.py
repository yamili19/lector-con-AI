from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from docx import Document
import PyPDF2
import io
import google.generativeai as genai
from dotenv import load_dotenv
import os
import re

load_dotenv()  # Cargar las variables de entorno desde el archivo .env

app = Flask(__name__)
CORS(app)
# Configurar en app.py
gemini_api_key = os.getenv('GEMINI_API_KEY')  # Crear en Google AI Studio
genai.configure(api_key=gemini_api_key)

@app.route('/')
def index():
    return render_template('index.html')


def extract_text(file):
    if file.filename.endswith('.docx'):
        doc = Document(io.BytesIO(file.read()))
        return [{"text": p.text} for p in doc.paragraphs if p.text.strip()]
    elif file.filename.endswith('.pdf'):
        pdf = PyPDF2.PdfReader(file)
        text = []
        for page in pdf.pages:
            text.append(page.extract_text())
        return [{"text": t} for t in text if t.strip()]
    return []


@app.route('/process', methods=['POST'])
def process_file():
    try:
        file = request.files['file']
        paragraphs = extract_text(file)
        return jsonify(paragraphs)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/complement', methods=['POST'])
def complement_info():
    try:
        data = request.get_json()
        text = data.get('text', '').strip()

        if not text:
            return jsonify({"error": "Texto vacío"}), 400

        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(
            f"Como experto académico, analiza el texto proporcionado y complementa su información con:\n"

            f"1) Datos adicionales relevantes (contexto teórico, cifras actualizadas, "
            f"ejemplos prácticos o controversias académicas).\n"
            
            f"EXACTAMENTE 2 referencias académicas confiables y especializadas en formato:\n"
            f"• NOMBRE_FUENTE (URL_OFICIAL)\n"
            f"(Prioriza fuentes institucionales, revistas científicas o bases de datos reconocidas "
            f"como PubMed, JSTOR, o repositorios " f"universitarios. Evita blogs o sitios sin revisión por pares).\n"
            
            f"Asegúrate de que las referencias respalden directamente los datos agregados y "
            f"estén vinculadas al tema central del texto.\n"
            f"Texto para analizar:\n"
            f"{text}"
        )

        if not response.text:
            return jsonify({"error": "Respuesta inválida"}), 500

        # Extracción mejorada de fuentes
        content = response.text.replace('•', '•')  # Normalizar viñetas
        sources = re.findall(
            r'(?:•|\d+\.)\s*([^\(\n]+?)\s*\((\bhttps?:\/\/[^\s\)]+)\)',
            content,
            flags=re.IGNORECASE
        )

        return jsonify({
            "complement": content,
            "sources": [{"name": s[0].strip(), "url": s[1]} for s in sources[:2]] or [
                {"name": "Google Scholar", "url": "https://scholar.google.com"}
            ]
        })

    except Exception as e:
        app.logger.error(f"Error: {str(e)}")
        return jsonify({"error": "Error en el servidor"}), 500

if __name__ == '__main__':
    app.run(debug=True)