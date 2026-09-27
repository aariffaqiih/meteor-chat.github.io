marked.setOptions({
    breaks: true,
    gfm: true,
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try { return hljs.highlight(code, { language: lang }).value; }
            catch {}
        }
        try { return hljs.highlightAuto(code).value; }
        catch {}
        return code;
    }
});

const renderer = new marked.Renderer();
renderer.code = function(obj) {
    const code = obj.text || obj;
    const lang = obj.lang || '';
    let highlighted;
    if (lang && hljs.getLanguage(lang)) {
        try { highlighted = hljs.highlight(code, { language: lang }).value; }
        catch { highlighted = escapeHTML(code); }
    } else {
        try { highlighted = hljs.highlightAuto(code).value; }
        catch { highlighted = escapeHTML(code); }
    }
    
    const tpl = document.getElementById('tpl-code-block').content.cloneNode(true).firstElementChild;
    tpl.querySelector('.code-lang').textContent = lang || 'code';
    const codeEl = tpl.querySelector('code');
    if (lang) codeEl.className = 'hljs language-' + lang;
    else codeEl.className = 'hljs';
    codeEl.innerHTML = highlighted;
    
    return tpl.outerHTML;
};
marked.use({ renderer });

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function escapeTextAndNewlines(text) {
    const container = document.createElement('div');
    const lines = String(text).split('\n');
    for (let j = 0; j < lines.length; j++) {
        container.appendChild(document.createTextNode(lines[j]));
        if (j < lines.length - 1) {
            container.appendChild(document.createElement('br'));
        }
    }
    return container.innerHTML;
}

function copyCode(btn) {
    const pre = btn.closest('.code-block-wrapper').querySelector('pre');
    const code = pre?.querySelector('code');
    if (code) {
        navigator.clipboard.writeText(code.textContent).then(() => {
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
        });
    }
}

function formatContent(contentObj, isMarkdown = false) {
    if (Array.isArray(contentObj)) {
        let out = "";
        for (const part of contentObj) {
            if (part.type === "text") {
                out += escapeTextAndNewlines(part.text);
            } else if (part.type === "image_url") {
                const imgWrap = document.getElementById('tpl-img-wrap').content.cloneNode(true).firstElementChild;
                imgWrap.querySelector('img').src = part.image_url.url;
                out += imgWrap.outerHTML;
            }
        }
        return out;
    }
    const text = String(contentObj);
    if (isMarkdown) {
        const normalized = typeof normalizeMath === "function" ? normalizeMath(text) : text;
        return marked.parse(normalized);
    }
    return escapeTextAndNewlines(text);
}
