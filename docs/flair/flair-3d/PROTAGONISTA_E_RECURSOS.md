# FLAIR 3D: a protagonista, a atividade-puzzle e as roupas como recursos de RPG

Data: 07/11/2026. Escopo: estudo de game design com pesquisa e leitura do código. Nenhum código mudou. Complementa
`JOGOS.md` (os cinco jogos), `../cbc/CINCO_ELENCOS.md` e `../cbc/FLAIR_CBC.md` (links do CBC),
`../3d-puzzles/ESTUDO_INSOMNIAC.md` e `../3d-puzzles/ALTERNATIVAS_FASHIONAI.md`. Plataforma: estudo em andamento em
`docs/plataforma/` (`APP_NATIVO_UNREAL.md`, `BACKEND_PARA_APP_NATIVO.md`: app nativo em Unreal Engine 5 para App
Store, PS Store e Xbox, com o web como banco de testes), sobre a base de `docs/multiplataforma/`.

**Legenda:** **[D]** documentado (código do repositório com caminho, fala de desenvolvedor, página oficial ou texto de
lei); **[P]** imprensa, guia ou wiki, descrevendo o jogo de fora; **[I]** inferência e proposta deste estudo.
**[decidir]** marca escolha da dona do projeto. Os números entre colchetes, como [3], remetem às fontes no fim.

**Pedido da dona (literal):** "Na realidade, pensei nos jogos do FLAIR 3D como sendo composto por um personagem
protagonista que é o próprio Avatar do usuário ou outro personagem concedido pelo próprio app de maneira promocional.
Este personagem realizará uma ação ou participará de uma atividade do mundo da moda semelhante a um puzzle do Spider
Man 2 onde o Peter realiza alguma atividade. Estude como isto faria sentido para o Fashion AI, onde roupas e acessórios
realmente entram como recursos semelhante a um jogo de videogame RPG 3D".

**Resposta curta [I].**

1. A troca é de verbo: a carta deixa de ser **encaixada num objeto** e a protagonista **veste a peça e faz algo com
   ela** (atende, troca de roupa, posa, enfrenta o vento). O puzzle é a atividade, como o acelerador é o trabalho de Peter.
2. A protagonista é o avatar da pessoa (rosto por 468 pontos e corpo paramétrico, já no app) ou um personagem
   concedido pelo app: fictício (Lina Vale) ou licenciado, por janela de tempo. Nenhum dos dois se compra.
3. A peça vira equipamento com atributos **derivados só de dados que o FashionAI já guarda**: material e taxonomia dão
   os físicos (calor, vento, brilho, movimento, troca, estabilidade), nível e OVR a força, Hype os sociais, e
   EDGE…SYNC seguem como atributos de estilo.
4. O bônus de conjunto é o **mesmo link do FLAIR CBC** aplicado à silhueta: um elenco bem ligado no CBC é um look forte
   no 3D. O desgaste segue o cuidado real (lavanderia, conservação), e o erro nunca cobra a carteira.

## 0. Precedentes

### 0.1 Spider-Man: a atividade do personagem é o puzzle

| Jogo · personagem | Atividade jogável | Motivação na história | O que o puzzle diz do personagem |
|---|---|---|---|
| Spider-Man (2018) · Peter | Laboratório de Otto Octavius: quebra-cabeças de circuito (montar a grade elétrica) e de padrão (recompor um padrão com peças), que rendem XP e Research Tokens [P][10][W1] | Peter é assistente de pesquisa mal pago. Os dois buscam próteses avançadas, e Osborn corta o financiamento [P][W1] | Ele é cientista, não só herói. O gesto do puzzle é o ofício |
| Spider-Man (2018) · MJ | Repórter do Bugle infiltrada na galeria de Fisk: furtividade, fotografar obras e resolver puzzles de luz [P][W2][W3] | Intihar: "I did not want to do the damsel in distress"; o ritmo ("If we're constantly playing as Spider-Man, then it's constantly at a 10") e um mundo de heróis visto sem poderes [D][W4] | A curiosidade dela e a câmera, a ferramenta do ofício |
| Miles Morales (2020) · Miles | Amostras de som: achar no cenário o objeto com o mesmo ritmo e gravar [P][12]; deixadas por Aaron Davis, fecham o traje Purple Reign [P][12] | Laço com o tio e com a música | Ele ouve a cidade |
| Spider-Man 2 (2023) · Peter | Professor de física demitido no primeiro dia; vai para a Emily-May Foundation com Harry, cujo lema é "healing the world" [P][W6]. Experimentos EMF: emendar genes de plantas, pilotar drones de abelha, instalar turbinas eólicas seguindo **trilhas de vento** reveladas por escaneamento, e Hybrid Calibration [P][14] | Reparar o mundo e a amizade | No acelerador, o controle espelha o que Peter faz na história, para resolver "with my eyes shut" (Sheahan) [D][4] |
| Spider-Man 2 · MJ | Missões de furtividade refeitas, com mais ação. A primeira reprovava na hora quem fosse visto [P][W8] | Repórter que vira podcaster [P][W6] | Intihar: "Yeah, she's probably OP… I don't care" [P][W8]: a personagem vale mais que o equilíbrio fino |
| Spider-Man 2 · Miles | Espelhos do Senior Prank (puxar e girar espelhos no cenário para levar um feixe ao alvo) e Photo Ops [P][13][15] | Último ano na escola | Vida de estudante |

**Lições [I].** (a) A atividade nasce do **emprego ou da vida** do personagem, e a motivação cabe em uma frase.
(b) O gesto no controle imita o gesto na cena. (c) O puzzle é curto e devolve o jogador ao mundo. (d) A recompensa é
progresso do personagem (traje, token), não moeda. (e) O personagem **sem poderes** (MJ) é a referência certa para o
avatar: a força dele é o ofício e o que veste. (f) Simplificar e pular puzzles são opções de acessibilidade [D][1][6].

### 0.2 Moda como recurso de jogo

- **Infinity Nikki** (Papergames/Infold, 05/12/2024; PC, PS5, iOS, Android; Unreal Engine 5, migrado do UE4 uns 12
  meses antes do lançamento) [D][N1][N2][P][N3]. Roupas **concedem habilidades**: planar, encolher, purificar, escovar
  animais, pescar, pegar insetos [P][N3][N4]. Os **Miracle Outfits** (oito peças, uma por capítulo) são o fio da
  história [P][N4]. **Desafios de estilo** pesam Elegant, Fresh, Sweet, Sexy e Cool por tema [P][N5]. **Fabricar**
  pede croqui e materiais colhidos no mundo; **evoluir** pede refabricar; Whimstars no Heart of Infinity liberam
  croquis e sobem atributos [P][N6][N7]. A receita vem de **gacha** com "pity" [P][N3].
