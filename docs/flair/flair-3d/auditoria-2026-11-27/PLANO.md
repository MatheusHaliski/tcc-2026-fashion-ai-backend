# Plano de refatoração: FLAIR 3D e FLAIR 3D MAKE UP acima de 8,0 em todos os critérios

Base: `AUDITORIA.md` (média 4,2; a pior coluna é Multiplayer com 0,6; depois Efeito com imagem e vídeo e Efeito das
cartas no cenário, com 3,0 cada). Meta: **≥ 8,2 projetado** em cada critério de cada um dos 16 (folga de 0,2 para a
reauditoria). A projeção só vale depois de a reauditoria usar a mesma rubrica (`AUDITORIA.md` §1) e jogar no navegador.

Regras do repositório que moldam o plano: limites do `LINE_RULES.md` (hook/route 150, controller 200, repo/DTO 120,
resto 250, testes 400); teste de caracterização antes de extrair; GoF registrado em `docs/refactoring/gof/`; segredos só
por variável de ambiente; uso novo de GPU ou IA registrado em `docs/fai-reconstruction-engine/piloto-e-decisoes.md`;
migration versionada no repositório e aplicada pelo pipeline normal, nunca à mão em produção.

## 0. Onde o trabalho em andamento entra

| Branch | O que traz (lido no `git show`) | Como o plano usa |
|---|---|---|
| `claude/flair3d-notas-8g` (3 commits) | `BatalhaLooksFecho` (vitória ≥ 60, derrota ≤ 59; a execução entra na soma); pacote `flair3d/aura/*` (plateia pelo Hype, trunfo do Hype `POST .../hype`, Electro, Comum, Metamorfose); `nucleo-aura.tsx`, `nucleo-result-aura.tsx`, `use-trunfo-do-hype.ts`. **Atenção:** `Flair3dAuraRegras.JOGOS` liga a Aura em **5** jogos (Passarela, Dress the Star, Filme, Boutique, Batalha), não nos 11 que não são de zonas. | **Mergear primeiro (passo 0).** Depois, a frente A6 estende `Flair3dAuraRegras.JOGOS` aos outros 6 (Dress Fighter, Fashion Sports, Detective, Labirinto, Around the World, Road to Glory) com a regra de cada gênero. Não refazer a Aura. |
| `claude/flair3d-zonas-nota8` (3 commits) | uniforme pintado no avatar (`scene/uniforme/*`: escudo, número, gola, estrela, dragonas, cinto, capa, capacete; `lib/flair/nucleos/uniforme/desenho.ts`); props da fase de uso pelo motor Blender (`scripts/blender3d/receitas/uso.py`, GLBs regenerados) | **Mergear no passo 0**, junto com a 8g (as duas mexem em `nucleo-game.tsx` com 2 linhas cada: conferir o conflito). A frente B5 (zonas) parte dela. Os GLBs regenerados na branch mudam bytes de ~60 arquivos que a A4 também regenera: a A4 começa **depois** desse merge. |

## 1. Visão das frentes

Frentes A são infraestrutura comum; frentes B são grupos de jogos por gênero e só **consomem** a A pela API dela.
Cada frente tem uma pasta própria e não edita a pasta da outra; os pontos de contato comuns têm dono único (§1.2).

