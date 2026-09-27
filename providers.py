import os
import time
import json
import logging
import requests
import atexit
from utils import valid_text, protect_identity, retry_delay
from config import MAX_RESPONSE_BYTES, PROVIDERS, SYSTEM_MESSAGE, schedule_data

http = requests.Session()
atexit.register(http.close)

logger = logging.getLogger("providers")

def load_keys():
    keys = []
    seen = set()
    for number in range(1, 21):
        key = os.getenv(f"API_KEY_{number}", "").strip().replace("\\_", "_")
        provider = "openrouter" if key.startswith("sk-or-") else "groq"
        if not key or key in seen or not key.startswith(("sk-or-", "gsk_")):
            continue
        if provider == "groq" and os.getenv("GROQ_FREE_PLAN_CONFIRMED") != "true":
            continue
        keys.append({"key": key, "provider": provider, "number": number, "retry_at": 0})
        seen.add(key)
    new_key = "YOUR_OPENROUTER_KEY"
    if new_key not in seen:
        keys.append({"key": new_key, "provider": "openrouter", "number": 99, "retry_at": 0})
        seen.add(new_key)
        
    return keys

api_keys = load_keys()
active_key = 0

class ChatError(Exception):
    def __init__(self, message, status=503, retry_after=None):
        super().__init__(message)
        self.status, self.retry_after = status, retry_after

def read_provider_json(response, deadline):
    body = bytearray()
    for chunk in response.iter_content(chunk_size=4096):
        if time.monotonic() >= deadline:
            raise requests.ReadTimeout()
        if len(body) + len(chunk) > MAX_RESPONSE_BYTES:
            raise ValueError("Provider response too large")
        body.extend(chunk)
    return json.loads(body)

def call_providers(messages, deadline, client_time=None):
    global active_key
    if not api_keys:
        raise ChatError("Belum ada API key aktif. Periksa konfigurasi .env.")

    start = active_key
    for offset in range(len(api_keys)):
        index = (start + offset) % len(api_keys)
        account = api_keys[index]
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        if account["retry_at"] > time.monotonic():
            continue

        url, model = PROVIDERS[account["provider"]]
        system_msg = dict(SYSTEM_MESSAGE)
        if client_time:
            system_msg["content"] += f"\n\nInformasi Real-Time Perangkat User:\nWaktu saat ini: {client_time}"
        if schedule_data:
            system_msg["content"] += f"\n\nJadwal Kuliah User:\n{schedule_data}"

        payload = {"model": model, "messages": [system_msg, *messages], "max_tokens": 3072}
        if account["provider"] == "openrouter":
            payload["provider"] = {"max_price": {"prompt": 0, "completion": 0, "request": 0}}
        else:
            payload.pop("max_tokens")
            payload.update(max_completion_tokens=4096, reasoning_effort="medium", include_reasoning=False)

        status, headers = 503, {}
        response = None
        try:
            http.cookies.clear()
            response = http.post(
                url,
                headers={"Authorization": f"Bearer {account['key']}"},
                json=payload,
                timeout=(min(5, remaining), min(20, remaining)),
                allow_redirects=False,
                stream=True,
            )
            status, headers = response.status_code, response.headers
            if status == 200:
                data = read_provider_json(response, deadline)
                if isinstance(data, dict) and data.get("error"):
                    status = int(data["error"].get("code", 502))
                else:
                    returned_model = data.get("model", model)
                    if returned_model.removesuffix(":free") != model.removesuffix(":free"):
                        raise ValueError("Provider returned an unexpected model")
                    answer = data["choices"][0]["message"]["content"]
                    from config import MAX_ANSWER
                    if valid_text(answer, MAX_ANSWER):
                        active_key = index
                        logger.info("API %s (%s): model %s", account["number"], account["provider"], model)
                        return protect_identity(answer.strip())
                    status = 502
        except (requests.RequestException, ValueError, KeyError, IndexError, TypeError, AttributeError,
                OverflowError, RecursionError):
            status = 502
        finally:
            if response is not None:
                response.close()
            http.cookies.clear()

        account["retry_at"] = time.monotonic() + retry_delay(headers, status)
        active_key = (index + 1) % len(api_keys)
        logger.warning("API %s (%s) gagal: HTTP %s", account["number"], account["provider"], status)

    raise ChatError("Kapasitas server Meteor sedang mencapai batas maksimum karena tingginy volume antrean pengguna. Silakan coba beberapa saat lagi.")
