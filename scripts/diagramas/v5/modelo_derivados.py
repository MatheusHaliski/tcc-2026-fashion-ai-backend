"""Estados que o código deriva: enums por limiar, faixas, subida de nível, classificadores e flags por limiar."""
from __future__ import annotations

import re

from modelo_dominio import TYPES, src_of
from modelo_java import ALL_TYPES, _text
from modelo_passos import _message, _split_args


# --------------------------------------------------------------------------------------------- estados derivados
def message_of(expr):
    """Texto pt-BR de uma expressão Msg.t/Msg.k("chave") ou literal."""
    return _message(expr)


def enum_args(enum, const):
    t = TYPES.get(enum)
    raw = t.const_args.get(const) if t else None
    return _split_args(raw) if raw else []


def enum_thresholds(enum):
    """Enum ordenado por limiar (ex.: FaiPointsService.Level, STUDIO(300, ...)): ({valor: (limiar, descrição)},
    variável comparada) quando o 1º argumento de cada valor é um número crescente."""
    t = TYPES.get(enum)
    if t is None or not t.const_args or len(t.const_args) < len(t.constants):
        return None
    out = {}
    for c in t.constants:
        a = enum_args(enum, c)
        num = a[0].replace('_', '') if a else ''
        if not re.fullmatch(r'-?\d+', num):
            return None
        desc = next((d for d in (_message(x) for x in a[1:]) if d), '')
        out[c] = (int(num), desc)
    vals = [v[0] for v in out.values()]
    if vals != sorted(vals) or len(set(vals)) != len(vals):
        return None
    pname = t.ctor[0][1] if t.ctor else 'threshold'
    m = re.search(r'(\w+)\s*>=\s*\w+\.' + re.escape(pname) + r'\b', src_of(t).decode('utf-8', 'replace'))
    return out, (m.group(1) if m else pname)


def score_bands():
    """Faixas declaradas como lista de records (int min, int max, …, String rótulo), como InventoryScoreService.BANDS:
    {classe dona: {'field', 'record', 'bands': [(min, max, rótulo)], 'var', 'eligible': (flag, contagem, CONST, n)}}."""
    out = {}
    for rt in ALL_TYPES:
        types = [f.type for f in rt.fields]
        if rt.kind != 'record' or len(types) < 3 or types[:2] != ['int', 'int'] or 'String' not in types[2:]:
            continue
        li = types.index('String', 2)
        owner = next((t for t in ALL_TYPES if t.name == rt.outer and t.file == rt.file), None)
        if owner is None:
            continue
        r = rt.name
        src = src_of(owner).decode('utf-8', 'replace')
        m = re.search(r'List<' + r + r'>\s+(\w+)\s*=\s*List\.of\(', src)
        if not m:
            continue
        end = src.find(';', m.end())
        body = src[m.end():end]
        bands = []
        for b in re.finditer(r'new\s+' + r + r'\(((?:[^()]|\([^()]*\))*)\)', body):
            a = _split_args(b.group(1))
            if len(a) == len(types) and re.fullmatch(r'\d+', a[0]) and re.fullmatch(r'\d+', a[1]):
                bands.append((int(a[0]), int(a[1]), _message(a[li]) or a[li]))
        if not bands:
            continue
        v = re.search(r'(\w+)\s*>=\s*\w+\.' + re.escape(rt.fields[0].name) + r'\(\)', src)
        el = None
        e = re.search(r'boolean\s+(\w+)\s*=\s*(\w+)\s*>=\s*([A-Z][A-Z0-9_]*)\s*;', src)
        if e and e.group(3) in owner.static_ints:
            el = (e.group(1), e.group(2), e.group(3), owner.static_ints[e.group(3)])
        out[owner.name] = {'field': m.group(1), 'record': r, 'bands': bands, 'var': v.group(1) if v else 'valor',
                           'eligible': el}
    return out


SCORE_BANDS = score_bands()


