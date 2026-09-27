import os
import json
import secrets
import logging
from pathlib import Path
from flask import Flask, abort, g, render_template, request, send_from_directory, session
from werkzeug.exceptions import HTTPException
import hmac

from config import SECRET_KEY, MAX_MESSAGE
from history import read_history, trim_history, sign_history, read_edit_index
from chat import ask_ai, ChatError

app = Flask(__name__, static_folder=None, template_folder=".")

app.config.update(
    SECRET_KEY=SECRET_KEY,
    MAX_CONTENT_LENGTH=8 * 1024 * 1024,
    MAX_FORM_MEMORY_SIZE=128 * 1024,
    MAX_FORM_PARTS=12,
    TRUSTED_HOSTS=["localhost", "127.0.0.1", "[::1]"],
    SESSION_COOKIE_NAME="meteor_session",
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Strict",
)

app.jinja_env.policies["json.dumps_kwargs"] = {"sort_keys": True, "ensure_ascii": False}

def sign_history_wrapper(history, csrf_token):
    return sign_history(history, csrf_token, app.secret_key)

app.jinja_env.globals.update(sign_history=sign_history_wrapper)

@app.before_request
def script_nonce():
    g.script_nonce = secrets.token_urlsafe(16)
    session.setdefault("csrf_token", secrets.token_urlsafe(32))
    if request.method == "POST":
        origin = request.headers.get("Origin")
        same_origin = not origin or origin == f"{request.scheme}://{request.host}"
        token = request.form.get("csrf_token", "")
        if (not same_origin or request.headers.get("Sec-Fetch-Site") == "cross-site"
                or not token.isascii() or not hmac.compare_digest(token, session["csrf_token"])):
            return render_template("index.html", history=[], error="Form tidak valid atau kedaluwarsa. Muat ulang halaman.",
                                   message="", edit_index=None), 403

@app.route("/", methods=["GET", "POST"])
def index():
    history, error, message, status = [], None, "", 200
    edit_index, retry_after = None, None
    if request.method == "POST":
        message = request.form.get("message", "").strip()
        try:
            history = read_history(request.form.get("history", "[]"))
            signature = request.form.get("history_signature", "")
            expected = sign_history_wrapper(json.loads(request.form.get("history", "[]")), session["csrf_token"])
            if not signature.isascii() or not hmac.compare_digest(signature, expected):
                history = []
                raise ValueError("Riwayat tidak autentik.")
            if "cancel" in request.form:
                message = ""
            elif "edit" in request.form:
                edit_index = read_edit_index(request.form["edit"], history)
                message = history[edit_index]["content"]
            else:
                if request.form.get("edit_index", ""):
                    edit_index = read_edit_index(request.form["edit_index"], history)
                image_base64 = request.form.get("image_base64", "")
                from utils import valid_text
                if not image_base64 and not valid_text(message, MAX_MESSAGE):
                    raise ValueError(f"Isi pesan sepanjang 1-MAX karakter.")
                context = history if edit_index is None else history[:edit_index]
                user_content = [{"type": "text", "text": message or " "}, {"type": "image_url", "image_url": {"url": image_base64}}] if image_base64 else message
                context = trim_history(context, len(message))
                pending = [*context, {"role": "user", "content": user_content}]
                client_time = request.form.get("client_time", "")
                answer = ask_ai(pending, client_time)
                history = trim_history([*pending, {"role": "assistant", "content": answer}])
                message, edit_index = "", None
        except ValueError:
            error, status = "Pesan atau riwayat tidak valid. Pesan maksimal 4.000 karakter.", 400
        except ChatError as exc:
            error, status, retry_after = str(exc), exc.status, exc.retry_after
        except Exception as exc:
            app.logger.error("Kesalahan internal: %s", type(exc).__name__)
            error, status = "Meteor mengalami kesalahan internal. Pesan belum terkirim; coba lagi.", 500
    page = render_template(
        "index.html", history=history, error=error, message=message, edit_index=edit_index
    )
    return page, status, {"Retry-After": str(retry_after)} if retry_after is not None else {}

@app.get("/<filename>")
def serve_static(filename):
    allowed = {"banner.png", "header.png", "icon.png", "style.css", "jadwal-kuliah.json"}
    for f in os.listdir(Path(app.root_path)):
        if f.endswith('.js'):
            allowed.add(f)
    if filename not in allowed or "/" in filename or "\\" in filename:
        abort(404)
    return send_from_directory(Path(app.root_path), filename)

@app.errorhandler(Exception)
def unexpected_error(error):
    if isinstance(error, HTTPException):
        return error
    app.logger.error("Kesalahan internal: %s", type(error).__name__)
    return "Meteor mengalami kesalahan internal. Muat ulang halaman dan coba lagi.", 500

@app.errorhandler(413)
def too_large(_error):
    return render_template(
        "index.html", history=[], error="Percakapan terlalu panjang. Mulai percakapan baru.",
        message="", edit_index=None
    ), 413

@app.after_request
def no_cache(response):
    if not getattr(g, "script_nonce", None):
        g.script_nonce = secrets.token_urlsafe(16)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Security-Policy"] = (
        f"default-src 'none'; script-src 'nonce-{g.script_nonce}' 'self' https://cdn.jsdelivr.net; "
        f"style-src 'self' 'nonce-{g.script_nonce}' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src https://cdn.jsdelivr.net https://fonts.gstatic.com; img-src 'self' data:; "
        "form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
    )
    return response

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    logging.getLogger("werkzeug").setLevel(logging.ERROR)
    port = int(os.getenv("PORT", "8000"))
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)
