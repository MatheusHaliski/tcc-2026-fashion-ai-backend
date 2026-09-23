# RF36 — Desafios & Games do Guarda-Roupa

**Projeto:** FashionAI (SAI-TCC-2026)
**Status:** proposta de especificação (v0.1), para revisão do time
**Requisito novo:** RF36 (próximo número livre, pela política de [`02-rf-reestruturados-e-criterios-aceite.md`](../novo-projeto/02-rf-reestruturados-e-criterios-aceite.md) §1)
**Depende de:** RF5, RF6, RF8, RF19, RF32, RF33, RF34, RF35
**Documentos irmãos:** [`01-especificacao-meu-quarto.md`](01-especificacao-meu-quarto.md) · [`02-inventory-score-calculo.md`](02-inventory-score-calculo.md) · [`04-detalhes-de-engajamento.md`](04-detalhes-de-engajamento.md)

---

## 0. Conceito

A sub-aba **Desafios** transforma o guarda-roupa em algo **para fazer**. O usuário escolhe um desafio num catálogo e decide se joga **sozinho** (meta pessoal), **em equipe** (esforço somado) ou **em duelo** (competição votada pela comunidade).

```
Meu Guarda-Roupa
Grade | Meu Quarto | Destaques | Desafios
```

| Sub-aba | Direção | Pergunta |
|---|---|---|
| Destaques (RF34) | olha para trás | "O que o meu guarda-roupa é e como evoluiu?" |
| **Desafios (RF36)** | olha para frente | "O que vou fazer com ele nesta semana?" |

As duas se alimentam. Destaques sugere desafios para as dimensões mais fracas do Inventory Score ("Utilização 62%: que tal o Segunda Chance?"), e um desafio concluído melhora essas dimensões.

**Teste principal** (mesmo de [`01`](01-especificacao-meu-quarto.md) §0.1): sem FAI Points, os desafios continuam resolvendo um problema real, porque dão estrutura para usar melhor o que já existe no guarda-roupa. A recompensa fica em cima disso.

---

## 1. Modos de jogo

| Modo | Participantes | Como funciona | Sensação |
|---|---|---|---|
| **Solo** | 1 | meta pessoal, contra si mesmo | disciplina, autoconhecimento |
| **Equipe** (cooperativo) | 2–6 | os membros somam esforço rumo a uma meta comum | pertencimento |
| **Duelo** (competitivo) | 2–8 pessoas, ou 2 equipes | competem, e o resultado vem de dado objetivo ou de votação da comunidade | adrenalina, reconhecimento |
| **Comunidade** | todos | a mesma regra para todo mundo, cada um joga sozinho, e os resultados ficam lado a lado | conversa em comum |

### 1.1 Princípio de equidade: nunca comparar guarda-roupas, comparar o uso deles

Comparar guarda-roupas diretamente **expõe desigualdade econômica**: quem tem mais peças e marcas caras ganharia só por ter. Duas regras normativas:

1. **No cooperativo, a meta é proporcional ao guarda-roupa de cada membro.** Cada membro contribui com a **fração** que cumpriu da própria meta (por exemplo, "resgatar 30% das suas peças esquecidas"). O progresso da equipe é a média dessas frações, nunca uma soma de números absolutos. Quem tem 20 peças contribui tanto quanto quem tem 200.
2. **No duelo votado, a votação é às cegas.** Até o resultado sair, o card do look esconde **marca, preço e autor**. Vota-se na composição, não no poder de compra. Duelos com resultado objetivo (por exemplo, "Sem Repetir") comparam **recordes pessoais**, que não dependem do tamanho do acervo.

---

## 2. Catálogo inicial

