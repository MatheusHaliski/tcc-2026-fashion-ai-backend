# Auditoria e correção do provador 3D — 2026-10-10

Escopo: ambiente da loja selecionada, manequim, assets de vestimenta, materiais, caimento e animação do provador 3D
(`/try-on`). Este documento registra o que foi encontrado, o que foi corrigido no código, o que foi medido e o que
continua como limitação. Evidências em `docs/provador/img/2026-10-10/`, métricas em `docs/provador/metricas/` e a
matriz completa em [`matriz-vestir-2026-10-10.md`](matriz-vestir-2026-10-10.md).

> **Integração com trabalho paralelo.** Enquanto esta auditoria corria, a `main` recebeu uma reforma do mesmo
> ambiente (#213, estúdio conceitual) e outra sessão publicou a máscara da foto opaca e um contrato de dados
> (`lib/avatar3d/garment-contract.ts`). O merge ficou assim: o **ambiente é o da `main`** (o plano de loja desta
> auditoria, que resolvia o mesmo problema, foi retirado); **vestimenta, caimento, estados, bota, saia e métricas são
> desta auditoria**; a foto recortada vem antes da processada (outra sessão), com a processada como reserva quando a
> recortada não carrega no 3D. Os dois contratos convivem — o de estado na tela (`lib/tryon/garment-asset.ts`) e o de
> procedência dos dados (`lib/avatar3d/garment-contract.ts`); unificá-los é pendência registrada na seção 9.

## 1. Que tecnologia executa o provador hoje

| Etapa | O que roda de verdade | Arquivo |
|---|---|---|
| Loja → ambiente | `resolveEnvironment` (marca) → **estúdio conceitual** `resolveFittingStudio` (paleta, objetos com função, até 2 fotos de referência da mesma marca) | `lib/scene3d/fitting-studio.ts`, `components/three/fitting-room-scene.tsx` |
| Render | three.js + React Three Fiber no navegador (WebGL) | `components/three/*` |
| Manequim | corpo MakeHuman CC0 `fai-body-v1` (malha + esqueleto Mixamo), formas pelo corpo medido | `lib/avatar3d/human/{asset,compose,three-human}.ts` |
| Peça → asset | **molde estimado**: malha própria nascida da pele afastada pela folga ("casca do corpo"), com pesos de pele copiados do corpo; saia/vestido como tubo da cintura; tênis/sapato como fôrma modelada | `lib/avatar3d/human/{garments,garment-relax,dress,shoes}.ts` |
| Ajuste | molde da subcategoria + classe de caimento + comprimentos da taxonomia | `lib/avatar3d/human/garment-fit.ts` |
| Material | foto da frente projetada na frente; costas e laterais na cor do tecido medida na própria foto | `garments.ts` (`garmentTexture`, `fabricColor`) |
| Movimento | skinning linear (LBS) no esqueleto do corpo; sem simulação de tecido | `pose.ts`, `three-human.ts` |

**Unreal Engine não está no código.** Não há build, plugin, Pixel Streaming nem asset `.uasset`. A migração continua
planejada (seção 9) — nada do que segue depende dela.

**Classificação da vestimenta atual:** *malha independente* (SkinnedMesh própria, com geometria fechada em 360°),
gerada a partir do corpo — não é billboard, não é decalque na pele e não altera o material do corpo. É, porém, um
**molde estimado**: nenhuma peça tem malha de vestimenta aprovada (UV, rig e validação próprios). Com uma foto só, a
geometria real da peça (gola, bolsos, volume das costas) é insuficiente — isso fica registrado no estado da peça
(seção 5), não escondido.

## 2. Problemas relatados → causas comprovadas → casos reproduzíveis

| # | Relato | Causa encontrada | Caso reproduzível | Critério de aceite | Estado |
|---|---|---|---|---|---|
| A1 | Loja com nome/cor da marca, mas objetos incoerentes | O ambiente era montado por funções soltas (`NeonSign`, `Rail`, `Bench`, `ZoneFixtures`) sem plano: arara com blocos coloridos, letreiro neon, painel de **outra marca** ("Atelier Lumi") na loja Norte Sport | `/lab/scenes?s=fitting-brand` → `img/2026-10-10/antes/fitting-brand-front.webp` | todo objeto tem função; nenhuma marca alheia numa loja de marca | corrigido (estúdio da `main`, #213) → `depois/fitting-brand-front.webp` |
| A2 | Imagens do catálogo aleatórias em pedestais | `ProductImage` desenhava a foto num plano flutuante (e espelhada no verso) sobre pedestais sem função | `antes/fitting-sneakers-*.png`, `antes/fitting-bags-*.png` | foto de catálogo só em suporte deliberado; produto 3D só com asset 3D | corrigido: até 2 fotos de referência emolduradas na parede (`ReferenceGallery`), só da marca da loja |
| A3 | A roupa "tinge" a frente do manequim em vez de vestir | Três causas: (1) imagem externa sem CORS → a textura falhava e só a casca lisa `colorHex` aparecia; (2) o fallback `CapsuleMannequin` desenhava moldes de cor chapada; (3) `pointLight` na cor de destaque perto do avatar | provador com peça do catálogo externo; `antes/*` | a peça envolve o corpo em 360°; falha de foto vira estado ERRO, nunca casca pintada | corrigido (seção 4) |
| A4 | Jeans "colado" / camiseta acompanhando a cintura | Um molde só por subcategoria, sem classe de caimento; perna seguindo a panturrilha | matriz, `antes-*.png` | jeans reto do joelho para baixo; camiseta regular cai do busto | corrigido (seção 6) |
| A5 | Peças classificadas no molde errado | `kindOf`: `crossbody_bag` caía em regata (`is("body")`), saia-short, bermuda, macaquinho, colete e polo sem molde certo | `lib/tryon/garment-asset.test.ts` | cada subcategoria do acervo no molde da família certa | corrigido |
| A6 | Bota com os dedos marcados e ~5 % de interseção | A bota usava o molde do pé: a casca copiava cada dedo e, afastada pela folga, entrava no vão entre os dedos vizinhos (5,0–5,6 % em todas as poses, sempre no pé). Tênis e sapato já usavam a fôrma modelada | matriz (`03_calcados_11/12/14`) | bota com fôrma modelada como o tênis | corrigido: a bota ganha a mesma fôrma (bico, contraforte, sola) e o molde fica só no cano → 0 % em todos os corpos e poses |
| A8 | Camiseta/regata/camisa atravessadas pela barriga e pelas coxas no agachamento (após o merge) | A barra curta em tubo da `main` seguia só o osso do quadril | matriz, agachamento | ≤ 6 % | corrigido: herda quadril, coluna e coxa da pele mais próxima, coxas divididas de forma contínua pelo lado → camiseta 7,5 → 4,4 %, regata 9,4 → 4,0 % |
| A9 | Macacão e macaquinho sem pernas abaixo do quadril | A barra curta da `main` também pegava peças com perna (`hem` negativo) | matriz (`05_corpo_inteiro_02/03`) | pernas do molde preservadas | corrigido: barra curta só sem perna → 9,6 → 2,2 % / 1,6 % |
| A7 | Saia e vestido atravessados pelas coxas no agachamento | O tubo da saia seguia só o quadril na frente: as coxas sobem a 70° e saem pela frente do tubo | matriz (`02_parte_inferior_12/14`, `05_corpo_inteiro_01`) | ≤ 6 % no agachamento | corrigido: o tubo divide o peso entre as duas coxas (frente e laterais mais que as costas) a partir da altura do quadril → saia 11,7 → 5,4 %, vestido 6,6 → 0,9 %, casaco 5,7 → 4,0 % (F-ref, agachamento) |

## 3. Ambiente da loja

O ambiente é o **estúdio conceitual** da `main` (`lib/scene3d/fitting-studio.ts`, #213): paredes neutras, uma placa de
identidade da marca, espelho de corpo inteiro, banco e cabideiro em escala real e no máximo **duas fotos de
referência emolduradas**, sempre da própria marca (`resolveFittingStudio` filtra produtos de outras marcas; a loja
neutra aceita qualquer uma). A cor da marca entra só nas superfícies (parede, móveis); **toda a luz é neutra**
(branca), então a paleta da loja não muda a cor da roupa (medido na seção 7). Como nenhuma marca tem referência de
loja física cadastrada, a interpretação é sempre `CONCEPTUAL` e a tela diz "estúdio conceitual".

| objeto (`STUDIO_OBJECTS`) | função |
|---|---|
| shell (quatro paredes e piso; a parede virada para a câmera sai de cena) | circulação |
| identity (placa da marca) | comunicação |
| mirror (espelho de corpo inteiro, moldura de madeira e pés) | prova |
| bench (banco) | prova |
| rail (cabideiro, sem peças falsas) | organização |
| gallery (até 2 fotos emolduradas) | comunicação |
| door (porta fechada da cabine na parede da frente, gancho com cabide vazio) | circulação |
| wainscot (pintura em dois tons, meia-cana, rodapé e molduras em todas as paredes) | ambiência |
| hooks (cabideiro de três ganchos com cabides vazios) | organização |
| stool (banco estofado e pufe) | prova |
| art (quadro abstrato nas cores da marca, sem repetir foto do catálogo) | ambiência |
| rug (tapete sob o avatar, recebe a sombra) | prova |
| plant (planta no canto; fica fora em celular fraco) | ambiência |
| fixtures (placa luminosa "Provador" e spots do teto, só superfícies emissivas) | comunicação |

**Cabine fechada (2026-10-11).** A sala ganhou a quarta parede em z = +2,4 m (a entrada da cabine) e as laterais e o
teto foram aparados a [−1,9; 2,4]. Como a câmera fica fora da sala nas vistas de frente e de costas, a parede virada
para ela sai de cena por quadro (`useCutaway` em `components/three/fitting-cabin.tsx`, por ref, sem estado React): a da
frente só aparece com a câmera em z < 1,9 e a do fundo com a câmera em z > −1,2; móveis soltos (espelho, bancos,
planta, pufe) somem quando a linha câmera → avatar passa a menos de 0,35 m da sua esfera. A cor de destaque da marca
ficou só nos detalhes (debrum do banco, filete da placa); móveis grandes usam as chaves neutras novas da paleta
(`wood`, `hardware`, `trim`, `wainscot`, `fabric`). **Nenhuma luz foi acrescentada**: o calor dos spots é disco
emissivo no teto e véu de brilho na parede, e a parede da frente (que só recebe a luz de preenchimento) tem a cor por
vértice compensada — a medida de cor da seção 7 continua valendo. Os enfeites não projetam sombra, os materiais são
compartilhados, as geometrias são fundidas por material e tudo é descartado ao desmontar. O palco do `/try-on` ganhou
botões de girar 30°, aproximar/afastar e voltar à frente (`components/try-on/fitting-orbit-buttons.tsx`), suaves ou
instantâneos com "reduzir movimento". Laboratório: `/lab/scenes?s=fitting-bruma&view=back` (parede lilás clara com
destaque verde, o caso relatado).

Trocar de marca recria o estúdio (`key={env.key}`) e a galeria é resolvida de novo — nada da loja anterior fica.
Testes: `lib/scene3d/fitting-studio.test.ts`. O laboratório publica esse perfil como inventário
(`window.__sceneInventory`). Capturas: `img/2026-10-10/antes/` (o ambiente original, com painel de marca alheia e
fotos soltas) e `img/2026-10-10/depois/` (estúdio).

## 4. Arquitetura modular da vestimenta

Contrato por peça (`lib/tryon/garment-asset.ts`, `garmentContract`):

| responsabilidade | o que responde | origem |
|---|---|---|
| identidade | id, nome, categoria, subcategoria, família, variação | peça do catálogo/guarda-roupa |
| asset | `molde-estimado` \| `malha-aprovada` \| `nenhum`, UV, rig, aprovação | `APPROVED_WEARABLES` (vazio hoje) |
| compatibilidade | corpo alvo `fai-body-v1`, slot, restrições conhecidas | `KNOWN_LIMITS` |
| ajuste | molde, classe de caimento, folga (mm), camada | `garment-fit.ts` |
| movimento | skinning no esqueleto do corpo; colisão por folga entre camadas; simulação: nenhuma | `STRATEGIES` |
| aparência | frente = foto; costas/laterais = cor do tecido da foto (ou cor cadastrada) | `human-outfit.tsx` |
| validação | estado + motivo | abaixo |

Estratégia por **família** (nada de uma função única para camiseta, vestido, tênis e bolsa):

| família | construção | nunca pode perder | movimento | classes aceitas |
|---|---|---|---|---|
| superior | casca do corpo | gola, ombros, mangas, barra | skinning | justa, regular, oversized |
| sobreposição | casca do corpo (camada de fora) | abertura frontal, gola/lapela, mangas, barra, folga sobre a peça de baixo | skinning | regular, oversized, estruturada, fluida |
| inferior | casca do corpo / tubo | cós, quadril, entrepernas, joelhos, barra | skinning | justa, regular, oversized, fluida |
| peça inteira | tubo da cintura | decote, cintura, comprimento, volume da saia | skinning | justa, regular, fluida |
| calçado | fôrma do calçado | sola no chão, bico, contraforte, cano | skinning | regular |
| acessório | fixação | ponto de fixação, alças | fixo no osso | — |

Estados mostrados na página (`GarmentState` em `app/(site)/(app)/try-on/page.tsx`, i18n `tryOn.*`):

| estado | quando | motivo |
|---|---|---|
| APROVADA | id em `APPROVED_WEARABLES` | `malha_aprovada` |
| ESTIMADA | molde estimado com a foto (ou cor cadastrada, sem foto) | `molde_estimado_foto_frontal` / `sem_foto_cor_cadastrada` |
| PROCESSANDO | foto ainda carregando no navegador | `carregando_foto` |
| SEM_3D | acessório (sem molde no corpo) | `acessorio_sem_molde_3d` |
| ERRO | a foto não pôde ser usada no 3D | `foto_indisponivel_no_3d` — a zona volta para a peça padrão; **nunca** casca pintada |

O status sai do Canvas por um store de módulo (`lib/tryon/garment-status.ts`, `useSyncExternalStore`), porque o
Canvas do R3F não herda o contexto React da página. Só ids e estados trafegam — nenhuma imagem ou medida.

Correções que fecham o relato A3: a peça tenta primeiro a foto recortada e, se ela não carregar no 3D (imagem externa
sem CORS), usa a **imagem processada** do próprio FashionAI (`processedImageOf`, mesma origem); a foto opaca tem o
fundo separado por cor (máscara da outra sessão); peça com foto que falhou é trocada pela peça padrão da zona (`usable` em `human-outfit.tsx`); o
`CapsuleMannequin` não é mais usado no provador (`fallback={null}`; o corpo mostra "carregando"/"erro" na página).

## 5. A roupa envolve o manequim (prova 3D)

Para cada caso abaixo há giro de 360° (8 ângulos), wireframe, corpo oculto, pesos por osso, poses e 16 quadros de
caminhada — tudo em `img/2026-10-10/vestir/<caso>/`. "Corpo oculto" de perfil e de costas é a prova direta de que a
peça é uma malha fechada, não pintura na frente do corpo.

| caso | peças do acervo | corpo |
|---|---|---|
| camiseta-jeans | `01_parte_superior_01_camiseta_referencia`, `02_parte_inferior_01_jeans`, `03_calcados_01_tenis_casual` | F-ref |
| camisa-chino | `01_parte_superior_02_shirt_camisa`, `02_parte_inferior_05_calca_chino`, `03_calcados_09_oxford` | M-ref |
| vestido-bota | `05_corpo_inteiro_01_vestido`, `03_calcados_11_bota_cano_curto` | F-ref |
| jaqueta-shorts | `01_parte_superior_14_jacket_jaqueta`, `02_parte_inferior_13_shorts`, `03_calcados_02_tenis_corrida` | M-slim |
| moletom-saia | `01_parte_superior_10_hoodie_moletom_com_capuz`, `02_parte_inferior_12_saia`, `03_calcados_17_sapatilha` | F-plus |

Animações: (em captura; os GIFs de caminhada e giro entram no próximo commit)

Modos de depuração no laboratório (`/lab/scenes?pieces=…&body=…&debug=wire|sem-corpo|pesos&pose=…&yaw=…&close=1`,
`components/three/scene-debug.tsx`).

## 6. Silhueta, caimento e folga

Unidades: metros no espaço do corpo, pés em y = 0, frente +z, esqueleto Mixamo; o tamanho é o do corpo medido (não
há grade de tamanhos). **O corpo da pessoa nunca é alterado para a roupa caber** — só a roupa muda.

Causas do "estufado" e do "colado": um molde por subcategoria com folga fixa; a perna seguia o contorno da
panturrilha; o tronco seguia a cintura. Correção (`garment-fit.ts`): classe de caimento pela **variação** da taxonomia
(SKINNY/SLIM… → justa; REGULAR/STRAIGHT/BOOTCUT → regular; LOOSE/BAGGY/OVERSIZED → oversized; WIDE_LEG/FLARE → fluida;
blazer/casaco/colete → estruturada) e comprimentos pelas dimensões `LENGTH`, `SLEEVE_LENGTH`, `SHAFT_HEIGHT`.

| classe | folga | queda | perna |
|---|---|---|---|
| justa | ×0,7 | acompanha o corpo (busto 0,93) | sem coluna |
| regular | ×1,25 nas pernas | cai reta do busto (0,985) | reta do joelho para baixo |
| oversized | ×2 | 1,03; manga +6 cm de ombro caído; barra mais baixa | coluna larga |
| estruturada | ×1,15 | reta (1,0) | coluna |
| fluida | ×1,2, barra +50 % | solta | coluna larga |

Perna em coluna (`columnLegs` em `garment-relax.ts`): abaixo do joelho a perna da calça segue o anel do joelho (não a
panturrilha), só para fora, sem cruzar o meio.

Resultado medido (F-ref e M-ref, `vestir-antes` × `vestir-depois`): 

| corpo | peça | medida | antes | depois | corpo nu |
|---|---|---|---|---|---|
| F-ref | jeans (`02_parte_inferior_01_jeans`) | barra/joelho | 0,84 | **0,93** (reta) | 0,55 |
| F-ref | jeans | folga coxa / joelho / panturrilha | 0,49 / 0,62 / 1,07 cm | **1,26 / 1,79 / 2,25 cm** | — |
| M-ref | jeans | barra/joelho | 0,88 | **0,92** | 0,59 |
| F-ref | calça cargo (construção cargo da `main` + classe oversized) | barra/joelho · folga joelho | 0,84 · 0,62 cm | **1,03 · 5,03 cm** | 0,55 |
| F-ref | camiseta de referência (regular) | cintura/busto | 0,98 | **0,99** (cai do busto) | 0,94 |
| F-ref | moletom (oversized) | cintura/busto · folga cintura | 0,97 · 1,84 cm | **1,05 · 3,62 cm** | 0,93 |
| M-ref | moletom com capuz | cintura/busto · folga peito | 1,02 · 1,56 cm | **1,11 · 2,76 cm** | 1,01 |

Antes, o jeans seguia a panturrilha (casca colada, folga < 1 cm) e o moletom "oversized" tinha a mesma folga de uma
camiseta. Depois, cada classe tem silhueta própria e mensurável.

**Visualização plausível ≠ recomendação de tamanho.** O provador mostra como a modelagem declarada cai num corpo
com as medidas do avatar; ele não diz se o tamanho M serve — não existe grade de medidas por peça.

## 7. Cor, textura e estampa

Caminho da cor: foto processada da peça → textura sRGB na frente → `fabricColor` (cor dominante do tecido na própria
foto) nas costas/laterais → material físico (sem `color` multiplicador da loja) → luzes neutras da loja. A paleta do
ambiente não entra no material da peça.

Teste (`scripts/tryon/capture-colors.mjs` + `color-report.py`): a mesma camiseta trocada na mesma cena, sem recarregar,
vermelha → branca → preta → estampada → vermelha, sob luz de dia, de loja e de noite, na loja neutra e na loja com cor de
destaque. Fixtures em `public/lab/cores/` (a camiseta de referência do acervo recolorida; gola, punhos e selo
intactos). Relatório completo: [`cores-2026-10-10.md`](cores-2026-10-10.md).

| medida | resultado | leitura |
|---|---|---|
| herança entre peças (1ª × 5ª vermelha, mesma cena) | **ΔE ≤ 0,38** nas 6 combinações loja × luz | a peça anterior não deixa cor na seguinte |
| tingimento pelo ambiente, cores lisas (loja da marca × neutra) | **ΔE ≤ 0,80** | a cor de destaque da loja não entra no material |
| branco na loja da marca | **C\* 2,0–2,6** | continua branco (neutro), não puxa para a cor da marca |
| estampada, ambiente | ΔE 0,8 / 2,0 / 6,7 (dia / loja / noite) | a caixa do peito pega trechos diferentes da estampa conforme o tecido balança; nas lisas não aparece |
| foto × render (loja neutra) | ΔE 2–23 | sombreamento da luz da cena sobre a foto (o preto aparece `#595859` de dia): é iluminação, igual em todas as lojas, não troca de cor |

**Defeito achado por este teste e corrigido.** Na primeira rodada só a vermelha vestia; branca, preta e estampada
viravam a camiseta padrão azul. O filtro de pessoa lia parte da malha como "pele" (1,6 % a 2,9 % da imagem, sem
esqueleto, sem rosto, sem cabelo), recusava a foto e o provador caía na peça padrão. Agora, sem esqueleto, rosto ou
cabelo, "pele" abaixo de 5 % é ruído do segmentador (`lib/pieces/person-filter.ts`, com teste); `__lab.probe(url,
parte)` no laboratório mostra por que uma foto não vira textura. Na mesma rodada: a troca de look mostrava a peça nova
na cor lisa do tecido enquanto a foto carregava; agora o look anterior fica até as fotos do novo ficarem prontas
(`HumanOutfit`).

## 8. Matriz, métricas e tolerâncias

Inventário: 46 peças vestíveis do acervo (`lib/tryon/acervo.ts`) + 22 acessórios sem molde 3D (`ACERVO_SEM_3D`, estado
SEM_3D). Matriz: 46 peças × 4 corpos (F-ref, M-ref, F-plus 1,66 m build +1,4, M-slim 1,82 m build −0,8) × 4 poses
(exibição, braços, caminhada, agachamento) = 736 linhas, cada uma com ID → molde → corpo → pose → resultado → defeito →
correção → evidência ([matriz](matriz-vestir-2026-10-10.md)). Harness: `lib/avatar3d/human/fit-matrix.ts`
(o mesmo `buildGarment` do provador, skinning na CPU), métricas em `fit-metrics.ts`:

- **penetração**: fração dos vértices opacos da peça > 2 mm dentro da pele, na pose, por grupo do corpo;
- **folga** por região (média e p95, cm);
- **silhueta**: cintura/busto, joelho/coxa, barra/joelho, folga da panturrilha.

Tolerâncias de penetração e por quê: exibição 3 % (contato de axila e dobra do cotovelo, invisível de frente),
braços 1,5 % (a pose abre a axila: o que sobra é defeito real), caminhada 3,5 % (LBS no quadril), agachamento 6 %
(LBS colapsa joelho e virilha a 105°; sem simulação de tecido). Teste de aceite (`fit-matrix.test.ts`) roda um subconjunto
em todo `vitest`.

Resultado (código mesclado): das 736 linhas, **6 ficam acima da tolerância**:

| peças | corpo | pose | penetração | causa | decisão |
|---|---|---|---|---|---|
| saia, saia-short | M-ref, M-slim | agachamento | 6,6 % | coxas longas sobem além do comprimento do tubo | 0,6 pt acima; sem simulação de tecido |
| calça (uma) | F-plus | agachamento | 6,4 % | virilha a 105° com coxa volumosa (colapso de LBS) | idem |
| bermuda | M-ref | agachamento | 6,2 % | virilha a 105° | idem |

Histórico do que foi corrigido nesta auditoria: bota 5,0–5,6 % em **todas** as poses (pé) → 0 %; saia 11,7–12,9 % e
vestido 6,6–7,7 % no agachamento → ≤ 6,6 % / ≤ 1 %; jaqueta 3,1–4,0 % e casaco 3,9 % na exibição/caminhada → ≤ 3 %;
depois do merge, blusas e macacões no agachamento (até 10,4 %) → ≤ 6 %.

Estabilidade: troca de peça reconstrói só a peça trocada; trocar de loja recria o plano (ids novos, nenhum objeto
herdado). Desempenho medido no harness (CPU, node): montar o look completo (corpo + peça + look padrão nas outras zonas) leva 63–127 ms; camiseta 1 943 vértices / 3 730 triângulos, jeans 1 517 / 2 941, vestido 3 693 / 7 120, casaco 5 347 / 10 417, bota (cano) 270 / 442.

## 9. Limitações que continuam (registradas, não escondidas)

- **Nenhuma malha aprovada**: toda peça é molde estimado com foto frontal; costas e laterais usam a cor do tecido.
- **Acessórios**: 22 do acervo sem molde 3D (bolsas, cintos, chapéus, joias, óculos, relógios) → SEM_3D.
- Sandália, chinelo e espadrille aparecem como **sapato fechado**; salto alto **sem salto modelado**.
- Conjunto (`matching_set`) vira peça única; jardineira **sem peitilho**; quimono **sem manga ampla**; saia-short sem o
  short por baixo.
- **Sem simulação de tecido**: o caimento é estático e o movimento é LBS (colapso de volume no agachamento).
- **Sem recomendação de tamanho**.
- As 6 linhas acima da tolerância da seção 8 (saia, bermuda e uma calça no agachamento).
- Dois contratos de vestimenta convivem (estado na tela × procedência dos dados): unificar num só.

Migração para Unreal (avaliação, não presunção): o caminho é exportar o corpo como **Skeletal Mesh** (já sai em GLB com
esqueleto, `export-glb.ts`), cada peça como Skeletal Mesh com **skin weights** próprios no mesmo esqueleto, **Physics
Asset** para colisão de cápsulas e **Chaos Cloth** (ou o Panel Cloth Editor) para saia, vestido e casaco. Pré-requisito
que falta hoje: malhas de vestimenta com UV e moldes por painel — exatamente o que `APPROVED_WEARABLES` passaria a
listar. O contrato da seção 4 é o mesmo lá: só muda quem preenche `asset`.

## 10. Arquivos

- Ambiente (da `main`): `lib/scene3d/fitting-studio.ts` (+ teste), `components/three/store-fixtures.tsx`, `components/three/fitting-room-scene.tsx` (com os ganchos de depuração desta auditoria).
- Vestimenta: `lib/tryon/garment-asset.ts` (+ teste), `lib/tryon/garment-status.ts`, `lib/tryon/acervo.ts`,
  `lib/avatar3d/human/{garment-fit,dress,garments,garment-relax,shoes}.ts`, `components/three/{human-outfit,human-avatar,mannequin}.tsx`.
- Métricas e evidências: `lib/avatar3d/human/{fit-metrics,fit-matrix}.ts` (+ testes), `lib/avatar3d/human/pose.ts`
  (`applyTestPose`), `components/three/scene-debug.tsx`, `components/lab/scenes-lab.tsx`, `scripts/tryon/*`.
- Página: `components/try-on/*` (estrutura da `main`); estado da peça em `components/try-on/garment-state.tsx` dentro de `fitting-items.tsx`; imagem processada, variação e atributos em `lib/tryon/fitting-room-model.ts`; i18n `tryOn.*`.

## 10. Peças do catálogo no provador (10/10, CATALOGO-3D)

Casos relatados com captura (busca → Provar): **T-Shirt Cropped listrada** (3D cinza liso, sem estampa), **T-Shirt
Decote V turquesa** (a calça branca da modelo entrou na camiseta; sem decote V), **Regata canelada com decote** ("entra
no corpo" na lateral, manchas brancas), **camisa xadrez de manga longa** (faixas lavadas em vez do xadrez, gola e botões
sem detalhe). As fotos reais (marca e modelo) ficaram só na área de rascunho; as evidências abaixo usam o acervo do
laboratório (marca fictícia, manequim padrão).

| sintoma | causa encontrada (`__lab.probe` / `__lab.texture`) | correção |
|---|---|---|
| listrada → cinza liso | a foto da modelo tem fundo de estúdio com molduras: o recorte pelos cantos falhava e a foto era recusada ANTES do filtro de pessoa; a zona caía na **peça padrão** (política "nunca casca pintada") sem o usuário perceber | `prepareOutfitPhoto`: sem recorte possível a foto inteira vai ao filtro de pessoa (a segmentação separa pessoa e cenário); sem pessoa, nada vira textura. Timeout de 45 s com uma repetição (a 1ª foto da sessão paga o carregamento do segmentador — na F-plus do laboratório a regata também caía na peça padrão por isso) |
| calça branca dentro da camiseta | a imagem processada no servidor traz o **look inteiro** (blusa + calça) já sem a pessoa; sem esqueleto o filtro não separava as peças; com esqueleto, o cinto/cós sobrava na faixa do quadril | `splitByHem`: barra pela mudança de cor (tudo acima × tudo abaixo do corte, não faixa local — estampa no peito não é barra), pelo vão/cobertura (restos finos da outra peça com a mesma estampa) e com o lado que fica uniforme perto do corte (gola/pala contrastante de camisa única NÃO decapita a camisa); cós/cinto que sobra sobe com o corte |
| sem decote V | o catálogo não traz atributos; o molde só tinha decote redondo raso | `necklineOf`: dimensão NECKLINE ou o nome ("Decote V", "V-neck", "gola alta", "canoa", "quadrado", "ombro a ombro", "decote"…) → `neckShape` (redondo/V/quadrado/canoa) + profundidade; `photoInfo.neckDrop` lê a profundidade na própria foto (topo no centro × topo nos ombros) e só aprofunda |
| regata "entra no corpo", manchas brancas | NÃO é caimento (F-plus justa e regular: ok de lado e em 3/4); são os vazios de oclusão da foto — onde o braço/mão da modelo cobria a peça a foto fica transparente e o molde vira buraco (corpo à mostra) ou cor lisa (mancha) | `fillInteriorHoles`: vazios internos recebem o tecido vizinho (ondas a partir da borda do buraco); a silhueta externa continua recortando; buracos > 45% da peça ficam |
| camisa: faixas lavadas, sem xadrez | para `shirt` a frente **nunca recebia a foto** (só o painel do tecido: repetição ou degradê por linhas); o degradê era tingido pela gola e pelos punhos (linhas inteiras) e as cores vinham de **medianas canal a canal** (azul + laranja ⇒ verde inexistente) | frente da camisa recebe a foto; `fabricRows` só do miolo das linhas e entre gola e barra; `medoid` (pixel real mais perto das medianas) em `fabricColor`, `trimColors`, `ribColor`, `fabricRows`; largura de referência da projeção perto da barra para manga longa (os punhos da foto não vão mais para o quadril) |
| gola, costura, botões sem detalhe | carcela lisa, 7 pontos escuros, gola só a faixa | `shirtPlacket`: carcela + **pesponto** nas duas bordas (cor da linha: escura em tecido claro, clara em tecido escuro), **botões** claros de 5 mm com aro escuro, **pontas da gola** deitadas no peito na cor da gola da foto (`ribColor` lê a gola inteira, sem a abertura escura) |

Evidências (laboratório, `img/2026-10-10/catalogo/`): `camisa-xadrez-e-lisa.webp` (fixture `public/lab/cores/camisa-xadrez.webp`,
a camisa do acervo com o corpo em xadrez — `scripts/tryon/make-plaid-fixture.py`; frente e 3/4; e a mesma lisa),
`decotes-camiseta.webp` (base · V · U · quadrado, `?neckline=`), `regata-f-plus-justa-e-regular.webp`,
`camisa-acervo-azul.webp`. Nas fotos reais (rascunho): a listrada passa a "pessoa encontrada, parte de cima mantida
(0,56 × 0,10)" e o recorte final é só a blusa; a turquesa fica sem cinto e sem calça.

Testes: `garment-photo.test.ts` (vazios internos, barra por cor/vão/restos, estampa no peito, gola contrastante, peça
única), `garment-photo-person.test.ts` (sem esqueleto segue com barra pela cor, fundo de estúdio vai ao filtro,
timeout com repetição), `garment-fit.test.ts` (decote pelo nome/atributo), `garments.test.ts` (formas do decote),
`photo-mask.test.ts` (profundidade do decote na foto), `shirt-placket.test.ts` (carcela, pesponto, botões com aro,
pontas da gola, foto na frente da camisa).

Limites: a repetição do xadrez nas mangas/costas depende de `fabricTile` achar o período — no fixture não achou (fica o
degradê de linhas do tecido); a peça padrão continua entrando quando a foto não serve (política), agora com menos casos;
`SCOOP` com a faixa da gola fica largo (vale como "decote U").