| Frente | Conteúdo | Tamanho* | Depende de | Critérios que mais sobem |
|---|---|---|---|---|
| **P0** Merge e pré-extração | merge das duas branches; extrair de `nucleo-game.tsx` e `Flair3dNucleoService.java` os pontos de extensão | P (2–3 d) | — | — (destrava todas) |
| **A0** Tela de jogo, HUD mínimo e controle padrão | tela cheia (F), HUD mínimo de console (título curto, sem texto solto), esquema padrão setas/Shift/E/A/X/P/Esc, roda de recursos e armas no X com P para pegar — **já iniciada por outro agente no Fashion Detective** | M (6 d; o Detective já em curso) | P0 | Jog, Ent, Recursos, Gráf |
| **A1** Multiplayer FAI | convite por busca na rede FAI com filtros, sala, duelo por semente, por turnos, co-op | GG (12–15 d) | P0 | Multi, Ent, Single |
| **A2** Efeitos de carta no cenário | catálogo de efeitos por família × raridade × Aura, com estado na cena e VFX | G (8–10 d) | P0 | Efeito cena, Carta, FX |
| **A3** Personagens | protagonista com rosto, elenco nomeado, rivais recorrentes, falas, correção de poses | G (8–10 d) | P0, A4 (malhas) | Pers, Gráf pers, Ent |
| **A4** Cenários pelo motor Blender | os 70 móveis/arquiteturas que faltam, texturas, luz assada, pós-processo; detetive e esporte no motor | GG (12–15 d) | P0 | Gráf, Gráf pers |
| **A5** Campanha e dificuldade | sequência em todos, chefes, desafio diário, dificuldade por rodada | M (5 d) | P0 | Single, Ent, Complex |
| **A6** Deck e cartas | papel tático por carta (custo, raridade, combo), selos legíveis, cartas nos jogos de zonas e no MAKE UP, Aura nos 6 que faltam | G (8–10 d) | P0, 8g | Carta, Complex, Recursos, Identid |
| **A7** Imagem e vídeo | foto da carta em telões/vitrines; clipes pré-renderizados no Blender; captura de replay/foto da partida; post no perfil | G (8–10 d) | P0, A4 | FX img/víd, Identid, Ent |
| **B1** Palco | Passarela, Dress the Star, Batalha, Road to Glory | G (10 d) | A1 (Batalha), A2, A6 | Jog, Complex, Ent |
| **B2** Arena | Dress Fighter, Fashion Sports | G (10 d) | A1, A2 | Jog, Recursos, Single |
| **B3** Exploração | Fashion Detective, Labirinto, Around the World | GG (12 d) | A2, A4 | Jog, Complex, Lógica |
| **B4** Serviço e set | Boutique 3D, Personagem de Filme | M (7 d) | A2, A7 | Jog, Complex |
| **B5** Zonas | Clube, Singer, Piloto, Super-Herói | G (10 d) | `zonas-nota8`, A6 | Carta, Jog, Efeito cena |
| **B6** MAKE UP | aba inteira | M (7 d) | A6 (cartas de beleza), A3 (rosto) | todos |

\* P/M/G/GG em dias de uma sessão de agente com revisão; total ≈ 126 dias-agente, ≈ 5–6 semanas com 4–5 frentes em
paralelo.

### 1.1 Ordem

1. **Semana 1:** P0 (sozinha, curta). Em seguida, em paralelo: A0 (generalizar o que o agente do Detective fizer), A1, A2, A4, A5, A6.
2. **Semana 2–3:** A3 (precisa das malhas de gente da A4), A7 (precisa da cena modelada da A4 para renderizar
   clipes); B5 e B6 começam (dependem de A6 e da branch de zonas).
3. **Semana 3–5:** B1–B4, consumindo A1/A2/A6/A7 pelas interfaces publicadas.
4. **Semana 6:** reauditoria independente com a rubrica, jogando no navegador (bancada de tela + Chromium com WebGL) e,
   para gráfico, numa máquina com GPU (RunPod permitido; registrar custo).

### 1.2 Pontos comuns com dono único (para não colidir)

| Arquivo | Dono | Regra para as outras frentes |
|---|---|---|
| `components/flair/nucleos/nucleo-game.tsx` (240/250) | P0 | P0 extrai um registro de painéis (`nucleo-paineis.ts`, Strategy por jogo); as frentes registram o painel delas sem editar o arquivo |
| `flair3d/Flair3dNucleoService.java` (242/250) | P0 | P0 extrai `Flair3dPartidaAbertura` e `Flair3dPartidaEntrega`; A1 pluga a sala por um gancho |
| `fai-web/.../Flair3dNucleoController.java` | A1 só adiciona controller novo | ninguém adiciona endpoint nele; cada frente cria o próprio controller (≤ 200 linhas) |
| `lib/i18n/messages/{pt-BR,en,es}.json` | todas | chaves em bloco próprio por frente (`flair3d.multi.*`, `flair3d.fx.*`, `flair3d.elenco.*`...); merge em ordem A→B |
| `public/flair/3d/assets/manifest.json` | A4 | as outras frentes pedem receitas à A4; não regeneram GLB |
| `app/(site)/_styles/33-flair3d-quadro.css`, `nucleo-stage.tsx`, `nucleo-hud.tsx`, `nucleo-resource-window.tsx`, `lib/flair/nucleos/controls.ts`, `use-eixo-de-andar.ts` | A0 | as outras frentes põem painel no slot lateral que a A0 expõe; não posicionam nada por cima da cena |
| `lib/flair/nucleos/scene/sequences-color.ts` | A2 | substituído pelo catálogo da A2; B só registra efeitos novos no catálogo |
| `FlairService.java` (congelado) | ninguém | o duelo 2D passa a usar o serviço da A1 por fora (não cresce) |

