# Estudo: puzzles da Insomniac (Marvel's Spider-Man 2018, Miles Morales, Spider-Man 2) → cartas FashionAI em 3D

Pedido (06/11/2026): migrar as fotos 2D dos cenários e a inserção de cartas do deck para um padrão 3D
"ultrarrealista", "semelhante aos gráficos do Spider-Man 2 da Insomniac", com encaixe perfeito e efeitos visuais e
sonoros. Vale para os dois segmentos FLAIR: **FLAIR 3D** (os 100 jogos de cenário e as aventuras 3D, como o
Afterparty) e **FLAIR Card Building Challenge** (desafios de montagem e modos de batalha de cartas: duelo, equipes,
arena e os 15 modos de look). Este documento estuda **como a Insomniac desenha e apresenta os puzzles** e **o que dessa tecnologia é
viável num navegador**. É estudo, não plano de implementação nem código.

**Legenda de confiabilidade** (usada em todo o texto):

- **[D]** documentado: fala de desenvolvedor, blog oficial da Sony/Insomniac ou entrevista técnica (fonte citada).
- **[G]** descrito por guias/imprensa a partir do jogo (mecânica observável, não intenção declarada).
- **[I]** inferência nossa: interpretação, número sugerido ou adaptação para a web. Não atribuir à Insomniac.

Correção de premissa: nas fontes, **"Mysterium"** em Spider-Man 2 são desafios de combate com tempo e medalhas
(sucessores dos desafios do Taskmaster), não puzzles de encaixe [G][16]. **Brooklyn Visions** é a escola de Miles;
os puzzles ligados a ela são os **espelhos de "Senior Prank"** e as fotos de vida estudantil [G][13][15]. Não
achamos palestra GDC nem entrevista da Insomniac dedicada a *design de puzzles*; o que há de primeira mão sobre
puzzles vem de entrevistas sobre DualSense/áudio e das opções de acessibilidade [1][2]. O resto é [G] ou [I].

## 0. Catálogo dos puzzles estudados

| Jogo | Puzzle | Mecânica (o que o jogador manipula) | Fonte |
|---|---|---|---|
| Spider-Man (2018) | Circuitos ("Power Control", Circuit Projects) | Grade com peças de circuito; levar energia do nó verde ao laranja; algumas peças giram; fases depois exigem voltagem-alvo com peças +/− | [G][10][11] |
| Spider-Man (2018) | Espectrógrafo ("Substance Identification") | Fragmentos à esquerda são posicionados sobre o padrão central até as **linhas coincidirem**; 1–3 fragmentos; depois surgem fragmentos que **subtraem** linhas | [G][10] |
| Miles Morales (2020) | Amostras de som | Holograma de onda verde → ouvir → localizar no cenário o objeto com o mesmo ritmo → ficar à distância certa → gravar; alguns exigem esperar o evento (trem) | [G][12] |
| Spider-Man 2 (2023) | Acelerador de partículas / "Hybrid Calibration" | Emissores "presos" com pressão **assimétrica** nos gatilhos adaptativos L2/R2; resistências diferentes; em fases | [D][3][4] |
| Spider-Man 2 | Splicer genético (EMF) | Colocar atributos/genes num terminal; as linhas nas bordas dos ícones definem se sincronizam | [G][14] |
| Spider-Man 2 | Espelhos ("Senior Prank") | Puxar e girar espelhos **no próprio cenário 3D** para desviar um feixe de luz até o alvo; caixas bloqueiam; última fase com espelhos azuis e vermelhos separados | [G][13] |
| Spider-Man 2 | Photo Ops | Achar o lugar e enquadrar o ponto de interesse com a câmera; 150 XP + tokens por foto | [G][15] |

## 1. O puzzle dentro do mundo 3D

**O que é documentado**

- O controle "espelha" a ação do personagem: no acelerador, Doug Sheahan diz que o design alinhou a interação do
  controle ao que Peter faz na história, e que o objetivo era o jogador resolver "with my eyes shut", achando o
  ponto certo sem depender da UI [D][4].
