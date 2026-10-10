# Auditoria e correção do provador 3D — 2026-10-10

Escopo: ambiente da loja selecionada, manequim, assets de vestimenta, materiais, caimento e animação do provador 3D
(`/try-on`). Este documento registra o que foi encontrado, o que foi corrigido no código, o que foi medido e o que
continua como limitação. Evidências em `docs/provador/img/2026-10-10/`, métricas em `docs/provador/metricas/` e a
matriz completa em [`matriz-vestir-2026-10-10.md`](matriz-vestir-2026-10-10.md).

## 1. Que tecnologia executa o provador hoje

| Etapa | O que roda de verdade | Arquivo |
|---|---|---|
| Loja → ambiente | `resolveEnvironment` (cor/nome da marca) + **plano de loja** novo (`planStore`) | `lib/scene3d/store-plan.ts`, `components/three/fitting-room-scene.tsx` |
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
| A1 | Loja com nome/cor da marca, mas objetos incoerentes | O ambiente era montado por funções soltas (`NeonSign`, `Rail`, `Bench`, `ZoneFixtures`) sem plano: arara com blocos coloridos, letreiro neon, painel de **outra marca** ("Atelier Lumi") na loja Norte Sport | `/lab/scenes?s=fitting-brand` → `img/2026-10-10/antes/fitting-brand-front.png` | todo objeto tem função (exposição, organização, circulação, prova, comunicação, iluminação); nenhuma marca alheia numa loja de marca | corrigido → `depois/fitting-brand-front.png` |
| A2 | Imagens do catálogo aleatórias em pedestais | `ProductImage` desenhava a foto num plano flutuante (e espelhada no verso) sobre pedestais sem função | `antes/fitting-sneakers-*.png`, `antes/fitting-bags-*.png` | foto de catálogo só em suporte deliberado (quadro com moldura, prateleira, mesa, nicho); produto 3D só com asset 3D | corrigido: `PhotoPrint` (só frente, com moldura e passe-partout), prateleira de calçados 3×2, mesa de fotos, nicho de acessórios, quadro em cavalete |
| A3 | A roupa "tinge" a frente do manequim em vez de vestir | Três causas: (1) imagem externa sem CORS → a textura falhava e só a casca lisa `colorHex` aparecia; (2) o fallback `CapsuleMannequin` desenhava moldes de cor chapada; (3) `pointLight` na cor de destaque perto do avatar | provador com peça do catálogo externo; `antes/*` | a peça envolve o corpo em 360°; falha de foto vira estado ERRO, nunca casca pintada | corrigido (seção 4) |
| A4 | Jeans "colado" / camiseta acompanhando a cintura | Um molde só por subcategoria, sem classe de caimento; perna seguindo a panturrilha | matriz, `antes-*.png` | jeans reto do joelho para baixo; camiseta regular cai do busto | corrigido (seção 6) |
| A5 | Peças classificadas no molde errado | `kindOf`: `crossbody_bag` caía em regata (`is("body")`), saia-short, bermuda, macaquinho, colete e polo sem molde certo | `lib/tryon/garment-asset.test.ts` | cada subcategoria do acervo no molde da família certa | corrigido |
| A6 | Bota com os dedos marcados e ~5 % de interseção | A bota usava o molde do pé: a casca copiava cada dedo e, afastada pela folga, entrava no vão entre os dedos vizinhos (5,0–5,6 % em todas as poses, sempre no pé). Tênis e sapato já usavam a fôrma modelada | matriz (`03_calcados_11/12/14`) | bota com fôrma modelada como o tênis | corrigido: a bota ganha a mesma fôrma (bico, contraforte, sola) e o molde fica só no cano → 0 % em todos os corpos e poses |
| A7 | Saia e vestido atravessados pelas coxas no agachamento | O tubo da saia seguia só o quadril na frente: as coxas sobem a 70° e saem pela frente do tubo | matriz (`02_parte_inferior_12/14`, `05_corpo_inteiro_01`) | ≤ 6 % no agachamento | corrigido: o tubo divide o peso entre as duas coxas (frente e laterais mais que as costas) a partir da altura do quadril → saia 11,7 → 5,4 %, vestido 6,6 → 0,9 %, casaco 5,7 → 4,0 % (F-ref, agachamento) |

## 3. Ambiente da loja

`lib/scene3d/store-plan.ts` define o **perfil** da loja (`storeProfileFor`): nome, materiais (piso, parede,
expositores), iluminação e **fidelidade**:

- `documentada` — só quando existirem referências da marca (fotos, guia de loja). Hoje `REFERENCES = {}`: nenhuma marca
  tem referência cadastrada, então **toda loja é conceitual** e a página do provador diz isso ("ambiente conceitual").
- `conceitual` — loja neutra FashionAI com a cor e o nome da marca só na comunicação (parede da marca, faixa de luz).

