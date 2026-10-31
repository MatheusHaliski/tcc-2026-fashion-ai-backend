# Regras do repositório FashionAI para agentes

## Tamanho de arquivo (obrigatório — checado no CI)

Leia `docs/refactoring/LINE_RULES.md`. Resumo:

- Código de produção: no máximo **250 linhas** por arquivo; testes: no máximo **400**.
- Arquivos legados acima do limite estão congelados em `scripts/refactoring/line_baseline.json` e **não podem
  crescer**. Para mudar um deles, extraia antes uma responsabilidade (função/classe/hook/componente) e só então
  acrescente código.
- Depois de reduzir um arquivo congelado: `python -m scripts.refactoring.line_ratchet --update` e versione o baseline.
- Antes de commitar: `python -m scripts.refactoring.line_ratchet` deve terminar sem violações.
- **Arquivo acima do limite deve ser refatorado criando arquivos auxiliares** (uma responsabilidade coesa por
  arquivo, cada um dentro do limite); o original passa a compor/delegar. GoF quando a estrutura corresponder.
- Divida por responsabilidade, não por contagem; nunca fragmente artificialmente.

## Refatoração

- Teste de caracterização antes de extrair; mesmo contrato depois (API, DTO, URL, i18n, autorização, transação,
  schema, visual).
- Padrões GoF só com problema concreto; registre a decisão em `docs/refactoring/gof/`.
- Nunca: migrations em produção, `flyway clean/repair`, deploy, IA/GPU paga, dados ou contas reais, segredos em logs.
