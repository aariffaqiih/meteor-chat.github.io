const _dk = (s) => [...s].map(c => String.fromCharCode(c.charCodeAt(0) ^ 1)).join('');
const CONFIG_API_KEYS = [
    { key: "YOUR_OPENROUTER_KEY", provider: "openrouter" },
    { key: "YOUR_GROQ_KEY", provider: "groq" },
];
