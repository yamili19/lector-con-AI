// static/js/app.js
import { setupEventListeners, renderParagraphs } from './modules/uiManager.js';
import { handleFileUpload, getFullDocumentText, setFullDocumentText } from './modules/fileHandler.js';
import { handleUserQuestion, addMessageToChat, getChatHistory } from './modules/chatManager.js';
import { fetchComplement, generateSuggestions } from './modules/textProcessor.js';
import { handleParagraphClick, readTextAloud } from './modules/voiceManager.js';
import { sanitizeInput, showLoading, hideLoading, showError } from './modules/utils.js';

// Exporta funciones necesarias para los módulos
window.handleFileUpload = handleFileUpload;
window.handleUserQuestion = handleUserQuestion;
window.addMessageToChat = addMessageToChat;
window.fetchComplement = fetchComplement;
window.handleParagraphClick = handleParagraphClick;
window.readTextAloud = readTextAloud;
window.sanitizeInput = sanitizeInput;
window.getFullDocumentText = getFullDocumentText;
window.setFullDocumentText = setFullDocumentText;
window.generateSuggestions = generateSuggestions;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();

    // Mensaje inicial del asistente
    setTimeout(() => {
        addMessageToChat("¡Hola! Soy tu asistente para analizar documentos. Sube un archivo y hazme preguntas sobre su contenido.");
    }, 1000);
});