- Áudio é tratado como interface de posição: Johannes Hammers descreve objetos posicionados em 3D para o jogador
  sentir onde estão inimigos, objetos e alvos de missão; funciona em fone e em alto-falante de TV [D][4].
- O mundo é renderizado com reflexos ray-traced em todos os modos, e o carregamento rápido do SSD permite trocar
  de personagem com um zoom contínuo (vista aérea e volta) em vez de tela de carregamento [D][3][5].

**O que é observável nos jogos [G]**

- Há dois regimes. (a) **Puzzle diegético**: os espelhos e as amostras de som acontecem no espaço do jogo, com o
  personagem presente e a câmera do jogo. (b) **Puzzle em "tela de instrumento"**: circuitos, espectrógrafo e
  splicer abrem uma interface holográfica/terminal que ocupa a tela, justificada na ficção (laboratório, terminal
  EMF) [G][10][14].
- A transição para o regime (b) parte de um objeto do mundo (terminal, estação científica) com o qual o jogador
  interage; o puzzle é curto e devolve o jogador ao mesmo lugar [G].

**Inferência para a web [I]**

- O caso FashionAI é um híbrido: a **vaga** existe no cenário 3D (cabide, manequim, vitrine), mas a **carta** vem
  de uma camada de interface (o deck). O equivalente ao "zoom contínuo" é uma transição de câmera de 400–700 ms do
  plano geral do cenário para um enquadramento da vaga ativa, com profundidade de campo leve para isolar a vaga e
  luz de destaque ("key light") sobre ela; nunca um corte seco nem um modal.
- Manter a cena viva durante o encaixe (ambiente sonoro, partículas ambientes, reflexos) é o que dá a sensação de
  "puzzle dentro do mundo", não a quantidade de polígonos.

## 2. Como as peças encaixam

**Documentado**

- No acelerador, a correção é sentida pela **resistência analógica** do gatilho: "If we didn't have that feedback,
  that minigame would feel mushy" (Sheahan) [D][4]. O jogador sente que "travou" antes de ver o resultado.
- Na prévia oficial, o gesto descrito é "carefully pressing the adaptive triggers with asymmetrical levels of
  pressure" para travar emissores [D][3].
- Numa porta, a Insomniac usa resistência alta no gatilho e vibração que **cede de repente** — o "clique" como
  liberação de tensão [D][4].

**Observável [G]**

- Circuitos: peças ocupam **slots discretos** de uma grade; a rotação é em passos (90°); a energia "flui" pelo
  caminho conectado, então o jogador vê a correção parcial a cada peça encaixada [G][10][11].
- Espectrógrafo: o critério é **coincidência de linhas** com o padrão-alvo; erro é visível como linha sobrando ou
  faltando [G][10].
- Espelhos: o feixe é recalculado em tempo real enquanto o espelho gira — feedback contínuo **antes** de confirmar [G][13].
- Splicer: as bordas dos ícones carregam a informação de compatibilidade (linhas que precisam casar) [G][14].

**Modelo extraído [I]**

1. **Espaço de solução discreto**: posições e rotações em passos; nada de precisão de pixel.
2. **Pré-visualização contínua**: enquanto a peça está "no ar", o resultado do encaixe já aparece (feixe, energia,
   linhas). Correção é comunicada *antes* de soltar.
3. **Zona magnética**: dentro de um raio (sugestão: 30–40% da maior dimensão da vaga), a peça é atraída e alinhada
   (posição + rotação) com mola amortecida; fora dele, segue o dedo/cursor.
4. **Momento do clique** = três coisas no mesmo frame: parada física com leve overshoot (easeOutBack, 120–180 ms),
   transiente sonoro curto e pulso háptico. Depois disso vem a "recompensa" (luz, partículas, stinger).
5. **Tolerância generosa, resultado exato**: o jogador solta "perto", o jogo coloca "perfeito".

## 3. Camadas de feedback

**Documentado**

- Vibração gerada a partir de **formas de onda de áudio**; a equipe de programação deu "ganchos" de eventos ao
  áudio, que modelou o feedback (Sheahan) [D][4]. Ou seja: som e háptico são desenhados juntos, pelo áudio.
