function setupImageUpload(wrap) {
    const fileInput = wrap.querySelector('.file-input');
    const uploadBtn = wrap.querySelector('.upload-btn');
    const previewContainer = wrap.querySelector('.image-preview-container');
    const previewImg = wrap.querySelector('.image-preview');
    const removeBtn = wrap.querySelector('.remove-image-btn');

    uploadBtn.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            processImage(e.target.files[0], previewContainer, previewImg);
        }
    });

    removeBtn.addEventListener('click', () => {
        currentImageBase64 = null;
        previewContainer.style.display = 'none';
        fileInput.value = '';
    });
}

function processImage(file, previewContainer, previewImg) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 512;
            let width = img.width;
            let height = img.height;
            if (width > height && width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            currentImageBase64 = canvas.toDataURL('image/jpeg', 0.8);
            if(previewImg && previewContainer) {
                previewImg.src = currentImageBase64;
                previewContainer.style.display = 'flex';
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

document.querySelectorAll('.input-wrap').forEach(setupImageUpload);

window.addEventListener('paste', (e) => {
    if (e.clipboardData && e.clipboardData.items) {
        for (const item of e.clipboardData.items) {
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                const wrap = currentView === 'landing' ? landingEl.querySelector('.input-wrap') : chatViewEl.querySelector('.input-wrap');
                const previewContainer = wrap.querySelector('.image-preview-container');
                const previewImg = wrap.querySelector('.image-preview');
                processImage(file, previewContainer, previewImg);
                break;
            }
        }
    }
});

function clearImagePreview() {
    currentImageBase64 = null;
    document.querySelectorAll('.image-preview-container').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.file-input').forEach(el => el.value = '');
}
