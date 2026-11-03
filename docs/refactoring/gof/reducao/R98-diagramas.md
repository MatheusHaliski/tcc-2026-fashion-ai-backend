# Lote R98-diagramas — `scripts/diagramas/v5/`

Base: `claude/relaxed-pasteur-5b5466` (`f9c3450`). Objetivo: os 5 scripts Python do gerador de diagramas v5 dentro de
250 linhas (`docs/refactoring/LINE_RULES.md`, categoria `python`), por extração de responsabilidades em módulos do mesmo
diretório, sem mudar um byte dos `.puml` gerados. `escopo.py`, `globais.py` e `indice.py` (já dentro do limite) não
foram tocados; `README.md` ganhou um parágrafo sobre as fachadas.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `gerar.py` | 1430 | 113 | `gerar_estilo.py` (142) — skinparams, acentos, `TODAY`, `esc`/`wrap`/`alias`/`header`; `gerar_consultas.py` (73) — rótulo da rota, operação/tabela do repositório, passos, tipo de dependência, chamadores, página; `gerar_ranking.py` (101) — `PRINCIPAL`, ordem das rotas, `choose_unit`; `gerar_atividades.py` (115); `gerar_sequencia.py` (127); `gerar_componentes.py` (108); `gerar_classes.py` (78); `gerar_estados.py` (208) — máquina de estados por Entidade.campo e `enum_states`; `gerar_citacao.py` (25) — `_cited`, `_up`, `_rf_prefix`, `_snake`; `gerar_flags.py` (104) — booleanos e campos de artefato; `gerar_derivados.py` (214) — limiares, faixas, classificadores, flags por limiar, `DERIVED_STATES`; `gerar_execucao.py` (134) — `kind_of_file`, `GEN`, `keep_team_diagram`, `run`; `gerar_extras.py` (75) — `EXTRAS`, `run_extras`, `render` | Facade |
| `modelo.py` | 1061 | 111 | `modelo_tipos.py` (46) — `Field`/`Method`/`TypeInfo`; `modelo_java.py` (173) — leitura tree-sitter-java, `parse_java`; `modelo_dominio.py` (123) — `TYPES`, entidades, enums, repositórios, ports/adaptadores; `modelo_rotas.py` (119) — controllers, `ENDPOINTS`, `match_endpoint`; `modelo_passos.py` (136) — `Step`, mensagens, erros lançados, guardas; `modelo_analise.py` (181) — `MethodAnalyzer`, `SERVICES`, `analyzer`, `deps_of`; `modelo_transicoes.py` (77) — `TRANSITIONS`; `modelo_derivados.py` (186) — limiares, faixas, `level_up`, `classifier`, `threshold_flags`; `modelo_front.py` (74) — `PAGES`, `BFF_ROUTES` | Facade |
| `unidades.py` | 565 | 30 | `unidades_citadas.py` (114) — unidades citadas, modo por unidades, função principal; `unidades_fluxo.py` (187) — atividades e sequência; `unidades_estrutura.py` (184) — classes, componentes, `aggregate_edges`; `unidades_estados.py` (99) — `state_machine`, `union_states` | Facade |
| `estados_ts.py` | 337 | 20 | `estados_ts_apoio.py` (40); `estados_ts_classificador.py` (69); `estados_ts_pipeline.py` (120); `estados_ts_midia.py` (121) | Facade |
| `tsmodelo.py` | 313 | 24 | `tsmodelo_tipos.py` (43); `tsmodelo_leitura.py` (157) — tree-sitter-typescript, `_parse`, `_files`; `tsmodelo_indice.py` (26) — `MODULES`/`TYPES`/`FUNCS`; `tsmodelo_passos.py` (91) — `steps`, `importers_of`, `imports_of`, `find_module` | Facade |

## Como foi dividido

- O código foi **movido por faixas de linhas, sem edição** (script de corte com verificação de cobertura: toda linha
  não vazia do original foi para um módulo novo ou ficou na fachada). Única alteração de corpo: em
  `keep_team_diagram` (`gerar_execucao.py`), `{TODAY}` passou a `{estilo.TODAY}` (ver "Data com `--data`").
- Separação pedida: **CLI/argparse** fica em `gerar.py` (`__main__`, reexecução com `PYTHONHASHSEED=0`, `--so`,
  `--data`, `--seco`, `--saida`, `--render`); **coleta/parsing** em `modelo_java.py`/`tsmodelo_leitura.py`;
  **modelo de dados** em `modelo_tipos.py`/`tsmodelo_tipos.py` e nos índices (`modelo_dominio`, `modelo_rotas`,
  `tsmodelo_indice`, …); **geração/renderização** um módulo por tipo de diagrama (`gerar_atividades` … `gerar_derivados`,
  `unidades_*`, `estados_ts_*`); **escrita** em `gerar_execucao.py`/`gerar_extras.py` (arquivos e PNG).