## 2. Frentes de infraestrutura

### A0 · Tela de jogo e controle (achado da dona, T9)

**Problema.** Palco na metade de cima dentro da casca do site; HUD por cima da cena nos quatro cantos e textos
empilhados embaixo; setas não andam (`use-eixo-de-andar.ts:14` só WASD; setas = NAVEGAR em `controls.ts:21-29`); roda
de recursos é janela fixa, sem acesso por ✕ (`controls.ts:30-31`: ✕ = VESTIR).

**Coordenação.** Um agente já começou pelo Fashion Detective (`components/flair/detetive/*`). A A0 **não** reescreve o
Detective: espera o PR dele, extrai o que for comum para `components/flair/tela-de-jogo/` e aplica aos 14 núcleos e
ao MAKE UP. Se o PR do Detective sair com componentes próprios, a A0 os promove a comuns sem mudar o contrato visual.

**Critério da dona (27/11, vale para todos):** "Limpe todo tipo de informação desnecessária da cena. Preserve teoria
de jogos de console como PS5 (padrão roda de recursos, título com informação mínima). Nada de textos soltos
desnecessários. Mira da arma com A, pegar uma arma da roda com P."

**Desenho.**
- **Tela cheia** (F; Fullscreen API + estado que esconde a casca do site; fallback `100dvh`): a cena ocupa a viewport
  em desktop e celular.
- **HUD mínimo de console**, só o que muda a decisão agora:
  - canto superior esquerdo: **título com informação mínima** (nome do jogo + rodada, uma linha, some após 3 s e volta
    no Esc);
  - canto superior direito: placar/estrelas e **um** medidor (o recurso-vida do jogo), sem rótulos longos;
  - centro-baixo: o prompt contextual de uma palavra com o ícone da tecla ("E Abrir", "A Mirar"), só quando há o que
    fazer;
  - mão de cartas: faixa baixa recolhida por padrão (abre no X junto com a roda ou com ↓ no foco da mão).
  - **Fora da cena** (vão para a pausa/Esc ou para painéis laterais recolhíveis, fechados por padrão): objetivo longo,
    radar de atributos, "A modelo da casa / sem avatar no perfil", lista de peças-recurso, log da ação (hoje 9 linhas
    embaixo da cena), painel "Aura na partida", "Seguir sem executar" (vira opção da pausa), caderno e mapa (Detective:
    tecla própria, abre em painel).
  - Regra testável: **nenhum texto com mais de 6 palavras sobre a cena fora da pausa**; nada na faixa central.
- **Esquema de controles padrão** (teclado; gamepad PS5 entre parênteses):

  | Ação | Tecla | Gamepad | Hoje (`lib/flair/nucleos/controls.ts`) |
  |---|---|---|---|
  | mover | **setas** (sem WASD) | analógico esquerdo | setas = NAVEGAR cartas; andar só WASD (`use-eixo-de-andar.ts:14`) |
  | correr | **Shift** | L3 / R2 | Shift = TIRAR |
  | interagir | **E** | ✕ | E = VESTIR |
  | mirar | **A** | L2 | A = NAVEGAR à esquerda |
  | roda de recursos/armas | **X** (abre; segura = câmera lenta) | L1 segurado | não existe (janela fixa à direita) |
  | pegar da roda | **P** (equipa o item destacado) | ✕ com a roda aberta | — |
  | tela cheia | **F** | — | F = DESFILAR |
  | pausa (objetivo, opções, "seguir sem executar", sair) | **Esc** | Options | Esc = VER_OBJETIVO |
  | navegar na roda/mão | setas com a roda ou a mão aberta | analógico/direcional | — |

  Remapeamentos que isso exige: VESTIR/confirmar passa a E (na preparação, com a mão aberta) e Enter; TIRAR passa a
  Backspace/○; DESFILAR/posar sai do F e vira a ação contextual do E na marca; TROCAR_ABA (I) vira L1/R1 dentro da roda.
  Teste de caracterização do mapa atual antes de trocar; o novo mapa num só lugar (`controls.ts`) e a ajuda de teclas
  só na pausa.