- Processo **audio-first**: pré-visualização, captura do jogo, passe linear de design de som, depois implementação
  (Hammers) [D][4].
- Identidade sonora por personagem e um "sonic lexicon" para o simbionte, montado em **camadas** de foley (couro
  rangendo, corda esticando, case de CD dobrado, lama); asas com luvas e bolas de borracha sobre tecido e celofane
  esticado [D][4]. Tecido é material sonoro legítimo — relevante para moda.
- Sino da igreja: ondas que "reverberam" pelo háptico; perseguição no esgoto com som em 360° [D][3].
- Áudio 3D (Tempest) usado para localizar alvos [D][4]; ticking de áudio para distância de pontos de interesse e
  hápticos distintos para habilidades prontas foram adicionados em patches de acessibilidade [D][7].
- Visual: reflexos ray-traced passaram a incluir partículas (fogo, fumaça) [D][5]. Não há fonte da Insomniac sobre
  curvas de animação/bloom específicas dos puzzles.

**Pilha de feedback proposta para o encaixe de carta [I]** (camadas no espírito de "juice" [33]) (tempos a partir do "solta" = 0 ms)

| Camada | Antes de soltar (hover na zona) | Clique (0–180 ms) | Recompensa (180–1200 ms) |
|---|---|---|---|
| Visual | Contorno emissivo da vaga, cor pela compatibilidade; "fantasma" da peça já na pose final | Snap com overshoot; flash curto de emissão (pico em ~60 ms) | Aura Hype: anéis por faixa de hype com bloom; Metamorfose: troca de material com dissolve 400–600 ms |
| Áudio | Tom/ambiente sobe levemente (filtro abre) | Transiente seco (clique de cabide, zíper, fecho) + corpo de tecido (foley) | Stinger musical por tier (BRONZE → ESPECIAL em intensidade), cauda com reverb do ambiente do cenário |
| Háptico (web) | — | 1 pulso curto (10–20 ms) | Padrão por tier derivado do envelope do stinger (só onde houver API, ver §6) |
| Câmera | Aproxima 5–10% | Micro "punch" de 1–2% | Volta ao enquadramento da cena |

## 4. Feedback de erro sem frustração

**Documentado**

- Acessibilidade de puzzles em Spider-Man 2: **Simplify Puzzles** [1] (reduz a complexidade de puzzles como o
  Genetic Splicer e a Molecule Identification Tool), **Puzzle Skips** pelo menu de pausa e **dicas explícitas**;
  um patch adicionou pular minijogos de gatilho adaptativo [D][6][7][8]. No jogo de 2018 já havia pulo de
  circuitos, espectrografia e torres de vigilância [D][9].
- Simplificar não impede 100% de conclusão [G][8]; filtros de frequência de áudio permitem cortar sons
  desconfortáveis [D][8].

**Observável [G]**

- Os puzzles estudados quase não têm "estado de erro" punitivo: o circuito simplesmente não conduz, o feixe bate na
  parede errada, a linha não coincide. O erro é o **resultado visível** da escolha, não uma tela de falha [G][10][13].
- Não há vidas nem penalidade de tempo nos puzzles de laboratório/espelho [G].

**Modelo para FashionAI [I]**

- Carta incompatível com a vaga: a vaga **não atrai** (sem magnetismo), a peça volta ao deck com mola suave
  (250–350 ms) e um som "abafado" de tecido — nunca buzina de erro.
- Orientação/encaixe parcial: o fantasma mostra a pose correta; o jogador não precisa acertar a rotação.
- Explicar o motivo em uma linha diegética (ex.: etiqueta no cabide "pede peça de festa") em vez de toast genérico.
- Respeitar a opção de redução de movimento e oferecer "simplificar"/"pular" como a Insomniac.

## 5. Progressão e curva de dificuldade

**Observável [G]**

- Circuitos: primeiro só conectar; depois peças rotacionáveis; depois peças de mão única (setas); por fim voltagem
  exata com peças +/− — **uma regra nova por vez** [G][10][11].
