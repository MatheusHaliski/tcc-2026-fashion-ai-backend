# Fashion Hall & Runway — o sentido do Meu Quarto além da decoração

> Documento de conceito. Responde a quatro perguntas levantadas durante o desenho dos portais: (1) o que o Meu Quarto
> significa além de guardar colecionáveis de marcas e celebridades; (2) como ele vira o saguão dos jogos; (3) como se
> liga ao Aurora CPS; (4) o que fazer com a ideia do Smart Mirror em casa e com a pergunta "web ou app nativo".

## 1. O que o quarto já é (e que não é decoração)

Lendo a especificação (`docs/meu_guarda_roupa/01-especificacao-meu-quarto.md`) e os elementos implementados
(`docs/meu-quarto/05-elementos-do-quarto.md`), o quarto hoje tem três camadas de sentido, e só a terceira é decorativa:

| Camada | O que é | Evidência no código |
|---|---|---|
| **Espelho do inventário real** | cada objeto do quarto é um **estado** de uma peça de verdade: poeira = esquecida há 60 dias; cesto = para lavar; arara = à venda; cadeira = não cabe no nível; vitrine = peça ícone do DNA; cabide dourado = favorita; luzes do closet = faixa do Inventory Score | `components/room3d/*`, `GET /api/me/room`, RF27, RF29, RF31 |
| **Lugar de ação** | andar até o espelho abre a prova (RF28), tocar na meia sem par abre "adicionar peça", tocar no busto fala com o Copilot, o interruptor troca o tema do app, a chave convida alguém | `lib/room3d/mirror-session.ts`, `DressForm`, `LightSwitch`, `KeyHook` |
| **Vitrine de coleção** | selos, itens da loja de pontos, módulos por nível, monograma | RF30, RF50, `FaiBox` |

A pergunta "qual é o sentido do quarto além de colecionar" tem, portanto, uma resposta que já está lá e precisa ser
dita com clareza: **o quarto é o gêmeo digital do guarda-roupa físico da pessoa**. Ele não representa roupas; ele
representa o *estado* das roupas. É isso que o diferencia de um inventário de jogo com skins.

O que falta, e que os portais trazem, é a quarta camada: **memória**. Hoje o quarto diz o que a pessoa tem e em que
estado. Não diz o que ela *fez* com isso.

## 2. A quarta camada: procedência

Cada item que entra no Hall vindo de um portal nasce com uma **ficha de procedência**: de que missão veio, em que data,
com qual deck, em que dificuldade, com qual final. É o que a Gala Lumière conta na história (o diamante vale pela
costureira que fez a peça, não pelo quilate) e é o que transforma colecionável em registro.

| Hoje | Com procedência |
|---|---|
| Selo "Marca X" comprado na loja de pontos | Selo "Marca X" ganho ao terminar a Noite Aurum vestindo uma peça dessa marca no clímax, 12/03, deck Gala, Médio |
| Carta FLAIR da peça (nível, nota, atributos) | a mesma carta com uma linha nova: "Partidas: 4 · Portaria VIP: 2 · Final Fantasma: 1" |
| Item de decoração do quarto | o item mostra, ao tocar, a cena de corte em que foi conquistado |

Regras:

- A procedência é **só leitura** e gravada no servidor junto com o resultado da partida (o mesmo lugar onde a tela de
  vitória já lê estilo do golpe, opcionais e números).
- Ela **não altera Hype nem nível FLAIR** (princípio do deck, §0). Altera só a ficha do item e o que o quarto mostra.
- Itens com procedência **não vão ao mercado de transferência**; a cópia FLAIR negociável continua sendo a carta sem
  história (decisão D11 do FLAIR-UT: o original fica com a pessoa).

## 3. O saguão: do quarto ao Hall

O Hall não substitui o quarto. Ele é o quarto com uma parede a mais.