- **Roda de recursos e armas (X)**: radial de 6–8 fatias (peças-recurso, armas/ferramentas do gênero, trunfo do Hype
  da 8g), setas escolhem, **P** pega/equipa, X ou Esc fecha; a janela fixa de recursos (`nucleo-resource-window.tsx`)
  sai da cena. **Mira (A)**: retícula no centro e câmera sobre o ombro para as armas/ferramentas de alcance.
- **Adoção por jogo** (onde faz sentido):

  | Jogo | Movimento livre (setas/Shift) | E interage | A mira | X roda / P pega | Observação |
  |---|---|---|---|---|---|
  | Fashion Detective | sim | gaveta, armário, pista, porta | lanterna, distração, câmera de pista | sim | já em curso (outro agente); vira o modelo |
  | O Labirinto | sim (com B3) | espelho, porta | reflexo/lanterna nos espelhos | sim | |
  | Around the World | sim (com B3) | lojas, guia, metrô | câmera de cartão-postal | sim | |
  | Dress Fighter | sim, no eixo do ringue | — (golpes vêm da carta) | golpe de alcance/Especial | sim: a mão vira a roda de golpes | |
  | Fashion Sports | sim (jogador da vez) | passe/desarme | chute/arremesso (A = mirar o gol) | sim: jogadas da mão | |
  | Super-Herói | sim (fase de uso) | caixas, reféns | superpoder (A mira, P equipa da roda) | sim | |
  | Clube do Coração | sim (fase de uso) | drible | chute ao gol | sim | |
  | Meu Piloto | volante (setas aceleram/esterçam; Shift = vácuo) | box | — | sim (pneus, combustível) | mirar não se aplica |
  | My Favorite Singer | no palco (setas) | público | — | sim (efeitos de palco) | mirar não se aplica |
  | Passarela, Dress the Star, Batalha | só no desfile (setas na passarela) | pose na marca | câmera de foto (A) só onde houver flash | sim | sem movimento livre na preparação |
  | Boutique 3D, Personagem de Filme | sim na loja/no set (com B4) | arara, provador, claquete | Filme: enquadrar câmera (A) | sim | |
  | Road to Glory, MAKE UP | não (estúdio/espelho) | — | Road to Glory: A = enquadrar a foto | sim (produtos, luzes) | HUD mínimo e roda continuam |

- Gamepad pela Gamepad API; toque: analógico existente (`analogico-de-toque.tsx`) + botões E/A/X na borda.
- Testes de tela: mapa de teclas inteiro, roda (abrir, escolher com setas, P equipa, fechar), mira, tela cheia, layout
  1360×860 e 390×844 (cena ≥ 85 % da altura), contagem de textos sobre a cena.

**Entregas mensuráveis.** Cena ≥ 85 % da viewport nos 16; nenhum texto > 6 palavras sobre a cena fora da pausa; zero
painel na faixa central; o esquema acima igual em todos os jogos onde se aplica (tabela); roda no X em todos os jogos
com recurso; nota "HUD/texto na cena" (AUDITORIA §3.1) ≥ 8 em todos; capturas antes/depois por jogo.
**Projeção:** +1,0 a +1,5 em Jogabilidade, +0,5 a +1,0 em Entretenimento e Recursos, +0,5 em Gráfico.

### A1 · Multiplayer com convite por busca na rede FAI

**Problema (T1).** Nenhum jogo tem segundo jogador; o duelo 2D pede a tag digitada (`classic-modes.tsx:92`).

