# Pessoas

**Zonas do blueprint:** todas · **Arquivos da área:** `components/heist/people/*`, `lib/avatar3d/human/locomotion.ts` (e o que
o corpo humano usa em `lib/avatar3d/human/`), `lib/heist/looks.ts`; laboratório `/lab/heist-gente`

## O que o cenário pede das pessoas

| Pedido | O que construir | Estado |
| --- | --- | --- |
| Pista com convidados dançando de verdade | Dança no ritmo (≈ 120 BPM), com passos diferentes por pessoa (balanço, passo lateral, giro, braços), fase e intensidade variadas, pés plantados sem patinar, pares que se olham; para e olha quando há tiro ou alarme | VALIDADO (122 BPM, o andamento das luzes) |
| DJ tocando | Animação "dj": mãos no mixer e nos pratos, uma mão segurando o fone numa orelha de vez em quando, cabeça e ombros no ritmo; visual próprio (`dj`) e fone de ouvido (`headphones`) | VALIDADO (teste) · IMPLEMENTADO (captura) |
| Convidados comendo | Animação "eat": prato pequeno numa mão (`plate`), garfo ou doce na outra, levar à boca, mastigar | VALIDADO (teste) · IMPLEMENTADO (captura) |
| Garçons servindo | Bandeja estável na mão, taças individualizadas com líquido, oferecer e entregar | IMPLEMENTADO (oferecer; entregar a taça na mão de alguém fica para depois) |
| Chef e equipe da copa | Visual próprio (`chef`): dólmã branco, avental, touca | IMPLEMENTADO |
| Humanos reais | Pele, cabelo, olhos, roupas com volume, joias; nada de manequim | parcial (joias, sapato social, lenço, tecidos e vestidos acertados; cabelo da qualidade baixa e roupa colada à coxa continuam limites do corpo) |

## Regras

- Os nomes `dj`, `eat`, `plate`, `headphones`, `chef` já existem nos tipos (`lib/heist/types.ts`) e na locomoção; esta
  área troca os provisórios pela animação e pelos objetos de verdade.
- Desempenho: a multidão do salão pode passar de 60 pessoas; animação espaçada e nível de detalhe por distância.

## Estudo da área

O que as pessoas fazem numa gala desse tipo, o que cada gesto pede do corpo e dos objetos, e as medidas usadas.

**Pista de dança (house/disco de gala, 122 BPM, o mesmo andamento das luzes da pista em `salao-dj.ts`).** Numa pista
cheia quase ninguém se desloca: dança-se no lugar, com o corpo inteiro marcando a batida. Os passos mais comuns, todos
com o pé de apoio parado no chão:

| Passo | Como é | Medida usada |
| --- | --- | --- |
| Balanço | joelhos dobram na batida, o peso passa de um pé ao outro, o calcanhar do pé livre sobe | quadril desce 1,5–4,5 cm na batida |
| Passo e junta (step-touch) | um pé sai de lado (1), o outro junta (2), sai de volta (3), junta (4); o compasso seguinte vai para o outro lado | 13–22 cm |
| Passo à frente (rock step) | pé à frente (1), peso nele (2), volta (3), toque do outro pé (4) | 12–20 cm |
| Twist | os dois pés giram sobre a bola, para um lado e para o outro a cada batida; o quadril gira ao contrário | 16–28° |
| Giro | pivô na ponta de um pé (calcanhar sobe e o pé gira sobre a bola), o outro no ar, em 3 batidas | 360° em 1,5 s |

Os braços variam mais que os pés: dobrados à frente indo e vindo (o jeito mais comum), soco no ar chegando na batida,
mãos para o alto balançando no refrão, palmas no 2 e no 4, o "apontar" da disco, e, nos pares, as mãos à frente na
altura da cintura como quem segura as mãos do outro; a cabeça acena na batida. Cada pessoa tem dois passos preferidos,
uma intensidade e um atraso de poucos centésimos (ninguém é metrônomo). De vestido longo dança-se com o tronco e os
braços: passos menores, joelhos quase retos (a saia é um tubo preso às coxas: joelho muito dobrado faz a barra "chutar"
20 cm para a frente) e nada de passo à frente (o pé entraria na saia). Com tiro ou alarme a dança acaba: a simulação
troca o gesto para se proteger ou fugir (já existia).

