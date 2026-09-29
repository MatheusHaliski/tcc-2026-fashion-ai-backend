# Prompt para nova conversa — TDE, Trello e tarefas funcionais para Bryan

Copie e cole todo o texto abaixo em uma nova conversa, depois de reiniciar o ambiente para que o DOCX e as variáveis do Trello estejam disponíveis.

---

Você está trabalhando no repositório `/workspace/tcc-2026-fashion-ai-backend`.

## Objetivo principal

1. Abrir e editar o documento:
   `TDEword/DOCUMENTACAO_FASHION_AI_VERSAO_FINAL.docx`.
2. Preservar integralmente o conteúdo e a formatação das seções anteriores à seção 4.
3. Preencher o documento **a partir da seção 4**, usando como fontes:
   - o código e os testes do repositório;
   - os documentos de RF/RNF;
   - as evidências E2E;
   - o board Trello do projeto.
4. Acessar o Trello em modo de leitura antes de propor mudanças.
5. Propor para Bryan tarefas **funcionais, implementáveis e demonstráveis**, concentradas nos RF25–RF39. Não limitar as sugestões a documentação, screenshots ou simples aumento da quantidade de commits.

## Acesso ao Trello

As variáveis abaixo devem estar configuradas no ambiente:

- `TRELLO_API_KEY`
- `TRELLO_TOKEN`
- `TRELLO_BOARD_ID`

Primeiro confirme apenas se elas existem, sem imprimir os valores. Em seguida execute:

```bash
python scripts/rubricas/verificar_trello.py
```

Use a API do Trello inicialmente **somente para leitura**. Leia listas, cards, descrições, responsáveis, labels, checklists e comentários relacionados a RF25–RF39. Não exponha chave ou token em logs, respostas, arquivos, commits ou URLs exibidas.

Não altere o board automaticamente. Antes de qualquer escrita, apresente um plano/diff das mudanças e solicite confirmação. Se não houver acesso, informe o erro real e continue com os artefatos locais, deixando explícito o que não foi validado no board.

## Análise obrigatória de RF25–RF39

Para cada RF, confronte Trello, código, testes e documentação:

- RF25 — selos de marca/celebridade e promoções;
- RF26 — Explorador Global;
- RF27 — Meu Quarto 3D;
- RF28 — Smart Mirror e Vista-me;
- RF29 — Inventory Score, destaques e rankings;
- RF30 — FAI Points, níveis e loja;
- RF31 — estados do acervo;
- RF32 — desafios;
- RF33 — Passarela 3D;
- RF34 — eras da celebridade;
- RF35 — coleções da marca;
- RF36 — foto com manequim;
- RF37 — FLAIR;
- RF38 — cupons Fashion AI;
- RF39 — criador e loja de guarda-roupa 3D.

Para cada um, registre:

1. estado no Trello;
2. critérios de aceite existentes;
3. implementação encontrada no frontend/backend;
4. testes existentes;
5. lacunas funcionais ou bugs verificáveis;
6. dependências;
7. uma possível contribuição de Bryan;
8. estimativa pequena/média/grande;
9. definição de pronto;
10. demonstração esperada para a banca.

Não considere a quantidade de endpoints como prova suficiente. Confirme comportamento, autorização, persistência, interface, erros e testes.

## Tipo de tarefa recomendado para Bryan

Priorize tarefas que resultem em comportamento funcional visível. Exemplos de frentes a investigar e confirmar antes de sugerir:

1. **RF27/RF28:** concluir o atalho “Usar em…” e a alternância Avatar 3D/manequim no Quarto e no Espelho.
2. **RF29:** testes verificáveis da fórmula do Inventory Score, casos de borda e explicação do cálculo na interface.
3. **RF30:** reconciliação do ledger de FAI Points, idempotência e limites diários.
4. **RF31:** consistência dos estados da peça em todas as telas e exclusão de itens indisponíveis dos fluxos de composição.
5. **RF32:** concorrência, desempate, encerramento e prevenção de pontuação duplicada nos desafios.
6. **RF33:** fallback sem WebGL, filtros Top 100 e teste visual/funcional da Passarela 3D.
7. **RF36:** tratamento de falhas e consentimento no fluxo de foto com manequim.
8. **RF37:** antifraude, idempotência, equilíbrio de recompensas ou regressão funcional dos modos do FLAIR.
9. **RF38:** resgate concorrente, expiração e prevenção de uso duplo de cupons.
10. **RF39:** autorização por perfil, persistência do guarda-roupa criado e funcionamento em dispositivos modestos.