- **Love Nikki / Shining Nikki**: batalhas de estilo julgadas por atributos com peso por fase, como Lively 5, Simple 4,
  Cute 3, Pure 2 e Cool 1 [P][N8], em pares opostos como Gorgeous × Simple [P][N9]. No Shining Nikki, a pontuação da
  peça soma o encaixe no estilo pedido e a **raridade** (R, SR, SSR, UR) [P][N10].
- **Leitura [I]:** a Nikki prova que roupa pode ser verbo (a habilidade) e também número (o atributo). Mas o número
  vem da raridade comprada, o que é pay-to-win. No FashionAI, o número sai da **peça real** e de dados públicos, e a
  raridade já vem do Hype público, nunca do preço (`FlairEngine.rarity`) [D].

### 0.3 Equipamento em RPG 3D

| Conceito | Precedente | Uso no FLAIR [I] |
|---|---|---|
| Slots | Destiny 2: 3 armas e 5 peças de armadura; até 10 loadouts por personagem, com armas, armadura, mods e subclasse [P][R1] | SUP, INF, VES, CAL e ACE; loadout salvo por atividade |
| Resistência ao ambiente | Zelda BOTW: o conjunto Snowquill dá resistência ao frio [P][R2] | Calor e vento vêm do material |
| Bônus de conjunto e melhoria | BOTW: as Great Fairies melhoram armadura com materiais, e o bônus de conjunto exige todas as peças melhoradas, em geral até o nível 2 [P][R2][R3] | Links do CBC na silhueta; ateliê e Metamorfose |
| Durabilidade | Diablo IV: −10% de durabilidade ao morrer; em 0 a peça quebra e o reparo custa ouro [P][R4] | Frescor ligado à lavanderia; reparo custa tempo, nunca moeda |
| Carga | Elden Ring: o peso equipado decide a esquiva (leve abaixo de 30%, média abaixo de 70%) [P][R5] | A "mala" que já existe: Bronze 1, Prata 2, Ouro 3, Especial 4 (`CbcRequirementsBoard.weight`) [D] |
| Cosmético × poder | Fortnite Icon Series: itens só cosméticos, sem vantagem de jogo [P][L1] | O personagem licenciado não dá atributo |

### 0.4 Personagens promocionais e licenciados

- **Fortnite Icon Series**: desde Marshmello (fevereiro de 2019), pacotes de **tempo limitado**, alguns sem retorno;
  Addison Rae, por exemplo, ficou de 06/08 a 16/08/2026 [P][L1].
- **Réplica digital**: o acordo de 2025 do SAG-AFTRA para jogos exige consentimento, uma "reasonably specific
  description" do uso e relatório ao intérprete. Foi ratificado em julho de 2025, com 95,04% [P][L2].
- **Brasil**: imagem e voz são protegidas (CF art. 5º, X; Código Civil art. 20) [D][L3][L4]. Dado biométrico é dado
  pessoal sensível (LGPD art. 5º, II) [D][L5]. O ECA Digital (Lei 15.211/2025, em vigor desde 17/03/2026) **proíbe
  caixas de recompensa** em jogos para crianças e adolescentes ou de acesso provável por eles (art. 20) [P][L6][L7].
  O Marco Legal dos Jogos (Lei 14.852/2024) já exigia consentimento dos responsáveis para microtransações [P][L6].

## 1. A protagonista

### 1.1 Duas origens

| | Avatar da pessoa | Personagem concedido pelo app |
|---|---|---|
| De onde vem | Identidade versionada (`avatar_identity_versions`, V42): forma do rosto, corpo, pele e cabelo; manifesto `GET /api/me/avatar3d/canonical`; as fotos não saem do aparelho [D] (`docs/multiplataforma/03-avatar-e-provador.md`). Construção em `lib/avatar3d/pipeline.ts` e `components/avatar3d/my-avatar.tsx`; o corpo vestido em `components/three/human-avatar.tsx` e `human-outfit.tsx` [D] | **Fictício do FashionAI** (Lina Vale, com DNA de Estilo próprio; Augusto Vellard só como antagonista) ou **licenciado** (embaixador de marca ou celebridade, por contrato) [I] |
| Como libera | Ter o avatar aprovado. Sem avatar, entra o **manequim** nas medidas da pessoa (`components/three/mannequin.tsx`, `lib/avatar3d/body-spec.ts`) [D] | Fictício: por mérito, por exemplo ao concluir o capítulo B, e fica para sempre. Licenciado: concluir a atividade do evento dentro da janela do contrato. **Nunca à venda e nunca em sorteio ou caixa** [I] |
| O que o jogador controla | Câmera, gestos de vestir, poses e o caminho na cena; escolhe cada peça | O mesmo. O DNA do personagem vira **restrição** (como Lina hoje: estilos, cor e Hype máximo) e muda as falas |
| Que peças veste | As cartas da pessoa (peças reais) | As peças da pessoa, nas medidas do personagem; o licenciado só veste peças de marcas liberadas pelo contrato ou sem marca [decidir] |
| Quanto dura | Sempre | Fictício: sempre. Licenciado: a janela do contrato. Depois dela, as fotos já feitas ficam só no perfil, se o contrato deixar; senão viram silhueta [decidir] |

**Cuidados [I], com base em [L2]–[L7]:**

- **Contrato de imagem** do licenciado: prazo, territórios, plataformas (web, iOS, Android, PlayStation, Xbox), poses e
  roupas permitidas, aprovação dos renders, voz gravada (nunca sintetizada sem consentimento escrito), conflito de
  marcas, destino das fotos ao fim da janela e direito de retirada.
- **Nunca misturar identidades**: nem o rosto da pessoa no corpo da celebridade, nem o contrário (réplica sem
  consentimento, porta para deepfake).
- **13+**: só licenciado cujo conteúdo caiba na classificação do FLAIR; celebridade menor de idade fica fora; prêmio
  presencial com 18 anos ou consentimento do responsável (`FLAIR_CBC.md` §4) [D].
