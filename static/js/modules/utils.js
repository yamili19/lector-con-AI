// static/js/modules/utils.js
export function sanitizeInput(text) {
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

export function showLoading(message, container = document.getElementById('status')) {
    container.innerHTML = `<div class="loading"></div> ${message}`;
}

export function hideLoading(container = document.getElementById('status')) {
    container.innerHTML = '';
}

export function showError(error) {
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
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
            statusDiv.innerHTML = `<div style="color: red;">Error: ${error.message}</div>`;
        }
    }
}