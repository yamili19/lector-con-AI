// static/js/modules/chatManager.js
import { sanitizeInput, showLoading, hideLoading } from './utils.js';
import { getFullDocumentText } from './fileHandler.js';

let chatHistory = [];
let isTyping = false;

export function getChatHistory() {
    return chatHistory;
}

export function addMessageToChat(text, isUser = false, isError = false) {
    const chatMessages = document.getElementById('chatMessages');

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

    chatHistory.push({
        text: text,
        isUser: isUser,
        isError: isError,
        timestamp: new Date().toISOString()
    });
}

export async function handleUserQuestion(question) {
    const documentText = getFullDocumentText();

    if (!question || question.trim().length < 3) {
        showChatError("La pregunta debe tener al menos 3 caracteres");
        return;
    }

    if (!documentText) {
        showChatError("Primero sube un documento para poder responder tus preguntas");
        return;
    }

    addMessageToChat(question, true);
    showTypingIndicator();

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: question,
                document_text: documentText
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

function showTypingIndicator() {
    if (isTyping) return;

    isTyping = true;
    const chatMessages = document.getElementById('chatMessages');
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

function showChatError(message) {
    const chatMessages = document.getElementById('chatMessages');
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

    chatHistory.push({
        text: message,
        isUser: false,
        isError: true,
        timestamp: new Date().toISOString()
    });
}