- **Rosto é dado sensível**: nunca em log, telemetria ou captura (`lib/avatar3d/identity/privacy.ts`) [D]; foto com
  rosto de 13–17 anos privada por padrão [decidir]. Revisar a classificação (ClassInd; nas lojas, ESRB, PEGI ou IARC) a
  cada personagem licenciado ou pose nova [I, conferir com cada loja].

### 1.2 Impersonation vira "a protagonista veste a peça"

**Hoje [D].** `Flair3dEffects` dá `IMPERSONATION` (bônus padrão +2) quando a pessoa tem nível Loft (900 pontos,
`FaiPointsService.Level`) e a aura (`FlairGameService.player`), e a peça tem `impersonationData.status = READY`
(`FlairGame3dScore.impersonationReady`). O vídeo vem de um renderizador ainda simulado
(`lib/aura/aura-impersonation-service.ts`), com movimento de 5 s a 24 fps (`AuraMotionService.capabilities`).

**Proposta [I].** Vestir deixa de ser efeito raro e vira a **base** de toda atividade. Os três efeitos mudam de
sentido sem mudar de nome no servidor; sem Impersonation a atividade é a mesma, só a foto final sai com a pose padrão:

| `Flair3dEffects.Kind` | Sentido novo | Condição (a que já existe) |
|---|---|---|
| `COMUM` | A protagonista veste a peça, e os atributos dela valem na atividade | Carta na posição certa |
| `METAMORFOSE` | O material da peça se transforma durante a atividade: melhoria temporária (§3.6) | Aura Metamorfose e sintonia ≥ 2 |
| `IMPERSONATION` | É **a própria pessoa** em cena: o avatar com o rosto dela faz o movimento de assinatura no final, e a foto de herói sai com ela | Loft, aura e peça READY. Só com o avatar da pessoa, nunca com personagem licenciado |

## 2. O ciclo atividade-puzzle

### 2.1 Anatomia comum [I]

Cada jogo tem seis tempos, de 3 a 6 minutos ao todo, e cada "batida" dura de 30 a 90 s (`ESTUDO_INSOMNIAC.md`, princípio 8):

**Chamado** (a motivação em uma frase, como "healing the world") → **Preparação** (o **loadout** no guarda-roupa; as
cartas mostram os atributos que serão testados) → **Atividade** (três batidas, cada uma com um verbo de moda, um gesto
e um **teste de atributo** conferido pelo servidor; cada batida é ponto de retomada) → **Imprevisto** (só uma
**habilidade** de peça resolve) → **Entrega** (foto, reação ou veredito) → **Volta** (recompensa e história da peça).

**Gestos** (o controle imita a cena, princípio de Sheahan [D][4]), em web · toque · controle do app Unreal: **vestir**
(arrastar a carta até o corpo · arrastar · botão de ação); **girar ou posar** (arrastar na horizontal · dois dedos ·
analógico esquerdo); **firmar contra o vento** (segurar o botão · segurar a tela · gatilho com resistência adaptativa);
**fechar zíper, abotoar, amarrar** (arrastar, cliques, sequência · deslizar e tocar · analógico direito e botões);
**enquadrar a foto** (rolagem · pinça · L2 mira, R2 dispara).

### 2.2 Jogo 1 · Espelho Partido (a suíte)

- **Protagonista**: o avatar, ou o personagem da temporada. **Motivação**: "amanhã cedo é a entrevista, e o Smart
  Mirror que te veste todo dia rachou em sete cacos". O Smart Mirror é o item do nível Estreia
  (`FaiPointsService.Level.ESTREIA`) [D].
- **Atividade**:
  1. Acender o abajur, a única fonte de luz.
  2. Abrir o closet, que é o deck, e vestir a peça na protagonista.
  3. Girar o corpo diante de cada caco até o reflexo da peça cair nele. O caco cola se a família de cor bate com a
     paleta dele (o requisito de hoje). Calçado vai no caco do chão, e qualquer peça no caco livre.
  4. **Imprevisto**: os dois cacos do topo ficam fora do feixe. Só um acessório com **Reflexo** desvia a luz até lá,
     como os espelhos do Senior Prank [P][13].
- **Peças e atributos**: família de cor, **Brilho** (≥ 60 acende o caco inteiro; abaixo disso, meia luz), Reflexo e
  os requisitos atuais (metal, Hype Nicho ou mais, cinco cartas).
- **Falha e fim**: o caco racha de novo e escurece o canto, e só ele recomeça. Inteiro, o espelho dá a foto (com
  Impersonation, o rosto da pessoa no reflexo) e, em harmonia, a carta Espelho Inteiro.

### 2.3 Jogo 31 · Prova com a Estrela (o camarim)

- **Protagonista**: o avatar como stylist. Lina Vale é a cliente e, numa variante futura, pode ser a protagonista
  concedida. **Motivação**: "Lina tem três compromissos numa noite e confia em você".
- **Atividade**:
  1. Ler o cartão de DNA de Lina: alfaiataria, minimalista, clássico e chique.
  2. **Prova**: pendurar a peça no cabide e mandar Lina para trás do biombo.
  3. **Troca rápida** entre a coletiva, a estreia e o after, com relógio. Cada fecho pede o gesto dele (zíper desliza,
     botão pede toques, cadarço pede sequência), e a **Troca** reduz os gestos.
  4. Passar a vapor: peça de linho, algodão ou viscose amassa e pede um gesto a mais.
  5. Lina sai e reage. A peça Viral rouba a cena, menos no after (regra que já existe).
- **Peças e atributos**: Troca, NOV (estreia), faixa de Hype (discrição), mala ≤ 20.
- **Falha e fim**: Lina devolve a peça e metade das lâmpadas apaga; se o relógio acaba, ela vai com a peça anterior
  (perde a sintonia da prova, a noite segue). No fim, três fotos de Lina e a carta numerada Prova com Lina Vale.

### 2.4 Jogo 43 · Rooftop ao Pôr do Sol (a cidade)

- **Protagonista**: o avatar. **Motivação**: "o convite é para a foto do pôr do sol, e o vento sobe quando a luz cai".
- **Atividade**:
  1. **Luz dourada**: escolher a peça de brilho e enquadrar a foto como num Photo Op [P][15]. Brilho e TRD aumentam o
     halo (regra atual: até +2 acima de Relevante).
  2. **Luz azul**: rajadas em três níveis, com a trilha de vento visível como nos experimentos EMF de turbinas
     [P][14]. O jogador **segura** a postura. A peça leve se mexe (bom para a foto) até o limite; acima dele, voa.
  3. **Noite**: o acessório com Reflexo pega a luz do bar.
  4. **Imprevisto**: a última rajada, de nível 3, só passa com uma camada **Corta-vento** ou com calçado de **Passo
     firme**.
