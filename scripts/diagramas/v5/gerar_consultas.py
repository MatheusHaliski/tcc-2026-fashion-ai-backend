"""Consultas ao modelo usadas pelos geradores por RF: rótulo da rota, operação e tabela de um repositório, passos
do serviço que a rota chama, tipo de uma dependência, rotas que chamam um método e a página que chama uma rota."""
from __future__ import annotations

import re

import modelo as M
from gerar_estilo import esc


def summary_label(e, n=48):
    s = re.sub(r'^(RNF?\d+(\.\w+)?(\s*[–—-]\s*\w+)*)\s*[—–-]\s*', '', e.summary or '').strip()
    s = re.sub(r'^RF\d+\S*\s*[—–-]\s*', '', s)
    if not s:
        s = f'{e.verb} {e.path}'
    return esc(s, n)


def repo_op(meth):
    m = meth.lower()
    if m.startswith(('save', 'insert', 'persist', 'upsert')):
        return 'grava'
    if m.startswith(('delete', 'remove', 'purge')):
        return 'apaga'
    if m.startswith(('update', 'increment', 'decrement', 'mark', 'set', 'touch', 'bump', 'reserve', 'claim', 'release')):
        return 'atualiza'
    return 'lê'


def sql_of(op):
    return {'grava': 'INSERT/UPDATE', 'apaga': 'DELETE', 'atualiza': 'UPDATE', 'lê': 'SELECT'}[op]


def table_of_repo(repo):
    ent, db = M.REPOS.get(repo, (None, 'MySQL'))
    return (M.table_of(ent) if ent else repo), db


def steps_for(e):
    """Passos do método de serviço chamado pela rota (o primeiro serviço que a rota chama)."""
    if not e.calls:
        return None, None, []
    svc, meth = e.calls[0]
    if svc not in M.TYPES or M.TYPES[svc].kind != 'class':
        return svc, meth, []
    return svc, meth, M.analyzer(svc).steps(meth)


NOT_COMPONENTS = {'Audit', 'AuditService', 'AiEngine', 'Guard', 'Clock', 'ObjectMapper', 'ApplicationEventPublisher'}


def kind_of_dep(t):
    if t in M.REPOS:
        return 'repo'
    if t in M.PORTS:
        return 'port'
    if t in M.SERVICES or (t in M.TYPES and M.TYPES[t].module == 'application'):
        return 'service'
    return 'other'


def callers_of(svc, meth):
    return [e for e in M.ENDPOINTS if (svc, meth) in e.calls]


def page_of_endpoint(e, sc):
    for r in sc.pages:
        if any(c[2] is e for c in M.PAGES[r]['calls']):
            return r
    for r, p in M.PAGES.items():
        if any(c[2] is e for c in p['calls']):
            return r
    return None
