let currentParagraph = null;
const synth = window.speechSynthesis;
let fullDocumentText = '';
const chatMessages = document.getElementById('chatMessages');
const userQuestionInput = document.getElementById('userQuestion');
const sendButton = document.getElementById('sendQuestion');
let currentUtterance = null;

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

// Verifica que el worker esté cargado correctamente
pdfjsLib.getDocument('dummy.pdf').promise.then(() => {
    console.log('PDF.js worker cargado correctamente');
}).catch((error) => {
    console.error('Error cargando PDF.js worker:', error);
});

let chatHistory = [];
let isTyping = false;

document.getElementById('fileInput').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validación de tipo de archivo
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const fileType = file.type;

    if (!allowedTypes.includes(fileType) &&
        !file.name.toLowerCase().endsWith('.pdf') &&
        !file.name.toLowerCase().endsWith('.docx')) {
        showError(new Error('Solo se permiten archivos PDF (.pdf) o Word (.docx)'));
        e.target.value = ''; // Limpiar el input
        return;
    }

    // Resto del código de procesamiento...
    showLoading('Procesando documento...');

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/process', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al procesar el archivo');
        }

        const result = await response.json();
        renderParagraphs(result);

    } catch (error) {
        showError(error);
        console.error('Error:', error);
    } finally {
        hideLoading();
    }
});

function sanitizeInput(text) {
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\//g, '&#x2F;')
        .substring(0, 5000)
        .trim();
}

