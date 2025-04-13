// static/js/modules/voiceManager.js
const synth = window.speechSynthesis;
let currentUtterance = null;
let isPaused = false;
let currentHighlightedPara = null;
let completionCheckInterval = null;

export function readTextAloud(text) {
    // Si ya hay una lectura en curso y está pausada, la reanudamos
    if (isPaused && currentUtterance) {
        synth.resume();
        isPaused = false;
        updateVoiceControls();
        return;
    }

    // Cancelar cualquier lectura previa
    stopReading();

    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    currentUtterance = utterance;

    // Configurar voz en español si está disponible
    const voices = synth.getVoices();
    const spanishVoice = voices.find(voice => voice.lang.includes('es-') || voice.lang.includes('ES'));
    if (spanishVoice) {
        utterance.voice = spanishVoice;
    }

    // Configurar eventos
    utterance.onend = () => {
        clearHighlight();
        currentUtterance = null;
        isPaused = false;
        clearInterval(completionCheckInterval);
        updateVoiceControls();
    };

    utterance.onerror = (event) => {
        console.error('Error en lectura de voz:', event);
        clearHighlight();
        currentUtterance = null;
        isPaused = false;
        clearInterval(completionCheckInterval);
        updateVoiceControls();
        alert('Error al leer el texto. Asegúrate de permitir audio en esta página.');
    };

    synth.speak(utterance);
    updateVoiceControls();
}

export function handleParagraphClick(paraDiv, text) {
    // Resaltar el párrafo actual
    clearHighlight();
    paraDiv.style.backgroundColor = '#f0f5ff';
    currentHighlightedPara = paraDiv;

    // Leer el texto
    readTextAloud(text);

    // Verificar cuando termina la lectura
    completionCheckInterval = setInterval(() => {
        if (!synth.speaking && !isPaused) {
            clearHighlight();
            clearInterval(completionCheckInterval);
        }
    }, 500);
}

export function togglePauseReading() {
    if (!currentUtterance) return;

    if (isPaused) {
        synth.resume();
        isPaused = false;
    } else {
        synth.pause();
        isPaused = true;
    }

    updateVoiceControls();
}

export function stopReading() {
    if (synth.speaking || isPaused) {
        synth.cancel();
    }
    clearHighlight();
    currentUtterance = null;
    isPaused = false;
    clearInterval(completionCheckInterval);
    updateVoiceControls();
}

function clearHighlight() {
    if (currentHighlightedPara) {
        currentHighlightedPara.style.backgroundColor = 'transparent';
        currentHighlightedPara = null;
    }
}

function updateVoiceControls() {
    const playPauseBtn = document.getElementById('playPauseBtn');
    const stopBtn = document.getElementById('stopBtn');

    if (!playPauseBtn || !stopBtn) return;

    if (synth.speaking && !isPaused) {
        playPauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pausar';
        playPauseBtn.disabled = false;
        stopBtn.disabled = false;
    } else if (isPaused) {
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i> Continuar';
        playPauseBtn.disabled = false;
        stopBtn.disabled = false;
    } else {
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i> Leer';
        playPauseBtn.disabled = !currentUtterance;
        stopBtn.disabled = !currentUtterance;
    }
}

// Cargar las voces disponibles
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = function() {
    };
}

// Exportar las funciones para uso global
window.togglePauseReading = togglePauseReading;
window.stopReading = stopReading;
