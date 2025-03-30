let currentParagraph = null;
const synth = window.speechSynthesis;
const formatText = (text) => {
    return text
        .replace(/\*\*/g, '') // Eliminar negritas
        .split('\n')
        .map(line => `<p>${line}</p>`)
        .join('');
};

const cleanSourceName = (name) => {
    return name.replace(/[\[\]\(\)\*]/g, '').trim();
};
document.getElementById('fileInput').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    showLoading('Procesando documento...');

    try {
        const response = await fetch('/process', { method: 'POST', body: formData });
        const result = await response.json();

        let paragraphs = [];
        if (file.name.endsWith('.pdf')) {
            const pdfDocument = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
            let textContent = '';

            for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
                const page = await pdfDocument.getPage(pageNum);
                const content = await page.getTextContent();
                textContent += content.items.map(item => item.str).join(' ') + '\n';
            }

            paragraphs = textContent.split('\n').filter(p => p.trim());
        } else {
            paragraphs = result.paragraphs;
        }

        renderParagraphs(paragraphs);
    } catch (error) {
        showError(error);
    } finally {
        hideLoading();
    }
});

function renderParagraphs(paragraphs) {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';

    paragraphs.forEach((para, index) => {
        const paraDiv = document.createElement('div');
        paraDiv.className = 'paragraph';
        paraDiv.innerHTML = `
            <div class="original-text">${para.text || para}</div>
            <button class="ai-trigger-button">Obtener información complementaria ⚡</button>
            <div class="ai-response" id="ai-${index}"></div>
        `;

        const aiResponse = paraDiv.querySelector('.ai-response');
        const button = paraDiv.querySelector('.ai-trigger-button');

        // Evento directo para el botón
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            fetchComplement(para.text || para, aiResponse);
        });

        // Evento original para el texto
        paraDiv.querySelector('.original-text').addEventListener('click', () => {
            handleParagraphClick(paraDiv, para.text || para);
        });

        contentDiv.appendChild(paraDiv);
    });
}

function renderAIResponse(data, container) {
    container.innerHTML = `
        <div class="ai-header">📚 INFORMACIÓN AMPLIADA:</div>
        <div class="ai-content">
            ${data.complement.replace(/\n/g, '<br>')}
        </div>
        <div class="ai-sources">
            <div class="sources-title">🔍 FUENTES:</div>
            ${data.sources.map(s => `
                <a href="${s.url}" target="_blank" class="source-link">
                    ${s.name.replace(/\*\*/g, '')} <i class="link-icon fas fa-external-link-alt"></i>
                </a>
            `).join('')}
        </div>
    `;
}

async function fetchComplement(text, aiResponseElement) {
    aiResponseElement.innerHTML = '<div class="debug">Cargando...</div>';
    aiResponseElement.style.display = 'block';

    try {
        const response = await fetch('/complement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });

        const data = await response.json();
        renderAIResponse(data, aiResponseElement);
    } catch (error) {
        aiResponseElement.innerHTML = `<div style="color: red; padding: 10px; background: #ffeef0;">ERROR: ${error.message}</div>`;
    }
}


async function handleParagraphClick(paraDiv, text) {
    if (currentParagraph === paraDiv) return;

    currentParagraph = paraDiv;
    const aiResponse = paraDiv.querySelector('.ai-response');
    aiResponse.innerHTML = '<div class="debug">Cargando...</div>'; // Debug 1
    aiResponse.style.display = 'block'; // Forzar visibilidad

    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    synth.speak(utterance);

    utterance.onend = async () => {
        try {
            console.log("Enviando texto al backend:", text); // Debug 2
            const response = await fetch('/complement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });

            console.log("Respuesta HTTP:", response.status); // Debug 3
            const data = await response.json();
            console.log("Datos recibidos:", data); // Debug 4

            // Renderizado final con estilos forzados
            aiResponse.innerHTML = `
                <div class="ai-header" style="color: #2c3e50; font-weight: bold; margin-bottom: 10px;">📚 INFORMACIÓN AMPLIADA:</div>
                <div class="ai-content" style="white-space: pre-wrap; background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    ${data.complement.replace(/\n/g, '<br>')}
                </div>
                <div class="ai-sources" style="border-top: 1px solid #ddd; padding-top: 10px;">
                    <div style="font-weight: bold; margin-bottom: 8px;">🔍 FUENTES:</div>
                    ${data.sources.map(s => `
                        <a href="${s.url}" target="_blank" style="display: block; color: #1a73e8; text-decoration: none; padding: 5px; margin: 3px 0; border-radius: 4px; background: #e8f0fe;">
                            ${s.name.replace(/\*\*/g, '')} ↗
                        </a>
                    `).join('')}
                </div>
            `;

        } catch (error) {
            aiResponse.innerHTML = `<div style="color: red; padding: 10px; background: #ffeef0;">ERROR: ${error.message}</div>`;
            console.error("Error detallado:", error); // Debug 5
        }
    };
}

function showLoading(message, container = document.getElementById('status')) {
    container.innerHTML = `<div class="loading"></div> ${message}`;
}

function hideLoading(container = document.getElementById('status')) {
    container.innerHTML = '';
}

function showError(error) {
    const statusDiv = document.getElementById('status');
    statusDiv.innerHTML = `<div style="color: red;">Error: ${error.message}</div>`;
}