- As cinco fachadas reexportam todos os nomes de módulo que existiam (inclusive privados usados de fora, como
  `M._text`, `T._t`, `T._union_values`); só deixaram de existir nas fachadas as variáveis temporárias de laços de topo
  (`_n`, `_t`, `m`, `src`, …) e os módulos da stdlib importados (`M.re`, `T.glob`…), que ninguém usa.
- Consumidores: `globais.py` continua com `from gerar import alias, esc, header, relations, wrap` (reexportado);
  `escopo.py`/`indice.py`/`globais.py` continuam com `import modelo as M`. Os módulos novos de `unidades` e
  `estados_ts` importam direto de `gerar_estilo`/`gerar_consultas` em vez de `from gerar import …`. Não há outros
  importadores em `scripts/` (`grep -rn "from scripts.diagramas\|import gerar\|diagramas.v5" scripts`).
- Importações tardias dentro de funções (`import unidades as U`, `import estados_ts as ETS`, `import globais as G`)
  foram mantidas como estavam, o que evita ciclos.
- A tabela `PRINCIPAL` (métodos de controller citados, ajustada no R60a) foi movida sem mudança para `gerar_ranking.py`.

## Por que Facade

Cada arquivo original vira uma interface única (reexportações) sobre módulos coesos; quem importa `modelo`, `tsmodelo`,
`gerar`, `unidades` ou `estados_ts` não muda. É o mesmo arranjo do R76 (`exterior-alley-tex.ts`). Os dicionários
`GEN`/`DERIVED_STATES`/`TS_DERIVED` já eram uma tabela de geradores intercambiáveis (forma de Strategy); foram
mantidos como estavam, sem criar classes.

## Testes e equivalência

Não há testes que importem `scripts/diagramas` (`grep -rln diagramas scripts --include='test_*.py'` vazio). Ambiente:
`tree_sitter` não está instalado no sistema; criei um venv no scratchpad com `pip install -r
scripts/diagramas/v5/requirements.txt` (tree-sitter 0.26.0, tree-sitter-java 0.23.5, tree-sitter-typescript 0.23.2) e
`pyflakes`.

| Etapa | Comando | Resultado |
|---|---|---|
| Antes e depois — saída completa | `python scripts/diagramas/v5/gerar.py --saida <tmp>`, depois `find . -type f \| sort \| xargs sha256sum` | 376 arquivos, 359 reescritos. Lista de SHA-256 idêntica: `sha256` da lista = `f842c839a0b020b4aca1eb9d10eb4d606b849356c2f50d880269eef0bef16526` antes e depois; log `e63ccbe9…1326` igual |
| Antes e depois — `--data 2026-10-14` | idem com `--data 2026-10-14` | 304 de 376 iguais; 72 diferem **só na linha do título** (data): ver abaixo |
| Saídas laterais | `python modelo.py`, `python tsmodelo.py`, `indice.build()`, `globais.classes_by_area(...)` + `globais.components_global(...)`, `U.GEN`/`gerar.GEN`/`ETS.TS_DERIVED` | iguais: `1b9f1d5c…d35d` (modelo), `d59d7317…1185` (tsmodelo), `f3e77d0b…1d93` (índice); globais 567 linhas iguais |
| Nomes reexportados | `dir(modelo)`/`dir(tsmodelo)` antes × depois | nenhum nome novo; faltam só temporários de laço e módulos da stdlib |
| Compilação | `python3 -m py_compile scripts/diagramas/v5/*.py` | ok |
| Nomes indefinidos | `python -m pyflakes scripts/diagramas/v5/*.py` | nenhum `undefined name`; só os avisos que já existiam no original (f-string sem placeholder, variáveis locais não usadas) e os reexports das fachadas |
| Catraca | `python3 scripts/refactoring/line_ratchet.py` | 0 violações; os 5 arquivos do lote como `APERTAR` (1430→113, 1061→111, 565→30, 337→20, 313→24) |

### Data com `--data`

No original, `gerar.py` rodava como `__main__` e `unidades.py`/`estados_ts.py`/`globais.py` faziam `from gerar import
header`, o que carregava **uma segunda cópia** do módulo `gerar`. `--data` só mudava o `TODAY` de `__main__`, então os
diagramas do modo por unidades, dos estados do frontend e das visões globais saíam com a data do dia, não com a de
`--data`. Agora há um só `TODAY` (em `gerar_estilo`) e `--data` vale para todos. Com `--data 2026-10-14`, os 72
arquivos que diferem trocam só `gerado do código em 2026-11-03` por `gerado do código em 2026-10-14` no título (144
linhas de diff, todas com a data, nenhuma outra). Sem `--data` (o uso do README) a saída é byte a byte igual. Os
`.puml` versionados estão todos com uma data única por geração, o que bate com a intenção de `--data`.

## Pendências

- Nenhum arquivo do lote ficou acima do limite. Falta o integrador rodar `python -m scripts.refactoring.line_ratchet --update`.
- Avisos preexistentes do pyflakes (variáveis locais sem uso em `unidades_fluxo.py`, `gerar_componentes.py`,
  `globais.py`) ficaram como estavam, porque o código foi só movido.
