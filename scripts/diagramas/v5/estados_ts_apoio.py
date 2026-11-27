"""Apoio aos estados do frontend: palavra citada, prefixo do RF, função pelo nome e parêntese balanceado."""
from __future__ import annotations

import re

import tsmodelo as T


def _cited(word, text):
    return bool(word) and re.search(r'(?<![\w])' + re.escape(word) + r'(?![\w])', text) is not None


def _rf_prefix(title):
    rf = re.match(r'^(RF\d+[^—]*)—', title or '')
    return rf.group(1).strip() + ' — ' if rf else ''


def _func(name):
    rel = T.FUNCS.get(name)
    if rel is None:
        for r, m in T.MODULES.items():
            if name in m.funcs:
                rel = r
                break
    if rel is None:
        return None, None
    return T.MODULES[rel], T.MODULES[rel].funcs.get(name)


def _balanced(s, i):
    """Índice logo após o parêntese que fecha o que abre em s[i]."""
    depth = 0
    for j in range(i, len(s)):
        if s[j] == '(':
            depth += 1
        elif s[j] == ')':
            depth -= 1
            if depth == 0:
                return j + 1
    return len(s)
