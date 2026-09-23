# Etapa 9 — Plano guiado de 4 horas para as nove etapas do Fashion AI

> **Resposta curta à pergunta "dá para fazer em 4h?":** dá — **desde que as etapas 1 a 5 e 8 já estejam escritas antes do cronômetro começar** (elas estão, nos documentos irmãos desta pasta) e desde que as 4 horas sejam usadas para **revisar, gerar os artefatos visuais e sincronizar o Trello**, com o time dividido em quatro frentes paralelas. Executar as nove etapas do zero, em série, por uma pessoa, não cabe em 4h — cabe em ~16h.
>
> O que este plano faz: transforma 16h de trabalho em 4h de relógio, usando (a) o trabalho analítico já entregue, (b) quatro pessoas em paralelo e (c) sessões do Claude Code rodando em segundo plano enquanto o time revisa.

---

## Estado atual — o que já está pronto nesta pasta

| Documento | Cobre as etapas | Estado |
|---|---|---|
| `01-bootstrap-repo-java.md` | **1 e 2** — inventário, tabela de decisões técnicas, arquitetura MySQL + NoSQL, variáveis de ambiente, segurança, prompt de bootstrap | ✅ pronto |
| `02-rf-reestruturados-e-criterios-aceite.md` | **3 e 5** — política de renumeração, mapa de absorção, enunciados corrigidos, ~150 CAs, matriz RF × RNF | ✅ pronto — falta validar RF6/RF13/RF23 contra as aulas |
| `03-rf24-ia-e-servicos-externos.md` | **4** — RF24 com 16 CAs + tabela RF × serviço externo de IA com custo | ✅ pronto |
| `04-telas-artefatos-e-pranchas.md` | **6 e 7** — ficha das 20 pranchas, assets Firefly, especificação dos 10 artefatos | ⚠️ esqueleto pronto; **bloqueado** pelos anexos |
| `05-diagramas-atividade.md` | **8** — 14 diagramas de atividade em Mermaid, com CAs anotados | ✅ pronto — faltam RF2, RF4, RF5, RF6, RF11, RF15, RF16 |

---

## Bloqueadores a resolver **antes** de iniciar as 4 horas

✅ **Quatro dos cinco insumos chegaram** e estão em `docs/novo-projeto/insumos/` (índice e URLs dos artefatos em [`insumos/README.md`](insumos/README.md)):

| Insumo | Estado |
|---|---|
| Padrões de interface **LGPD** (RNF6) | ✅ **incorporado** — gerou RF3.CA19–CA24, o mapa direito→controle, os anti-padrões, a spec do artefato #6 e a revisão do diagrama 10 |
| **Vinte pranchas** (Firefly) | ✅ **incorporado** — catálogo das 5 famílias e Coleções D/E/F no documento `04`; revelou o *delta* de RF20/RF21 (dois tiers de selo, aba Meus Selos) |
| Aulas **Perfil Lookbook · DNA de Estilo · Closet Inteligente** | ✅ recebidas, ⏳ **ainda não confrontadas** com os CAs de RF6 e RF13 — é o trabalho do Bloco 2 |

⚠️ **Conflito aberto que o Bloco 0 precisa decidir:** a aula "DNA de Estilo — Mosaico de Eras" define RF13 como **tipologia de publicação** (2–6 esquemas fundidos num card-retrato, com `mosaicLayout` e rótulo de era), enquanto a **HU20** define como **cartão de identidade** (arquétipo, paleta, silhueta, ousadia, peça ícone, Frase de Identidade). Os CAs de RF13 do documento `02` seguiram a HU20. Ver `insumos/README.md`.

**Todos os insumos externos chegaram** — não há mais bloqueador de entrada para as 4 horas.

A **Modelagem UML** trouxe a Parte 3 (especificação dimensional dos cards, em milímetros) que destrava o artefato #7, e o confronto com o catálogo de CAs achou **sete lacunas**, já viradas em CA no documento `02`, §4.1: campo `sexo` obrigatório, `/add-piece` como página, wearstyles por parte do corpo, listas do Build Outfit espelhando o guarda-roupa real, filtro do provador por sexo, **remixar/retornar** como interações próprias, e tema que não altera a cor do conteúdo do usuário.

⚠️ **Uma cota fica pendente:** os desenhos da Parte 3 não incluem a faixa de toggles do topo do card (⭐ favoritar, disponível, indisponível). Proposta de 8–10 mm a confirmar com quem desenhou — ver `insumos/README.md`.

---

## Divisão do time

| Frente | Pessoa | Responsabilidade nas 4h |
|---|---|---|
| **A — Requisitos** | Matheus | Revisar e aplicar as mudanças de RF/CA no Trello |
| **B — Interface** | Bryan | Conduzir as sessões de artefato e os assets do Firefly |
| **C — Modelagem** | Victor | Diagramas de atividade faltantes + conferência contra os UML existentes |
| **D — Arquitetura** | Stephanny | Repositório novo, variáveis de ambiente, segurança, RNFs |

