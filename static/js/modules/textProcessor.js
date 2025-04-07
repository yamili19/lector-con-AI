// static/js/modules/textProcessor.js
import { getFullDocumentText, setFullDocumentText } from './fileHandler.js';
import { showLoading, hideLoading } from './utils.js';

export async function fetchComplement(text, aiResponseElement) {
    if (!text || text.trim().length < 10) {
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

export async function generateSuggestions() {
    const documentText = getFullDocumentText();
    if (!documentText || documentText.trim().length === 0) {
        console.log('No hay texto del documento para generar sugerencias');
        return;
    }

    showLoading('Generando sugerencias...', document.getElementById('chatStatus'));

    try {
        const response = await fetch('/suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ document_text: documentText })
        });

        if (!response.ok) {
            throw new Error('Error al generar sugerencias');
        }

        const data = await response.json();
        displaySuggestions(data.questions || [
            "¿Cuál es el tema principal?",
            "¿Qué métodos se mencionan?",
            "¿Cuáles son las conclusiones?",
            "¿Hay datos estadísticos relevantes?",
            "¿Qué fuentes se citan?"
        ]);

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
    if (!container) return;

    container.innerHTML = '';

    questions.slice(0, 5).forEach(question => {
        if (!question || typeof question !== 'string') return;

        const chip = document.createElement('div');
        chip.className = 'suggestion-chip';
        chip.textContent = question.trim();
        chip.addEventListener('click', () => {
            const userQuestionInput = document.getElementById('userQuestion');
            if (userQuestionInput) {
                userQuestionInput.value = question.trim();
                userQuestionInput.focus();
            }
        });
        container.appendChild(chip);
    });
}