`planStore(env, others, scene)` gera os expositores com **função** e **escala real** (`SCALE_RANGES`, verificadas em
teste): porta dos provadores 2,0–2,2 m, banco 0,42–0,50 m, mesa 0,72–0,92 m, espelho 1,7–2,2 m. Trocar de loja troca
todos os ids (nenhum objeto da loja anterior sobra). Painéis multimarca só aparecem quando a loja **não** é de uma
marca. O inventário publicado pela cena (`inventoryOf`) está em `img/2026-10-10/depois/inventario.json`:

| função | objetos |
|---|---|
| circulação | piso |
| organização | paredes, prateleiras de calçados |
| iluminação | teto, trilho de luz, luz de parede (wash na parede do fundo) |
| comunicação | parede da marca, faixa de luz, placa e quadros da zona, foto em destaque |
| prova | palco de prova, cabine com cortina, espelho, banco, porta dos provadores |
| exposição | mesa de fotos, nicho de acessórios, quadros (só fotos em suporte) |

Luz: a luz na cor de destaque perto do avatar foi removida; a cor da marca fica nas superfícies de comunicação, não
na roupa (comprovado na seção 7). Testes: `lib/scene3d/store-plan.test.ts` (5).

Capturas antes × depois das 6 cenas (frente e costas): `img/2026-10-10/antes/` e `img/2026-10-10/depois/`.

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

Correções que fecham o relato A3: catálogo usa a **imagem processada** do próprio FashionAI (`processedImageOf`, mesma
origem, sem CORS); peça com foto que falhou é trocada pela peça padrão da zona (`usable` em `human-outfit.tsx`); o
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
| F-ref | calça cargo (oversized) | barra/joelho · folga joelho | 0,84 · 0,62 cm | **1,03 · 2,89 cm** | 0,55 |
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
intactos). (teste em execução; o relatório de ΔE entra no próximo commit)

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

Resultado: das 736 linhas, **10 ficam acima da tolerância** (eram 62 na primeira medição do "depois", antes das correções de bota,
saia e axila):

| peças | corpo | pose | penetração | causa | decisão |
|---|---|---|---|---|---|
| 5 sobreposições (cardigã, blazer, jaqueta, corta-vento, quimono) | F-plus | exibição | 3,2 % | axila: no corpo plus o braço encosta no tronco mesmo a 22°; a manga fica entre os dois | limitação de LBS sem colisão; cai para ≤ 1,0 % com os braços erguidos |
| corta-vento | F-ref | exibição | 3,1 % | idem, folga oversized ×2 | idem |
| saia, saia-short | M-ref, M-slim | agachamento | 6,6 % | coxas longas sobem além do comprimento do tubo | 0,6 pt acima; sem simulação de tecido |
| bermuda | M-ref | agachamento | 6,2 % | virilha a 105° (colapso de LBS) | idem |

Antes das correções desta auditoria: bota 5,0–5,6 % em **todas** as poses (pé), saia 11,7–12,9 % e vestido 6,6–7,7 % no
agachamento, jaqueta 3,1–4,0 % e casaco 3,9 % na caminhada.

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
- As 10 linhas acima da tolerância da seção 8 (axila em corpo plus com sobreposição; saia e bermuda no agachamento em corpos masculinos).

Migração para Unreal (avaliação, não presunção): o caminho é exportar o corpo como **Skeletal Mesh** (já sai em GLB com
esqueleto, `export-glb.ts`), cada peça como Skeletal Mesh com **skin weights** próprios no mesmo esqueleto, **Physics
Asset** para colisão de cápsulas e **Chaos Cloth** (ou o Panel Cloth Editor) para saia, vestido e casaco. Pré-requisito
que falta hoje: malhas de vestimenta com UV e moldes por painel — exatamente o que `APPROVED_WEARABLES` passaria a
listar. O contrato da seção 4 é o mesmo lá: só muda quem preenche `asset`.

## 10. Arquivos

- Ambiente: `lib/scene3d/store-plan.ts` (+ teste), `components/three/store-fixtures.tsx`, `components/three/fitting-room-scene.tsx`.
- Vestimenta: `lib/tryon/garment-asset.ts` (+ teste), `lib/tryon/garment-status.ts`, `lib/tryon/acervo.ts`,
  `lib/avatar3d/human/{garment-fit,dress,garments,garment-relax,shoes}.ts`, `components/three/{human-outfit,human-avatar,mannequin}.tsx`.
- Métricas e evidências: `lib/avatar3d/human/{fit-metrics,fit-matrix}.ts` (+ testes), `lib/avatar3d/human/pose.ts`
  (`applyTestPose`), `components/three/scene-debug.tsx`, `components/lab/scenes-lab.tsx`, `scripts/tryon/*`.
- Página: `app/(site)/(app)/try-on/page.tsx` (estados, aviso de ambiente conceitual), i18n `tryOn.*`, `scene3d.provadores`.