**Desenho.**
- Servidor, pacote novo `fai-application/.../flair3d/multi/`:
  - `Flair3dAdversarios` — busca de adversários: reaproveita `SearchService` aba `PESSOAS` (bloqueio e conta de
    teste já tratados) e `connections` (seguindo/seguidores); filtros: `relacao` (sigo, me segue, mútuos, todos), `nivel`
    (nível FLAIR/carreira), `estilo` (do DNA de estilo público), `pais`, `ativoRecente` (jogou nos últimos 7 dias),
    `temDeckValido` para o jogo (cartas que cumprem as obrigatórias, por `Flair3dDeck.faltam`), `temAvatar3d`. Respeita
    conta privada (só quem a pessoa segue com aceite, a mesma regra de `ChallengeService.java:320-325`) e idade 13+.
  - `Flair3dConvite` (entidade + repositório ≤ 120 linhas) e migration **nova** `V1xx__flair3d_convites.sql`
    (id, jogo, rodada, semente, de, para, estado CONVIDADO/ACEITO/RECUSADO/EXPIRADO/JOGANDO/FECHADO, modo, prazo,
    partida_de, partida_para). Versionada; aplicada pelo pipeline, nunca à mão.
  - `Flair3dSala` (Strategy por modo): **ASSINCRONO_SEMENTE** (os dois jogam a mesma semente e rodada; compara-se o
    resultado do servidor — serve a 13 dos 16), **TURNOS** (Dress Fighter: o lance da oponente passa a vir do
    acionamento da outra pessoa; Fashion Sports: a mão rival é a da outra pessoa; Batalha: as 3 rodadas lado a lado),
    **COOP** (Fashion Detective: dois detetives, pistas compartilhadas; Super-Herói: dupla).
  - Notificação `NotificationType.FLAIR3D_CONVITE` / `FLAIR3D_VEZ` / `FLAIR3D_RESULTADO` por `NotificationService.notify`.
  - Controller novo `Flair3dMultiController`: `GET /api/flair/3d/adversarios`, `POST /api/flair/3d/convites`,
    `POST .../{id}/aceitar|recusar|cancelar`, `GET /api/flair/3d/convites` (caixa), `GET .../{id}` (estado da sala,
    polling de 2 s nos turnos; SSE é opcional numa segunda etapa).
  - Revanche (novo convite com a semente seguinte) e ranking semanal por jogo (das partidas de sala fechadas).
- Tela, pasta nova `components/flair/multi/`: `buscar-adversario.tsx` (campo de busca + chips de filtro + lista com
  avatar, nível, estilo, "tem deck para este jogo"), `convites.tsx` (caixa de entrada no hub FLAIR), `sala-espera.tsx`,
  `resultado-duelo.tsx` (os dois looks e as duas notas lado a lado), hooks `use-convite.ts`, `use-sala.ts` (≤ 150).
  Entrada "Jogar contra alguém" na escolha de rodada (`nucleo-rounds.tsx`, registrado pelo ponto de extensão da P0).
- **Reuso fora do 3D:** o mesmo `buscar-adversario` substitui o campo de tag do duelo 2D (`classic-modes.tsx:92`, a
  chamada vira `userId`) e os IDs por vírgula do desafio (`challenge-start-dialog.tsx:62`). O duelo 2D continua em
  `FlairService` sem crescer: o controller converte `userId` → username antes (ou um método novo num serviço auxiliar).

**Entregas mensuráveis.** (1) Busca devolve só pessoas permitidas (teste com bloqueado, privada, menor de 13, a si
mesma). (2) Convite → notificação → aceite → as duas partidas com a mesma semente → resultado para os dois (teste de
serviço e de tela). (3) Dress Fighter e Batalha jogáveis por turnos entre duas contas na bancada de tela. (4) Detective
co-op com pistas compartilhadas. (5) Nenhum campo de tag digitada em FLAIR 2D e 3D. GoF: Strategy de sala, Observer de
notificação → `docs/refactoring/gof/`.

**Projeção:** Multi 0,6 → 8,2–8,8 (TURNOS nos 3 de confronto e COOP nos 2 cooperativos chegam a 8,5+; os assíncronos
precisam do resultado lado a lado e da revanche para passar de 8).

### A2 · Efeitos das cartas no cenário

**Problema (T2).** Efeito = luz + anel no piso, 6 por jogo, cosmético.

