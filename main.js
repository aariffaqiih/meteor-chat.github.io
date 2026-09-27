function handleSendFromLanding() {
    if (isLoading) return;
    const text = msgLanding.value.trim();
    if (!text && !currentImageBase64) return;
    
    msgChat.value = "";
    msgLanding.value = "";
    
    sendMessage(text);
}

async function handleSend() {
    if (isLoading) return;
    const text = msgChat.value.trim();
    if (!text && !currentImageBase64) return;
    
    msgChat.value = "";
    updateSendButton(msgChat, sendChat);
    autoResize(msgChat);
    sendMessage(text);
}

async function sendMessage(text) {
    if ([...text].length > MAX_MESSAGE) {
        showError(`Pesan maksimal ${MAX_MESSAGE.toLocaleString("id")} karakter.`);
        return;
    }

    hideError();
    isLoading = true;
    const btn = getActiveSendBtn();
    btn.disabled = true;

    if (editIndex !== null) {
        history = history.slice(0, editIndex);
        exitEditMode();
    }

    let finalContent = text;
    if (currentImageBase64) {
        finalContent = [
            { type: "text", text: text || " " },
            { type: "image_url", image_url: { url: currentImageBase64 } }
        ];
    }
    history.push({ role: "user", content: finalContent });
    
    clearImagePreview();

    while (history.length > MAX_HISTORY) {
        history.splice(0, 2);
    }

    renderChat();
    showTypingIndicator();

    msgChat.readOnly = true;

    try {
        const messages = history.map((m) => ({ role: m.role, content: m.content }));
        const answer = await callAPI(messages);

        removeTypingIndicator();
        history.push({ role: "assistant", content: answer });
        while (history.length > MAX_HISTORY) {
            history.splice(0, 2);
        }
        renderChat();
    } catch (err) {
        removeTypingIndicator();
        if (err.name !== "AbortError") {
            showError(err.message || "Terjadi kesalahan. Coba lagi.");
            msgChat.value = text;
            updateSendButton(msgChat, sendChat);
            if (history.length && history[history.length - 1].role === "user") {
                history.pop();
            }
            renderChat();
        }
    } finally {
        isLoading = false;
        sendChat.disabled = false;
        sendLanding.disabled = false;
        msgChat.readOnly = false;
        msgChat.focus();
    }
}

function newChat() {
    if (abortController) abortController.abort();
    history = [];
    editIndex = null;
    isLoading = false;
    sendLanding.disabled = false;
    sendChat.disabled = false;
    msgLanding.readOnly = false;
    msgChat.readOnly = false;
    msgLanding.value = "";
    msgChat.value = "";
    exitEditMode();
    hideError();
    renderChat();
    msgLanding.focus();
}

function addEnterHandler(textarea) {
    textarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
            e.preventDefault();
            if (!isLoading) {
                if (textarea === msgLanding) {
                    handleSendFromLanding();
                } else {
                    handleSend();
                }
            }
        }
    });
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('copy-btn')) {
        copyCode(e.target);
    }
});

addEnterHandler(msgLanding);
addEnterHandler(msgChat);

sendLanding.addEventListener('click', handleSendFromLanding);
cancelBtn.addEventListener('click', cancelEdit);
sendChat.addEventListener('click', handleSend);

if (API_KEYS.length === 0) {
    noKeysNotice.style.display = "";
}
