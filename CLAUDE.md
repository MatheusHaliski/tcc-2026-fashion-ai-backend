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
  A única exceção é a auditoria completa, descrita abaixo.

## Auditoria completa do app (exceção autorizada pela dona em 14/11/2026)

Quando a dona pede uma auditoria do app, tudo pode ser exercitado, inclusive o que antes ficava sem nota:

- **IA e GPU pagas liberadas na auditoria.** Provador com IA, geração do Avatar 3D, Copilot remoto, selos feitos pelo
  Copilot, remoção de fundo e geração 3D podem ser chamados de verdade, só no ambiente local e só durante a auditoria.
  - Vale o teto de gasto que a dona informar para aquela auditoria. Sem teto informado, nada pago é chamado.
  - Ligue também os limites do próprio app (`AI_DAILY_BUDGET_USD`, `AI_USER_DAILY_BUDGET_USD`) no valor do teto.
  - O relatório lista cada provedor chamado, quantas chamadas e o gasto estimado.
  - Fora de uma auditoria pedida pela dona, IA/GPU paga continua proibida (desenvolvimento, testes automáticos, CI).
- **Rosto para o Avatar 3D.** Só imagem sintética (rosto que não é de ninguém) ou foto da própria dona, enviada por
  ela para esse fim. Nunca foto de terceiros nem de menor de idade. A imagem não entra no repositório nem no relatório.
- **Sem limite de tempo por área.** Modos clássicos do FLAIR, Aventura, Heist, FAI Atelier, DNA de Estilo e as telas
  que só foram abertas entram na auditoria até o fim do fluxo principal de cada uma.
- **Fluidez do 3D.** Sem placa de vídeo no ambiente, a nota de fluidez fica "não medida" e o relatório diz isso; a
  medição é feita numa máquina com GPU quando houver uma.
- **Continua proibido, também na auditoria:** tocar em produção ou em qualquer ambiente publicado, usar contas ou
  dados reais de usuários, rodar migrations em produção, `flyway clean/repair`, deploy e segredos em logs ou no
  relatório. As variáveis `MYSQL_*` e `S3_*` do ambiente apontam para um servidor externo: nunca conectar nele; a
  auditoria usa só o banco e o armazenamento locais.
