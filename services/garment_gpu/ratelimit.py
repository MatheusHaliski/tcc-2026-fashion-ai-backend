"""Per-client fixed-window rate limit in Redis (shared by every API replica)."""
from __future__ import annotations

import time


def check(redis, client_id: str, limit_per_minute: int, now: float | None = None) -> tuple[bool, int]:
    """Returns (allowed, retry_after_seconds). limit 0 disables the check."""
    if limit_per_minute <= 0:
        return True, 0
    now = time.time() if now is None else now
    window = int(now // 60)
    key = f"fai:rl:{client_id}:{window}"
    pipe = redis.pipeline()
    pipe.incr(key)
    pipe.expire(key, 120)
    count, _ = pipe.execute()
    if int(count) > limit_per_minute:
        return False, max(1, 60 - int(now % 60))
    return True, 0
