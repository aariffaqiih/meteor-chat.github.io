function normalizeMath(text) {
    if (!text) return "";
    
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, (match, eq) => '\n\n$$\n' + eq.trim() + '\n$$\n\n');

    text = text.replace(/\\\(([\s\S]*?)\\\)/g, (match, eq) => '$' + eq.trim() + '$');

    return text;
}

function createErrorNode(text, isBlock) {
    const el = document.createElement(isBlock ? 'div' : 'span');
    el.className = 'katex-error';
    el.textContent = text;
    return el.outerHTML;
}

const displayMath1 = {
    name: 'displayMath1',
    level: 'inline',
    start(src) { return src.indexOf('\\['); },
    tokenizer(src) {
        const match = /^\\\[([\s\S]+?)\\\]/.exec(src);
        if (match) {
            return { type: 'displayMath1', raw: match[0], text: match[1].trim() };
        }
    },
    renderer(token) {
        try {
            return katex.renderToString(token.text, { displayMode: true, throwOnError: false });
        } catch (e) {
            return createErrorNode(token.text, true);
        }
    }
};

const displayMath2 = {
    name: 'displayMath2',
    level: 'inline',
    start(src) { return src.indexOf('$$'); },
    tokenizer(src) {
        const match = /^\$\$([\s\S]+?)\$\$/.exec(src);
        if (match) {
            return { type: 'displayMath2', raw: match[0], text: match[1].trim() };
        }
    },
    renderer(token) {
        try {
            return katex.renderToString(token.text, { displayMode: true, throwOnError: false });
        } catch (e) {
            return createErrorNode(token.text, true);
        }
    }
};

const bracketBlockMath = {
    name: 'bracketBlockMath',
    level: 'inline',
    start(src) { return src.indexOf('['); },
    tokenizer(src) {
        const match = /^\[\s*\n([\s\S]*?\\[a-zA-Z][\s\S]*?)\n\s*\]/.exec(src);
        if (match) {
            return { type: 'bracketBlockMath', raw: match[0], text: match[1].trim() };
        }
    },
    renderer(token) {
        try {
            return katex.renderToString(token.text, { displayMode: true, throwOnError: false });
        } catch (e) {
            return createErrorNode(token.text, true);
        }
    }
};

const inlineMath1 = {
    name: 'inlineMath1',
    level: 'inline',
    start(src) { return src.indexOf('\\('); },
    tokenizer(src) {
        const match = /^\\\(([\s\S]+?)\\\)/.exec(src);
        if (match) {
            return { type: 'inlineMath1', raw: match[0], text: match[1].trim() };
        }
    },
    renderer(token) {
        try {
            return katex.renderToString(token.text, { displayMode: false, throwOnError: false });
        } catch (e) {
            return createErrorNode(token.text, false);
        }
    }
};

const inlineMath2 = {
    name: 'inlineMath2',
    level: 'inline',
    start(src) { return src.indexOf('$'); },
    tokenizer(src) {
        const match = /^\$([^$\n]+?)\$/.exec(src);
        if (match) {
            return { type: 'inlineMath2', raw: match[0], text: match[1].trim() };
        }
    },
    renderer(token) {
        try {
            return katex.renderToString(token.text, { displayMode: false, throwOnError: false });
        } catch (e) {
            return createErrorNode(token.text, false);
        }
    }
};

if (typeof marked !== 'undefined' && marked.use) {
    marked.use({ extensions: [displayMath1, displayMath2, bracketBlockMath, inlineMath1, inlineMath2] });
}