- **Teste de atributo** (§3.2): uma peça voa quando Movimento − Vento efetivo > 50 na rajada 3. O Vento efetivo é o
  maior entre o da própria peça e o da camada que a cobre.
- **Falha e fim**: a camada voa, a luz do bar pisca e só a rajada recomeça. No fim, a foto no perfil e a luminária.

### 2.5 Jogo 70 · Cinco Clientes (a boutique)

- **Protagonista**: o avatar no primeiro dia de vendedora. **Motivação**: "a dona saiu, e cinco clientes chegaram ao
  mesmo tempo".
- **Atividade**:
  1. **Recepção**: cada cliente diz em uma fala a ocasião, o DNA e quanto cabe na mala dela.
  2. **Arara**: o deck de 11 é o estoque, e cada peça sai uma vez só. É um quebra-cabeça de alocação.
  3. **Provador**: vestir a cliente.
  4. **Espelho de atendimento**: a cliente se olha e reage.
  5. **Imprevisto**: a influenciadora quer foto, e ENG e a faixa de Hype pesam só para ela (regra atual: até +2).
- **Peças e atributos**: RANGE (a peça de muitas ocasiões é coringa), ocasião em comum e química do look de cada
  cliente (§3.4).
- **Falha e fim**: a peça volta à arara, pronta para outra cliente, e o provador apaga. Com as cinco atendidas, o
  caixa fecha e chega o espelho de atendimento. É o protótipo de `ALTERNATIVAS_FASHIONAI.md` (usa todas as posições).

### 2.6 Jogo 96 · Chefe: Vellard (o salão de gala)

- **Protagonista**: o avatar. Augusto Vellard é o antagonista fictício. **Motivação**: "Vellard sabotou um manequim da
  casa e diz que a coleção é cópia". A disputa é por estilo, nunca por força.
- **Ato 1 · Imagem**: caminhar até a marca no tapete e posar. Vellard dispara um **flash cegante** anunciado, que só
  passa com acessório de **Sombra** ou com Brilho ≤ 40. Atributos: GLOW e EDGE contra o look de Vellard, publicado no
  briefing (sem informação escondida).
- **Ato 2 · Evidência**: **restaurar a peça de arquivo**. Com a câmera de detalhe a 12 cm
  (`lib/scene3d/detail-camera.ts`) [D], examinar costura, etiqueta e uso, e encaixar fragmentos do padrão como no
  espectrógrafo [P][10]. Serve como arquivo a carta com LON ≥ 60, ou sem uso há 60 dias ou mais
  (`CbcRules.REDISCOVERY_DAYS`) [D], ou com conservação Desgastada: o uso real é a prova.
- **Ato 3 · Roupa**: a peça do DNA, a que a defende e o reforço. Vellard sabota uma carta Viral, salvo com Metamorfose
  (regra atual). A rodada compara EDGE e ORI.
- **Falha e fim**: os lustres do seu lado piscam e o ato recomeça. Vencendo, a carta Queda de Vellard e o monograma.

## 3. Roupas e acessórios como recursos de RPG

### 3.1 Slots no corpo

| Posição (`FlairTier.position`) [D] | Slot | Papel na atividade [I] | Subcategorias da taxonomia [D] |
|---|---|---|---|
| SUP | Torso: base + **camada** | A camada protege o que fica embaixo (vento, flash) | camada: `coat`, `parka`, `windbreaker`, `jacket`, `blazer`, `cardigan`, `vest`; base: o resto de `upper_piece` |
| INF | Pernas | Movimento, troca e calor | `lower_piece` (14 subcategorias) |
| VES | Torso e pernas | Ocupa SUP e INF e liga às quatro vizinhas | `dress`, `jumpsuit`, `romper`, `matching_set`, `overalls` |
| CAL | Base | Estabilidade (vento, passarela, tapete) | `shoes_piece` (19) |
| ACE | Até 3: cabeça e rosto, pescoço e mãos, bolsa | Reflexo, Sombra e carga | `accessory_piece` (23) |

A taxonomia está em `fai-application/src/main/resources/taxonomy/taxonomy.json` [D]. A carga é a **mala** que já
existe, Bronze 1 a Especial 4, com teto por jogo (`CbcRequirementsBoard`) [D]. Ela funciona como a carga do Elden
Ring: peça mais forte pesa mais.

### 3.2 Atributos derivados: regras exatas [I]

Entrada: só campos de `WardrobeItem` [D]: `material` (33 valores de `MATERIAL`), `category`, `subcategory`,
`variationCode`, `attributes` (`FINISH`, `LENGTH`, `SLEEVE_LENGTH`, `SLEEVE_STYLE`, `CLOSURE`, `HEEL_HEIGHT`,
`HEEL_TYPE`, `SOLE_TYPE`, `SPORT_USE`) e `color`, mais o nível, o OVR e o Hype da carta. Tudo é limitado a 0–100.
**Dado ausente aparece como "—", nunca 0** (regra do FLAIR em `flair-game-card.tsx`) [D], e a atividade usa 50 neutro.
Vento vale só para SUP, INF e VES; Estabilidade, só para CAL.

**Base por material** (Brilho dos tecidos = round(100 × (0,5·sheen + 0,5·(1 − roughness))), com os números que o
render já usa em `fabricSurface`, `lib/avatar3d/human/garments.ts`. Assim, o que **parece** brilhar **brilha** [D/I]):

