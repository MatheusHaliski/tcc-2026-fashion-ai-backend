"""Modelo do código do FashionAI para os diagramas v5.

Lê o código de verdade (Java com tree-sitter-java, TSX com expressões regulares simples) e monta:

- entidades JPA (campos, relações, tabela, banco), enums e constantes;
- repositórios (entidade e banco de cada um);
- controllers (rotas HTTP, resumo do @Operation, métodos de serviço chamados);
- serviços (dependências injetadas e, por método, os passos em ordem: guardas que lançam erro, chamadas a
  dependências, eventos, chamadas de IA, criações de entidade e mudanças de status);
- ports e adaptadores (quem implementa cada port);
- páginas do Next.js e as rotas da API que cada uma chama.


Nada aqui depende dos diagramas antigos: tudo vem das fontes. O código fica nos módulos modelo_* (registros, leitura do
Java, domínio, rotas, passos e erros, análise de métodos, transições, estados derivados e frontend), reexportados aqui.
"""
from __future__ import annotations

from modelo_tipos import Field, Method, TypeInfo  # noqa: F401
from modelo_java import (  # noqa: F401
    ALL_TYPES,
    JAVA,
    ROOT,
    SOURCES,
    _annotations,
    _collect_types,
    _modifiers,
    _module_of,
    _parser,
    _read_type,
    _text,
    _type_text,
    parse_java,
)
from modelo_dominio import (  # noqa: F401
    ADAPTERS,
    CASSANDRA_ROWS,
    ENTITIES,
    ENUMS,
    PORTS,
    REPOS,
    REPO_BASES,
    STATUS_FIELD,
    TYPES,
    bool_fields,
    by_module,
    entity_fields,
    src_of,
    status_fields,
    store_of_adapter,
    table_of,
)
from modelo_rotas import (  # noqa: F401
    CONTROLLERS,
    ENDPOINTS,
    Endpoint,
    MAPPINGS,
    _EP_RX,
    _field_types,
    _first_string,
    _strip_templates,
    _summary,
    endpoint_regex,
    match_endpoint,
)
from modelo_passos import (  # noqa: F401
    MESSAGES,
    Step,
    _DEFAULT_CODE,
    _STATUS,
    _error_of,
    _is_throw_branch,
    _load_messages,
    _message,
    _split_args,
    _status_of_cond,
)
from modelo_analise import (  # noqa: F401
    BOOL_FIELD_NAMES,
    ENUM_FIELD_NAMES,
    MethodAnalyzer,
    PRESENCE_FIELD,
    PRESENCE_FIELD_NAMES,
    SERVICES,
    _ANALYZERS,
    analyzer,
    deps_of,
)
from modelo_transicoes import TRANSITIONS, _entity_of_var, transitions  # noqa: F401
from modelo_derivados import (  # noqa: F401
    SCORE_BANDS,
    _cond_text,
    classifier,
    enum_args,
    enum_thresholds,
    level_up,
    message_of,
    method_containing,
    score_bands,
    threshold_flags,
)
from modelo_front import BFF_ROUTES, FRONT_API, PAGES, _imports, _resolve_import, api_calls_of, route_of  # noqa: F401


if __name__ == '__main__':
    print('tipos', len(TYPES), 'entidades', len(ENTITIES), 'linhas cassandra', len(CASSANDRA_ROWS), 'enums', len(ENUMS))
    print('repositórios', len(REPOS), 'ports', len(PORTS), 'com adaptador', len(ADAPTERS))
    print('controllers', len(CONTROLLERS), 'endpoints', len(ENDPOINTS), 'serviços', len(SERVICES))
    print('transições', len(TRANSITIONS), 'páginas', len(PAGES),
          'chamadas de API nas páginas', sum(len(p['calls']) for p in PAGES.values()),
          'sem endpoint', sum(1 for p in PAGES.values() for c in p['calls'] if c[2] is None))