```
                 parede norte: FAI Origem · porta · janela · calendário
                ┌───────────────────────────────────────────────────┐
 parede oeste   │                                                   │  parede leste
 guarda-roupa 2 │   quarto como hoje: móvel, espelho, busto, cesto, │  janela 2
 (Loft)         │   arara, cadeira, vitrine, tapete, neon            │  + CORREDOR DOS PORTAIS (novo)
                │                                                   │    ┌───┐ ┌───┐ ┌───┐
                │                                                   │    │ 1 │ │ 2 │ │ 3 │  → PASSARELA (Runway)
                └───────────────────────────────────────────────────┘    └───┘ └───┘ └───┘
                 parede sul: câmera
```

- O **corredor dos portais** abre na parede leste, ao lado da janela 2, a partir do nível **Loft** (o mesmo que a prévia
  da partida já exige). Abaixo do Loft a parede mostra uma porta fechada com a placa "Disponível no nível Loft", igual
  ao guarda-roupa 2 hoje.
- Cada portal é uma **arara de luz** (a mesma imagem de CS-O-03) com quatro estados: *apagado* (não desbloqueado),
  *pulsando* (disponível, nunca jogado), *aberto* (em andamento, com o último checkpoint) e *concluído* (com o selo e o
  final obtido gravados na moldura).
- A **passarela** no fim do corredor é o Runway: onde a Batalha na Passarela (RF36, `RUNWAY_BATTLE`) e os Momentos
  passam a acontecer em 3D, com os looks das pessoas desfilando. É o espaço social do Hall; os portais são o espaço
  solo.

### Desbloqueio

| Portal | Abre quando | Fecha com |
|---|---|---|
| 1 · Noite Aurum | nível Loft **e** pelo menos 1 carta FLAIR própria (o jogo precisa de um deck) | selo da Noite Aurum, carta "Look da Noite Aurum", carta "Estrela do Norte (procedência: desconhecida)" |
| 2 · Gala Lumière | final de qualquer tipo no portal 1 | selo da Gala Lumière, carta "Estrela do Norte (procedência: Celina Rocha)", final gravado |
| 3 · (reservado) | final Fantasma ou Profissional no portal 2 | define-se no próximo ciclo; no final Barulhenta o portal aparece com o monograma Vellard |

### O que volta do jogo para o quarto

| Do jogo | Para o quarto | Regra |
|---|---|---|
| Final da partida | selo na moldura do portal; ficha de procedência nas cartas usadas | só leitura |
| "Look da Noite Aurum" | caixa de look no maleiro, com o outfit card e a cena CS-O-08 ao tocar | não entra no mercado |
| Estrela do Norte | item na vitrine da Peça Ícone enquanto a pessoa não tiver peça ícone própria; depois, na vitrine de bolsas e joias do nível Closet | não troca, não vende |
| FAI Points | concessão pelo RF41 v2, uma vez por portal e por dificuldade, nunca por repetição | evita farm |
| Hype | **nada** | integridade do Hype v2 |

## 4. Ligação com o Aurora CPS

O documento do Aurora (`docs/aurora_cps/aurora-cps-fashion-gaming.md`) descreve a roupa como interface bidirecional e
um loop percepção → processamento → atuação. O Hall é a camada de **mundo do jogo** desse loop, e três pontos já se
encaixam sem hardware:

| Aurora | Hall | Como |
|---|---|---|
| "Equipamentos = combinações de peças AURORA do guarda-roupa; um look inteiro equipado = bônus de atributos" (§7.2) | o **deck** e a **sintonia** | os atributos do Aurora (FORÇA, SABEDORIA, AGILIDADE, VITALIDADE, CARISMA) mapeiam para os efeitos do deck (fôlego, furtividade, agilidade, defesa, carisma). O cálculo é o mesmo `AfterpartyMods`, lendo peça por peça |
| "Digital twin por peça com estado em tempo real" (§8.1) | o quarto como gêmeo digital do guarda-roupa | o quarto já mostra estado; com uma peça Aurora real, a mesma peça no quarto mostraria temperatura, uso do dia e carga. A ficha de procedência do Hall é a parte **histórica** do gêmeo (§8.1 fala em "histórico de uso, conquistas associadas") |
| Daily Color Challenge "software-only, sem hardware" (roadmap, fase 1) e Urban Hunter com portais de emoção (HU-AU07) | Momentos e portais do Hall | os portais do Hall são a versão em casa dos portais de emoção: abrem por condição (nível, final anterior) em vez de biometria, e podem no futuro aceitar a condição biométrica como alternativa |