**Desenho.** `lib/flair/nucleos/efeitos/` (catálogo puro) + `components/flair/nucleos/efeitos/` (render):
- Catálogo `efeito = f(jogo, família de cor, raridade, Aura, categoria da peça)`: 3 camadas — **ambiente** (luz,
  névoa, cor do céu, telão), **objeto** (prop que aparece/abre/acende: pétalas, confete, holofote que segue, porta que
  abre, cone que cai), **gente** (NPC que reage pelo papel). Raridade muda a intensidade (Bronze 1 camada, Prata 2,
  Ouro 3, Especial = efeito exclusivo + câmera).
- VFX: sistema de partículas instanciado (um `InstancedMesh` por emissor, orçamento por sala em
  `scene/orcamento-da-cena.ts`), decal no piso com a cor/estampa da peça, rastro, onda de choque, câmera lenta curta.
- **Estado na cena, não só flash:** o servidor já devolve o efeito por carta (`Flair3dEfeitosDaCarta`); acrescentar ao
  efeito um `estado` que persiste (passarela acesa até o fim, gaveta aberta, cone caído), lido pela cena.
- Substitui `sequences-color.ts`; respeita "reduzir movimento".

**Entregas.** ≥ 18 efeitos por jogo (6 famílias × 3 raridades) nos 11 jogos de cartas + 6 por jogo de zonas (B5) +
MAKE UP (B6); captura de cada efeito na bancada; teste de orçamento (triângulos e chamadas) por sala.
**Projeção:** Efeito cena 3,0 → 8,2; puxa FX e Carta.

### A3 · Personagens

- Protagonista: trocar o manequim sem rosto por **modelo da casa estilizada FashionAI** (rosto, cabelo, 3 tons de
  pele, 2 corpos), gerada pelo motor (`scripts/blender3d/receitas/gente.py` + nova receita de cabeça/cabelo); com avatar
  3D do perfil, mantém o avatar. Mesmo estilo dos figurantes (fim do contraste manequim × humano).
- Elenco nomeado por jogo em `lib/flair/nucleos/elenco/` (dados + falas i18n): rival recorrente (Passarela, Batalha,
  Dress Fighter, Sports), cliente recorrente (Boutique), diretor e coestrela (Filme), fotógrafa (Road to Glory),
  guardiã (Labirinto), guia por cidade (Around the World), vilão (Super-Herói), banda (Singer), técnico (Clube), chefe de
  equipe (Piloto). Balões de fala curtos nos momentos-chave (abertura, virada, final).
- Correções: pose sentada sobre degrau (offset por assento; captura `clube_coracao-uso-2-deixa.png`), pés deslizando.
**Entregas.** 16 elencos com ≥ 3 personagens nomeados; teste de pose (assento × altura do degrau); capturas.
**Projeção:** Pers 4,0 → 8,2; Gráf pers 4,0 → 8,0–8,4 (depende de A4).

### A4 · Cenários, roupas e gente pelo motor Blender

- Executar `PLANO_MOTOR_BLENDER.md` até o fim: as 6 capacidades que faltam ao motor (seção 2 do plano), depois os
  22 objetos e 26 arquiteturas que faltam; portar a sala do Detective (`components/flair/detetive/sala-3d.tsx`) e o
  estádio/quadras (`components/flair/esporte/*-3d.tsx`) para o motor.
- Pós-processo comum (bloom leve, SSAO, tonemapping, luz assada em lightmap gerada no Blender para salas fixas) com
  degradação em aparelho fraco (`scene/qualidade.ts`).
- **Roupas:** peças das cartas sem GLB recebem malha pelo `services/garment_blender` (ficha técnica → `.glb` por
  tamanho, sem custo), para que o 3D vista a peça com forma e não só a cor.
- Identidade por lugar: marcos de cada cidade do Around the World, pista do Piloto, jardim do Labirinto, terraço com
  caixa d'água/antena (já começado na `zonas-nota8`).
- GPU (RunPod) só para renderizar previews e os clipes da A7; registrar provedor, tempo e custo.
**Entregas.** Manifesto cobrindo 88/88 tipos; capturas de cada sala antes/depois; orçamento por sala dentro do limite.
**Projeção:** Gráf 4,9 → 8,0–8,3 (o teto em navegador exige estilização coesa, não realismo).