*(Ajustar os nomes conforme a divisão real do grupo — o que importa é que sejam quatro frentes independentes.)*

---

## Cronograma

### Bloco 0 — Alinhamento · **T+00:00 → 00:15** · todos

| Passo | Ação |
|---|---|
| 1 | Ler em voz alta a §1 do documento `02` (**política de não renumerar**) e fechar a decisão em grupo. É a decisão que trava tudo o mais — se o time preferir renumerar, o plano inteiro muda. |
| 2 | Confirmar a decisão sobre **RF26 → RF3** (nota de rastreabilidade em `02`, §2): a gestão vai para RF3, o disparo fica em RF19/RF20. |
| 3 | Confirmar **RF21/RF22 (celebridades)** dentro ou fora do escopo do TCC — o card de rastreabilidade do board levanta que "Celebridades" não consta em Temas Futuros. Se sair, sai também metade do artefato #7 e o diagrama 12. |
| 4 | Confirmar a criação de **RF24** (IA) e **RF31** (favoritar/disponível/indisponível/todos). |
| 5 | Distribuir as frentes A–D. |

**Pronto quando:** as quatro decisões estão registradas como comentário no card de rastreabilidade do Trello.

---

### Bloco 1 — Etapas 1 e 2: repositório novo · **T+00:15 → 00:45** · frente D *(em paralelo com o Bloco 2)*

| Passo | Ação | Tempo |
|---|---|---|
| 1 | Criar o repositório privado `fashion-ai-api`; proteger `main` (PR obrigatório, sem force-push) | 5 min |
| 2 | Copiar para ele **apenas** `docs/`, `db/schema.sql` e os `HU*.md` — **nenhum código** | 5 min |
| 3 | Criar `.gitignore` + `.env.example` da §3.2 do documento `01` + GitHub Action do `gitleaks` | 10 min |
| 4 | Abrir uma sessão do Claude Code no repositório novo e colar o **prompt de bootstrap** (§4 do documento `01`), Tarefas 1–3 · **deixar rodando em segundo plano** | 5 min |
| 5 | Iniciar a **rotação de credenciais**: revogar as chaves antigas de Google AI, Anthropic/OpenAI, Meshy, FASHN, remove.bg, Resend e AWS, e gerar novas direto no cofre | 5 min |

**Pronto quando:** repositório criado, `gitleaks` verde, sessão do Claude Code rodando, chaves antigas revogadas.
**Não fazer agora:** migrar dados, apagar o Firebase, implementar RF. Isso é pós-4h.

---

### Bloco 2 — Etapas 3 e 5: RF e critérios de aceite · **T+00:15 → 01:15** · frente A

| Passo | Ação | Tempo |
|---|---|---|
| 1 | Ler as **aulas** (Perfil Lookbook, DNA de Estilo, Closet Digital) e confrontar com os CAs de **RF6**, **RF13** e **RF23** no documento `02` | 20 min |
| 2 | Corrigir no documento `02` o que as aulas contradisserem (é o único ponto do catálogo escrito sem a fonte primária) | 10 min |
| 3 | **Aplicar no Trello os 6 cards absorvidos** — RF24, RF25, RF26, RF27, RF28, RF29: renomear para `[ABSORVIDO em RFx] …`, colar a nota de rastreabilidade, remover o label de sprint, arquivar | 10 min |
| 4 | **Aplicar os 10 enunciados corrigidos** (§3 do documento `02`) nos títulos dos cards RF1, RF3, RF5, RF6, RF7, RF9, RF11, RF12, RF19, RF23 | 10 min |
| 5 | **Colar os CAs como checklist** em cada card de RF (um item por CA) | 10 min |

> **Atalho:** os passos 3–5 são mecânicos e repetitivos. Vale rodá-los por uma sessão do Claude Code com acesso ao Trello, e usar os 30 min economizados para revisar o resultado. Prompt sugerido:
> *"Leia `docs/novo-projeto/02-rf-reestruturados-e-criterios-aceite.md`. No board TCC 2026 (Fashion AI), lista Requisitos Funcionais: (1) para cada RF absorvido na §2, renomeie o card com o prefixo `[ABSORVIDO em RFx]`, adicione a nota de rastreabilidade no topo da descrição, remova o label de sprint e arquive; (2) aplique os títulos corrigidos da §3; (3) crie em cada card de RF um checklist 'Critérios de Aceite' com um item por CA da §4. Não crie cards novos sem me perguntar antes."*

**Pronto quando:** o board tem 25 RFs ativos, cada um com checklist de CAs, e 6 cards arquivados com a nota de rastreabilidade.

