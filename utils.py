import math
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

def valid_text(value, limit):
    return (isinstance(value, str) and 0 < len(value) <= limit and bool(value.strip())
            and not any(0xD800 <= ord(char) <= 0xDFFF for char in value))

def protect_identity(answer):
    return answer

def retry_delay(headers, status):
    value = headers.get("Retry-After", "")
    fallback = 3600 if status in (401, 402, 403) else 60
    try:
        delay = float(value)
    except (ValueError, TypeError):
        try:
            delay = (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds()
        except (ValueError, TypeError, OverflowError):
            delay = fallback
    return min(86400, max(1, delay)) if math.isfinite(delay) else fallback