Esses itens são hipóteses. Valide no Trello e no código antes de transformá-los em tarefas.

## Como selecionar as tarefas

Escolha de 3 a 5 tarefas para Bryan usando estes critérios:

- resolve lacuna real encontrada;
- envolve código funcional, teste automatizado e evidência;
- pode ser implementada sem reescrever a arquitetura;
- tem escopo suficiente para autoria legítima, mas cabe em uma sprint;
- está ligada a CA específico;
- pode ser demonstrada pela interface e pela API;
- não duplica trabalho concluído por outro integrante;
- reduz risco da banca ou aumenta cobertura de um fluxo importante.

Para cada tarefa escolhida, produza um card pronto para o Trello com:

- título no formato `[RFxx][FE/BE/DB/QA] ação objetiva`;
- contexto e problema;
- valor para o usuário;
- escopo incluído e fora de escopo;
- critérios de aceite em Given/When/Then;
- subtarefas separadas por FE/BE/DB/QA quando necessário;
- arquivos/módulos provavelmente afetados;
- testes obrigatórios;
- evidências exigidas;
- riscos e dependências;
- definição de pronto;
- estimativa;
- sugestão de commits pequenos e coerentes.

Evite tarefas como “atualizar README”, “tirar prints” ou “fazer vários commits” como entrega principal. Documentação e evidências devem acompanhar uma implementação ou validação funcional.

## Regras para autoria do Bryan

- Não reescreva autoria de código existente.
- Bryan deve trabalhar com sua própria conta Git e identidade verificável.
- Cada commit deve representar trabalho próprio, coeso e revisável.
- Sugestões de mensagens:
  - `feat(rf28): adicionar atalho usar em no smart mirror`
  - `test(rf32): impedir recompensa duplicada em desafios concorrentes`
  - `fix(rf38): tornar resgate de cupom transacional`
- Cada PR deve citar o card, RF, CA, testes executados e evidências.
- Outro integrante deve revisar o PR.

## Edição do DOCX

Antes de editar:

1. localize a seção 4 por título/estrutura, não apenas por número de parágrafo;
2. extraia uma cópia textual para auditoria;
3. identifique estilos, tabelas, cabeçalhos, rodapés, imagens e numeração;
4. faça backup local do DOCX original;
5. preserve as seções 1–3 sem alterações.

Ao preencher da seção 4 em diante:

- use linguagem acadêmica em português;
- não invente datas, sprints, responsáveis, métricas ou resultados;
- marque claramente campos que exigem confirmação humana;
- cite RF, RNF, CA, arquivo, teste ou card que sustenta cada afirmação;
- mantenha tabelas e estilos do modelo;
- inclua as tarefas funcionais selecionadas para Bryan no planejamento/TDE;
- registre diferenças encontradas entre Trello, documentação e código.

Gere também uma versão Markdown textual do conteúdo preenchido para facilitar revisão do PR. Se o DOCX precisar entrar no commit, informe explicitamente que ele é binário e mantenha a versão Markdown como diff revisável.

## Validação final

Antes de concluir:

1. confirme que o DOCX abre sem corrupção;
2. confirme que as seções 1–3 não mudaram;
3. revise títulos, tabelas, numeração e caracteres acentuados;
4. confirme que nenhuma credencial foi persistida;
5. execute os testes relacionados às tarefas propostas ou implementadas;
6. apresente um resumo do que foi preenchido e do que depende da equipe;
7. liste todas as consultas feitas ao Trello e garanta que nenhuma escrita ocorreu sem autorização;
8. faça commit das alterações na branch atual e prepare o PR conforme as instruções do repositório.

Comece verificando a existência do DOCX e das três variáveis `TRELLO_*`. Depois apresente um plano curto e prossiga com a análise.

---