| Material | Calor | Vento | Movimento | Brilho |
|---|---|---|---|---|
| COTTON · LINEN | 35 · 15 | 40 · 25 | 40 · 55 | 19 |
| DENIM · CANVAS | 45 · 40 | 65 · 70 | 15 · 10 | 7 |
| CORDUROY · VELVET | 60 · 55 | 55 · 50 | 20 · 40 | 25 · 45 |
| WOOL · CASHMERE | 80 · 85 | 60 · 45 | 25 · 35 | 29 |
| FLEECE · KNIT · ACRYLIC | 80 · 65 · 60 | 40 · 35 · 35 | 20 · 45 · 35 | 29 · 29 · 25 |
| SHEARLING | 95 | 80 | 10 | 25 |
| SILK · SATIN · VISCOSE | 25 | 15 · 20 · 20 | 80 · 70 · 75 | 63 · 63 · 25 |
| POLYESTER · NYLON | 40 · 30 | 55 · 75 | 50 · 45 | 25 |
| MESH | 5 | 0 | 50 | 25 |
| LEATHER · FAUX_LEATHER · SUEDE | 60 · 50 · 60 | 85 · 80 · 60 | 10 · 10 · 15 | 27 · 27 · 15 |
| RUBBER · EVA · CORK · STRAW | 10 | 90 · 90 · 20 · 20 | 0 · 0 · 10 · 10 | 25 · 25 · 15 · 15 |
| METAL · GOLD · SILVER · PLATED · PEARL · ACETATE | — | — | 0 | 90 (metais) · 70 · 50 |
| SYNTHETIC · BLEND | 40 | 50 | 40 | 25 |

**Modificadores:**

- **Calor**: subcategoria em `FlairEngine.COLD` +15, em `FlairEngine.WARM` −15 [D: as listas]; `LONG_SLEEVE` +5,
  `SLEEVELESS` −10; `MAXI`, `FLOOR_LENGTH` ou `FULL_LENGTH` +5.
- **Vento**: `windbreaker` +25, `parka` +20, `coat` +15, `jacket` +10, `blazer` +5; fecho `ZIPPER` ou
  `DOUBLE_BREASTED` +5; acabamento `COATED` ou `WAXED` +10; `RIPPED` ou `DISTRESSED` −10.
- **Movimento**: `MAXI` ou `FLOOR_LENGTH` +15, `MIDI` +5, `MINI` ou `MICRO` −10; `dress` ou `skirt` +10; manga `BELL`,
  `FLUTTER`, `BALLOON_SLEEVE` ou `PUFF` +10; `FRINGED` ou `RUFFLED` +15.
- **Brilho**: `PATENT` ou `METALLIC` +30, `SEQUINED` ou `BEADED` +35, `SATIN_FINISH` +15, `WAXED` ou `COATED` +10; cor
  `gold`, `silver`, `metallic_gold` ou `metallic_silver` +20.
- **Troca** (pelo `CLOSURE`): `SLIP_ON`, `ELASTIC`, `MAGNETIC`, `VELCRO`, `CLIP_ON` e `OPEN_TOP` 90; `ZIPPER` e
  `HALF_ZIP` 80; `SNAP` 75; `FLAP` 70; `PULLOVER`, `CLASP`, `BUCKLE` e `TOGGLE` 60; `BUTTON` e `SINGLE_BREASTED` 50;
  `TIE`, `DRAWSTRING` e `HOOK_AND_EYE` 45; `DOUBLE_BREASTED` 40; `LACE_UP` 30.
- **Estabilidade** (só CAL): `HEEL_HEIGHT` `FLAT` 90, `LOW` 80, `MID` 60, `HIGH` 40, `VERY_HIGH` 25. Sem salto
  informado, vale a subcategoria: tênis 90, `flats` e `loafers` 85, `boots` 80, `sandals` 70, `heels` 40,
  `flip_flops` 50. Ajustes: `STILETTO` −10; `BLOCK`, `WEDGE` ou `FLATFORM` +10; `LUG` +5; `HIKING`, `RUNNING` ou
  `TRAINING` +5.
- **Amassa** (marca, não número): `LINEN`, `COTTON` ou `VISCOSE` em `upper_piece`, `lower_piece` ou `full_body_piece`.
- **Atributo pouco confiável**: atributo com `confidence` < 0,6 (`TaxonomyAttribute.source`/`confidence`) [D] conta
  pela metade do modificador [I]. É a mesma lógica do preço não confirmado, que segura a carta em Prata (`FlairTier`).

**Força**: o OVR, de 45 a 92 (`FlairTier`) [D], escala a **habilidade**, não o atributo. Fator = 0,9 + 0,2 × (OVR −
45) ÷ 47, ou seja, de 0,9 a 1,1. A troca é que a peça forte pesa mais na mala. Como o OVR inclui preço (`45 +
30·preço + 18·marca + 6·acabamento`), o teto de ±10% evita que gastar mais seja ganhar [decidir].

**Atributos sociais (só Hype público, `FlairCollectionService.hypeSnapshot`)** [D/I]: POP vira **Plateia**
(passarela, gala), ENG **Conversa** (clientes, influenciadora), TRD **Tendência** (luz dourada), ORI **Originalidade**
(Vellard, júri), RAR **Raridade** (arquivo), LON **Longevidade** (evidência), NOV **Novidade** (estreia) e HYP a
**faixa** de Aura Hype (`Flair3dHype.bandOf`; Nicho ≥ 20, Relevante ≥ 40, Em alta ≥ 60, Tendência ≥ 75, Viral ≥ 90)
[D]. Peça privada fica sem atributo social, e as regras sociais não se aplicam a ela (`FlairEngine.Hype.NONE`) [D].

**Atributos de estilo (sem mudança)**: EDGE, RANGE, CLOUT, GLOW, ART e SYNC de `FlairEngine.card` [D], lidos como
ousadia, versatilidade, credibilidade, presença na foto, acabamento e estação.

**Exemplos com peças plausíveis** [I]:

| Peça (dados) | Calor | Vento | Movimento | Brilho | Troca | Estab. | Habilidade |
|---|---|---|---|---|---|---|---|
| Trench coat bege · COTTON · `coat`/TRENCH · `DOUBLE_BREASTED` · manga longa · Prata 71 | 55 | 60 | 40 | 19 | 40 | — | Corta-vento |
| Saia midi de cetim esmeralda · SATIN · `skirt` · `MIDI` · `ZIPPER` · Bronze 62 | 25 | 25 | 85 | 63 | 80 | — | voa sozinha na rajada 3 (85 − 25 > 50) |
| Jaqueta motociclista preta · LEATHER · `jacket`/MOTO · `ZIPPER` · manga longa · Ouro 78 | 80 | 100 | 10 | 27 | 80 | — | Corta-vento, Troca rápida |
| Colar de corrente prata · SILVER · `necklace`/CHAIN · cor `silver` · Prata 68 | — | — | 0 | 100 | — | — | Reflexo |
| Bota Chelsea de camurça · SUEDE · `boots`/CHELSEA · `LOW` · `SLIP_ON` · Prata 66 | 75 | — | 15 | 15 | 90 | 80 | Passo firme, Troca rápida |
| Camisa de linho · LINEN · `shirt` · `BUTTON` · manga curta · Bronze 58 | 15 | 25 | 55 | 19 | 50 | — | Amassa |