- Espectrógrafo: 1–3 fragmentos; depois fragmentos subtrativos [G][10]. Espelhos: 3 fases, terminando com dois
  feixes por cor [G][13]. Hybrid Calibration em 3 fases [G][14].
- Puzzles são curtos e ancorados em missão/narrativa (Peter cientista, Miles produtor musical). O design de
  conteúdo de distrito busca "a meaningful arc and a meaningful story" para cada atividade (Josue Benavidez) [D][17].

**Modelo [I]**

- Cada cenário apresenta **uma** regra nova; a regra seguinte combina com a anterior.
- Leitura em 2 segundos: o número de vagas e a regra principal são visíveis no próprio cenário (luz nas vagas).
- Partidas de encaixe de 30–90 s; o "custo" de uma tentativa errada é ≤ 1 s.

## 6. Técnicas de renderização e o que é viável no navegador

**O que a Insomniac faz [D]** (entrevista Digital Foundry com Mike Fitzgerald [5] e blog PlayStation [3])

- Reflexos ray-traced sempre ligados em todos os modos; água com RT em ¼ da resolução horizontal; fallback de
  probes (baked/runtime) para reflexos secundários e superfícies rugosas.
- **Interiores de janela ray-traced**: cada janela mapeia para uma de 32 salas falsas sob o chão; antes, cubemaps
  (técnica "interior mapping") [5][18].
- **GI pré-calculada (baked)** para a cidade e para interiores de missão, um bake por hora do dia; GI ray-traced não
  foi prioridade porque precisa "assentar" e conflita com câmera rápida [5].
- 10–15 sistemas de detalhe: streaming de texturas, LODs, imposters; desgaste e sujeira "baked" para quebrar
  repetição [5]. Personagens com musculatura simulada e detalhe facial (capilares, pálpebras úmidas) [3].

**Lição principal [I]:** o "ultrarrealismo" de Spider-Man 2 em cenários estáticos vem muito mais de **luz
pré-calculada de alta qualidade + materiais PBR bem feitos + reflexos convincentes** do que de RT em tempo real. Isso é
exatamente o que a web faz bem: nossos cenários são **estáticos e pequenos** (uma loja, um provador), não uma cidade.

**Viabilidade na web (stack já presente no repo: three 0.187, @react-three/fiber 9, @react-three/drei 10)**

| Técnica | Web hoje | Observação |
|---|---|---|
| PBR (MeshStandard/MeshPhysical: clearcoat, sheen para tecido, transmissão p/ vidro) | Sim | `sheen` é o canal certo para veludo/cetim [19] |
| Iluminação por HDRI (IBL, PMREM) | Sim | HDRIs CC0 da Poly Haven; drei `<Environment>` [19][24] |
| Lightmaps/AO baked (Blender) | Sim, e é o maior ganho por custo [I] | Equivale ao "GI baked" da Insomniac [5] |
| glTF + Draco/Meshopt + texturas KTX2 (Basis) | Sim | KTX2 reduz memória de GPU; ETC1S 1K em celular, UASTC 2K em desktop são metas comuns, não oficiais [20][21] |
| Bloom, tone mapping (AgX/Neutral), vinheta, grão | Sim, barato | Bloom seletivo para emissivos das auras [I] |
| SSAO (N8AO), DOF | Sim, custo médio | DOF só durante o enquadramento da vaga [I] |
| SSR | Possível mas instável/caro | Preferir reflection probes, `MeshReflectorMaterial` para piso, cubemap local [I] |
| Ray tracing em tempo real | Não realista em celular | Path tracer WebGL existe para render offline/prévia, não para jogo [I] |
| WebGPU | Chrome desktop (113+), Chrome Android 121+ (Android 12+, GPU Qualcomm/ARM), Safari 26, Firefox 141 (Windows) | Manter fallback WebGL2 [22] |
| Gaussian splatting (captura real) | Sim (Spark, MIT, three r180+) | Fotorrealismo de cenário capturado, mas sem reiluminação nem colisão; usar como fundo + malhas proxy nas vagas [23] |
| Fotogrametria → malha | Sim | Pesado; precisa retopologia/decimação e bake [I] |
| Áudio espacial | Sim (Web Audio `PannerNode` HRTF) | [25] |
| Háptico | Parcial | `navigator.vibrate` em Chrome Android; **não** em Safari/iOS; Gamepad API com rumble em controles [26][27] |

