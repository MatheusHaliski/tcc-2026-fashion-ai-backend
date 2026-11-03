"""Comparação com o texto do diagrama do time: palavra citada, rótulo sem acento em caixa alta, prefixo do RF no
título e nome em snake_case."""
from __future__ import annotations

import re
import unicodedata


def _cited(word, text):
    return bool(word) and re.search(r'(?<![\w])' + re.escape(word) + r'(?![\w])', text) is not None


def _up(s):
    """'Versátil Closet' -> 'VERSATIL CLOSET' (para comparar rótulos com o texto do diagrama do time)."""
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().upper()
    return ' '.join(re.split(r'[^A-Z0-9]+', s)).strip()


def _rf_prefix(sc):
    rf = re.match(r'^(RF\d+[^—]*)—', sc.title)
    return rf.group(1).strip() + ' — ' if rf else ''


def _snake(name):
    return re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()
