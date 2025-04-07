// static/js/modules/fileHandler.js
import { showLoading, hideLoading, showError } from './utils.js';

let fullDocumentText = '';

export function getFullDocumentText() {
    return fullDocumentText;
}

export function setFullDocumentText(text) {
    fullDocumentText = text;
}

export async function handleFileUpload(file) {
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
        return result;

    } catch (error) {
        showError(error);
        console.error('Error:', error);
        throw error;
    } finally {
        hideLoading();
    }
}