| Código | Desafio | Regra | Duração | Solo | Equipe | Duelo | Comunidade | Dimensão do score que alimenta |
|---|---|---|---|---|---|---|---|---|
| `TEN_X_TEN` | **10×10** | escolher 10 peças e montar 10 looks em 10 dias só com elas | 10 dias | ✅ | ✅ | — | — | Versatilidade, Descoberta |
| `CAPSULE_SEASON` | **Temporada Cápsula** | viver 3 meses com 33 peças (o resto vai para o maleiro) | 90 dias | ✅ | ✅ | — | — | Utilização, Versatilidade |
| `SECOND_CHANCE` | **Segunda Chance** | resgatar N% das peças esquecidas | 14 dias | ✅ | ✅ | — | — | Descoberta, Utilização |
| `NO_REPEAT` | **Sem Repetir** | dias seguidos com Look do Dia sem repetir composição | aberto | ✅ | — | ✅ | — | Descoberta |
| `WEAR_WHAT_YOU_HAVE` | **Semana Vista o que Você Tem** | uma semana só com o que já está no acervo, sem cadastrar compras novas | 7 dias (abril, Fashion Revolution Week) | ✅ | ✅ | — | ✅ | Utilização |
| `CHANEL_WEEK` | **Semana Chanel** | todo dia, aplicar "Tira uma coisa" (RF33) no look | 7 dias | ✅ | ✅ | — | — | Identidade |
| `MY_SEASON` | **Minha Estação** | looks só com peças da cartela da coloração pessoal | 7 dias | ✅ | — | ✅ | — | Identidade |
| `RUNWAY_BATTLE` | **Batalha na Passarela** | tema semanal, look só com peças do próprio acervo, votação às cegas no The Runway | 7 dias | — | ✅ (times) | ✅ | — | Versatilidade |
| `DAILY_CHALLENGE` | **Desafio do Dia** | uma regra igual para todos (ex.: "uma peça vermelha + uma esquecida") e resultado em grade de emoji | 1 dia | — | — | — | ✅ | Descoberta |
| `GRWM` | **Arrume-se Comigo** | publicar o vídeo do Vista-me de um look do desafio ativo | 7 dias | ✅ | ✅ | ✅ | — | — |
| `REAL_MIRROR` | **Espelho de Verdade** | registrar o look real no espelho do app na janela aleatória do dia | 7 dias | ✅ | ✅ | — | — | Utilização |

**Ficam fora do catálogo, de propósito:**
- **Conquistas secretas** (RF34 §4.3 e [`04`](04-detalhes-de-engajamento.md)): se estivessem numa lista, deixariam de ser secretas.
- **Álbum de Combinações:** é uma coleção permanente em Destaques, não uma meta com prazo.
- **WAYWT** ("O que você está vestindo?"): é um tópico fixo de conversa no The Runway, não um desafio.

### 2.1 Anatomia do card de desafio

```
┌──────────────────────────────────────────┐
│ 10×10                         ◷ 10 dias  │
│ 10 peças · 10 looks · 10 dias            │
│ Melhora: Versatilidade · Descoberta      │
│ Esforço: ●●○ médio                       │
│ Recompensa: até 300 FAI pts              │
│                                          │
│ [ Solo ]  [ Equipe ]                     │
│ 1.204 pessoas jogando agora              │
└──────────────────────────────────────────┘
```

O card mostra **sempre** qual dimensão do Inventory Score o desafio melhora. É isso que o liga ao problema real (§0) e o que permite a Destaques recomendá-lo.

---

## 3. Ciclo de vida

```
         ┌──────────── cancelar (criador) ────────────┐
         ▼                                            │
[rascunho] ──convidar──► [aguardando] ──início──► [ativo] ──fim do prazo──► [concluído]
   │  (solo: direto para ativo)   │                  │                           │
   │                              └─ prazo de aceite ─┴──► [expirado]            └──► recompensa + snapshot
```

| Estado | Regra |
|---|---|
| `rascunho` | o criador escolhe o desafio, o modo e os parâmetros (ex.: as 10 peças do 10×10) |
| `aguardando` | só em Equipe e Duelo: convites enviados. Aceite em até 48 h. Começa com quem aceitou, se houver o mínimo de participantes |
| `ativo` | o progresso é calculado a partir de dados reais (§4). Qualquer um pode sair a qualquer momento |
| `concluído` | prazo encerrado ou meta atingida. Gera recompensa, snapshot e o card de resultado compartilhável |
| `expirado` | o mínimo de participantes não foi atingido no prazo de aceite. Sem penalidade |

**Limite de desafios simultâneos:** no máximo **3 ativos** por usuário. Mais do que isso vira obrigação, e o desafio deixa de ser jogo.

