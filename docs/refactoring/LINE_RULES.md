# Regras de tamanho de arquivo (obrigatórias)

Objetivo: arquivos curtos, com uma responsabilidade, fáceis de ler e revisar. As regras valem para todo código
versionado (TS/TSX/JS, Java, Python, CSS, shell) e são verificadas no CI por `scripts/refactoring/line_ratchet.py`.

## Limites

| Tipo | Limite máximo | Meta |
|---|---|---|
| Código de produção (componente, página, hook, service, controller, util, script) | **250 linhas** | componente simples 40–150, hook 40–150, util 20–120, página ≤ 250 |
| Teste | **400 linhas** | um arquivo de teste por unidade/fluxo; fixtures grandes em arquivo próprio |

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
