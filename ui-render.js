function showLanding() {
    currentView = "landing";
    landingEl.style.display = "";
    chatViewEl.style.display = "none";
    msgLanding.focus();
}

function showChatView() {
    currentView = "chat";
    landingEl.style.display = "none";
    chatViewEl.style.display = "flex";
    msgChat.focus();
}

function updateSendButton(textarea, btn) {
    const img = btn.querySelector("img");
    if (img) {
        if (textarea.value.trim().length > 0) {
            img.src = "send-active.svg";
        } else {
            img.src = "send-inactive.svg";
        }
    }
}

msgLanding.addEventListener("input", () => updateSendButton(msgLanding, sendLanding));
msgChat.addEventListener("input", () => updateSendButton(msgChat, sendChat));

function autoResize(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
}
msgLanding.addEventListener("input", () => autoResize(msgLanding));
msgChat.addEventListener("input", () => autoResize(msgChat));

function renderChat() {
    if (history.length === 0) {
        showLanding();
        conversationEl.innerHTML = '';
    } else {
        showChatView();
        
        conversationEl.innerHTML = '';

        history.forEach((item, i) => {
            const isUser = item.role === "user";
            if (isUser) {
                const msgUser = document.getElementById('tpl-user-msg').content.cloneNode(true).firstElementChild;
                
                if (Array.isArray(item.content)) {
                    const imgPart = item.content.find(p => p.type === "image_url");
                    if (imgPart) {
                        const imgWrap = document.getElementById('tpl-img-wrap').content.cloneNode(true).firstElementChild;
                        imgWrap.querySelector('img').src = imgPart.image_url.url;
                        msgUser.appendChild(imgWrap);
                    }
                    const textPart = item.content.find(p => p.type === "text");
                    const text = textPart ? textPart.text.trim() : "";
                    if (text) {
                        const bubble = document.getElementById('tpl-user-bubble').content.cloneNode(true).firstElementChild;
                        bubble.innerHTML = formatContent(text, false);
                        msgUser.appendChild(bubble);
                    }
                } else {
                    const bubble = document.getElementById('tpl-user-bubble').content.cloneNode(true).firstElementChild;
                    bubble.innerHTML = formatContent(item.content, false);
                    msgUser.appendChild(bubble);
                }
                
                const actions = document.getElementById('tpl-user-actions').content.cloneNode(true).firstElementChild;
                actions.querySelector('.btn-copy').addEventListener('click', () => copyMessage(i));
                actions.querySelector('.btn-edit').addEventListener('click', () => startEdit(i));
                msgUser.appendChild(actions);
                
                conversationEl.appendChild(msgUser);
            } else {
                const msgAssistant = document.getElementById('tpl-assistant-msg').content.cloneNode(true).firstElementChild;
                
                const contentDiv = msgAssistant.querySelector('.msg-assistant-content');
                if (i === history.length - 1) {
                    contentDiv.id = 'streaming-target';
                }
                contentDiv.innerHTML = formatContent(item.content, true);
                
                msgAssistant.querySelector('.btn-copy').addEventListener('click', () => copyMessage(i));
                
                conversationEl.appendChild(msgAssistant);
            }
        });
    }
    scrollToBottom();
}

function showTypingIndicator() {
    const typing = document.getElementById('tpl-typing').content.cloneNode(true).firstElementChild;
    conversationEl.appendChild(typing);
    scrollToBottom();
}

function updateStreamingMessage(text) {
    const target = $("streaming-target");
    if (target) {
        target.innerHTML = formatContent(text, true);
        scrollToBottom();
    }
}

function removeTypingIndicator() {
    const el = $("typing-indicator");
    if (el) el.remove();
}

function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = "";
}

function hideError() {
    errorBox.style.display = "none";
}

function scrollToBottom() {
    if (currentView === "chat") {
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }
}

function startEdit(index) {
    if (isLoading) return;
    editIndex = index;
    const item = history[index].content;
    let text = "";
    let imgUrl = null;
    if (Array.isArray(item)) {
        text = item.find(p => p.type === "text")?.text || "";
        const imgPart = item.find(p => p.type === "image_url");
        if (imgPart) imgUrl = imgPart.image_url.url;
    } else {
        text = item;
    }
    msgChat.value = text;
    updateSendButton(msgChat, sendChat);
    autoResize(msgChat);
    cancelBtn.style.display = "";
    editNotice.style.display = "";
    msgChat.focus();
    hideError();
    if (imgUrl) {
        currentImageBase64 = imgUrl;
        const wrap = chatViewEl.querySelector('.input-wrap');
        const previewContainer = wrap.querySelector('.image-preview-container');
        const previewImg = wrap.querySelector('.image-preview');
        previewImg.src = currentImageBase64;
        previewContainer.style.display = 'flex';
    } else {
        if (typeof clearImagePreview === "function") clearImagePreview();
    }
}

function cancelEdit() {
    exitEditMode();
    msgChat.value = "";
    updateSendButton(msgChat, sendChat);
    autoResize(msgChat);
    hideError();
    if (typeof clearImagePreview === "function") clearImagePreview();
}

function exitEditMode() {
    editIndex = null;
    cancelBtn.style.display = "none";
    editNotice.style.display = "none";
}

function copyMessage(index) {
    const item = history[index].content;
    let text = Array.isArray(item) ? (item.find(p => p.type === "text")?.text || "") : item;
    navigator.clipboard.writeText(text);
}
