"""O passo de um método e a leitura dos erros lançados: mensagens pt-BR, código e status HTTP, guardas e valores
de estado citados numa condição."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass

from modelo_java import ROOT


# --------------------------------------------------------------------------------------------- análise de métodos
@dataclass
class Step:
    kind: str           # guard | call | event | ai | create | transition | throw | branch
    text: str = ''
    target: str = ''    # tipo da dependência, evento, capacidade, entidade
    method: str = ''
    code: str = ''      # código de erro
    status: int = 0
    field: str = ''     # campo de estado (transições)
    value: str = ''     # novo valor
    enum: str = ''
    sources: tuple = ()
    cond: str = ''


def _load_messages():
    out = {}
    path = ROOT + '/fai-application/src/main/resources/i18n/messages.properties'
    if not os.path.exists(path):
        return out
    for line in open(path, encoding='utf-8'):
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            out[k.strip()] = v.strip()
    return out


MESSAGES = _load_messages()
_STATUS = {'badRequest': 400, 'notFound': 404, 'conflict': 409, 'unauthorized': 401, 'forbidden': 403, 'tooMany': 429,
           'unprocessable': 422}
_DEFAULT_CODE = {'notFound': 'NAO_ENCONTRADO', 'forbidden': 'ACESSO_NEGADO', 'unauthorized': 'NAO_AUTENTICADO',
                 'tooMany': 'MUITAS_TENTATIVAS'}


def _message(arg):
    """Texto pt-BR de um argumento de mensagem: Msg.t("chave", ...) ou literal."""
    if arg is None:
        return ''
    m = re.search(r'Msg\.[tk]\(\s*"([^"]+)"', arg)
    if m:
        txt = MESSAGES.get(m.group(1), '')
        return re.sub(r'\{\d+\}', '…', txt)
    m = re.match(r'\s*"((?:[^"\\]|\\.)*)"', arg)
    return m.group(1) if m else ''


def _split_args(args):
    """Separa os argumentos de topo de uma chamada (sem quebrar parênteses e strings)."""
    out, depth, cur, q = [], 0, '', None
    for ch in args:
        if q:
            cur += ch
            if ch == q and not cur.endswith('\\' + q):
                q = None
            continue
        if ch in '"\'':
            q = ch
            cur += ch
        elif ch in '([{<':
            depth += 1
            cur += ch
        elif ch in ')]}>':
            depth -= 1
            cur += ch
        elif ch == ',' and depth == 0:
            out.append(cur.strip())
            cur = ''
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def _error_of(text):
    """(código, status HTTP, mensagem pt-BR) do erro lançado num trecho."""
    m = re.search(r'ApiException\.(\w+)\s*\((.*)\)\s*;', text, re.S)
    if m and m.group(1) in _STATUS:
        kind, args = m.group(1), _split_args(m.group(2))
        if kind in _DEFAULT_CODE:
            msg = _message(args[0]) if args else ''
            if kind == 'notFound' and msg and not msg.endswith('.'):
                msg = msg + ' não encontrado(a)'
            return _DEFAULT_CODE[kind], _STATUS[kind], msg
        code = args[0].strip('"') if args else 'ERRO'
        return code, _STATUS[kind], _message(args[1]) if len(args) > 1 else ''
    m = re.search(r'new\s+ApiException\s*\((.*)\)\s*;', text, re.S)
    if m:
        args = _split_args(m.group(1))
        st = int(args[0]) if args and args[0].isdigit() else 500
        code = args[1].strip('"') if len(args) > 1 else 'ERRO'
        return code, st, _message(args[2]) if len(args) > 2 else ''
    if 'throw' in text:
        n = re.search(r'throw\s+new\s+(\w+)', text)
        return (n.group(1) if n else 'ERRO'), 500, ''
    return None


def _is_throw_branch(node):
    if node is None:
        return False
    if node.type == 'throw_statement':
        return True
    if node.type == 'block':
        stmts = [c for c in node.children if c.type not in ('{', '}', 'line_comment', 'block_comment')]
        return bool(stmts) and stmts[-1].type == 'throw_statement'
    return False


def _status_of_cond(cond, enum_names):
    """Valores de estado citados numa condição: (requeridos, excluídos)."""
    req, exc = set(), set()
    for m in re.finditer(r'(!=|==)\s*(\w+)\.([A-Z][A-Z0-9_]*)', cond):
        if m.group(2) in enum_names:
            (req if m.group(1) == '!=' else exc).add((m.group(2), m.group(3)))
    for m in re.finditer(r'(\w+)\.([A-Z][A-Z0-9_]*)\s*(!=|==)', cond):
        if m.group(1) in enum_names:
            (req if m.group(3) == '!=' else exc).add((m.group(1), m.group(2)))
    for m in re.finditer(r'(!)?\s*(\w+)\.([A-Z][A-Z0-9_]*)\.equals\(', cond):
        if m.group(2) in enum_names:
            (req if m.group(1) else exc).add((m.group(2), m.group(3)))
    for m in re.finditer(r'(!)?\s*"([A-Z][A-Z0-9_]*)"\.equals\(\s*\w+\.get\w*(Status|State|Stage|Phase)\(\)', cond):
        (req if m.group(1) else exc).add(('String', m.group(2)))
    return req, exc
