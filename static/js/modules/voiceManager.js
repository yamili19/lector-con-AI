// static/js/modules/voiceManager.js
const synth = window.speechSynthesis;
let currentUtterance = null;

export function readTextAloud(text) {
    if (currentUtterance) {
        synth.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    currentUtterance = utterance;

    const voices = synth.getVoices();
    const spanishVoice = voices.find(voice => voice.lang.includes('es-') || voice.lang.includes('ES'));
    if (spanishVoice) {
        utterance.voice = spanishVoice;
    }

    utterance.onerror = (event) => {
        console.error('Error en lectura de voz:', event);
        alert('Error al leer el texto. Asegúrate de permitir audio en esta página.');
    };

    synth.speak(utterance);
}

export function handleParagraphClick(paraDiv, text) {
    document.querySelectorAll('.paragraph').forEach(p => {
        p.style.backgroundColor = 'transparent';
    });
    paraDiv.style.backgroundColor = '#f0f5ff';

    readTextAloud(text);

    const checkCompletion = setInterval(() => {
        if (!synth.speaking) {
            paraDiv.style.backgroundColor = 'transparent';
            clearInterval(checkCompletion);
        }
    }, 500);
}