### A5 · Campanha e dificuldade

- `Flair3dCampanha.EM_SEQUENCIA` para todos (incluir Road to Glory, zonas, Sports com trilha de liga); dificuldade por
  rodada como parâmetro da `Definicao` (notas da casa, janelas, agressividade da IA); chefe na última rodada com
  personagem da A3; **desafio diário** por jogo (semente do dia, igual para todos, ranking do dia — reaproveita o padrão
  do "deck da casa do dia" do FLAIR 2D).
**Entregas.** Teste de progressão por jogo; tela de campanha com chefe. **Projeção:** Single 4,9 → 8,2.

### A6 · Deck e cartas

- Papel tático por carta: custo de recurso ao jogar (fôlego/foco/energia por raridade), habilidade ativa por raridade
  (Ouro: repetir efeito; Especial: poder com recarga — Metamorfose da 8g), combos por categoria/marca, **selo que diz o
  valor da carta neste desafio** (fim do "vale conforme o pedido da vez" repetido; captura `8g/batalha_looks-b0-deck.png`).
- Aura nos 6 jogos de cartas que a 8g não cobre (estender `Flair3dAuraRegras.JOGOS` com a regra do gênero: Fighter =
  Metamorfose como contra-golpe; Sports = Hype ≥ 80 já existe, unificar; Detective = Electro abre a janela do vigia).
- **Cartas nos jogos de zonas** (com B5): a peça do guarda-roupa vira tinta (cor), acabamento (raridade) e emblema
  (categoria acessório).
- **Cartas de beleza** para o MAKE UP e Road to Glory (com B6): produtos como cartas virtuais (não pagas) ganhas na
  carreira.
**Entregas.** Cada carta do deck com selo diferente quando o efeito difere; testes de custo e combo no servidor.
**Projeção:** Carta 4,1 → 8,2; Recursos 4,7 → 8,0+ (junto com B).

### A7 · Imagem e vídeo

- **Imagem:** a foto da peça (`pieceImageUrl`) como textura em telões, painéis de LED, vitrines, outdoor da cidade,
  caderno de pistas; no fim, **foto da partida** (render do canvas com o look, a moldura do jogo e a nota) salva como
  imagem e publicável como look/post no FashionAI (identidade).
- **Vídeo:** clipes curtos pré-renderizados no Blender (abertura de cada jogo, vitória/derrota, chefe) servidos como
  `.webm` em `VideoTexture` no telão ou em tela cheia; **replay** da jogada decisiva gravado do canvas
  (`MediaRecorder`, 5–8 s) e baixável.
- Peso: clipes ≤ 1,5 MB, carregamento preguiçoso, fallback para imagem com "reduzir movimento".
**Entregas.** 16 aberturas e 16 finais em vídeo; foto da partida e replay em todos; teste de fallback.
**Projeção:** FX img/víd 3,0 → 8,2; Ent e Identid +0,5–1,0.

## 3. Frentes por gênero

Cada B só cria arquivos nas pastas do próprio jogo (`nucleos/<Jogo>*.java`, `lib/flair/nucleos/<jogo>*.ts`,
`components/flair/nucleos/<jogo>/`, `scene/salas/<jogo>.ts`) e registra painel/efeito/elenco pelas APIs da A.

### B1 · Palco — Passarela, Dress the Star, Batalha de Looks, Road to Glory
- **Batalha = piloto da A1** (TURNOS: mesma rodada para os dois, voto da plateia; telão com os dois looks — A7).
- Passarela: desfile por segmentos com escolha de pose e tempo; 3 jurados com gostos sorteados; casa calibrada pela
  rodada (fim das notas 20–60 fixas, `PassarelaNucleo.java:52`).
- Dress the Star: entrevista com troca de carta com custo; estrela nomeada com reviravolta.
- Road to Glory: sessão de fotos real (enquadrar, luz, momento) que gera a foto (A7); deck com cartas de beleza (A6).
- Entregas: cada um com ≥ 2 decisões táticas pós-entrega medidas em teste; derrota possível; capturas.

### B2 · Arena — Dress Fighter, Fashion Sports
- Fighter: fôlego por golpe, vida máxima pelo look, descarte até o round seguinte, torneio de 4 lutadoras nomeadas +
  chefe; TURNOS com pessoa (A1).
