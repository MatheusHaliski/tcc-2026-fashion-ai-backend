"""Todas as mudanças de estado do código, com a entidade dona do campo."""
from __future__ import annotations

import re

from modelo_analise import analyzer
from modelo_dominio import ENTITIES, ENUMS, REPOS, TYPES, bool_fields, entity_fields, src_of, status_fields
from modelo_java import _text
from modelo_rotas import _field_types
from modelo_tipos import Method, TypeInfo


# --------------------------------------------------------------------------------------------- transições globais
def _entity_of_var(service: TypeInfo, method: Method, var):
    """Tipo da variável local (ou parâmetro) que recebe setStatus — procura a declaração no corpo do método."""
    src = src_of(service)
    body = _text(method.node, src) if method.node is not None else ''
    for p in method.params:
        if p[1] == var:
            return re.sub(r'<.*', '', p[0])
    m = re.search(r'\b([A-Z]\w+)(?:<[^>]*>)?\s+' + re.escape(var) + r'\s*[=:]', body)
    if m:
        return m.group(1)
    # parâmetro de lambda sobre o resultado de um repositório: comments.findById(id).ifPresent(c -> ...)
    m = re.search(r'\b(\w+)\.\w+\([^;{}]*?\)\s*\.(?:ifPresent|forEach)\(\s*' + re.escape(var) + r'\s*->', body)
    if m:
        rep = _field_types(service).get(m.group(1))
        if rep in REPOS:
            return REPOS[rep][0]
    ft = _field_types(service).get(var)
    return ft


def transitions():
    """Todas as mudanças de estado do código: (entidade, campo, enum, origem(s), destino, Servico.metodo)."""
    out = []
    for n, t in TYPES.items():
        if t.module not in ('application', 'web', 'domain') or t.kind not in ('class', 'record'):
            continue
        an = analyzer(n)
        for m in t.methods:
            if m.node is None:
                continue
            for s in an.steps(m.name):
                if s.kind != 'transition':
                    continue
                ent = None
                if t.module == 'domain' and n in ENTITIES and s.target in ('', 'this'):
                    ent = n
                else:
                    var = s.target.split('.')[-1] if s.target else ''
                    ent = _entity_of_var(t, m, var) if var else None
                    if ent not in ENTITIES and s.enum == 'boolean':
                        cands = [e for e in ENTITIES if any(f[0] == s.field for f in bool_fields(e))]
                        ent = cands[0] if len(cands) == 1 else ent
                    elif ent not in ENTITIES and s.enum == '?enum':
                        cands = [e for e in ENTITIES if any(f[0] == s.field and f[1] in ENUMS for f in entity_fields(e))]
                        ent = cands[0] if len(cands) == 1 else ent
                    elif ent not in ENTITIES and s.enum == 'presence':
                        cands = [e for e in ENTITIES if any(f[0] == s.field for f in entity_fields(e))]
                        ent = cands[0] if len(cands) == 1 else ent
                    elif ent not in ENTITIES:
                        # o objeto pode ser um getter encadeado; tenta achar a entidade pelo campo de estado
                        cands = [e for e in ENTITIES if any(f[0] == s.field for f in status_fields(e))
                                 and (s.enum == 'String' or any(f[1] == s.enum for f in status_fields(e)))]
                        ent = cands[0] if len(cands) == 1 else ent
                    if ent in ENTITIES and not any(f[0] == s.field for f in entity_fields(ent)):
                        ent = None
                enum = s.enum
                if ent in ENTITIES and enum == '?enum':
                    enum = next((f[1] for f in entity_fields(ent) if f[0] == s.field and f[1] in ENUMS), None)
                if ent in ENTITIES and enum:
                    out.append((ent, s.field, enum, s.sources, s.value, f'{n}.{m.name}'))
    return sorted(set(out))


TRANSITIONS = transitions()