E um ponto que depende de hardware, e por isso fica explicitamente como **fase 2 do Aurora**, não do Hall: o **fôlego**
do deck (hoje derivado de material e estação) pode, com uma peça Aurora de IMU e frequência cardíaca, ler o corpo real da
pessoa. Correr de verdade na sala daria fôlego na fuga da Gala Lumière. É a frase do Aurora, "o corpo é o controle",
aplicada a um jogo que já existe. Nada disso é prometido para o TCC; é a porta que se deixa aberta.

**O lado do ambiente do loop** (escanear o quarto real e viver nele no app) está desenhado à parte, como RF56, em
[`docs/aurora_cps/digital-twin-do-quarto-real.md`](../../aurora_cps/digital-twin-do-quarto-real.md): é independente
dos portais e torna o quarto digital o gêmeo do quarto físico, não só do guarda-roupa.

**O que não fazer:** não misturar dado biométrico com Hype, nível FLAIR ou ranking. O Aurora é explícito sobre safety e
cibersegurança (§9); o Hall segue a regra do deck: biometria, quando existir, muda a partida e só a partida.

## 5. RF55 · Smart Mirror em casa: provar roupas no espelho físico

Rascunho de requisito a partir da ideia levantada nesta conversa. Numeração seguinte à última usada (RF54).

**História.** *Como* pessoa com conta FashionAI e um espelho inteligente em casa (TV, monitor ou espelho
semi-reflexivo com um computador atrás), *posso* escolher peças do catálogo ou do meu closet no app e ver, no espelho
físico, a minha projeção vestindo a peça, *para* decidir sem sair de casa e sem tirar foto do meu corpo.

**O que é e o que não é.** A imagem no espelho é a **projeção** da pessoa (o avatar do Meu Quarto, ou a silhueta
detectada pela câmera com a Prévia 2D do RF28 sobreposta), nunca uma fotografia editada. Isso é coerente com o que o
`anatomical_vton` já declara: o espaço é PROJECTED_2D e "uma projeção não comprova ajuste físico". O espelho mostra
como a peça *compõe*, não como ela *veste*.

**Arquitetura mínima (sem GPU alugada).**

| Camada | O que faz | Com o que |
|---|---|---|
| Captura | câmera do próprio dispositivo ou do celular (Continuity Camera), detecção de pose e silhueta **local** | MediaPipe Pose (já presente em `services/anatomical_vton`), rodando em CPU ou Metal |
| Composição | o avatar do quarto, ou a silhueta, com a peça da Prévia 2D alinhada aos pontos de pose | o mesmo renderizador do RF28 (prévia no vidro do espelho do quarto), em modo tela cheia |
| Controle | o celular é o controle: escolher peça, trocar, "Usar este look", salvar no espelho | a API do espelho que já existe (`POST/DELETE /api/me/mirror/pieces`), o espelho físico é só mais um cliente do mesmo estado |
| Hardware de referência | um Mac Mini ou mini PC atrás de um monitor em modo quiosque, ou uma TV com o navegador em tela cheia | nenhuma GPU NVIDIA é necessária; o `garment_gpu` continua opcional e remoto |

**Critérios de aceite (rascunho).**

1. O estado do espelho físico e o do espelho do quarto no app são **o mesmo** (`GET /api/me/mirror`): trocar no celular
   troca no vidro em menos de 1 s na rede local.
2. Nenhum quadro da câmera sai do dispositivo. Só pontos de pose (coordenadas) trafegam, e só se a pessoa ligar
   "ajustar à minha silhueta"; sem isso, o espelho mostra o avatar do quarto.