**Orçamento sugerido [I]** (pontos de partida da comunidade, não normas oficiais [20][21]; medir com `renderer.info`)

| Alvo | Draw calls | Triângulos visíveis | Texturas | Pós-processamento | Resolução |
|---|---|---|---|---|---|
| Celular intermediário (30–60 fps) | ≤ 100 | ≤ 150–300 mil | KTX2 ETC1S, ≤ 1K (2K só no herói), ≤ 64 MB GPU | Tone mapping + bloom leve; sem SSAO/DOF | DPR 1–1.5 adaptativo |
| Notebook intermediário (60 fps) | ≤ 300 | ≤ 1 milhão | UASTC 2K, ≤ 256 MB | + SSAO + DOF na transição | DPR até 2 |
| Download do cenário | — | — | — | — | ≤ 8–15 MB por cenário no celular, streaming do resto |

Ferramentas do r3f para manter o orçamento: `frameloop="demand"` (renderiza só quando algo muda — ideal para
puzzle), instancing, `<Detailed>` (LOD), `PerformanceMonitor` + DPR adaptativo, `regress()` durante movimento [28].

## 7. Nota jurídica e fontes de assets

Não podemos usar nenhum asset, som, música, marca, logotipo ou captura de Insomniac/Marvel/Sony. "Inspirado em"
vale para **princípios de design**, não para aparência específica; evitar citar "Spider-Man" em material de
divulgação do FashionAI [I]. Lojas, marcas e vitrines reais também têm marca/trade dress: não escanear nem reproduzir
interiores reais de marcas sem autorização [I].

| Fonte | Licença | Cuidados |
|---|---|---|
| Poly Haven (HDRIs, texturas, modelos) | CC0, uso comercial, sem atribuição | Logos/renders do site não são CC0; ToS proíbe scraping [24] |
| ambientCG (texturas PBR) | CC0 | Conferir por asset [I] |
| Sketchfab | Por modelo: CC0, CC-BY (crédito obrigatório), CC-BY-NC (não comercial), Standard (sem crédito), Editorial (proibido uso comercial); tag NoAI | Guardar licença e URL de cada download; evitar NC/Editorial; modelos de "roupa de marca" podem infringir marca mesmo com CC [29][30] |
| Fab / Quixel Megascans | Fab Standard License; Megascans foi gratuito "para todas as engines" só até o fim de 2024, depois pago; downloads antigos via Bridge sob licença Epic restrita a Unreal | Ler o EULA vinculante; não presumir uso em web/three.js sem conferir [31] |
| Freesound | Por som: CC0, CC-BY (crédito), CC-BY-NC (sem uso comercial), Sampling+ (legado) | Preferir CC0; manter página de créditos [32] |
| Gravação própria de foley (tecido, zíper, cabide, salto) | Nossa | Melhor opção para identidade sonora, como a Insomniac fez com tecidos [4] |
| Capturas próprias (splat/fotogrametria) | Nossa | Autorização do local e das pessoas; nada de dados reais de clientes [I] |

## Princípios para o FashionAI

1. **Encaixe tolerante, resultado perfeito.** Zona magnética generosa; ao entrar nela a carta "se resolve" em
   posição e rotação exatas. O jogador nunca ajusta pixel nem ângulo. [I, a partir de §2]
2. **Correção antes do clique.** Durante o arraste, a vaga e o "fantasma" da peça já mostram se combina (cor,
   emissão, prévia da aura). Soltar só confirma. [I, a partir dos espelhos/circuitos §2]
3. **Clique em três canais no mesmo frame.** Parada com overshoot + transiente sonoro + pulso háptico; recompensa
   (aura, stinger) vem depois, em camada separada. [D: háptico derivado do áudio, §3]
