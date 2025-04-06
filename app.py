import json

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


@app.route('/chat', methods=['POST'])
def chat_with_document():
    try:
        data = request.get_json()
        user_question = data.get('question', '').strip()
        document_text = data.get('document_text', '').strip()

        if not user_question or not document_text:
            return jsonify({"error": "Pregunta o texto del documento vacío"}), 400

        model = genai.GenerativeModel('gemini-1.5-flash')

        prompt = (
            "Actúa como un asistente académico especializado en analizar documentos. "
            "Responde la pregunta del usuario basándote PRINCIPALMENTE en el contenido "
            "del documento proporcionado. Sigue estas reglas:\n\n"

            "1) SI la respuesta está DIRECTAMENTE en el documento:\n"
            "- Extrae la información precisa\n"
            "- Cita el fragmento relevante entre comillas \"\"\n"
            "- Responde de manera concisa\n\n"

            "2) SI necesitas COMPLEMENTAR con información externa:\n"
            "- Primero indica claramente \"Según el documento:\"\n"
            "- Luego añade \"Información adicional:\" con datos relevantes\n"
            "- Proporciona EXACTAMENTE 1 referencia académica confiable\n\n"

            "3) SI la pregunta NO está relacionada con el documento:\n"
            "- Responde amablemente que la respuesta a esa pregunta no se encuentra en el documento subido\n"
            "- Responde la pregunta de manera concisa añadiendo que según (inserte la fuente aquí) \n\n"

            f"DOCUMENTO:\n{document_text}\n\n"
            f"PREGUNTA DEL USUARIO:\n{user_question}"
        )

        response = model.generate_content(prompt)

        # Procesar la respuesta para identificar fuentes externas
        answer = response.text
        external_source = None

        if "Información adicional:" in answer:
            # Buscar fuente en el texto
            source_match = re.search(r'Fuente:\s*(.+?)\s*(\(https?://[^\s]+)?', answer)
            if source_match:
                external_source = {
                    "name": source_match.group(1),
                    "url": source_match.group(2)[1:-1] if source_match.group(2) else "https://scholar.google.com"
                }

        return jsonify({
            "answer": answer,
            "external_source": external_source
        })

    except Exception as e:
        app.logger.error(f"Error en chat: {str(e)}")
        return jsonify({"error": "Error en el servidor"}), 500


@app.route('/suggestions', methods=['POST'])
def generate_questions():
    try:
        data = request.get_json()
        document_text = data.get('document_text', '').strip()

        if not document_text:
            return jsonify({"error": "Texto del documento vacío"}), 400

        model = genai.GenerativeModel('gemini-1.5-flash')

        response = model.generate_content(
            "Genera exactamente 5 preguntas frecuentes breves (máximo 15 palabras cada una) "
            "basadas en este documento. Devuélvelas como una lista JSON:\n\n"
            f"{document_text}"
        )

        # Extraer las preguntas de la respuesta
        questions = []
        print(response.text)
        if response.text.startswith('[') and response.text.endswith(']'):
            try:
                questions = json.loads(response.text)
            except:
                # Si falla el parseo, intentar extraer preguntas de otro formato
                questions = [q.strip() for q in response.text.split('\n') if q.strip()]
        else:
            questions = [q.strip() for q in response.text.split('\n') if q.strip()]

        return jsonify({"questions": questions[2:7]})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

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

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)