---

### Bloco 3 — Etapa 4: RF24 e a tabela de IA · **T+01:15 → 01:35** · frente A

| Passo | Ação | Tempo |
|---|---|---|
| 1 | Criar no Trello o card **RF24 — Prover capacidades de IA**, com a descrição e os 16 CAs do documento `03` | 8 min |
| 2 | Criar o card **RF31 — Filtros favoritar/disponível/indisponível/todos**, com os 6 CAs | 5 min |
| 3 | Anexar a **tabela RF × serviço externo de IA** (documento `03`) ao card **RNF8** — é lá que a decisão de provedor e de fallback precisa ser lida | 4 min |
| 4 | Distribuir os labels de sprint: RF24 → Sprint 3 (motor, Copilot, detecção) e Sprint 4 (DNA, arte, provador); RF31 → Sprint 3 | 3 min |

**Pronto quando:** RF24 e RF31 existem no board, com CAs e sprint, e a tabela de IA está no RNF8.

---

### Bloco 4 — Etapa 6: as vinte pranchas · **T+01:35 → 02:05** · frente B

> ✅ **Desbloqueado** — o artefato das pranchas chegou. O catálogo das 5 famílias e das Coleções D/E/F já está no documento `04`, §A.3; este bloco agora é preencher as fichas e gerar os assets, não descobrir o conteúdo.

| Passo | Ação | Tempo |
|---|---|---|
| 1 | Preencher a **ficha padrão** (§A.6 do documento `04`) para cada uma das 20 pranchas: família, coleção, arquivo, RF dono, CAs, proporção, barra de cor, prompt e bloco `ArtworkStudioInput` | 15 min |
| 2 | Conferir contra as **cinco famílias** (§A.3) e as **quatro regras de rejeição** (§A.4): nenhuma pessoa real, nenhum logotipo existente, área segura antes de beleza, tile só onde for tile. | 5 min |
| 3 | Registrar em RF23 um **item de checklist por prancha** (não CAs soltos) | 5 min |
| 4 | Gerar os prompts no **Firefly**, vetorizar os selos no **Illustrator**, registrar cada arquivo em `public/` (Coleções D/E/F) e no array de `OutfitBackgroundStudioModal.tsx`; anotar a autoria em `insumos/assets/CREDITOS.md` | 5 min |

**Pronto quando:** 20 fichas preenchidas, RF23 com 20 itens de checklist, divergências anotadas.

---

### Bloco 5 — Etapa 7: os dez artefatos de interface · **T+02:05 → 03:05** · frente B + frente C

Esta é a hora mais densa. A única forma de caber é **paralelizar**: abrir várias sessões do Claude Code, uma por onda, e revisar enquanto as seguintes rodam.

| Onda | Artefatos | Quem | Janela |
|---|---|---|---|
| 1 | **#7** esquema+peça com footer de estado · **#1** Criar Look + Background Studio | B | 02:05 → 02:25 |
| 2 | **#2** Copilot · **#3** DNA de Estilo · **#8** Provador 2D | C | 02:25 → 02:45 |
| 3 | **#5** Buscar/Explorar · **#4** Minhas Fotos · **#9** Editar esquema · **#10** Notificações | B + C | 02:45 → 03:05 |
| 4 | **#6** Dados pessoais LGPD + preferências | B | **depois das 4h**, quando o anexo do RNF6 tiver sido lido |

**Prompt padrão** (trocar o que está entre colchetes):

```text
Gere um artefato HTML de especificação visual da tela [NOME].
Fontes: docs/novo-projeto/04-telas-artefatos-e-pranchas.md (Parte B, artefato #N)
e docs/novo-projeto/02-rf-reestruturados-e-criterios-aceite.md (os CAs de [RFx]).
Requisitos: mobile-first; tema claro e escuro por tokens em :root; os cinco estados
(vazio, carregando, sucesso, erro, sem permissão); contraste AA, foco visível e
alvos de toque de 44px; e um rodapé com a tabela "CA → onde na tela ele é satisfeito".
Não invente comportamento que não esteja num CA — se faltar CA, aponte a lacuna.
```

**Pronto quando:** 9 artefatos publicados, cada um com o rodapé de rastreabilidade preenchido, e as lacunas de CA anotadas para o Bloco 7.

---

### Bloco 6 — Etapa 8: diagramas de atividade · **T+03:05 → 03:35** · frente C

| Passo | Ação | Tempo |
|---|---|---|
| 1 | Revisar os **14 diagramas** do documento `05` contra `docs/uml-casos-rede-social.md` e `docs/main-activity-workflows.md` — procurar contradição, não repetição | 10 min |
| 2 | Gerar os **7 diagramas faltantes** (RF2, RF4, RF5, RF6, RF11, RF15, RF16) no mesmo padrão Mermaid com CAs anotados | 12 min |
| 3 | Anexar cada diagrama ao card do RF correspondente no Trello | 8 min |