4. **Áudio desenha o feedback.** Projetar o som primeiro e derivar o padrão de vibração do envelope dele; foley de
   tecido/acessório real em camadas, com reverb do tipo de ambiente (provador seco, clube com cauda longa). [D §3]
5. **Tier é material, não só número.** BRONZE/PRATA/OURO/ESPECIAL mudam luz, partícula e stinger em intensidade
   crescente; Hype define o raio/brilho dos anéis. Mesma gramática em FLAIR 3D e FLAIR Card Building Challenge. [I]
6. **O cenário é o puzzle.** Vagas são objetos diegéticos (cabide, manequim, mesa, passarela) iluminados no próprio
   3D; HUD só para o que não tem lugar no mundo. Transição de câmera contínua para a vaga, sem modal. [D/G §1]
7. **Erro é resultado, não punição.** Carta incompatível não é atraída e volta ao deck com mola; motivo em uma
   linha diegética; tentativa errada custa menos de 1 s. [G §4]
8. **Uma regra nova por cenário.** Curva como nos circuitos: conectar → girar → restrição → combinação; partidas de
   30–90 s legíveis em 2 s. [G §5]
9. **Realismo vem de luz baked + PBR + reflexo, não de RT.** Cenários estáticos com lightmap/AO do Blender, HDRI CC0,
   tecido com `sheen`, vidro/metal com probes; pós-processamento mínimo no celular. [D §6: GI baked da Insomniac]
10. **Orçamento por dispositivo e qualidade adaptativa.** `frameloop="demand"`, KTX2 + Draco/Meshopt, LOD,
    `PerformanceMonitor`, fallback WebGL2; se cair abaixo de 30 fps, desligar SSAO/DOF antes de baixar a resolução. [I §6]
11. **Acessibilidade de primeira classe.** "Simplificar" e "pular" encaixe, redução de movimento, controle de volume
    por camada (efeitos/stinger/ambiente) e háptico desligável — como a Insomniac oferece. [D §4]
12. **Assets limpos e rastreáveis.** Só CC0/licença própria por padrão; cada asset com licença e URL registrados;
    nada de Insomniac/Marvel nem marcas reais. [§7]

## Fontes

