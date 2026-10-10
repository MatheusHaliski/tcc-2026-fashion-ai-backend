# Orientação "Como funciona"

Componente reutilizável que explica cada aba ou recurso com um texto curto, um exemplo ilustrado e até três passos.
Código: `components/guide/guide.tsx` (provedor, diálogo, `GuideAuto`, `HowItWorks`), `components/guide/guide-demos.tsx`
(exemplos), `lib/guides/registry.ts` (catálogo de tutoriais e regra de abertura). Backend: `GuideService`,
`GuideController` (`GET /api/me/guides`, `PUT /api/me/guides/{key}`), tabela `user_guides` (V57).

## Anatomia do diálogo

| Parte | Conteúdo | Regra |
|---|---|---|
| Título | `guide.<key>.title` | nome do recurso, não instrução |
| Texto | `guide.<key>.body` | 1–2 frases sobre o que o recurso faz de verdade |
| Exemplo | `GuideDemo` dentro de `.guide-demo-stage` | componentes reais com dados de exemplo; selo "Exemplo" |
| Legenda | `guide.<key>.demo` | descreve o exemplo (alternativa textual da animação) |
| Passos | `guide.<key>.step1..3` | no máximo 3 |
| Rodapé | caixa "Não mostrar novamente" + botão "Entendi" | "Entendi" recebe o foco ao abrir |

## Quando abre

| Situação | Comportamento |
|---|---|
| Primeira visita pertinente (sem registro ou versão nova) | abre sozinho, no máximo um por tela |
| "Entendi" sem marcar | não reabre na mesma sessão; volta no máximo mais uma vez, depois de 24 h (`MAX_AUTO = 2`) |
| "Não mostrar novamente" | vale só para aquele tutorial e aquela versão |
| Versão do tutorial sobe | reapresenta uma vez (zera "escondido" e a contagem) |
| "Como funciona" | abre sempre; não conta como abertura automática |
| Primeira entrada num modo pela Central FLAIR (`gate`) | "Jogar" abre a explicação antes de ir ao modo, com o botão **"Entendi, começar"** e o ícone do modo; só esse botão leva ao jogo (Esc, X e clique fora fecham e a pessoa continua na central). Conta como abertura automática e obedece às mesmas regras (versão, "Não mostrar novamente", no máximo 2 vezes). Depois disso, "Jogar" vai direto |
| Desmarcar a caixa ao reabrir | volta a mostrar (`UNHIDDEN`) |
| Esc, botão fechar, clique fora | fecham como "Entendi" sem marcar (fechamento previsível) |
| Outro tutorial já aberto | o pedido automático é ignorado (nunca empilha) |

A regra é a mesma no servidor (`GuideService.shouldAutoOpen`) e no cliente (`shouldAutoOpen` em `registry.ts`).

## Persistência

- Com conta: no servidor, por pessoa e por tutorial (`user_guides`: versão, escondido, aberturas automáticas,
  última exibição). Trocar de conta recarrega as preferências da outra pessoa e descarta o estado da sessão anterior.
- Sem conta: no navegador (`localStorage["fai.guides.anon"]`); se o armazenamento estiver bloqueado, vale só na visita.
- Eventos aceitos: `AUTO_SHOWN`, `MANUAL_SHOWN`, `CLOSED`, `HIDDEN`, `UNHIDDEN`. Chave validada por
  `[a-z0-9][a-z0-9.-]{1,59}`; versão de 1 a 1000.

## Versionamento

Suba `version` em `registry.ts` só quando o funcionamento mudar de forma relevante (nova etapa, regra diferente,
custo diferente). Ajuste de texto ou visual não sobe a versão.

## Exemplos seguros

- IDs com prefixo `demo-`: o Hype desses cards nasce no cache e nunca é pedido à API (`use-hype.ts`).
- O palco tem `inert` e `aria-hidden`: nada recebe foco, clique ou leitura duplicada; a legenda descreve o exemplo.
- Dono fictício sem permissão de edição; marcas e nomes de exemplo fictícios.
- Nenhum exemplo chama a API, consome carta, concede ponto ou altera dados (coberto por teste).

## Movimento

- Animação só em CSS e só com `data-playing="true"` e sem `prefers-reduced-motion: reduce`.
- O estado sem animação é o quadro final (o que se quer ensinar). Pausar mostra esse quadro.
- Com movimento reduzido o exemplo já abre parado e o botão oferece "Reproduzir animação".

## Tutoriais

| Chave | Onde | Exemplo | Estado |
|---|---|---|---|
| `games.hub` | /flair (Central FLAIR) | os modos da central, com o primeiro selecionado | montado (versão 2: a central nova) |
| `flair.matches` | /flair/partidas | duas cartas frente a frente e o placar | montado |
| `flair.cbc` | /flair/desafios (Desafio de Montagem) | carta entra no mosaico | montado |
| `flair.cards` | /flair/cartas | a peça e a carta FLAIR gerada dela | montado |
| `flair.decks` | /flair/decks | deck com poder e combos | montado |
| `flair.shops` | /flair/lojas | requisitos cumpridos e o cupom | montado |
| `flair.wallet` | /flair/carteira | saldo e um cupom emitido | montado |
| `flair.quests` | /flair/missoes | missão chegando a 3/3 e Resgatar | montado |
| `moments.calendar` | /moments | calendário e detalhe do Momento | montado |
| `challenges.progress` | /challenges | requisitos, progresso, recompensa | montado |
| `feed.posts` | /feed | card de peça com áreas numeradas | montado |
| `schemes.seal` | card com selo | sem selo × com selo | entra com SELOS-1 |
| `seals.about` | selos | sugerido → aceito → aprovado | entra com SELOS-2 |
| `copilot.suggest` | /copilot | sugestão com motivo e "Salvar como look" | montado |
| `autopilot.plan` | /autopilot | Hoje + Semana com lacuna | montado |
| `explore.search` | /explorer | abas, filtros, regiões com dados | montado |
| `hype.flip` | verso do card | card vira para o Hype | entra com HYPE-1 |
| `brand.visitor` | perfil de marca | abas do perfil | entra com PERFIS-2 |
| `brand.operator` | cartas Especiais | estados da carta | entra com GAMES-3 |
| `points.fai` | /points | extrato e unidades | montado |
| `shop.room` | loja do quarto | item → confirmação → inventário | entra com PONTOS-LOJA |

Os textos descrevem o comportamento atual do código (verificado em cada tela). Um tutorial só é montado quando o
recurso que ele descreve existe.

## Testes

`components/guide/guide.test.tsx`: primeira visita com foco em "Entendi", palco inerte e nenhuma chamada fora da API de
tutoriais; "Entendi" sem marcar não reabre na visita; "Como funciona" reabre; "Não mostrar" por tutorial; Esc fecha
sem marcar; tutorial escondido abre com a caixa marcada e desmarcar envia `UNHIDDEN`; troca de conta não herda;
visitante sem conta usa o navegador; movimento reduzido abre parado; nunca empilha. Backend: `GuideServiceTest`.
