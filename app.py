from flask import Flask, request, jsonify, render_template
from docx import Document
import PyPDF2
import io
from openai import OpenAI
import mammoth
from dotenv import load_dotenv
import os

load_dotenv()  # Cargar las variables de entorno desde el archivo .env

app = Flask(__name__)
api_key = os.getenv('OPENAI_API_KEY')

client = OpenAI(api_key ='api_key')


# Función para extraer texto del archivo
def extract_text(file):
    if file.filename.endswith('.docx'):
        # Procesar archivo DOCX
        doc = Document(io.BytesIO(file.read()))
        return [p.text for p in doc.paragraphs if p.text.strip()]
    elif file.filename.endswith('.pdf'):
        # Procesar archivo PDF
        pdf = PyPDF2.PdfReader(file)
        text = []
        for page in pdf.pages:
            text.extend(page.extract_text().split('\n'))
        return [t for t in text if t.strip()]
    return []


# Ruta principal (inicio)
@app.route('/')
def index():
    return render_template('index.html')


# Ruta para procesar el archivo (DOCX o PDF)
@app.route('/process', methods=['POST'])
def process_file():
    file = request.files['file']
    paragraphs = extract_text(file)

    # Si es un archivo DOCX, lo convertimos a HTML con Mammoth para facilitar su visualización
    if file.filename.endswith('.docx'):
        result = mammoth.convert_to_html(file)
        return jsonify({"html": result.value})

    # Para PDFs simplemente devolvemos el texto extraído
    return jsonify([{"text": p} for p in paragraphs])


# Ruta para complementar la información usando OpenAI
@app.route('/complement', methods=['POST'])
def complement_info():
    text = request.json['text']

    try:
        response = client.chat.completions.create(  # Nueva sintaxis
            model="gpt-3.5-turbo",
            messages=[{
                "role": "user",
                "content": f"Complementa esta información y menciona 2 fuentes académicas reales: {text}"
            }]
        )

        # Nueva forma de acceder a la respuesta
        complement = response.choices[0].message.content
        sources = extract_sources(complement)  # Función para extraer fuentes

        return jsonify({
            "complement": complement,
            "sources": sources
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


def extract_sources(text):
    # Implementa lógica para extraer fuentes del texto (ejemplo básico)
    import re
    sources = re.findall(r'Fuente:\s*(.*?)(?=\n|$)', text)
    return sources if sources else ["Fuentes académicas estándar"]


# Ejecutar la aplicación
if __name__ == '__main__':
    app.run(debug=True)