---

## 4. Progresso verificável

O progresso **vem dos dados do sistema**, nunca de uma autodeclaração "eu fiz":

| Evidência | Fonte |
|---|---|
| look montado | esquema criado (RF5/RF33) com as regras do §5 de [`02-inventory-score-calculo.md`](02-inventory-score-calculo.md): ≥ 2 peças e sobrevivência de 24 h |
| look usado | `saiDailyLooks` do dia |
| peça resgatada | transição de estado esquecida → usada |
| peça dentro da regra | tags da peça (cor, estação, origem) conferidas pelo servidor |
| foto real (Espelho de Verdade) | foto enviada na janela aleatória. Em Equipe, a confirmação vem de um colega de equipe |

**Troca de participantes no cooperativo.** Se um membro sai, a meta da equipe é recalculada como a média das frações dos membros restantes. O progresso já feito por quem saiu continua registrado **no perfil dele**, mas deixa de contar para a equipe.

---

## 5. Integração com o quarto e o resto do produto

| Desafio ativo | O que aparece no Meu Quarto (RF32) |
|---|---|
| 10×10 | **quadro de cortiça** na parede com os 10 dias. Cada look do desafio é preso como uma foto polaroide |
| Temporada Cápsula | as peças fora da cápsula ficam no maleiro, com **fita de alfaiate** amarrada nos puxadores |
| Segunda Chance | as peças esquecidas do desafio ganham uma etiqueta "2ª chance" pendurada |
| Sem Repetir | contador de dias num calendário de parede |
| Batalha na Passarela | o tema da semana aparece escrito no espelho |

| Integração | Regra |
|---|---|
| Destaques (RF34) | sugere até 2 desafios para as dimensões mais fracas do score |
| Copilot (RF10) | conhece os desafios ativos. Se a regra do 10×10 estiver ativa, o Vista-me só sugere as 10 peças escolhidas |
| FAI Points (RF35) | recompensa na conclusão. Em Equipe, dividida **igualmente** entre quem terminou como membro, dentro dos limites diários |
| The Runway (RF19) | Batalha na Passarela e Desafio do Dia têm feed próprio, com votação às cegas |
| Seguir (RF8) | convites só para quem o usuário segue ou para quem usou a Chave do Quarto |

---

## 6. Interação social mínima no MVP

Equipes e duelos têm **reações** (6 emojis fixos) e **bilhetes** (textos curtos de uma lista de frases prontas mais 1 campo livre de até 80 caracteres, moderado pelo RF15/RF16). **Não há chat livre no MVP:** o peso de moderação de um chat não cabe no escopo do TCC.

---

## 7. Desafios criados pela comunidade (fase posterior)

Qualquer usuário pode propor uma regra ("uma semana só com peças herdadas") a partir de **blocos de regra pré-definidos** (cor, categoria, origem, estado, quantidade de peças, duração). Não há texto livre na regra, então todo desafio proposto é automaticamente verificável (§4). Os desafios propostos com mais participantes em 30 dias podem entrar no catálogo oficial, **com o nome de quem os criou**.

---