No rooftop, a saia de cetim sob o trench coat vira 85 − max(25, 60) = 25 e não voa: a camada protege. O exemplo mostra
o combo que se quer ensinar [I].

### 3.3 Habilidades por tipo de peça [I]

| Habilidade | Regra (só dados existentes) | Efeito |
|---|---|---|
| Corta-vento | camada (`coat`, `parka`, `windbreaker`, `jacket`) com Vento ≥ 60 | absorve um nível de rajada e protege SUP base e INF |
| Reflexo | ACE de `METAL`, `GOLD`, `SILVER` ou `PLATED`, ou `METALLIC`/`SEQUINED` | desvia o feixe (espelho) e pega a luz noturna (rooftop) |
| Brilho suave | `PEARL` ou `SATIN_FINISH` | brilha sem ofuscar: conta como discreta na coletiva de Lina |
| Sombra | `sunglasses`, `hat` ou `cap` | anula o flash cegante de Vellard |
| Troca rápida | Troca ≥ 80 | troca com um gesto só |
| Passo firme | CAL com Estabilidade ≥ 80 | não tropeça na rajada nem no tapete |
| Carga | `handbag`, `tote_bag`, `backpack` ou `crossbody_bag` | +2 de mala (leva uma peça reserva), como os talismãs de carga do Elden Ring [P][R5] |
| Camada removível | `cardigan`, `vest` ou `blazer` | dois estados, com e sem, trocados no meio da atividade |
| Arquivo | LON ≥ 60, sem uso há ≥ 60 dias ou conservação Desgastada | prova no ato de evidência |
| Talentos atuais | `TRENDSETTER`, `SPOTLIGHT`, `ICON`, `STATEMENT_LOCK`, `HYPE_BOOST`, `SHIELD` (`FlairEngine.ability`) [D] | Spotlight +1 nível de halo na foto; Escudo perdoa uma batida falha; os outros valem no veredito |

### 3.4 Bônus de conjunto = links do FLAIR CBC [D/I]

O corpo é a formação **Silhueta** do Primeiro Elenco: acessório–cima, cima–bolsa, cima–baixo, bolsa–baixo e
baixo–calçado (`CINCO_ELENCOS.md`) [D]. A peça inteira (VES) liga às quatro vizinhas, como na Noite de Estreia. A
força de cada linha e a química do look vêm de `CbcLinks`: marca 2, subcategoria 2, categoria 1, estilo 1, cor 1 e
ocasião 1; verde vale 1, laranja 0,5; química de 0 a 100 [D] (`fai-application/.../flair/CbcLinks.java`).

| Química do look | Bônus de conjunto [I] |
|---|---|
| ≥ 40 · Harmonia | +1 retomada grátis por atividade |
| ≥ 70 · Coerência | o atributo que mais acendeu linhas dá +10 ao atributo ligado: marca → CLOUT, estilo → EDGE, cor → Brilho na foto, ocasião → RANGE |
| 100 · Look Lendário | foto final especial e partículas da carta em todas as peças |

Um só sistema de conjunto no FLAIR 3D: os combos de `FlairEngine.deck` (sinergia de estilo, ocasião e estação,
contraste de materiais e multiplicador de marca) [D] continuam valendo só nos duelos, para não contar duas vezes. O
loadout que fecha um elenco no CBC pode ser salvo e usado no 3D, e assim os dois segmentos se reforçam.

### 3.5 Desgaste ligado ao cuidado real

**Dados [D]:** `PieceWearState` (`CLEAN`, `WORN`, `IN_WASH`; lavanderia em `components/laundry/`), `ItemCondition`
(`NEW`…`DAMAGED`), `EstadoConservacao` (Nova, Excelente, Boa, Desgastada, Danificada; V83), `TipoLavagem`,
`careInstructions`, `wearCount` e `lastWornDate` em `WardrobeItem`.

**Regras [I]:** o jogo **nunca** altera a peça real (jogar não soma uso nem muda estado).

- **Frescor**: `CLEAN` dá atributos cheios; `WORN` dá −10% nos físicos e a peça aparece amassada até ser marcada
  limpa; `IN_WASH` deixa a peça **indisponível**, como a peça quebrada do Diablo, mas sem custo [P][R4].
- **Conservação**: Desgastada não entra nas provas de Lina, mas ganha **Arquivo**; Danificada abre a missão de ateliê
  "restaurar", paga com atividade, nunca com moeda.
- Nada premia lavar mais (o recurso é água). Premia-se **usar o que já se tem**, como `noBuy` e `rediscovery` (C2/C3) [D].

### 3.6 Melhorias: Metamorfose e ateliê [I]

- **Metamorfose (temporária)**: muda o material de uma peça durante uma atividade, por exemplo cetim "encerado" com +20
  de Vento no rooftop, na paleta dos presets `PRISMA`, `FIO_VIVO` ou `HOLOGRAFIA` (`lib/aura-metamorphose.ts`) [D].
  Uma por atividade, na condição de hoje: aura e sintonia ≥ 2.
- **Ateliê (permanente, na carta)**: até 3 níveis de +5 por atributo, como as Great Fairies [P][R2], pagos com
  **Linha** (ponto ganho em atividade, nunca comprado). A carta mostra à parte "Vento 60 + 10 ateliê", para a verdade
  da peça seguir visível. Editor 3D: `components/atelier3d/` [D].
- **Completar a ficha é a melhoria legítima**: informar fecho, comprimento ou acabamento, ou trocar por foto de estúdio
  (GLOW 88), sobe os atributos de verdade e enriquece a taxonomia.

### 3.7 Loadouts

Um loadout é um **look salvo por atividade**: carta por slot e o slug do jogo. Pode haver até 5 por atividade
[decidir]. Ele reaproveita o esquema de deck (`schemeId`) e a carta de origem LOOK (`FlairCollectionCard.originType`)
[D]. Ao abrir, o servidor revalida: a peça existe, não está `IN_WASH` e a carta não está `LOCKED_CHALLENGE`. O botão
"vestir para esta atividade" sugere o loadout pelos testes da atividade, com regra determinística e sem IA paga.

## 4. Progressão e economia sem pay-to-win

