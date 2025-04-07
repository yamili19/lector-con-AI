// static/js/modules/uiManager.js
import { generateSuggestions } from './textProcessor.js';

export function setupEventListeners() {
    const toggleButton = document.getElementById('toggleDocument');
    const documentContent = document.getElementById('documentContent');
    const fileInput = document.getElementById('fileInput');
    const sendButton = document.getElementById('sendQuestion');
    const userQuestionInput = document.getElementById('userQuestion');
    const downloadChatButton = document.getElementById('downloadChat');

    // Toggle document section
    let isCollapsed = false;
    if (toggleButton && documentContent) {
        toggleButton.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            documentContent.classList.toggle('collapsed', isCollapsed);
            toggleButton.classList.toggle('collapsed', isCollapsed);
            toggleButton.innerHTML = isCollapsed
                ? '<i class="fas fa-chevron-down"></i>'
                : '<i class="fas fa-chevron-up"></i>';
            localStorage.setItem('documentCollapsed', isCollapsed);
        });

        const savedState = localStorage.getItem('documentCollapsed');
        if (savedState === 'true') {
            isCollapsed = true;
            documentContent.classList.add('collapsed');
            toggleButton.classList.add('collapsed');
            toggleButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
        }
    }

    // File input
    if (fileInput) {
        fileInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            const fileType = file.type;

            if (!allowedTypes.includes(fileType) &&
                !file.name.toLowerCase().endsWith('.pdf') &&
                !file.name.toLowerCase().endsWith('.docx')) {
                showError(new Error('Solo se permiten archivos PDF (.pdf) o Word (.docx)'));
                e.target.value = '';
                return;
            }

            try {
                const result = await handleFileUpload(file);
                renderParagraphs(result);
                generateSuggestions();
            } catch (error) {
                console.error('Error al procesar archivo:', error);
            }
        });
    }

    // Chat input
    if (sendButton && userQuestionInput) {
        sendButton.addEventListener('click', () => {
            const question = sanitizeInput(userQuestionInput.value);
            if (question) {
                handleUserQuestion(question);
                userQuestionInput.value = '';
            }
        });

        userQuestionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const question = sanitizeInput(userQuestionInput.value);
                if (question) {
                    handleUserQuestion(question);
                    userQuestionInput.value = '';
                }
            }
        });
    }

    // Download chat
    if (downloadChatButton) {
        downloadChatButton.addEventListener('click', downloadChat);
    }
}

export function renderParagraphs(paragraphs) {
    const contentDiv = document.getElementById('content');
    if (!contentDiv) return;

    contentDiv.innerHTML = '';
    const texts = Array.isArray(paragraphs) ?
        paragraphs.map(p => p.text || p) :
        [paragraphs];

    setFullDocumentText(texts.join('\n\n'));

    texts.forEach((text, index) => {
        if (!text) return;

        const paraDiv = document.createElement('div');
        paraDiv.className = 'paragraph';
        paraDiv.innerHTML = `
            <div class="original-text">${text}</div>
            <button class="ai-trigger-button">Obtener información complementaria ⚡</button>
            <div class="ai-response" id="ai-${index}"></div>
        `;

        const aiResponse = paraDiv.querySelector('.ai-response');
        const button = paraDiv.querySelector('.ai-trigger-button');
        const textElement = paraDiv.querySelector('.original-text');

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            fetchComplement(text, aiResponse);
        });

        textElement.addEventListener('click', () => {
            handleParagraphClick(paraDiv, text);
        });

        contentDiv.appendChild(paraDiv);
    });
}

function downloadChat() {
    const chatHistory = getChatHistory();
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