def level_up(enum):
    """Método que sobe de nível: declara dois valores do enum e compara after.ordinal() > before.ordinal().
    Devolve (classe, método, tipos de notificação, chamadas setX(..., after.name()))."""
    for t in ALL_TYPES:
        if t.module != 'application' or t.kind != 'class':
            continue
        src = src_of(t)
        for m in t.methods:
            if m.node is None:
                continue
            body = _text(m.node, src)
            if len(re.findall(r'\b' + re.escape(enum) + r'\s+\w+\s*=', body)) < 2:
                continue
            mm = re.search(r'(\w+)\.ordinal\(\)\s*>\s*(\w+)\.ordinal\(\)', body)
            if not mm:
                continue
            notif = list(dict.fromkeys(re.findall(r'NotificationType\.([A-Z_]+)', body)))
            sets = list(dict.fromkeys(re.findall(r'\.(set\w+)\([^;]*\b' + mm.group(1) + r'\.name\(\)', body)))
            return t.name, m.name, notif, sets
    return None


def _cond_text(node, src):
    c = _text(node, src).strip()
    while c.startswith('(') and c.endswith(')'):
        c = c[1:-1].strip()
    return re.sub(r'\s+', ' ', c)


def classifier(type_name, method_name):
    """Método que classifica algo em rótulos de texto: devolve [(condição, RÓTULO)] na ordem do código e se os
    rótulos são exclusivos (return "X") ou se acumulam (s.add("X")). Ex.: WardrobeCreatorService.availability,
    RoomService.statesOf."""
    t = TYPES.get(type_name)
    m = next((x for x in t.methods if x.name == method_name), None) if t else None
    if m is None or m.node is None:
        return None
    src = src_of(t)
    rules, kinds = [], set()
    lit = re.compile(r'^(?:return\s+|\w+\.add\(\s*)"([A-Z][A-Z0-9_]*)"')

    def labels_in(block):
        out = []
        for st in (block.children if block.type == 'block' else [block]):
            txt = _text(st, src).strip()
            mm = lit.match(txt)
            if mm:
                out.append(mm.group(1))
                kinds.add('return' if txt.startswith('return') else 'add')
        return out

    def walk(node, prefix=''):
        for ch in node.children:
            if ch.type == 'if_statement':
                cond = _cond_text(ch.child_by_field_name('condition'), src)
                for lb in labels_in(ch.child_by_field_name('consequence')):
                    rules.append((prefix + cond, lb))
                alt = ch.child_by_field_name('alternative')
                if alt is not None:
                    alt_node = alt.children[-1] if alt.type == 'else_clause' else alt
                    if alt_node.type == 'if_statement':
                        walk(type('N', (), {'children': [alt_node]})(), prefix='senão, ')
                    else:
                        for lb in labels_in(alt_node):
                            rules.append(('senão', lb))
            elif ch.type in ('return_statement', 'expression_statement'):
                for lb in labels_in(ch):
                    rules.append(('caso contrário', lb))
    walk(m.node)
    if len({r[1] for r in rules}) < 2:
        return None
    return rules, ('return' in kinds and 'add' not in kinds)


def threshold_flags(type_name):
    """Flags calculadas por limiar numa classe: boolean x = n >= CONST ou put("x", n >= CONST).
    Devolve [(flag, variável, CONST, valor, método)]."""
    t = TYPES.get(type_name)
    if t is None:
        return []
    src = src_of(t)
    out = []
    for m in t.methods:
        if m.node is None:
            continue
        body = _text(m.node, src)
        for mm in re.finditer(r'(?:boolean\s+(\w+)\s*=|put\(\s*"(\w+)"\s*,)\s*(\w+)\s*>=\s*([A-Z][A-Z0-9_]*)\b', body):
            const = mm.group(4)
            if const in t.static_ints:
                out.append((mm.group(1) or mm.group(2), mm.group(3), const, t.static_ints[const], m.name))
    return out


def method_containing(type_name, pattern):
    """Primeiro método do tipo cujo corpo casa com a expressão regular."""
    t = TYPES.get(type_name)
    if t is None:
        return None
    src = src_of(t)
    for m in t.methods:
        if m.node is not None and re.search(pattern, _text(m.node, src)):
            return m.name
    return None