function renderParagraphs(paragraphs) {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';
    const texts = Array.isArray(paragraphs) ?
        paragraphs.map(p => p.text || p) :
        [paragraphs];

    fullDocumentText = texts.join('\n\n');

    // Generar sugerencias después de cargar el documento
    generateSuggestions();

    texts.forEach((text, index) => {
        if (!text) return;  // Saltar textos vacíos

        const paraDiv = document.createElement('div');
        paraDiv.className = 'paragraph';
        paraDiv.innerHTML = `
            <div class="original-text">${text}</div>
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
    setupParagraphEvents()
}

document.getElementById('downloadChat').addEventListener('click', downloadChat);

document.addEventListener('DOMContentLoaded', () => {
    // Mensaje inicial del asistente
    setTimeout(() => {
        addMessageToChat("¡Hola! Soy tu asistente para analizar documentos. Sube un archivo y hazme preguntas sobre su contenido.");
    }, 1000);
});

function addMessageToChat(text, isUser = false, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : isError ? 'error-message' : 'bot-message'}`;

    if (isError) {
        messageDiv.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-circle"></i>
                ${text}
            </div>
        `;
    } else {
        let processedText = text.replace(/"([^"]+)"/g, '<div class="document-quote">$1</div>');

        if (processedText.includes("Información adicional:")) {
            const parts = processedText.split("Información adicional:");
            processedText = parts[0] +
                '<div class="additional-info"><strong>Información adicional:</strong>' +
                parts[1].replace(/Fuente:\s*(.+?)\s*(\(https?:\/\/[^\s)]+)?/g,
                '<div class="external-source">Fuente: <a href="$2" target="_blank">$1</a></div>') +
                '</div>';
        }

        messageDiv.innerHTML = processedText;
    }

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Guardar en el historial
    chatHistory.push({
        text: text,
        isUser: isUser,
        isError: isError,
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
    const question = sanitizeInput(userQuestionInput.value);

    if (!question || question.trim().length < 3) {
        showChatError("La pregunta debe tener al menos 3 caracteres");
        return;
    }

    if (!fullDocumentText) {
        showChatError("Primero sube un documento para poder responder tus preguntas");
        return;
    }

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

        if (!response.ok) {
            const errorData = await response.json();
            if (errorData.error === "rate_limit_exceeded") {
                showChatError(errorData.message);
            } else {
                throw new Error(errorData.error || "Error en el servidor");
            }
            return;
        }

        const data = await response.json();
        hideTypingIndicator();
        addMessageToChat(data.answer);

    } catch (error) {
        hideTypingIndicator();
        showChatError(`Error: ${error.message}`);
        console.error("Error en el chat:", error);
    }
}

function showChatError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'rate-limit-error';
    errorDiv.innerHTML = `
        <div class="error-content">
            <i class="fas fa-exclamation-triangle"></i>
            ${message}
        </div>
    `;
    chatMessages.appendChild(errorDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Agregar al historial
    chatHistory.push({
        text: message,
        isUser: false,
        isError: true,
        timestamp: new Date().toISOString()
    });
}

async function generateSuggestions() {
    if (!fullDocumentText || fullDocumentText.trim().length === 0) {
        console.log('No hay texto del documento para generar sugerencias');
        return;
    }

    showLoading('Generando sugerencias...', document.getElementById('chatStatus'));

    try {
        const response = await fetch('/suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ document_text: fullDocumentText })
        });

        if (!response.ok) {
            throw new Error('Error al generar sugerencias');
        }

        const data = await response.json();

        if (data.questions && data.questions.length > 0) {
            displaySuggestions(data.questions);
        } else {
            console.log('No se recibieron preguntas sugeridas');
            // Mostrar preguntas por defecto
            displaySuggestions([
                "¿Cuál es el tema principal?",
                "¿Qué métodos se mencionan?",
                "¿Cuáles son las conclusiones?",
                "¿Hay datos estadísticos relevantes?",
                "¿Qué fuentes se citan?"
            ]);
        }
    } catch (error) {
        console.error('Error generando sugerencias:', error);
        displaySuggestions([
            "¿Cuál es el tema principal?",
            "¿Qué métodos se mencionan?",
            "¿Cuáles son las conclusiones?"
        ]);
    } finally {
        hideLoading(document.getElementById('chatStatus'));
    }
}

function displaySuggestions(questions) {
    const container = document.getElementById('suggestionsList');
    if (!container) {
        console.error('El contenedor de sugerencias no existe');
        return;
    }

    container.innerHTML = '';

    questions.slice(0, 5).forEach(question => {
        if (!question || typeof question !== 'string') return;

        const chip = document.createElement('div');
        chip.className = 'suggestion-chip';
        chip.textContent = question.trim();
        chip.addEventListener('click', () => {
            userQuestionInput.value = question.trim();
            userQuestionInput.focus();
        });
        container.appendChild(chip);
    });
}

function downloadChat() {
    if (chatHistory.length === 0) return;

    let chatText = "Historial de conversación:\n\n";
    chatHistory.forEach(msg => {
        const prefix = msg.isUser ? "Tú: " : msg.isError ? "ERROR: " : "Asistente: ";
        const date = new Date(msg.timestamp).toLocaleString();
        chatText += `${prefix}[${date}]\n${msg.text}\n\n`;
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

async function fetchComplement(text, aiResponseElement) {
    if (!text || text.trim().length < 10) {  // Mínimo 10 caracteres
        aiResponseElement.innerHTML = '<div class="error">Texto demasiado corto para complementar</div>';
        aiResponseElement.style.display = 'block';
        return;
    }

    aiResponseElement.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Analizando texto...</div>';
    aiResponseElement.style.display = 'block';

    try {
        const response = await fetch('/complement', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();

        // Mostrar resultados
        aiResponseElement.innerHTML = `
            <div class="ai-complement">
                <h4>Información complementaria:</h4>
                <div class="complement-content">${data.complement.replace(/\n/g, '<br>')}</div>
                ${data.sources.length > 0 ? `
                <div class="sources">
                    <h5>Fuentes:</h5>
                    ${data.sources.map(source => `
                        <a href="${source.url}" target="_blank" class="source-link">
                            ${source.name} <i class="fas fa-external-link-alt"></i>
                        </a>
                    `).join('')}
                </div>
                ` : ''}
            </div>
        `;

    } catch (error) {
        console.error('Error al complementar:', error);
        aiResponseElement.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i> Error al obtener información: ${error.message}
            </div>
        `;
    }
}


// Función modificada para leer texto
function readTextAloud(text) {
    // Cancelar lectura anterior
    if (currentUtterance) {
        synth.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    currentUtterance = utterance;

    // Configurar voz en español si está disponible
    const voices = synth.getVoices();
    const spanishVoice = voices.find(voice => voice.lang.includes('es-') || voice.lang.includes('ES'));
    if (spanishVoice) {
        utterance.voice = spanishVoice;
    }

    // Evento para manejar errores
    utterance.onerror = (event) => {
        console.error('Error en lectura de voz:', event);
        alert('Error al leer el texto. Asegúrate de permitir audio en esta página.');
    };

    synth.speak(utterance);
}



function handleParagraphClick(paraDiv, text) {
    // Resaltar el párrafo seleccionado
    document.querySelectorAll('.paragraph').forEach(p => {
        p.style.backgroundColor = 'transparent';
    });
    paraDiv.style.backgroundColor = '#f0f5ff';

    // Leer el texto
    readTextAloud(text);

    // Quitar resaltado cuando termine la lectura
    const checkCompletion = setInterval(() => {
        if (!synth.speaking) {
            paraDiv.style.backgroundColor = 'transparent';
            clearInterval(checkCompletion);
        }
    }, 500);
}

function setupParagraphEvents() {
    document.querySelectorAll('.paragraph').forEach(paraDiv => {
        const textElement = paraDiv.querySelector('.original-text');
        const button = paraDiv.querySelector('.ai-trigger-button');
        const aiResponse = paraDiv.querySelector('.ai-response');

        // Limpiar eventos previos
        textElement.onclick = null;
        button.onclick = null;

        // Nuevos eventos
        textElement.onclick = () => {
            const text = textElement.textContent;
            handleParagraphClick(paraDiv, text);
        };

        button.onclick = (e) => {
            e.stopPropagation();
            const text = textElement.textContent;
            fetchComplement(text, aiResponse);
        };
    });
}

function handleTextClick(paraDiv, text) {
    handleParagraphClick(paraDiv, text);
}

async function handleButtonClick(e, text, aiResponse) {
    e.stopPropagation();
    await fetchComplement(text, aiResponse);
}

function showLoading(message, container = document.getElementById('status')) {
    container.innerHTML = `<div class="loading"></div> ${message}`;
}

function hideLoading(container = document.getElementById('status')) {
    container.innerHTML = '';
}

function showError(error) {
    // Esta función ahora solo maneja errores de archivos
    const fileError = document.getElementById('fileError');
    const uploadSection = document.querySelector('.custom-upload');

    if (fileError && uploadSection) {
        fileError.textContent = error.message;
        fileError.style.display = 'block';
        uploadSection.classList.add('invalid');

        setTimeout(() => {
            fileError.style.display = 'none';
            uploadSection.classList.remove('invalid');
        }, 3000);
    } else {
        // Fallback: mostrar en el área de estado
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
            statusDiv.innerHTML = `<div style="color: red;">Error: ${error.message}</div>`;
        }
    }
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