**DJ.** Na cabine do Grande Salão (`salao-dj.ts`) o tampo está a 1,05 m e o equipamento por cima: superfície a ~1,16 m,
linha dos botões 0,55 m à frente dos pés do DJ, borda do mixer (crossfader) a 0,44 m, os dois players a ±0,62 m de lado.
A rotina real: as duas mãos no mixer quase o tempo todo (botões de EQ e filtro na esquerda, crossfader na direita); a
cada poucos compassos o corpo vai até um dos players (o quadril desloca uns 11 cm, o tronco gira e inclina) e a mão gira
o jog ou arranha no dobro da batida; a cada 4 compassos, por 2, uma mão segura a concha do fone na orelha com a cabeça
inclinada (pré-escuta da próxima música); de vez em quando uma mão sobe para a pista. Cabeça, ombros e joelhos marcam a
batida. Fone fechado de concha (Ø ~8 cm), arco sobre a cabeça, uma concha na orelha e a outra virada para trás; fora do
console, caído no pescoço. Visual: camiseta preta sob blazer de veludo bordô e tênis branco, ou macacão preto de crepe de
manga longa.

**Mesa de doces.** Prato de sobremesa de porcelana Ø 17 cm com filete dourado, garfo de sobremesa (~15 cm), fatia de bolo
de chocolate em camadas (~7 cm de raio, 5 cm de altura) com morango. Quem come segura o prato na mão esquerda à frente da
cintura, nivelado; a cada ~5 s corta, leva a garfada à boca (a cabeça vem ao encontro, os dentes do garfo chegam à boca)
e volta; depois mastiga (~1,7 Hz) olhando em volta. Na copa, com o prato na bancada, a mão direita arruma o doce.

**Garçons.** Bandeja redonda de prata (Ø 34 cm) na palma esquerda virada para cima, na altura do ombro e nivelada; a
bandeja não balança com o peito (só acompanha um terço do sobe e desce da passada). Cinco taças diferentes com líquido:
três flûtes de espumante, uma de tinto (bojo largo), uma de branco, e o guardanapo dobrado. Parados, oferecem: a bandeja
avança uns 13 cm e a mão direita, aberta, mostra as taças.

**Copa (chef e confeiteira).** Dólmã branco trespassado (duas fileiras de quatro botões de tecido, gola padre, manga
longa), avental da cintura ao joelho aberto atrás (preto do chef, branco da confeiteira), calça escura, sapato fechado e
a touca alta plissada (~25 cm; a touca alta é do chef por hierarquia e higiene), por cima da touca de malha.

**Convidados.** Vestidos longos de cetim sem alça ou ombro a ombro (o decote padrão do molde subia às costas e deixava
retalhos nos ombros sem manga), smoking com gravata-borboleta, camisa de colarinho fechado por dentro da calça, lenço de
bolso dobrado em pontas e sapato social polido (sola e cadarço na cor do couro); joias de verdade em cada convidada —
brincos (brilhante em gota, argola de ouro ou pérola) e colar na base do pescoço, do tamanho do pescoço de cada corpo.

