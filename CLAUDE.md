# Regras do repositório FashionAI para agentes

## Tamanho de arquivo (obrigatório — checado no CI)

Leia `docs/refactoring/LINE_RULES.md`. Resumo:

- Limite máximo de linhas por arquivo, por categoria (tabela em `docs/refactoring/LINE_RULES.md`):
  hook e route handler/BFF **150**; controller Java **200**; repositório e DTO Java **120**;
  página, componente, lib TS, service, entidade, adapter, Python, scripts e CSS **250**; testes **400**.
- Arquivos legados acima do limite estão congelados em `scripts/refactoring/line_baseline.json` e **não podem
  crescer**. Para mudar um deles, extraia antes uma responsabilidade (função/classe/hook/componente) e só então
  acrescente código.
- Depois de reduzir um arquivo congelado: `python -m scripts.refactoring.line_ratchet --update` e versione o baseline.
- Antes de commitar: `python -m scripts.refactoring.line_ratchet` deve terminar sem violações.
- **Arquivo acima do limite deve ser refatorado criando arquivos auxiliares** (uma responsabilidade coesa por
  arquivo, cada um dentro do limite); o original passa a compor/delegar. GoF quando a estrutura corresponder.
- Divida por responsabilidade, não por contagem; nunca fragmente artificialmente nem comprima a formatação
  (várias instruções ou um método inteiro numa linha) para caber no limite.

## Refatoração

- Teste de caracterização antes de extrair; mesmo contrato depois (API, DTO, URL, i18n, autorização, transação,
  schema, visual).
- Padrões GoF só com problema concreto; registre a decisão em `docs/refactoring/gof/`.
- Nunca: migrations em produção, `flyway clean/repair`, deploy, IA/GPU paga, dados ou contas reais, segredos em logs.