- Sports: HUD de fôlego/embalo/goleiro pronto, descarte com custo, liga com 5 times nomeados, partida por turnos e 2×2
  usando as Equipes FLAIR 2D (A1), replay em vídeo do gol (A7).

### B3 · Exploração — Fashion Detective, Labirinto, Around the World
- Detective: culpado sorteado entre 3 (pistas decisivas parametrizadas, textos nos 3 idiomas), ✕ contextual, COOP (A1),
  salas no motor (A4).
- Labirinto: labirinto andável gerado da semente (reusar `lib/flair/mundos`), portas-espelho por família, sombra que
  persegue, cartas que abrem atalhos (A2).
- Around the World: mapa com rotas e custo, clima sorteado que pede troca de peça, moedas para pular região, cartão-postal (A7).

### B4 · Serviço e set — Boutique 3D, Personagem de Filme
- Boutique: fila de clientes com humor e orçamento, arara/provador/balcão interagíveis, margem e reputação.
- Filme: 3 tomadas com enquadramento e marca; a tomada vira clipe (A7); diretor e coestrela (A3); "casting" multiplayer.

### B5 · Zonas — Clube, Singer, Piloto, Super-Herói (continua `claude/flair3d-zonas-nota8`)
- Cartas entram (A6); fase de uso vira mini-jogo do gênero: drible contra defensor e goleiro (Clube), show em ritmo com
  setlist (Singer), volta pilotada com traçado e frenagem (Piloto), missão com inimigos móveis e superpoder com
  recarga (Super-Herói).
- Lugares pelo motor (a branch já começou com caixa d'água, antena, caixas de retorno, bandeiras).

### B6 · MAKE UP
- **Correção imediata:** passar `maquiagem` para `MakeUpScene3D` e desenhar no rosto com `maquiagemNoRosto`
  (`makeup-scene-3d.tsx:15-45`; o núcleo Road to Glory já faz isso em `nucleo-scene-3d.tsx:92`).
- Maquiagem por camadas e ferramenta, luz do brief, 12 briefs com clientes nomeadas, cartas de beleza + roupa (A6),
  orçamento de produtos, capa de revista como imagem (A7), "mesmo brief" contra convidado (A1), rascunho no servidor.

## 4. Projeção por critério depois do plano (a conferir)

| Critério | Hoje | Depois | Frentes |
|---|---|---|---|
| Jogabilidade | 4,6 | 8,2 | A0, B1–B6, A6 |
| Entretenimento | 4,3 | 8,2 | A0, A1, A5, A7, B |
| Gráfico | 4,9 | 8,1 | A4, A0 |
| FX imagem/vídeo | 3,0 | 8,2 | A7, A2 |
| Criatividade | 5,4 | 8,3 | B (mini-jogos de gênero) |
| Multiplayer | 0,6 | 8,3 | A1 |
| Single player | 4,9 | 8,2 | A5 |
| Carta no deck | 4,1 | 8,2 | A6 |
| Efeito no cenário | 3,0 | 8,2 | A2 |
| Complexidade | 4,5 | 8,2 | A6, B |
| Personagens | 4,0 | 8,2 | A3 |
| Gráf. personagens | 4,0 | 8,1 | A3, A4 |
| Identidade | 5,6 | 8,4 | A7 (foto/post), A6 (Aura), A1 (rede FAI) |
| Recursos | 4,6 | 8,1 | A0 (roda no ✕), A6, B |
| Lógica | 5,6 | 8,3 | P0, B (testes de equilíbrio por simulação: ≥ 1000 partidas por jogo, como o Dress Fighter já mediu) |

Os maiores riscos: Gráfico e Gráfico dos personagens (teto do navegador — mitigar com estilização coesa e luz assada),
e o multiplayer por turnos (latência por polling; se necessário, SSE numa segunda etapa).

## 5. Como reauditar

Mesma rubrica, mesmas 16 linhas. Para cada jogo: uma partida inteira solo, uma partida com convite entre duas contas da
bancada, capturas em 1360×860 e 390×844, um clipe de 10 s; registrar fps numa máquina com GPU. Nota ≥ 8 só com
evidência na tela, não por teste.