**Realismo e desempenho com 60+ pessoas.** Cada aparência é montada uma vez e clonada (geometria, texturas e materiais
compartilhados, um esqueleto por pessoa); longe, a animação roda a cada 2–4 quadros e os detalhes de poucos pixels
(córnea, linha d'água, sobrancelha 3D, acabamentos de barra e punho, cadarço, ponto, gravata, botões) somem; sombra só de
quem está perto. Nada de material transmissivo nas taças e joias: com um só objeto transmissivo visível o three desenha
a cena inteira de novo a cada quadro (passo de transmissão); o vidro vem do verniz e do reflexo do ambiente. Os objetos
de mão são uma geometria por material (prato, doce, garfo e fone com cor por vértice: uma chamada de desenho cada; a
bandeja com cinco taças em seis).

## Implementado

Capturas em `/tmp/claude-0/-home-user-tcc-2026-fashion-ai-backend/7ee91c59-4fb9-5bee-a7c2-8abced5989af/scratchpad/gala/areas/pessoas/`
(laboratório `/lab/heist-gente?cam=…`, com `&t=` para parar o tempo num instante; `cam=pessoa&look=…&seed=…&anim=…` mostra
uma pessoa de cada aparência e gesto).

| Item | Onde (arquivo · função) | Captura | Estado |
| --- | --- | --- | --- |
| Dança no relógio comum (122 BPM, o das luzes da pista): balanço, passo e junta, passo à frente, twist e giro com pivô na bola do pé; braços em 6 estilos misturados por frase; intensidade, atraso e preferências pela semente; pés plantados | `lib/avatar3d/human/locomotion.ts` · `dance`, `footwork`, `armStyle`, `DANCE_BPM`, `danceBeat` | `pista-low.jpg`, `danca-gown-low.jpg`, `danca-gF1-low.jpg` | VALIDADO (teste: ponta do pé no chão andando > 0,25 m/s em menos de 1,5 % dos quadros; quadril mais baixo na batida para todos) |
| Vestido longo dançando: passos menores, joelhos quase retos, sem passo à frente (a barra não chuta) | `locomotion.ts` · `MotionInput.skirt`; `people.tsx` · `longSkirt` | `danca-gF1-low.jpg` | IMPLEMENTADO |
| DJ: duas mãos no mixer (botões e crossfader), vai aos players (quadril desloca, tronco gira e inclina, jog/arranhado), fone na orelha 2 compassos a cada 4, mão para a pista; cabeça, ombros e joelhos na batida; mãos na altura do equipamento da cabine do salão (`DJ_DESK`), compensando a altura da pessoa | `locomotion.ts` · `djPose`, `DJ_DESK`; `people.tsx` (`scale`) | `dj-low.jpg` | VALIDADO (teste: uma mão no console > 85 % do tempo, as duas > 35 %, fone na orelha > 10 %, players > 5 %) |
| Fone de DJ (arco por cima do cabelo, concha esquerda na orelha e a direita virada para trás) na cabeça enquanto toca e no pescoço fora do console | `components/heist/people/holds.ts` · `makeHeadphones`; `people.tsx` · `syncHold` | `dj-low.jpg` | IMPLEMENTADO |
| Visual do DJ: camiseta preta + blazer de veludo bordô + tênis branco; macacão preto de crepe de manga longa | `lib/heist/looks.ts` · `LOOKS.dj` | `dj-low.jpg` | IMPLEMENTADO |
| Comer: prato nivelado à frente da cintura, garfada a cada ~5 s (corta, leva à boca com a cabeça vindo ao encontro, volta), boca abre para o garfo e mastiga; andando, o garfo descansa no prato; na bancada (copa), a mão direita arruma o doce | `locomotion.ts` · `eat`, `eatPhase`, `interact`; `people.tsx` (boca) | `comer-low.jpg` | VALIDADO (teste: mão do garfo a < 26 cm da cabeça na garfada; prato varia < 4 cm) |
| Prato de sobremesa Ø 17 cm com filete dourado, fatia de bolo em camadas com morango, garfo de sobremesa | `holds.ts` · `geo.plate`, `geo.cake`, `geo.fork`, `makeFork` | `comer-low.jpg` | IMPLEMENTADO |
| Chef e confeiteira: dólmã trespassado (gola padre, duas fileiras de botões de tecido), avental aberto atrás, touca alta plissada do tamanho da cabeça | `looks.ts` · `chefWear`, `LOOKS.chef`; `fabric.ts` (avental); `people.tsx` · `addChefHat`; `holds.ts` · `makeToque`, `makeChefButtons` | `comer-low.jpg` | IMPLEMENTADO |
| Garçons: bandeja nivelada e firme (não balança com o peito), oferece parado (bandeja avança, mão aberta mostra as taças); cinco taças diferentes com líquido e guardanapo, seis chamadas de desenho | `locomotion.ts` · `serve`; `holds.ts` · `TRAY` | `pista-low.jpg`, `comer-low.jpg` | IMPLEMENTADO |
| Joias das convidadas (brincos e colar de brilhantes, ouro ou pérolas, colar do tamanho do pescoço) e lenço de bolso nos smokings | `looks.ts` (`jewel`, `pocket`); `people.tsx` · `addJewelry`, `frontOf`; `holds.ts` · `makeEarrings`, `makeNecklace`, `makePocketSquare` | `danca-gown-low.jpg`, `danca-gF1-low.jpg` | IMPLEMENTADO |
| Desempenho: detalhes de poucos pixels somem de longe; vidro e joias sem transmissão; objetos de mão numa geometria por material | `people.tsx` · `DETAIL`; `holds.ts` | `salao60-low.jpg` | IMPLEMENTADO |
| Laboratório: presets `pista`, `dj`, `comer`, `salao60`, `jogadora`, `pessoa`, tempo parado (`t`) e contagem de chamadas de desenho (`window.__heistGenteInfo`) | `components/lab/heist-gente-scene.tsx`, `heist-gente-lab.tsx` | — | IMPLEMENTADO |

Testes: `lib/avatar3d/human/locomotion.test.ts` (9, inclui dança, DJ e comer), `components/heist/people/fabric.test.ts` (2) e
`components/heist/people/holds.test.ts` (3: medidas e chamadas de desenho dos objetos).

Pendências e pedidos a outras áreas:
- **Grande Salão (`salao-dj.ts`)**: o tique das luzes usa o relógio do three (`state.clock`), e a dança usa o tempo da
  cena (`view.time`); para luz e passos baterem juntos, o tique pode usar `danceBeat(v.time)` de `locomotion.ts` (o
  andamento já é o mesmo: 122 BPM).
- O DJ espera o equipamento como na cabine atual (`DJ_DESK`: superfície a ~1,16 m, botões 0,55 m à frente dos pés,
  players a ±0,62 m); se a cabine mudar, basta ajustar `DJ_DESK`.
- Cabelo na qualidade "low" (casca, nível 3) fica cinzento e chapado; os vestidos longos seguem as coxas (tubo preso às
  pernas): numa dança muito aberta ainda aparecem dobras horizontais leves.
