import json
import hmac
import hashlib
from utils import valid_text, protect_identity
from config import MAX_HISTORY, MAX_MESSAGE, MAX_ANSWER, MAX_CONTEXT

def read_history(raw):
    try:
        history = json.loads(raw)
    except RecursionError as exc:
        raise ValueError("Riwayat terlalu kompleks.") from exc
    if not isinstance(history, list) or len(history) > MAX_HISTORY or len(history) % 2:
        raise ValueError("Riwayat percakapan tidak valid. Mulai percakapan baru.")
    clean = []
    for index, message in enumerate(history):
        role = "user" if index % 2 == 0 else "assistant"
        if not isinstance(message, dict) or message.get("role") != role:
            raise ValueError("Riwayat percakapan tidak valid. Mulai percakapan baru.")
        content = message.get("content")
        if isinstance(content, list):
            text_part = next((c.get("text", "") for c in content if c.get("type") == "text"), "")
            if not valid_text(text_part or " ", MAX_MESSAGE):
                raise ValueError("Riwayat teks gambar tidak valid.")
        elif not valid_text(content, MAX_MESSAGE if role == "user" else MAX_ANSWER):
            raise ValueError("Riwayat percakapan tidak valid. Mulai percakapan baru.")
        content = protect_identity(message["content"]) if role == "assistant" else message["content"]
        clean.append({"role": role, "content": content})
    if sum(len(message["content"]) for message in clean) > MAX_CONTEXT:
        raise ValueError("Riwayat terlalu panjang.")
    return clean

def trim_history(history, extra_length=0):
    history = history[-MAX_HISTORY:]
    while history and sum(len(item["content"]) for item in history) + extra_length > MAX_CONTEXT:
        history = history[2:]
    return history

def sign_history(history, csrf_token, secret_key):
    canonical = json.dumps(history, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hmac.new(secret_key.encode(), (csrf_token + ":" + canonical).encode(), hashlib.sha256).hexdigest()

def read_edit_index(raw, history):
    index = int(raw)
    if index < 0 or index >= len(history) or index % 2:
        raise ValueError("Pesan yang diedit tidak valid.")
    return index