**Prompt sugerido:** *"Seguindo exatamente o padrão de `docs/novo-projeto/05-diagramas-atividade.md` (Mermaid flowchart, raias [U]/[S]/[E], CA anotado nas caixas de saída, sempre com os caminhos de erro), gere os diagramas de atividade de RF2, RF4, RF5, RF6, RF11, RF15 e RF16, usando os CAs do documento `02`."*

**Pronto quando:** 21 diagramas existem e cada card de RF tem o seu.

---

### Bloco 7 — Fechamento e RNFs · **T+03:35 → 04:00** · todos

| Passo | Ação | Tempo |
|---|---|---|
| 1 | **Varredura dos 8 RNFs** com a matriz da §6 do documento `02`: cada RNF tem ao menos um CA-âncora? Se não tem, ele não é verificável e vira risco na banca. | 8 min |
| 2 | Atualizar a descrição de cada card de RNF com os **CAs-âncora** e com o **mecanismo do Spring Boot** que o realiza (documento `01`, §2): RNF1→Spring Security `@PreAuthorize`; RNF2→JWT RSA + refresh rotativo; RNF3→Argon2id + converter AES-GCM; RNF4→Flyway + backup automatizado; RNF5→**`AuditService` próprio** gravando em `audit_log` (o `@EntityListeners` do JPA só cobre metadados de entidade, não login falho, 403, consentimento nem chamada de IA); RNF6→telas de RF3 + exportação/exclusão; RNF7→Actuator/Micrometer; RNF8→Resilience4j | 8 min |
| 3 | Conferir o resultado da sessão de bootstrap do Bloco 1 e commitar | 4 min |
| 4 | Escrever a lista **"o que ficou de fora"**: artefato #6 (LGPD), migração de dados, exclusão do Firebase, implementação dos RFs | 5 min |

**Pronto quando:** os 8 RNFs têm CA-âncora e mecanismo declarados, e a lista de pendências está escrita.

---

## Mapa etapa → bloco

| Etapa do seu plano | Bloco | Frente | Já escrito? |
|---|---|---|---|
| 1–2 · Reunir insumos e criar o repositório Java | 1 | D | ✅ `01` |
| 3 · Estudar aulas e ajustar CAs | 2 (passos 1–2) | A | ⏳ aulas recebidas, confronto pendente |
| 4 · Novo RF de IA + tabela de serviços | 3 | A | ✅ `03` |
| 5 · Arrumar todos os CAs e RFs | 2 (passos 3–5) | A | ✅ `02` |
| 6 · Vinte pranchas → RF23 | 4 | B | ✅ catalogado em `04` |
| 7 · Dez artefatos de interface | 5 | B + C | ✅ especificado em `04` |
| 8 · Diagramas de atividade | 6 | C | ✅ `05` (14 de 21) |
| 9 · Plano guiado + RNFs | 0 e 7 | todos | ✅ este documento |

---

## Riscos e planos B

| Risco | Probabilidade | Plano B |
|---|---|---|
| O time discorda sobre a definição do DNA de Estilo (HU20 × mosaico) | **alta** | Decidir no Bloco 0. Se vencer o mosaico, RF13.CA01–CA09 são reescritos no Bloco 2 (+20 min) |
| A faixa de toggles do topo do card não está cotada | média | Usar a proposta de 8–10 mm e confirmar com quem desenhou antes de gerar arte definitiva |
| O time decide **renumerar** os RFs no Bloco 0 | média | Some ~40 min do Bloco 2 (renumerar HUs, diagramas e commits). Nesse caso, cortar o Bloco 4. |
| Sessões de artefato demoram mais que a janela | média | Reduzir a onda 3 para dois artefatos (#5 e #10) e adiar #4 e #9 |
| Celebridades sai do escopo no Bloco 0 | baixa | Ganha ~15 min: caem RF21, RF22, o diagrama 12 e metade do artefato #7 |
| Bootstrap do Claude Code falha no Bloco 1 | baixa | Não bloqueia nada nas 4h; o repositório novo só precisa existir |

---

## O que este plano deliberadamente **não** faz em 4 horas

Dizer isso é parte do plano — a alternativa é prometer o impossível e chegar às 4h com tudo pela metade:

- **Migrar os dados** do Firestore para o MySQL (é trabalho de dia inteiro, com validação);
- **Apagar o projeto Firebase** (só depois que a migração estiver validada);
- **Implementar qualquer RF** no novo backend (é o trabalho das quatro sprints);
- **Gerar o artefato #6** (LGPD) sem ler o anexo do RNF6 — geraria retrabalho;
- **Escrever as HU** correspondentes aos RFs novos (RF24, RF31) — 30 min extras, fora da janela.