1. PlayStation Blog — acessibilidade de Marvel's Spider-Man 2: https://blog.playstation.com/?p=384830
2. GamesRadar — Spider-Man 2 puzzles (circuito, espectrógrafo, torres; opção de pular): https://www.gamesradar.com/dont-like-puzzles-marvels-spider-man-2-lets-you-totally-skip-them
3. PlayStation Blog — How Marvel's Spider-Man 2 taps into the power of PS5 (Tim Turi, 19/09/2023): https://blog.playstation.com/?p=384475
4. MobileSyrup — entrevista com Johannes Hammers e Doug Sheahan (19/10/2023): https://mobilesyrup.com/2023/10/19/insomniac-games-marvels-spiderman-2-ps5-tech-interview
5. Digital Foundry (John Linneman) — "Inside Marvel's Spider-Man 2: the Digital Foundry tech interview" com Mike Fitzgerald, 24/10/2023 (publicado na Eurogamer; cópia consultada): https://icon-era.com/threads/inside-marvels-spider-man-2-the-digital-foundry-tech-interview.6815
6. Insomniac Support — opções de acessibilidade de Spider-Man 2 (Simplify Puzzles, Puzzle Skips; acesso bloqueado ao robô, conteúdo via buscadores): https://support.insomniac.games/hc/en-us/articles/46730041467027-What-Accessibility-options-does-Marvel-s-Spider-Man-2-feature
7. MP1st — notas de patch de Spider-Man 2 (acessibilidade, pular minijogos de gatilho, hápticos): https://mp1st.com/news/marvels-spider-man-2-update-1-002-crawls-out-for-new-game-plus-and-more
8. Destructoid — Simplify Puzzles: https://www.destructoid.com/spider-man-2-how-to-simplify-puzzles/ ; Push Square — modificadores e acessibilidade: https://www.pushsquare.com/news/2023/09/marvels-spider-man-2-details-in-depth-difficulty-modifiers-and-impressive-accessibility-settings-on-ps5
9. Insomniac Support — acessibilidade de Spider-Man Remastered: https://support.insomniac.games/hc/en-us/articles/46670280641299-What-Accessibility-options-does-Marvel-s-Spider-Man-Remastered-have
10. Gamepressure — Substance Identification and Power Control (2018): https://www.gamepressure.com/marvels-spider-man/substance-identification-and-power-control/zeb46b
11. Camzillasmom — Circuit Projects (guia de fã, usar com cautela): https://camzillasmom.com/balance-compensation-circuit-project-4-solution-spider-man/
12. NoobFeed — amostras de som de Miles Morales: https://noobfeed.com/articles/spider-man-miles-morales-all-sound-samples
13. Twinfinite — puzzle dos espelhos (Senior Prank): https://twinfinite.net/guides/how-to-solve-mirror-puzzle-spider-man-2/ ; Push Square: https://pushsquare.com/guides/marvels-spider-man-2-senior-prank
14. PowerPyx — experimentos EMF (splicer): https://www.powerpyx.com/spider-man-2-all-emf-experiment-locations-solutions/ ; Twinfinite — Hybrid Calibration: https://twinfinite.net/guides/how-to-solve-hybrid-calibration-puzzle-spider-man-2/
15. GameSpot — Photo Ops: https://www.gamespot.com/articles/spider-man-2-photo-ops-all-23-locations-guide/1100-6518457/
16. GamesRadar — Mysteriums: https://www.gamesradar.com/marvels-spider-man-2-mysteriums-mysterio-location-map
17. Press Start — entrevista com Josue Benavidez: https://press-start.com.au/features/2023/10/20/we-spoke-to-insomniac-about-bringing-new-york-to-life-in-marvels-spider-man-2/
18. Joost van Dongen — Interior mapping: https://joostdevblog.blogspot.com/2018/09/interior-mapping-real-rooms-without.html ; GDC 2019, Elan Ruskin, Marvel's Spider-Man: A Technical Postmortem: https://gdcvault.com/play/1026496
19. three.js — MeshPhysicalMaterial: https://threejs.org/docs/#api/en/materials/MeshPhysicalMaterial
20. three.js — KTX2Loader: https://threejs.org/docs/#examples/en/loaders/KTX2Loader ; DRACOLoader: https://threejs.org/docs/#examples/en/loaders/DRACOLoader
21. Fórum three.js — limites de cena (texturas, draw calls): https://discourse.threejs.org/t/three-scene-optimization-texture-size-calculation-in-gpu-compression-merge-meshes-what-the-limits/23972
22. web.dev — WebGPU is now supported in major browsers: https://web.dev/blog/webgpu-supported-major-browsers
23. Spark (World Labs, MIT) — Gaussian splatting para three.js: https://github.com/sparkjsdev/spark
24. Poly Haven — licença: https://polyhaven.com/license
25. MDN — PannerNode: https://developer.mozilla.org/en-US/docs/Web/API/PannerNode
26. Can I use — navigator.vibrate: https://caniuse.com/mdn-api_navigator_vibrate
27. MDN — GamepadHapticActuator: https://developer.mozilla.org/en-US/docs/Web/API/GamepadHapticActuator
28. React Three Fiber — Scaling performance: https://r3f.docs.pmnd.rs/advanced/scaling-performance
29. Sketchfab — licenças: https://sketchfab.com/licenses
30. Sketchfab — NoAI e licenças de modelos gratuitos: https://sketchfab.com/blogs/community/restricting-generative-ai-use-of-free-models
31. CG Channel — Megascans grátis só até o fim de 2024 (Fab Standard License): https://www.cgchannel.com/2024/10/epic-games-has-made-megascans-free-to-all-but-only-until-the-end-of-2024/ ; EULA Fab: https://www.fab.com/eula
32. Freesound — FAQ de licenças: https://freesound.org/help/faq/
33. Jonasson & Purho — "Juice it or lose it" (GDC/Nordic Game 2012, base geral para camadas de feedback): https://www.youtube.com/watch?v=Fy0aCDmgnxg
