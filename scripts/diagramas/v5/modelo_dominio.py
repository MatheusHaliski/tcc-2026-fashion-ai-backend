"""Domínio, repositórios, ports e adaptadores: entidades JPA e linhas Cassandra, enums, campos de estado e
booleanos, a entidade e o banco de cada repositório e quem implementa cada port."""
from __future__ import annotations

import os
import re

from modelo_java import ROOT, SOURCES, parse_java
from modelo_tipos import TypeInfo


STATUS_FIELD = re.compile(r'(?i)^(status|state|stage|phase|\w+(Status|State|Stage|Phase))$')


TYPES = parse_java()


def src_of(t: TypeInfo):
    return SOURCES[(t.name, t.file)]


def by_module(*mods):
    return {n: t for n, t in TYPES.items() if t.module in mods}


# --------------------------------------------------------------------------------------------- domínio
ENTITIES = {n: t for n, t in TYPES.items()
            if t.module == 'domain' and t.kind == 'class' and ('Entity' in t.annotations or 'Table' in t.annotations
                                                               or 'MappedSuperclass' in t.annotations)}
CASSANDRA_ROWS = {n: t for n, t in TYPES.items()
                  if t.module == 'infra-cassandra' and 'Table' in t.annotations and t.kind in ('class', 'record')}
ENUMS = {n: t.constants for n, t in TYPES.items() if t.kind == 'enum' and t.constants}


def table_of(name):
    t = ENTITIES.get(name) or CASSANDRA_ROWS.get(name)
    if t is None:
        return None
    a = t.annotations.get('Table', '')
    m = re.search(r'"([^"]+)"', a)
    return m.group(1) if m else re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()


def entity_fields(name):
    t = ENTITIES.get(name)
    if t is None:
        return []
    out = []
    parent = t.superclass
    if parent and parent in ENTITIES:
        out += entity_fields(parent)
    for f in t.fields:
        rel = None
        if 'ManyToOne' in f.annotations:
            rel = 'many'
        elif 'OneToOne' in f.annotations:
            rel = 'one'
        elif 'OneToMany' in f.annotations or 'ManyToMany' in f.annotations:
            rel = 'list'
        out.append((f.name, f.type, rel, f.init))
    return out


def status_fields(name):
    """Campos de estado de uma entidade: (campo, tipo) quando o nome indica estado e o tipo é enum ou String."""
    out = []
    for fname, ftype, rel, init in entity_fields(name):
        if rel is None and STATUS_FIELD.match(fname) and (ftype in ENUMS or ftype == 'String'):
            out.append((fname, ftype, init))
    return out


def bool_fields(name):
    """Campos booleanos da entidade (ex.: Comment.active): (campo, valor inicial 'true'/'false')."""
    out = []
    for fname, ftype, rel, init in entity_fields(name):
        if rel is None and ftype in ('boolean', 'Boolean'):
            out.append((fname, (init or 'false').strip()))
    return out


# --------------------------------------------------------------------------------------------- repositórios
REPO_BASES = {'JpaRepository': 'MySQL', 'CrudRepository': 'MySQL', 'JpaSpecificationExecutor': 'MySQL',
              'CassandraRepository': 'Cassandra', 'ElasticsearchRepository': 'OpenSearch'}
REPOS = {}
for _n, _t in TYPES.items():
    if _t.kind != 'interface':
        continue
    for itf in _t.interfaces:
        base = re.sub(r'<.*', '', itf)
        if base in REPO_BASES:
            m = re.search(r'<(\w+)', itf)
            if m:
                REPOS[_n] = (m.group(1), REPO_BASES[base])
                break


# --------------------------------------------------------------------------------------------- ports e adaptadores
PORTS = {n: t for n, t in TYPES.items() if t.kind == 'interface' and t.module == 'application'
         and ('/ports/' in t.file or n.endswith('Port'))}
ADAPTERS = {}
for _n, _t in TYPES.items():
    if _t.kind != 'class' or _t.module not in ('infra-mysql', 'infra-cassandra', 'application', 'web', 'bootstrap'):
        continue
    for itf in _t.interfaces:
        base = re.sub(r'<.*', '', itf)
        if base in PORTS:
            ADAPTERS.setdefault(base, []).append(_n)


def store_of_adapter(name):
    """Onde um adaptador guarda ou busca os dados (pelo nome e pelo código)."""
    t = TYPES.get(name)
    # caminho relativo à raiz: o absoluto pode citar 'claude', 's3'… no nome da pasta onde o repositório está
    s = (name + ' ' + (os.path.relpath(t.file, ROOT) if t else '')).lower()
    for key, label in (('anatomicaltryon', 'Worker VTON (Cloud Run)'),
                       ('cassandra', 'Cassandra'), ('opensearch', 'OpenSearch'), ('elastic', 'OpenSearch'),
                       ('redis', 'Redis'), ('s3', 'S3'), ('mysql', 'MySQL'), ('resend', 'Resend'), ('replicate', 'Replicate'),
                       ('anthropic', 'Anthropic'), ('claude', 'Anthropic'), ('openai', 'OpenAI'), ('gemini', 'Gemini'),
                       ('vision', 'Google Vision'), ('meshy', 'Meshy'), ('runpod', 'RunPod'), ('wikidata', 'Wikidata')):
        if key in s:
            return label
    return None
