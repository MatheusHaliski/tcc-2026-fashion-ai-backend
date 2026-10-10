# Gerador de diagramas v5

Reescreve todos os diagramas de **atividades, sequência, componentes, máquina de estados e classes** do repositório a
partir do código atual. O índice com todos os links está em `docs/diagramas/INDICE-2026-10.md`.

## Como rodar

```bash
pip install -r scripts/diagramas/v5/requirements.txt
python3 scripts/diagramas/v5/gerar.py                 # reescreve os .puml no mesmo caminho (os links continuam valendo)
python3 scripts/diagramas/v5/gerar.py --render        # idem + PNG
python3 scripts/diagramas/v5/gerar.py --so RF27,RF28  # só algumas pastas
python3 scripts/diagramas/v5/gerar.py --saida /tmp/x  # escreve noutra pasta (para comparar antes de trocar)
python3 scripts/diagramas/v5/indice.py                # reescreve o índice
```

`--render` precisa de Java e do `plantuml.jar` (variável `PLANTUML_JAR` ou o jar que o Maven baixa em
`~/.m2/repository/net/sourceforge/plantuml/`). O layout é o `smetana` embutido no PlantUML, então não precisa de
Graphviz.

## O que cada arquivo faz

| Arquivo | Papel |
|---|---|
| `modelo.py` | Lê o Java com tree-sitter: entidades, enums (com os argumentos de cada valor), repositórios, ports e adaptadores, controllers e rotas, serviços e, por método, os passos em ordem (guardas que lançam erro com a mensagem em português, chamadas, IA, eventos, criações e mudanças de estado). Também lê as páginas do Next e as rotas que cada uma chama. |
| `tsmodelo.py` | Lê `app/`, `components/` e `lib/` com tree-sitter-typescript: funções, tipos e uniões, `useState` e chamadas. |
| `escopo.py` | Decide o que entra em cada diagrama (RF, telas, rotas, serviços, entidades) a partir das citações do diagrama que o time tinha, guardadas em `citacoes.json`. |
| `gerar.py` | Gera os cinco tipos por RF e os estados derivados do Java (limiares, faixas, classificadores, flags por limiar, booleanos e campos de artefato). |
| `unidades.py` | Diagramas de unidade de código (pipelines, filtros, componentes React) quando o time desenhou um módulo e não um fluxo de rota. |
| `estados_ts.py` | Estados que o frontend calcula: função classificadora (`resolveEnvironment`), etapas de pipeline (`dress()`) e o elemento de vídeo do `ArtVideo`. |
| `globais.py` | Classes de todas as entidades por área (mesmas áreas de `scripts/docs/taxonomia_entidades.py`) e componentes da arquitetura inteira. |
| `indice.py` | Escreve `docs/diagramas/INDICE-2026-10.md`. |

## Quando o código não tem o que o diagrama do time desenhou

Se não existe no código um campo, enum ou método de estado equivalente (por exemplo, o resgate em dinheiro do RF48 ainda
não foi implementado), o arquivo do time **não é reescrito**: recebe uma legenda na imagem dizendo que não foi gerado nem
verificado contra o código, e o índice marca o link com †. Assim nada inventado entra no lugar do diagrama.

## Diagramas novos

Para um RF novo, crie o `.puml` na pasta do RF citando o que ele cobre (entidades, rotas, serviços, valores de enum),
registre as citações dele e rode o gerador:

```bash
python3 scripts/diagramas/v5/escopo.py --acrescentar docs/diagramas/RF55/RF55-atividades.puml
python3 scripts/diagramas/v5/gerar.py --so RF55 --render
```

`--acrescentar` só registra arquivos que ainda não estão em `citacoes.json`: as citações dos diagramas antigos foram
tiradas antes da reescrita e não são trocadas pelo texto gerado.