- **O que se ganha** [D/I]: os FAI Points de cada jogo (25, 45, 30, 60, 80), FAI XP, itens do quarto, cartas
  especiais, a **foto de herói numerada**, poses da protagonista, **Linha** e personagens liberados por mérito.
- **A peça real é a fonte da verdade**: atributos recalculados de `WardrobeItem` a cada partida; peça apagada sai dos
  loadouts; o jogo nunca inventa peça; prêmio de marca só conta depois de entrar no guarda-roupa.
- **O erro custa a atividade, não a carteira** (`Flair3dPenalties`, regra ética do FLAIR) [D]: custa batida, placar,
  bônus perfeito e carta especial. Sem aposta de coins, energia ou espera paga, gacha ou caixa de recompensa (13+;
  ECA Digital, art. 20 [P][L6]).
- **Auditoria de pay-to-win [I]**: atributo físico não depende de preço (linho barato e caro têm o mesmo Vento); a
  raridade vem do Hype público (RF53) [D]; o OVR, que tem preço, mexe ±10% na habilidade e cobra mala; compra não muda
  atributo.
- **Guarda-roupa pequeno [I]**: peças de empréstimo, as peças padrão do avatar (`DEFAULT_PIECES`,
  `lib/avatar3d/human/default-outfit.ts`) [D], com atributos 50 e sem bônus de conjunto. Toda atividade fecha com
  elas; a montagem perfeita pede peças próprias. Acessibilidade: simplificar e pular batida, reduzir movimento e
  desligar vibração, como a Insomniac [D][1][6].

## 5. Dados, regras do servidor e protótipo

### 5.1 O que muda no backend [I]

| Hoje [D] | Passa a ser |
|---|---|
| `Flair3dHype`: faixa, teto, bônus de jogada (`DIMENSION` já lê qualquer dimensão), deslocamento por vaga | Igual. O `DIMENSION` vira o teste social de uma batida (por exemplo ENG ≥ 50 na influenciadora), e o deslocamento passa a ser por batida |
| `Flair3dEffects`: COMUM, METAMORFOSE e IMPERSONATION, com bônus por vaga | Mesmo enum e mesmos bônus, com o sentido da §1.2 |
| `Flair3dPenalties`: REFUSED −2, MISPLACED −1, NO_SINTONIA −1, OVEREXPOSED −1; `score()` nunca negativo | Mais `CHECK_FAILED` (−1: teste de atributo da batida falhou) e `UNAVAILABLE` (peça `IN_WASH`, bloqueada antes de começar, sem pontos). `score()` soma o resultado das batidas |

**Novidades:**

- `flair/PieceStats.java` (puro): `Input(material, category, subcategory, variationCode, attributes, color, tier, ovr,
  hype, wearState, conservation)` → `Result(stats, abilities, basis)`, com as tabelas em `PieceStatsTable.java` e as
  habilidades em `PieceAbilities.java` (uma responsabilidade por arquivo, ≤ 250 linhas, `LINE_RULES.md`). `basis()`
  explica cada número, como `FlairTier.Result.basis()`.
- **Endpoint de atributos derivados**: `GET /api/me/flair/cards/{id}/stats` e o lote `GET /api/me/flair/cards/stats?ids=`
  em `FlairCollectionController` (67 de 200 linhas) [D], com DTO ≤ 120 linhas.
- **Batidas no JSON** (`scripts/flair-games/data/serie-*.json`): `activity: {protagonist: "AVATAR" |
  "FICTIONAL:lina-vale" | "LICENSED:<id>", beats: [{key, verb, check: {stat, min, slot}, retry}]}`, conferidas em
  `POST /api/flair/games/{slug}/beats/{beat}`. O servidor segue como fonte da verdade.
- **Tabelas**: `flair_loadouts`, `flair_card_upgrades` e `flair_protagonists` (tipo, `dna_json`, janela, territórios,
  plataformas, idade mínima, licença), validada pela administração como os selos. Migração só em desenvolvimento.
- **i18n** pt-BR/en/es dos atributos e habilidades; o verso da carta (`FlairPieceCardPanels`) mostra os físicos.

### 5.2 O que prototipar primeiro no web (three.js) [I]

1. **`PieceStats` + endpoint + verso da carta**, sem 3D, com testes de caracterização dos exemplos da §3.2. Valem desde
   já o orçamento de chamadas de desenho do avatar (730–790 na auditoria do Afterparty) [D], nada de IA paga (Meshy,
   SF3D) e nada do Heist como asset.
2. **Uma batida do rooftop**: o avatar (`HumanOutfit`) numa sacada com uma luz pré-calculada; a rajada move a peça com
   o pêndulo que já existe (`stepSwing`, `lib/room3d/cloth-motion.ts`) [D] na amplitude Movimento − Vento efetivo, e o
   brilho vem de `fabricSurface`. É o teste mais visível dos atributos físicos.
3. **Cinco Clientes com manequins** (`mannequin.tsx`): alocação e química por cliente (`ALTERNATIVAS_FASHIONAI.md`).
4. **Unreal depois**, com os mesmos contratos JSON e a mesma conferência no servidor; o web segue como banco de testes
   (`docs/multiplataforma/02-arquitetura-e-contratos.md`), e o gatilho adaptativo entra só no app.

## 6. Riscos e decisões em aberto

| Risco [I] | Mitigação |
|---|---|
| O preço entra no OVR, e o OVR em força | Teto de ±10%, custo na mala e atributos físicos independentes de preço |
| Mentir no material para ganhar atributo (algodão cadastrado como couro) | Atributo de baixa confiança vale metade; ranking só com dados confirmados pelo catálogo, como o `priceVerified` |
| Atributos parecerem arbitrários | `basis()` em texto no verso: "Vento 60 = algodão 40 + casaco 15 + trespassado 5" |
| Dados incompletos (sem fecho, sem salto) | "—" e 50 neutro; pedido para completar a ficha como melhoria (§3.6) |
| Licença de imagem cara ou restritiva; marca concorrente no corpo do licenciado | Começar só com personagens fictícios; lista de marcas no contrato |
| Rosto de 13–17 em foto pública; mistura de identidades | Privado por padrão; Impersonation só com o avatar próprio |
| Incentivar consumo ou lavagem | Prêmios por reuso (`noBuy` e `rediscovery`); nada por número de lavagens |
| Desempenho do avatar no celular; escopo maior que o calendário do TCC | Manequim como modo leve e uma luz pré-calculada por cena; fases da §5.2, cada uma jogável |

