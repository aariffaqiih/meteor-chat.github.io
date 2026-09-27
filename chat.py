import threading
import time
import math
from collections import deque
from providers import ChatError, call_providers
from config import LOCAL_REQUEST_LIMIT, REQUEST_BUDGET

chat_lock = threading.Lock()
recent_requests = deque()

def ask_ai(messages, client_time=None):
    if not chat_lock.acquire(blocking=False):
        raise ChatError("Meteor sedang menjawab pesan lain. Coba lagi sebentar.", retry_after=1)
    try:
        now = time.monotonic()
        while recent_requests and now - recent_requests[0] >= 60:
            recent_requests.popleft()
        if len(recent_requests) >= LOCAL_REQUEST_LIMIT:
            raise ChatError("Batas 20 pesan per menit tercapai. Coba lagi sebentar.", 429,
                            max(1, math.ceil(60 - (now - recent_requests[0]))))
        recent_requests.append(now)
        return call_providers(messages, now + REQUEST_BUDGET, client_time)
    finally:
        chat_lock.release()