## 8. Critérios de aceitação

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF36.CA01 | usuário em Meu Guarda-Roupa | abre a sub-aba Desafios | vê o catálogo com os modos disponíveis por desafio, a dimensão do score que cada um melhora, a duração e a recompensa (§2.1) |
| RF36.CA02 | desafio que não aceita um modo (tabela §2) | o card é exibido | o modo não disponível não aparece como opção |
| RF36.CA03 | usuário escolhe o modo Solo | confirma os parâmetros | o desafio entra direto no estado `ativo` |
| RF36.CA04 | usuário escolhe Equipe ou Duelo | envia convites | só pode convidar quem segue (RF8) ou quem usou a Chave do Quarto. O desafio fica `aguardando` por até 48 h |
| RF36.CA05 | prazo de aceite encerrado sem o mínimo de participantes | o prazo vence | o desafio vai para `expirado`, sem penalidade para ninguém |
| RF36.CA06 | usuário com 3 desafios ativos | tenta iniciar ou aceitar outro | o sistema informa o limite e oferece encerrar um dos ativos |
| RF36.CA07 | desafio cooperativo com metas proporcionais | o progresso é calculado | o progresso da equipe é a média das frações das metas individuais. Nenhum valor absoluto de peças é exibido para os colegas |
| RF36.CA08 | duelo votado | um look é exibido para votação | marca, preço e autor ficam ocultos até o resultado ser publicado |
| RF36.CA09 | participante de equipe ou duelo | acessa o desafio | vê apenas os looks que cada membro publicou no desafio, **nunca** o guarda-roupa dos outros (**RNF6**) |
| RF36.CA10 | desafio ativo | o usuário cria um look ou registra um Look do Dia | o progresso é atualizado a partir do dado real (§4). Não existe botão "marcar como feito" |
| RF36.CA11 | participante sai de um desafio cooperativo | confirma a saída | a meta da equipe é recalculada com os membros restantes, e nenhum membro recebe notificação de culpa |
| RF36.CA12 | desafio concluído | o prazo acaba ou a meta é atingida | a recompensa é lançada no ledger de forma idempotente (RF35.CA01) e é gerado um card de resultado compartilhável |
| RF36.CA13 | desafio ativo com representação no quarto (§5) | o usuário abre Meu Quarto | o elemento visual do desafio aparece no ambiente e some quando o desafio termina |
| RF36.CA14 | desafio com regra de conjunto de peças (10×10, Temporada Cápsula) ativo | o usuário aciona o Vista-me ou o Copilot | as sugestões usam só as peças permitidas pela regra, e o Copilot avisa que está respeitando o desafio |
| RF36.CA15 | Destaques exibe o Inventory Score | a dimensão mais fraca está abaixo de 70 | a aba sugere até 2 desafios que melhoram essa dimensão |
| RF36.CA16 | bilhete com texto livre em equipe ou duelo | é enviado | passa pela moderação (RF15/RF16) e tem no máximo 80 caracteres. Não existe chat livre |
| RF36.CA17 | Desafio do Dia | o usuário conclui | o resultado é exibido como grade de emoji compartilhável, sem expor as peças nem o acervo |

---

## 9. Modelo de dados

| Entidade | Campos principais |
|---|---|
| `saiChallengeTemplates` | `code`, `name`, `rule_blocks[]`, `modes_allowed[]`, `duration_days`, `score_dimensions[]`, `reward_points`, `min_participants`, `max_participants`, `origin` (`official`/`community`), `author_user_id?` |
| `saiChallengeInstances` | `id`, `template_code`, `mode`, `state`, `params{}` (ex.: `piece_ids` do 10×10), `starts_at`, `ends_at`, `created_by` |
| `saiChallengeParticipants` | `instance_id`, `user_id`, `team` (A/B em duelo de equipes), `joined_at`, `left_at?`, `personal_goal`, `progress_fraction` |
| `saiChallengeEvents` | `instance_id`, `user_id`, `evidence_type`, `ref_id` (esquema, daily look, peça), `created_at` (fonte do progresso do §4) |
| `saiChallengeVotes` | `instance_id`, `voter_user_id`, `entry_scheme_id`, `created_at` (único por par votante/entrada) |

---

## 10. Plano de entrega

| Fase | Escopo |
|---|---|
| **3a** (junto com a gamificação do RF35) | sub-aba, catálogo, modo **Solo** para 10×10, Segunda Chance, Sem Repetir e Semana Chanel. Progresso verificável. Representação no quarto |
| **3b** | modo **Equipe** com metas proporcionais, reações e bilhetes. Integração com Destaques e Copilot |
| **4** | **Duelo** com votação às cegas (Batalha na Passarela), **Comunidade** (Desafio do Dia), Arrume-se Comigo, Espelho de Verdade |
| **5** | desafios criados pela comunidade (§7) |

## 11. Decisões em aberto

1. **Tamanho máximo de equipe:** 6 é o ponto de partida. Confirmar.
2. **Duelo 1×1 entre desconhecidos** (matchmaking por arquétipo do DNA) no MVP, ou só entre quem já se segue?
3. **Espelho de Verdade:** com a confirmação feita pela equipe, a foto fica visível para ela durante o desafio. Isso precisa de consentimento explícito na entrada.
