# Regras de tamanho de arquivo (obrigatórias)

Objetivo: arquivos curtos, com uma responsabilidade, fáceis de ler e revisar. As regras valem para todo código
versionado (TS/TSX/JS, Java, Python, CSS, shell) e são verificadas no CI por `scripts/refactoring/line_ratchet.py`.

## Limites máximos por arquivo

Cada arquivo de código pertence a uma categoria (detectada por caminho/nome em
`scripts/refactoring/line_ratchet.py`, função `category`) e tem um **limite máximo de linhas físicas**:

| Arquivo | Categoria | Máximo |
|---|---|---|
| testes, fixtures e kits de teste (`src/test`, `*.test.ts(x)`, `test_*.py`) | `teste` | **400** |
| hooks React `use-*.ts(x)` / `useX.ts(x)` | `hook` | **150** |
| Route Handlers do App Router (`app/**/route.ts`, BFF/API) e `middleware.ts` | `route-handler` | **150** |
| `page`/`layout`/`loading`/`error`/`not-found`/`template` do App Router | `pagina` | **250** |
| componentes React `.tsx`/`.jsx` | `componente` | **250** |
| módulos TS/JS sem JSX (`lib/`, helpers de `components/`) | `lib-ts` | **250** |
| controllers Spring (`fai-web/.../controller`) | `java-controller` | **200** |
| interfaces Spring Data `*Repository` | `java-repositorio` | **120** |
| DTOs/records de request/response | `java-dto` | **120** |
| entidades/embeddables JPA (`fai-domain/.../model`) | `java-entidade` | **250** |
| classes `*Service` | `java-service` | **250** |
| adapters de infraestrutura (`fai-infrastructure`) | `java-adapter` | **250** |
| políticas, regras, views, utilitários e configuração Java | `java-outro` | **250** |
| scripts, pipelines e serviços Python | `python` | **250** |
| scripts Node em `scripts/` | `script-js` | **250** |
| folhas de estilo | `css` | **250** |
| shell, Kotlin, Groovy | `outro` | **250** |

Metas de legibilidade (não obrigatórias): componente simples 40–150, hook 40–120, utilitário 20–120,
controller ≤ 150, página ≤ 200. Consulte a tabela vigente com `python3 scripts/refactoring/line_ratchet.py --limits`.

Fora do escopo: `docs/`, migrations Flyway já aplicadas (nunca reescrever), arquivos gerados, dados/JSON/SQL de seed.

## Regra de correção

**Se um arquivo exceder o limite, ele deve ser refatorado criando arquivos auxiliares**: cada responsabilidade coesa
(regras puras, mapeamento/views, parsing, cálculo, tabelas, subcomponentes, hooks, I/O) sai para um arquivo próprio
dentro do limite, e o arquivo original passa a compor/delegar. Aplicar um padrão GoF quando a nova estrutura
corresponder de fato a um (ex.: Facade sobre colaboradores, Strategy, Chain of Responsibility); caso contrário,
registrar "NENHUM" com o motivo. Exceção só para dados/configuração pura, com justificativa no baseline.

## Catraca (arquivos legados)

1. Arquivo **novo** nasce dentro do limite.
2. Arquivo que já estava acima do limite em 2026-10-31 está congelado em `scripts/refactoring/line_baseline.json`:
   **não pode crescer nenhuma linha**. Para acrescentar comportamento, extraia antes uma responsabilidade.
3. Quando um arquivo congelado diminui, rode `python -m scripts.refactoring.line_ratchet --update` e versione o
   baseline: o teto baixa e nunca volta a subir. Ao ficar dentro do limite, a entrada sai do baseline.
4. Arquivo dentro do limite não pode ultrapassá-lo.
5. Exceção nova só com entrada manual no baseline contendo `reason` concreta, aprovada em revisão de PR.

## Como dividir (sem fragmentação artificial)

- Divida por **responsabilidade**, nunca por contagem: regra pura, mapeamento/DTO, acesso a dados, orquestração e UI
  em unidades separadas. Um arquivo de 260 linhas coeso é melhor que dois de 130 acoplados.
- React: página = composição; estado e efeitos em hooks (`use-*.ts`); seções visuais em componentes; formatação e
  validação em funções puras. Preservar DOM, acessibilidade, i18n e efeitos/cleanup.
- Java: o service continua dono de `@Transactional`, autorização e repositórios; políticas puras, validações e
  montagem de views vão para classes package-private testáveis (ex.: `RegistrationFormChain`). Não mover métodos
  transacionais entre beans sem caracterização; não criar interface por service.
- Python: CLI/argparse, domínio, I/O e relatório em módulos distintos.
- Padrões GoF só quando resolvem um problema real (ver `docs/refactoring/gof/PATTERN_DECISIONS.md`).
- Sempre: teste de caracterização antes da extração, mesmo comportamento depois, métricas antes/depois no relatório.

## Verificação

```
python -m scripts.refactoring.line_ratchet          # falha em violação
python -m scripts.refactoring.line_ratchet --update # aperta o baseline após reduzir arquivos
```

O workflow `.github/workflows/architecture.yml` executa a checagem em todo PR.
`LINE_LIMITS.md`/`line_policy.py` continuam como triagem por faixas (REVIEW/PRIORITY/HIGH/CRITICAL) para priorizar
os arquivos congelados.
