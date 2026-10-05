# RF50 — Criar selos em três tipos (Circular, Folha e Padrão FashionAI) num criador em etapas, com rascunho por IA e arte editável

**Data:** 2026-10-05 · **Origem:** evolução do RF25 (criar e editar selo de marca/celebridade) · **Numeração:** RF50, porque o
RF49 é o último cartão da lista *Requisitos Funcionais* do Trello e o RF48 está em disputa no repositório (ver
[README](README.md)).

**Trello:** [RF50](https://trello.com/c/sEKTaBZD) (lista *Requisitos Funcionais*, critérios na checklist "Critérios de Aceite") ·
**Diagramas:** [`docs/diagramas/RF50/criador-de-selos/`](../diagramas/RF50/criador-de-selos/) — atividades, sequência (criador e detecção por política),
componentes, máquina de estados (assistente, selo e vínculo) e classes.

## Objetivo

O dono de um perfil de marca (RF14) ou de celebridade (RF22), já aprovado na verificação do emissor (RF1), cria e edita
os selos do perfil num **assistente de 4 passos**, escolhe entre **três tipos de arte** e personaliza a arte (textos da
folha, imagem ou texto no centro do selo). Pode começar **com IA**, que sugere nome, nível, política e arte a partir das
peças do próprio emissor. A **política padronizada** do selo (regras estruturadas) é a mesma usada para sugerir o selo nos
criadores de peça (RF4) e de look (RF5).

## Fluxo (tela: perfil → aba "Selos" → "Novo selo" / "Editar")

1. **Modo** — "Com IA" (`POST /api/seals/draft`, nada é salvo) ou "Sem IA" (desenho padrão). Na edição de um selo
   existente o assistente abre em **Dados**.
2. **Dados** — nome, nível (LOOK ou PEÇA), política padronizada, validade (início e fim) e limite de emissões.
3. **Arte** — tipo do selo:
   - **Circular**: um dos **44 anéis** com centro livre (*Modelos*) ou o gerador/upload (*Personalizado*); o **núcleo** é
     editável: *Elemento* (ícone + texto + material), *Imagem* enviada (zoom 1–3 e texto opcional) ou *Texto* livre.
   - **Folha**: uma das **33 folhas** picotadas; todos os textos da folha são editáveis e o **emblema central** pode ser
     o da arte, uma imagem enviada ou um texto.
   - **Padrão FashionAI**: um dos **13 medalhões** prontos.
   Prévia ao vivo no tamanho do card do look (44 px) e do card da peça (36 px). Ao voltar a um tipo, o último modelo
   escolhido nele é restaurado.
4. **Revisar e salvar** — resumo (nome, nível, frase da política, validade, limite, tipo); "Editar" volta ao passo.

## Critérios de aceite

| CA | Critério |
|---|---|
| CA01 | Só um perfil emissor **APROVADO** (RF1) cria ou edita selos; perfil pessoal ou pendente recebe 403. |
| CA02 | O criador tem **4 passos na ordem Modo → Dados → Arte → Revisar e salvar**, com navegação para trás e "Editar" na revisão; salvar só existe no último passo e exige nome com 2 caracteres ou mais. |
| CA03 | **Com IA** preenche nome, nível, política e arte a partir das peças do emissor e mostra **o porquê** de cada escolha (ex.: "Cor mais frequente nas suas peças: azul (2 de 3)"); nada é salvo até o emissor confirmar. Marca → anel circular da cor mais próxima + iniciais; celebridade → folha. Sem peças cadastradas, avisa que a política ficou só com a marca do emissor e pede ajuste antes de salvar. |
| CA04 | O passo Arte oferece **três tipos** — Circular (44 modelos + Personalizado), Folha (33 modelos) e Padrão FashionAI (13 modelos) — e o tipo escolhido é o que aparece no selo salvo e nos cards. |
| CA05 | Na **Folha**, todos os textos são editáveis — título (vazio = nome do selo, até 22), série, subtítulo, rótulo, legenda, ano e texto do emblema, cada um com limite próprio — e nenhuma folha traz nome, cidade ou ano de marca real por padrão. |
| CA06 | No **Circular** (e no emblema da Folha) o **núcleo** pode ser: elemento da arte, **imagem enviada** (com zoom 1–3 e texto opcional por cima) ou **texto livre** (até 24 caracteres, quebra em até 2 linhas), com cor do texto escolhível. |
| CA07 | A imagem do núcleo vai por `POST /api/seals/uploads?purpose=core`: aceita PNG, WebP ou JPEG com lado menor ≥ 64 px e proporção até 4:1, é reduzida a até 640 px e guardada em `users/{id}/seals/`; imagem menor ou desproporcional é recusada no cliente e no servidor com mensagem clara. |
| CA08 | Ao salvar, o servidor **valida o desenho** (tipo, modelo existente no catálogo, limites de texto, modo do núcleo) e recusa com **400 `SELO_DESIGN_INVALIDO`** apontando o campo; a imagem do núcleo só é aceita se for do próprio emissor. |
| CA09 | A **política padronizada** tem até 6 regras (quantificador AO MENOS N / TODAS / NENHUMA × cor × marca × categoria × subcategoria), combinadas por TODAS ou QUALQUER, mais tags de ocasião e estilo escolhidas em listas; o texto da política é gerado a partir das regras. |
| CA10 | Nos criadores de peça (RF4) e de look (RF5), cada selo **ativo, dentro da validade e com emissões disponíveis** cuja política é atendida aparece como sugestão, com "atende: <frase da política>". |
| CA11 | O vínculo sugerido segue o ciclo **SUGERIDO → ACEITO / EDITADO / RECUSADO → (EM REVISÃO) → APROVADO / RECUSADO → REVOGADO**: celebridade sempre revisa; emissão automática soma 1 ao contador; look excluído (RF31) revoga os vínculos. |
| CA12 | Selos antigos, sem tipo gravado, continuam aparecendo como **Circular gerado**; os 3 tipos funcionam nos 3 idiomas (pt-BR, en, es). |

## API

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/seals/design-catalog` | catálogo de tipos, modelos e limites |
| POST | `/api/seals/draft` | rascunho "Com IA" (`{tier}` → `{name, tier, policy, design, reasons}`) |
| POST | `/api/seals/uploads` · `?purpose=core` | selo pronto 1:1 · imagem do núcleo |
| POST · PUT | `/api/seals` · `/api/seals/{id}` | criar · editar |
| POST | `/api/seal-suggestions/preview` · `/preview-piece` | detecção por política no look · na peça |
| POST | `/api/schemes/{id}/seal-bonds` · `/seal-bonds/refuse-all` | vínculos escolhidos no look |
| POST | `/api/seal-bonds/{id}/accept` · `/refuse` · `/review` · `/revoke` | ciclo do vínculo |

## Dados

Sem migração nova. O desenho e a política ficam em `seals.background_config_json` (`{design, policy}`); o desenho
guarda `kind` (CIRCULAR · FOLHA · FASHIONAI), `mode`, `template`, `label`, `caption`, `texts` e `core`
(`mode`, `imageUrl`, `text`, `textColor`, `zoom`). Os modelos estão em `lib/seals/templates.json` (front) e
`fai-application/src/main/resources/seals/templates.json` (ids e cores, back); as artes em `public/selos/`.

## Implementação

- **Front:** `components/seal-wizard.tsx`, `components/seal-core-editor.tsx`, `components/seal-medallion.tsx`,
  `components/seal-policy-editor.tsx`, `lib/seals/templates.ts`; aba Selos em `app/(site)/(app)/brands/[slug]/page.tsx`.
- **Back:** `SealController`, `SealService` (`draft`, `createSeal`, `updateSeal`, sugestões e vínculos),
  `SealDrafts`, `SealDesigns`, `SealPolicies`, `SealDesignService.uploadCore`.
- **Geração dos modelos:** `scripts/selos/build_templates.py` (OpenCV) e `scripts/selos/build_folhas.mjs` (Chromium).
- **Testes:** `components/seal-wizard.test.tsx`, `SealDesignsTest`, `SealDraftsTest`, `SealDesignServiceTest`,
  `SealPoliciesTest`.

## Exibição no perfil do emissor (RF14/RF22) — política revisada em 2026-10-05

O perfil de uma marca ou celebridade mostra conteúdo de **outros usuários** só quando ele passou pela política do selo:
vínculo **APPROVED** (política atendida → aceite de quem criou o look → revisão do emissor quando exigida → emissão).
Vínculos `SUGGESTED`, `ACCEPTED`/`EDITED` (ainda não roteados), `PENDING_REVIEW`, `REFUSED`, `REJECTED` e `REVOKED`
**nunca** aparecem. Implementação: `InstitutionalService` (`promoted`, `displayable`, `covers`, `catalog`).

| Aba | Entra | Fica de fora | Ordem |
|---|---|---|---|
| **Esquemas em destaque** | look com vínculo APPROVED **vigente** (`expiresAt` vazio ou no futuro) | selo expirado; look em **revalidação** (peças mudaram depois da aprovação, RF9.CA05); look não publicado, arquivado, privado ou só para seguidores (para quem não segue); bloqueio entre quem vê e o autor; autor suspenso, em exclusão ou excluído; perfil do autor privado | **HypeScore v2** do look (sem score no fim) e, no empate, a emissão mais recente |
| **Looks consagrados** | o **histórico**: os mesmos looks visíveis, inclusive com selo **expirado** (marcado "Selo expirado em…") e em revalidação (marcado "Em revalidação") | os mesmos de visibilidade/autor; revogados e rejeitados | emissão mais recente |
| **Peças em destaque** | peças dos looks em destaque: selo de **LOOK** destaca todas; selo de **PEÇA** destaca só as `linkedPieceIds`; cada peça leva **só os selos que a cobrem** | peça arquivada, fora da moderação `APPROVED`, invisível para quem vê (o look pode ser público com uma peça privada) ou de autor suspenso | ordem dos looks |
| **Catálogo** | acervo do próprio perfil: o visitante vê só peças **aprovadas na moderação e visíveis** para ele; o administrador vê todas (menos arquivadas) | — | mais recentes |

Cada entrada de look traz `promotion { issuedAt, expiresAt, expired, revalidationPending }`, que a tela mostra embaixo do card.
Desativar um selo (`INACTIVE`) só impede novas emissões; o que já foi emitido vale até expirar. O filtro "Destaques" usa o
HypeScore v2 (não o `hype_score` legado do look).

**Teto de emissões:** quando o selo fica indisponível no aceite (teto atingido, fora da janela ou inativo), o vínculo fica
`REJECTED`, com o motivo e a auditoria `RECUSADO_LIMITE`, e a API responde 409 `SELO_INDISPONIVEL`. Até esta revisão, o
rollback da transação apagava esse registro. Agora `SealService.SealUnavailable` e `@Transactional(noRollbackFor = …)` o
mantêm. Os outros erros, como o aceite sem consentimento de imagem, continuam desfazendo o aceite, e o vínculo segue
`SUGGESTED`.

**Testes:**
- `InstitutionalDisplayPolicyTest` (17): só APPROVED aparece; expirado sai do destaque e fica nos consagrados; o vínculo
  vigente prevalece sobre o expirado; revalidação; privado, rascunho e arquivado; perfil privado; seguidores; bloqueio;
  autor suspenso; ordem por Hype v2; filtro Destaques; selo de peça × selo de look; peça privada, em moderação ou
  arquivada; catálogo do visitante × administrador.
- `SealPromotionFlowTest` (11), com os serviços reais, de ponta a ponta: política da marca atendida → sugestão → aceite →
  emissão (`BRD…`, contador) → destaque, consagrados e peças. Também cobre:
  - política não atendida;
  - recusa;
  - marca que exige revisão;
  - celebridade com selo de PEÇA: consentimento, revisão (`PRM…`) e só a peça que atende;
  - rejeição pela celebridade;
  - teto de emissões;
  - revogação;
  - revalidação após edição;
  - look tornado privado;
  - vínculo duplicado.

## Dependências

RF1 (emissor aprovado), RF4 e RF5 (detecção), RF14 e RF22 (perfis), RF20 e RF21 (vínculo a marca/celebridade),
RF24 (motor de IA), RF25 (selo e promoções), RF31 (exclusão revoga vínculos), RF38 (cupons).
