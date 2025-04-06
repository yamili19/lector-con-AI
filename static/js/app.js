let currentParagraph = null;
const synth = window.speechSynthesis;
let fullDocumentText = '';
const chatMessages = document.getElementById('chatMessages');
const userQuestionInput = document.getElementById('userQuestion');
const sendButton = document.getElementById('sendQuestion');

let chatHistory = [];
let isTyping = false;
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
    fullDocumentText = paragraphs.map(p => p.text || p).join('\n\n');

    // Generar sugerencias después de cargar el documento
    generateSuggestions();

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

document.getElementById('downloadChat').addEventListener('click', downloadChat);

document.addEventListener('DOMContentLoaded', () => {
    // Mensaje inicial del asistente
    setTimeout(() => {
        addMessageToChat("¡Hola! Soy tu asistente para analizar documentos. Sube un archivo y hazme preguntas sobre su contenido.");
    }, 1000);
});

function addMessageToChat(text, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

    let processedText = text;
    processedText = processedText.replace(/"([^"]+)"/g, '<div class="document-quote">$1</div>');

    if (processedText.includes("Información adicional:")) {
        const parts = processedText.split("Información adicional:");
        processedText = parts[0] +
            '<div class="additional-info"><strong>Información adicional:</strong>' +
            parts[1].replace(/Fuente:\s*(.+?)\s*(\(https?:\/\/[^\s)]+)?/g,
            '<div class="external-source">Fuente: <a href="$2" target="_blank">$1</a></div>') +
            '</div>';
    }

    messageDiv.innerHTML = processedText;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Guardar en el historial
    chatHistory.push({
        text: text,
        isUser: isUser,
        timestamp: new Date().toISOString()
    });
}

function showTypingIndicator() {
    if (isTyping) return;

    isTyping = true;
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <div>Asistente está escribiendo...</div>
        <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    isTyping = false;
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

async function handleUserQuestion() {
    const question = userQuestionInput.value.trim();
    if (!question || !fullDocumentText) return;

    addMessageToChat(question, true);
    userQuestionInput.value = '';
    showTypingIndicator();

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: question,
                document_text: fullDocumentText
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        hideTypingIndicator();
        addMessageToChat(data.answer);

    } catch (error) {
        hideTypingIndicator();
        addMessageToChat(`Error: ${error.message}`);
    }
}

async function generateSuggestions() {
    if (!fullDocumentText) return;

    try {
        const response = await fetch('/suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                document_text: fullDocumentText
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        displaySuggestions(data.questions);
    } catch (error) {
        console.error("Error generando sugerencias:", error);
        // Fallback: generar sugerencias localmente
        const fallbackQuestions = [
            "¿Cuál es el tema principal?",
            "¿Qué métodos se mencionan?",
            "¿Cuáles son las conclusiones?",
            "¿Quiénes son los autores?",
            "¿Qué fuentes se citan?"
        ];
        displaySuggestions(fallbackQuestions);
    }
}

function displaySuggestions(questions) {
    const container = document.getElementById('suggestionsList');
    container.innerHTML = '';

    questions.forEach(question => {
        const chip = document.createElement('div');
        chip.className = 'suggestion-chip';
        chip.textContent = question;
        chip.addEventListener('click', () => {
            userQuestionInput.value = question;
            userQuestionInput.focus();
        });
        container.appendChild(chip);
    });
}

function downloadChat() {
    if (chatHistory.length === 0) return;

    let chatText = "Historial de conversación:\n\n";
    chatHistory.forEach(msg => {
        const prefix = msg.isUser ? "Tú: " : "Asistente: ";
        const date = new Date(msg.timestamp).toLocaleString();
        chatText += `${prefix} [${date}]\n${msg.text}\n\n`;
    });

    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Event listeners para el chat
sendButton.addEventListener('click', handleUserQuestion);
userQuestionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleUserQuestion();
});

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

document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('toggleDocument');
    const documentContent = document.getElementById('documentContent');

    // Estado inicial (descolapsado)
    let isCollapsed = false;

    toggleButton.addEventListener('click', () => {
        isCollapsed = !isCollapsed;

        // Alternar clases
        documentContent.classList.toggle('collapsed', isCollapsed);
        toggleButton.classList.toggle('collapsed', isCollapsed);
        toggleButton.innerHTML = isCollapsed
            ? '<i class="fas fa-chevron-down"></i>'
            : '<i class="fas fa-chevron-up"></i>';

        // Opcional: Guardar preferencia en localStorage
        localStorage.setItem('documentCollapsed', isCollapsed);
    });

    // Opcional: Cargar preferencia guardada
    const savedState = localStorage.getItem('documentCollapsed');
    if (savedState === 'true') {
        isCollapsed = true;
        documentContent.classList.add('collapsed');
        toggleButton.classList.add('collapsed');
        toggleButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
    }
});