**Decisões para a dona [decidir]:**

1. Protagonista padrão = avatar, com o manequim como alternativa? Lina Vale jogável numa variante do jogo 31?
2. Licenciado: veste qualquer peça da pessoa ou só marcas liberadas? As fotos ficam no perfil depois da janela?
3. Teto do OVR na habilidade: ±10% (proposto), 0% ou outro? Atributo de baixa confiança vale metade?
4. `WORN` −10% e `IN_WASH` indisponível, ou o estado de uso fica fora do jogo?
5. Ateliê com Linha (3 níveis de +5) ou só a Metamorfose temporária? Até 5 loadouts por atividade?
6. Primeiro protótipo: a rajada do rooftop (proposto) ou Cinco Clientes?

## Fontes

Repositório: os caminhos citados no texto. Numeração [1]–[16] igual à de `../3d-puzzles/ESTUDO_INSOMNIAC.md`: [1] https://blog.playstation.com/?p=384830 · [4] https://mobilesyrup.com/2023/10/19/insomniac-games-marvels-spiderman-2-ps5-tech-interview ·
[6] https://support.insomniac.games/hc/en-us/articles/46730041467027-What-Accessibility-options-does-Marvel-s-Spider-Man-2-feature · [10] https://www.gamepressure.com/marvels-spider-man/substance-identification-and-power-control/zeb46b ·
[12] https://noobfeed.com/articles/spider-man-miles-morales-all-sound-samples · [13] https://twinfinite.net/guides/how-to-solve-mirror-puzzle-spider-man-2/ · [14] https://www.powerpyx.com/spider-man-2-all-emf-experiment-locations-solutions/ ·
[15] https://www.gamespot.com/articles/spider-man-2-photo-ops-all-23-locations-guide/1100-6518457/

**Spider-Man.** [W1] Wikipedia, Marvel's Spider-Man (2018): https://en.wikipedia.org/wiki/Marvel%27s_Spider-Man_(2018_video_game) · [W2] GameSpot, MJ na galeria: https://www.gamespot.com/articles/spider-man-on-ps4-why-you-should-be-excited-about-/1100-6460893/ ·
[W3] Wccftech, MJ e o laboratório de Peter: https://wccftech.com/spider-man-mary-jane-stealth-peter-lab/ · [W4] ComicBook, Intihar (2018): https://comicbook.com/2018/09/16/marvels-spider-man-ps4-mary-jane-stealth-sections/ ·
[W6] Wikipedia, Marvel's Spider-Man 2: https://en.wikipedia.org/wiki/Marvel%27s_Spider-Man_2 ·
[W8] GamingBolt (via IGN): https://gamingbolt.com/marvels-spider-man-2-director-says-he-doesnt-care-that-mj-is-a-little-op ; Dexerto: https://dexerto.com/spider-man/marvels-spider-man-2-director-explains-importance-of-divisive-mj-stealth-missions-2356781

**Nikki.** [N1] Unreal Engine, entrevista (bloqueada ao robô; lida pelo resumo do buscador): https://www.unrealengine.com/en-US/developer-interviews/behind-the-scenes-of-infinity-nikki-tracing-a-glamorous-turn-to-an-unreal-open-world ·
[N2] Epic Games Store: https://store.epicgames.com/news/how-infinity-nikki-became-the-ultimate-dress-up-game-and-so-much-more · [N3] Wikipedia: https://en.wikipedia.org/wiki/Infinity_Nikki ·
[N4] The Backdash: https://thebackdash.com/gaming/infinity-nikki-all-outfits-upgrade/ · [N5] Inverse: https://inverse.com/gaming/infinity-nikki-styling-challenge-guide-cool-elegant-fresh-sexy-sweet ·
[N6] GameWith: https://gamewith.net/infinitynikki/49153 ; Game8: https://game8.co/games/Infinity-Nikki/archives/487072 · [N7] Sportskeeda: https://www.sportskeeda.com/esports/how-upgrade-outfits-infinity-nikki ·
[N8] Newsweek, Love Nikki: https://www.newsweek.com/entertainment/video-games/love-nikki-magic-circus-quiz-event-guide-answers-stage-battle-tips-1025024 · [N9] Nikki Calc: https://nikkicalc.pages.dev/stages/custom ·
[N10] BlueStacks, Shining Nikki: https://www.bluestacks.com/blog/game-guides/shining-nikki/sn-styling-guide-en.html

**RPG.** [R1] GameSpot, loadouts do Destiny 2: https://gamespot.com/articles/destiny-2-lightfall-adds-in-game-loadouts-and-a-mod-manager/1100-6506775/ ·
[R2] RPG Site, BOTW: https://www.rpgsite.net/feature/5364-zelda-breath-of-the-wild-armor-set-outfit-locations-stats-and-bonuses · [R3] Zelda Dungeon: https://www.zeldadungeon.net/wiki/Set_Bonus ·
[R4] GamesRadar, Diablo IV: https://gamesradar.com/diablo-4-repair-weapons-armor-durability · [R5] Elden Ring Wiki: https://eldenring.wiki.gg/wiki/Equipment_Load

**Licença e lei.** [L1] Digital Trends, Fortnite Icon Series: https://digitaltrends.com/gaming/fortnite-icon-series-skins ·
[L2] Decrypt, SAG-AFTRA 2025: https://decrypt.co/329479/video-game-performers-ai-consent-rules ; Frankfurt Kurnit: https://technologylaw.fkks.com/post/102mewu/inside-the-new-sag-aftra-interactive-media-agreement-new-standards-for-ai-and-di ·
[L3] CF, art. 5º, X: https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm · [L4] Código Civil, art. 20: https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm ·
[L5] LGPD, art. 5º, II: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm ·
[L6] Mattos Filho, ECA Digital (lido pelo resumo do buscador): https://www.mattosfilho.com.br/unico/eca-digital-sancionada-lei/ ; Poder360: https://www.poder360.com.br/poder-governo/eca-digital-entra-em-vigor-nesta-3a-feira-entenda-o-que-muda/ ·
[L7] Ministério da Justiça, nota técnica: https://www.gov.br/mj/pt-br/assuntos/noticias-1/mjsp-pede-a-anpd-que-monitore-jogos-eletronicos-com-caixas-de-recompensa-que-nao-implementaram-verificacao-de-idade/NotaTcnican55.pdf