3. A imagem exibe de forma permanente a marca "projeção", igual ao cabeçalho `X-FAI-AI-Generated` das reconstruções.
4. Sem câmera, sem WebGL ou sem rede, o espelho mostra a Prévia 2D estática do look, nunca uma tela vazia.
5. O modo quiosque aceita controle de jogo (Gamepad API, já suportada na central FLAIR) para navegar sem teclado.

**Relação com o Hall.** O Smart Mirror físico é a porta de entrada do Hall fora do celular: o clímax da Noite Aurum
(CS-O-08) é literalmente esta tela. Uma pessoa com o espelho em casa joga o clímax no vidro.

## 6. Web ou app nativo

A pergunta surgiu com o Astro Bot como referência: um saguão 3D com portais pede fidelidade gráfica que um web app
"não aguenta". A leitura do repositório diz algo mais matizado.

**O que a web já aguenta aqui.** O heist v2 roda em React Three Fiber com 13 salas, seguranças com visão e rádio,
pessoas com tecido simulado (`components/heist/people/fabric.ts`), cenas de corte, controle de jogo e checkpoints. O
plano construtivo (`met-gala-heist-v2-plano-construtivo`) mira salões no padrão de jogos de grande orçamento e já tem
critérios de reprovação por área. Para os **dois primeiros portais e o saguão**, a web é suficiente e é onde o produto
está.

**Onde a web encosta no teto.** Passarela com dezenas de avatares vestidos e tecido simulado ao mesmo tempo, pós-
processamento pesado, áudio espacial, carregamento de GBs de assets, e a experiência de quiosque do Smart Mirror.

**Recomendação em três fases, mantendo um único backend:**

| Fase | Cliente | O que ganha | Custo |
|---|---|---|---|
| **A · agora** | web (Next + R3F), como hoje | portais 1 e 2, saguão, procedência, prévia do deck | o que já se paga |
| **B · TCC+1** | o mesmo código web empacotado para desktop (Tauri ou Electron) e instalado no Mac Mini do espelho | modo quiosque, controle, tela cheia sem navegador, cache local de assets, vídeo das cutscenes em disco | baixo: nenhuma reescrita, uma camada de empacotamento |
| **C · depois** | cliente nativo de jogo (Godot ou Unity) consumindo a **mesma API** (`/api/flair/adventure/*`, JWT, prévia do deck no servidor) | Runway com muitos avatares, loja de console ou App Store | alto: duas bases de cena; a regra "efeitos calculados no servidor" é o que torna isso viável sem duplicar regras |

O que **não** se recomenda: começar pelo cliente nativo. Um jogo de PS5 exige programa de desenvolvedor, hardware de
desenvolvimento e certificação; a App Store exige conta, revisão e taxa; e o TCC tem prazo. A arquitetura já tomou a
decisão certa para permitir a fase C mais tarde: o servidor calcula o que a carta faz, o cliente só mostra. Enquanto
essa regra se mantiver, trocar de cliente é trocar de renderizador, não de jogo.

## 7. Resumo em uma frase por pergunta

1. **Sentido do quarto:** é o gêmeo digital do guarda-roupa real; os portais acrescentam a memória do que a pessoa fez
   com ele (procedência).
2. **Saguão:** o quarto ganha uma parede com o corredor dos portais e a passarela; os portais abrem por nível e por
   final anterior e devolvem ao quarto cartas com história, nunca Hype.
3. **Aurora CPS:** o Hall é o mundo do jogo do Aurora; deck e sintonia são o "look equipado", a procedência é a parte
   histórica do gêmeo digital, e a biometria, quando existir, muda só a partida.
4. **Smart Mirror e plataforma:** o espelho físico é mais um cliente do mesmo estado do espelho, com projeção local e
   sem foto; a web fica como cliente principal, o desktop empacotado atende o quiosque, e o nativo vem depois sobre a
   mesma API.
