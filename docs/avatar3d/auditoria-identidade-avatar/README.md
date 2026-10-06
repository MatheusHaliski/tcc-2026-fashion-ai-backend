# Auditoria do avatar 3D: identidade, fidelidade e proposta (AVATAR-ID-AUDIT)

**Data:** 2026-10-05. **Estado:** diagnóstico. O código do pipeline não foi alterado.

**Como foi medido.**

- **Fotos:** os 16 retratos de teste autorizados já usados em 27/09 (`docs/testes/dados/`). Um deles é recusado pelo
  próprio filtro de qualidade, e 15 seguem.
- **Pipeline:** cada foto passou pelo pipeline atual no navegador: MediaPipe, atlas, cabelo, sexo, corpo humano.
- **Renders:** o avatar foi renderizado de frente, 3/4 e perfil em `/lab/human`, com o mesmo `HumanAvatar` da produção.
- **Medições:**
  - semelhança: reconhecedores faciais independentes SFace e ArcFace (`scripts/avatar3d/eval-likeness.py`);
  - forma do rosto: o quanto sobrevive ao ajuste no corpo;
  - tom de pele: o quanto ele muda com a cor da luz.

**O que vai para o repositório:** só agregados, em
[`metricas-identidade-2026-10-05.json`](metricas-identidade-2026-10-05.json). Nenhuma foto, render de pessoa, forma de
rosto ou parâmetro individual. Os renders ficaram no ambiente de trabalho e não foram publicados.

---

## Resumo

1. **A pessoa ficou menos reconhecível no avatar atual do que no busto de setembro.**

   | Medida | Busto (27/09) | Avatar atual: frente | Avatar atual: 3/4 |
   |---|---|---|---|
   | SFace, mediana | 0,54 | 0,37 | 0,27 |
   | Acima do limiar "mesma pessoa" (0,363) | 14 de 15 | 8 de 15 | 2 de 15 |
   | A própria foto é a mais parecida (top-1) | 15 de 15 | 11 de 15 | 10 de 15 |

   O busto colava a foto na própria malha do MediaPipe. O avatar atual leva o rosto para o corpo MakeHuman, e é nessa
   passagem que a identidade se perde.
2. **Onde se perde (medido):**
   - **Forma do rosto:** o espaço de rostos do corpo tem 38 componentes e é **simétrico**:
     - só **42–76%** (mediana 64%) do que diferencia cada rosto do rosto médio sobrevive;
     - o resíduo vai de 1,7 a 3,4 mm (contorno da mandíbula até 5,2 mm; sobrancelhas até 4,5 mm);
     - a **assimetria medida (0,3–4,5 mm) vira 0,1 mm em 100% dos casos** (req. 5).
   - **Pele:** a cor é a mediana dos pixels **sem balanço de branco**:
     - corrigir a cor da luz desloca a estimativa em ΔE de 2 a 20 (mediana 6,5);
     - entre o tom medido e o renderizado há mais ΔE 12 (mediana);
     - aparece costura de cor entre rosto e pescoço.
   - **Olhos:** a mesma textura castanha para todos. Sem cor de íris, sem shader de olho, sem osso de olho.
   - **Cabelo:** classes grossas (5 comprimentos, 4 texturas, 4 volumes):
     - sem risca, linha do cabelo medida, mechas ou raiz;
     - dreads castanhos com mechas claras viram fios pretos;
     - coberturas de cabeça viram um "capacete" maior que o real.
   - **Barba e bigode:** sem geometria. A barba longa some (fica uma sombra no queixo).
   - **Orelhas, crânio e pescoço:** genéricos do MakeHuman (a malha do MediaPipe não cobre orelha nem crânio).
3. **Não existe um perfil de identidade:** nada guarda confiança ou origem por característica nem tem versão.
   Refazer o avatar **sobrescreve** a única linha do banco e apaga a textura anterior.
4. **O que já está certo e fica:**
   - análise no navegador (a foto não sai do aparelho);
   - consentimento obrigatório, exclusão e moderação da textura;
   - log de auditoria sem dado pessoal (só a contagem de fotos);
   - filtro de qualidade que pede outra foto;
   - até 3 vistas fundidas;
   - **nenhum embelezamento** (sem suavizar pele nem simetrizar na medição);
   - ajustes finos que não reconstroem o rosto (tom e corte do cabelo, volume, luz da pele).
5. **Proposta:**
   - um `CanonicalAvatarIdentity` versionado, com valor, confiança e origem em cada característica;
   - geometria em **topologia canônica**: o espaço de rostos atual mais uma **camada de resíduo assimétrico** dirigida
     pelos 468 pontos, o que preserva o rig e a troca de roupa;
   - pele com balanço de branco e mapas (base, normal, rugosidade, SSS);
   - olho com íris medida;
   - cabelo e barba como componentes desacoplados;
   - métricas de fidelidade e um gate de identidade (`NEEDS_REFINEMENT`).

---

## 1. Diagnóstico do pipeline atual

### 1.1 Componentes

| Item pedido | Onde está | Estado | Observação |
|---|---|---|---|
| Upload da foto | `components/avatar3d/my-avatar.tsx` (`Create`: foto do perfil ou envio), `pipeline.ts` (`loadOriented`, EXIF, ≤ 1600 px) | ok | Foto não sai do aparelho; só o modelo e o atlas vão ao servidor, com consentimento |
| Detecção facial | `detect.ts` (MediaPipe Face Landmarker, WASM) | ok | 1 rosto exigido; mais de 1 bloqueia |
| Landmarks | `detect.ts` (478 pontos + 52 blendshapes do MediaPipe) | ok | Blendshapes só usados no filtro (olho fechado, boca aberta) |
| Face mesh | `geometry.ts` (`fitView`, `frontalize`, `fuseShape`) | ok | Pose desfeita por semelhança; **não espelha** (assimetria medida preservada) |
| Reconstrução 3D | `human/compose.ts` (`fitFace`: 38 coeficientes, regularizados e limitados a ±3) | **perda** | Espaço simétrico e de baixa dimensão; `rmsMm` calculado e descartado |
| Busto | `components/three/avatar-bust.tsx` | legado | Ainda existe; as telas usam o corpo humano |
| Corpo | `human/compose.ts` (`fitBody`), `body.ts` (medidas da foto de corpo) | ok | Proporções por medida com origem (`observed/user/estimated/default`) |
| Textura facial | `atlas.ts` (atlas no UV canônico do MediaPipe, até 3 vistas, `evenSideLight`) → `human/skin-bake.ts` (`evenShading` + cópia por triângulo para o UV do MakeHuman) | **perda** | Luz de baixa frequência puxada para um único tom; pescoço e corpo com cor lisa; costura rosto↔pescoço |
| Cabelo | `hair.ts` (perfil), `hair-tone.ts` (CIELAB), `hair-cut.ts`, `human/hair-geometry.ts`, `hair-strands.ts`, `hair-lod.ts` | parcial | Silhueta por altura, comprimento, textura e volume em classes; sem risca, linha do cabelo medida, densidade × volume ou mechas |
| Materiais de pele | `three-human.ts` (`skinMaterial`: Physical com sheen, roughness 0,58) | básico | Sem normal map, microdetalhe, SSS nem mapa de rugosidade |
| Rig facial | — | **ausente** | Só o osso `Head`; sem mandíbula, olho ou pálpebra |
| Blend shapes / morph targets | corpo: 24 componentes; rosto: 38 (identidade) | parcial | Sem expressões (ARKit) |
| GLB/glTF | `human/export-glb.ts` | ok | Corpo, olhos, cabelo (cards), roupa, idle; exige avatar vestido |
| Meshy | `plano-meshy-corpo-por-prompt.md`, RF16 só para peças | n/a | Não usado no avatar |
| Blender / RunPod | só `markdowns/` | inexistente | — |
| Frontend de visualização | `my-avatar.tsx`, `mannequin.tsx` → `human-avatar.tsx` (provador, espelho, vitrines, passarela, Meu Quarto, Foto com meu manequim) | ok | Uma identidade para todas as telas |
| Armazenamento | `Avatar3dService` + `UserAvatar3d` (modelo JSON, ajustes, textura em `restricted/users/{id}/avatar3d/`) | ok | Consentimento com data; moderação da textura se público |
| Versões do avatar | `MODEL_VERSION = 1` (formato) | **ausente** | Uma linha por pessoa; refazer sobrescreve e apaga a textura anterior |

### 1.2 Fluxo e pontos de perda

| Etapa (pedido) | Hoje | Perda de identidade |
|---|---|---|
| PHOTO | arquivo/perfil → canvas em pé | — |
| PREPROCESSING | `checkPhoto` (rosto, resolução, enquadramento, pose, luz, nitidez, olhos/boca, oclusão) | baixa: pede outra foto quando ruim |
| FACE DETECTION | MediaPipe | — |
| FEATURE EXTRACTION | 468 pontos frontalizados; `faceMetrics` (7 medidas); pele (mediana em 13 pontos); cabelo (máscara + classes) | **média**: pele sem balanço de branco; cor dos olhos, sobrancelha, orelha, barba e linha do cabelo não são extraídas |
| 3D RECONSTRUCTION | `fitFace` no espaço de 38 componentes | **alta**: 24–58% da forma individual e 100% da assimetria |
| TEXTURE GENERATION | atlas → UV do MakeHuman com `evenShading` | **alta**: sombreamento achatado, costura no pescoço, olhos genéricos por cima |
| HAIR | perfil → base + fios | **média**: cor, textura e coberturas erradas em parte dos casos |
| BODY | `fitBody` por medidas | baixa |
| RIGGING | esqueleto Mixamo do corpo | — (sem rig facial) |
| VALIDATION | só o filtro de entrada | **ausente** depois da reconstrução |
| EXPORT | GLB | — |

---

## 2. Arquitetura nova

```
USER IMAGE(S) ─► ImageQualityGate ─► FaceAnalyzer ─► (landmarks, segmentação, olhos, sobrancelhas, orelhas, barba)
                                    │
                                    ├─► SkinAnalyzer (balanço de branco, tom/subtom, detalhes localizados)
                                    ├─► HairAnalyzer (silhueta, comprimento medido, curvatura, densidade, risca, linha, franja, cores)
                                    ▼
                         IdentityProfile {value, confidence, source}  ──►  CanonicalAvatarIdentity vN (versionado)
                                    │
     FaceReconstructor ─► FaceMorphFitter (espaço de identidade + resíduo assimétrico, topologia canônica)
     SkinMaterialBuilder (base, normal, rugosidade, SSS, máscaras de detalhe)  ·  EyeBuilder (íris, córnea, ossos)
     HairBuilder (silhueta → penteado → níveis HAIR-F2)  ·  FacialHairBuilder (cards de barba por região)
                                    │
                         AvatarAssembler (corpo canônico + cabeça + cabelo + barba + rig facial)
                                    │
                         IdentityValidator (reprojeção, silhueta, multiângulo, cor, embeddings, revisão) ──► APPROVED | NEEDS_REFINEMENT
                                    │
                         renderProfile (realistic · semiRealistic · stylized · fashionEditorial) — nunca muda a identidade
```

**Decisões:**

| # | Decisão |
|---|---|
| D1 | **Identidade ≠ estilo.** O `renderStyle` só troca materiais, iluminação e pós-processamento. A geometria e as cores intrínsecas vêm do `CanonicalAvatarIdentity` |
| D2 | **Topologia canônica.** Fica o corpo MakeHuman (rig, roupa, LOD). O rosto deixa de ser só os 38 coeficientes: entra uma **camada de resíduo** sobre os vértices da cabeça, por RBF a partir dos 468 pontos medidos, com regularização de suavidade. Ela guarda a assimetria e o que o espaço não alcança |
| D3 | **Textura por camadas:** albedo com a luz da foto removida (balanço de branco + remoção do sombreamento de baixa frequência pelo próprio relevo 3D, não "puxar para um tom"), normal de microdetalhe, rugosidade, máscaras de sardas, pintas e cicatrizes. O pescoço recebe a transição do rosto para o corpo |
| D4 | **Olhos e cabelo como componentes** (`EyeBuilder`, `HairBuilder`, `FacialHairBuilder`), presos à cabeça por âncoras. Trocar o cabelo não mexe no rosto (req. 40) |
| D5 | **Perfil com confiança** e **versão imutável aprovada.** A correção da pessoa cria uma versão nova localizada (req. 37–39) |
| D6 | **Validação obrigatória** depois da montagem (seção 16) |

---

## 3. Mapa dos componentes existentes

| Arquivo | Papel hoje | Na arquitetura nova |
|---|---|---|
| `lib/avatar3d/detect.ts` | MediaPipe (rosto, cabelo) | `FaceAnalyzer` (mantém) |
| `lib/avatar3d/geometry.ts` | frontalização, fusão de vistas, medidas | `FaceAnalyzer` + `FaceReconstructor` (mantém e amplia as medidas) |
| `lib/avatar3d/quality.ts` | filtro de entrada | `ImageQualityGate` (mantém; adiciona orientação de captura) |
| `lib/avatar3d/image-stats.ts` | pele, luz, nitidez, cabelo | `SkinAnalyzer` (troca: balanço de branco, subtom) e `HairAnalyzer` |
| `lib/avatar3d/hair*.ts` | perfil, tom e corte do cabelo | `HairAnalyzer`/`HairBuilder` (amplia o `HairProfile`) |
| `lib/avatar3d/atlas.ts`, `human/skin-bake.ts` | textura do rosto e da pele | `SkinMaterialBuilder` (troca o `evenShading`; adiciona mapas) |
| `lib/avatar3d/human/compose.ts` | corpo e rosto no MakeHuman | `FaceMorphFitter` (adiciona a camada de resíduo e devolve as métricas) |
| `lib/avatar3d/human/three-human.ts` | malha, olhos, esqueleto | `AvatarAssembler` + `EyeBuilder` (shader de olho, ossos) |
| `lib/avatar3d/model.ts` | `AvatarModel` v1 | `CanonicalAvatarIdentity` v2 (com migração do v1) |
| `lib/avatar3d/sex-detect.ts`, `body*.ts` | corpo base | ficam (corpo) |
| `Avatar3dService` + `UserAvatar3d` | um avatar por pessoa | `AvatarIdentityVersion` (histórico, aprovação) |
| `components/avatar3d/my-avatar.tsx` | criar, ajustar, excluir | revisão visual por característica (seção 11) |

---

## 4. `CanonicalAvatarIdentity`

```ts
export type Source = "IMAGE_ANALYSIS" | "MULTI_VIEW" | "USER_CONFIRMED" | "USER_EDITED" | "DEFAULT";
export interface Trait<T> { value: T; confidence: number; source: Source }   // confidence 0–1

export interface CanonicalAvatarIdentity {
  schema: 2;
  identityId: string;            // estável entre versões
  version: number;               // 1 = reconstrução inicial; cada correção ou reconstrução cria outra
  status: "DRAFT" | "NEEDS_REFINEMENT" | "APPROVED";
  createdAt: string; basedOn: number | null;   // versão anterior
  inputs: { views: { role: "FRONT" | "LEFT_45" | "RIGHT_45" | "LEFT_PROFILE" | "RIGHT_PROFILE"; quality: number }[] };
  face: FaceProfile; eyes: EyesProfile; skin: SkinProfile; hair: HairProfile; facialHair: FacialHairProfile | null;
  distinctiveFeatures: DistinctiveFeature[];
  body: BodyModel;                                // medidas com origem (já existe)
  geometry: { faceCoeffs: number[]; residualKey: string; topology: "fai-body-v1" };   // resíduo em arquivo próprio
  textures: { albedoKey: string; normalKey?: string; roughnessKey?: string; detailMaskKey?: string };
  quality: IdentityQualityReport;
}
export type RenderStyle = "realistic" | "semiRealistic" | "stylized" | "fashionEditorial";   // fora da identidade
```

---

## 5. Estrutura de dados do rosto

```ts
export interface FaceProfile {
  shapeClass: Trait<"OVAL" | "ROUND" | "SQUARE" | "RECTANGULAR" | "OBLONG" | "HEART" | "DIAMOND" | "TRIANGULAR">;
  proportions: Trait<{                         // cm na escala real do avatar
    faceWidth: number; faceHeight: number; foreheadWidth: number; cheekboneWidth: number; jawWidth: number;
    chinWidth: number; chinProjection: number; jawAngle: number; jawProjection: number; chinHeight: number;
  }>;
  nose: Trait<{ bridgeWidth: number; bridgeHeight: number; tipProjection: number; tipWidth: number; nostrilWidth: number; noseLength: number; noseRotation: number }>;
  mouth: Trait<{ mouthWidth: number; upperLipThickness: number; lowerLipThickness: number; cupidBow: number; lipProjection: number; mouthCornerAngle: number }>;
  brows: { left: Trait<Brow>; right: Trait<Brow> };   // thickness, curvature, length, density, orientation, color
  ears: { left: Trait<Ear> | null; right: Trait<Ear> | null };   // null + confidence LOW quando escondidas
  cranium: Trait<{ headWidth: number; headLength: number; headHeight: number; foreheadSlope: number }>;
  asymmetry: Trait<{ eye: number; brow: number; cheek: number; jaw: number; mouth: number }>;   // mm, lado E − lado D
}
```

**Regra:**

- a classe (`shapeClass`) é **derivada** das proporções, só para busca e rótulos;
- a malha usa as medidas;
- a assimetria só é simetrizada quando estiver dentro do ruído da reconstrução: abaixo do desvio entre vistas, ou
  abaixo de 0,5 mm com uma foto só.

---

## 6. Estrutura de dados dos olhos

```ts
export interface EyesProfile {
  left: Trait<Eye>; right: Trait<Eye>; spacing: Trait<number>;   // distância entre os cantos internos (mm)
}
interface Eye {
  shape: "ALMOND" | "ROUND" | "HOODED" | "MONOLID" | "DOWNTURNED" | "UPTURNED" | "DEEP_SET" | "PROTRUDING";
  width: number; height: number; tilt: number; upperLid: number; lowerLid: number; scleraVisibility: number;
  irisSize: number;
  irisColorClass: "DARK_BROWN" | "MEDIUM_BROWN" | "LIGHT_BROWN" | "HAZEL" | "AMBER" | "GREEN" | "GREEN_GRAY" | "GRAY" | "GRAY_BLUE" | "BLUE" | "BLUE_GRAY";
  irisBaseColor: string; irisSecondaryColor: string; irisPattern: "RADIAL" | "CRYPT" | "RING" | "UNIFORM";
}
```

**Medição da íris:**

- recorte das íris pelos 10 pontos do MediaPipe;
- descarta o reflexo especular (luminância acima do p95) e a pupila (anel interno);
- cor em CIELAB depois do **balanço de branco da esclera**;
- confiança baixa se o diâmetro da íris for menor que 18 px ou o olho estiver semicerrado;
- a classe é derivada da cor (ΔE para protótipos).

**Shader do olho:**

- esfera com **córnea** transparente (IOR 1,376, clearcoat) sobre a íris côncava, com parallax pela profundidade da
  câmara anterior;
- **íris** procedural (cor base, secundária e padrão);
- **pupila** e **esclera** com veias suaves e sombra da pálpebra (AO);
- **tear line** como faixa fina brilhante.

Os ossos `LeftEye`/`RightEye` ficam presos ao `Head`.

---

## 7. Estrutura da pele

```ts
export interface SkinProfile {
  baseTone: Trait<{ L: number; a: number; b: number }>;            // intrínseco (luz removida), CIELAB
  undertone: Trait<"COOL" | "NEUTRAL" | "WARM" | "OLIVE"> & { hueAngle: number };   // contínuo + classe
  melaninLevel: Trait<number>; rednessLevel: Trait<number>;
  roughness: number; specularity: number; subsurface: { radius: [number, number, number]; color: string };
  microNormal: { strength: number; poreScale: number };
  lightingEstimate: { whiteBalance: [number, number, number]; exposureEv: number; shadowContrast: number };   // da foto; não vai para a pele
}
```

**Luz removida antes de medir (req. 17):**

1. **Balanço de branco:** pela esclera e pelos dentes quando visíveis; senão gray-edge na foto inteira, com limite.
2. **Exposição:** pela luminância do rosto.
3. **Sombreamento:** separado do albedo por "intrinsic decomposition" simples. O relevo 3D já ajustado gera o
   sombreamento esperado sob uma luz estimada por harmônicos esféricos de ordem 2 nos pontos da pele. O albedo é
   foto ÷ sombreamento, com limite de ganho.

Isso substitui o `evenShading`, que puxava tudo para um único tom e apagava variações reais (vermelhidão, olheiras).

---

## 8. Estrutura do cabelo

```ts
export interface HairProfile {
  lengthClass: Trait<"BUZZ" | "VERY_SHORT" | "SHORT" | "MEDIUM" | "SHOULDER_LENGTH" | "LONG" | "VERY_LONG">;
  lengthCm: Trait<number>;                          // medido pela silhueta (relativo à cabeça e ao corpo)
  curlPattern: Trait<"STRAIGHT" | "WAVY" | "CURLY" | "COILY">;
  curlSubtype: Trait<"1A" | "1B" | "1C" | "2A" | "2B" | "2C" | "3A" | "3B" | "3C" | "4A" | "4B" | "4C"> | null;   // só com confiança
  density: Trait<number>; volume: Trait<number>; strandThickness: Trait<"FINE" | "MEDIUM" | "COARSE">;   // separados (req. 26)
  silhouette: Trait<number[]>;                       // meia-largura por altura (já existe: outline)
  hairline: Trait<{ height: number; templeShape: "ROUNDED" | "M_SHAPED" | "STRAIGHT"; widowsPeak: boolean; recession: number; frontContour: number[] }>;
  parting: Trait<{ kind: "CENTER" | "LEFT" | "RIGHT" | "NONE"; x: number }>;
  bangs: Trait<"NO_BANGS" | "STRAIGHT_BANGS" | "SIDE_BANGS" | "CURTAIN_BANGS" | "WISPY_BANGS">;
  colors: { base: Trait<string>; highlight: Trait<string> | null; root: Trait<string> | null; pattern: "UNIFORM" | "HIGHLIGHTS" | "OMBRE" | "BALAYAGE" | "COLORED" };
  covering: Trait<{ kind: "NONE" | "CAP" | "SCARF" | "TURBAN" | "HAT"; color: string }>;
}
export interface FacialHairProfile {
  type: Trait<"STUBBLE" | "SHORT_BEARD" | "FULL_BEARD" | "GOATEE" | "MOUSTACHE" | "VAN_DYKE" | "CHIN_STRAP">;
  lengthMm: Trait<number>; density: Trait<number>; coverageMask: string; color: Trait<string>;
}
```

---

## 9. Sistema de morph targets

**Espaço de identidade:**

- Os **38 componentes atuais** ficam como base: são populacionais e dão suavidade.
- Entram **morphs nomeados** como direções derivadas no mesmo espaço. Cada um é uma combinação linear dos componentes
  ajustada por regressão sobre as medidas da seção 5:

  | Grupo | Morphs nomeados |
  |---|---|
  | Cabeça | `HEAD_WIDTH`, `HEAD_HEIGHT`, `FOREHEAD_HEIGHT` |
  | Mandíbula e queixo | `CHEEKBONE_WIDTH`, `JAW_WIDTH`, `CHIN_WIDTH`, `CHIN_PROJECTION` |
  | Olhos | `EYE_WIDTH`, `EYE_HEIGHT`, `EYE_SPACING`, `EYE_TILT` |
  | Nariz | `NOSE_WIDTH`, `NOSE_LENGTH`, `NOSE_PROJECTION` |
  | Boca | `MOUTH_WIDTH`, `UPPER_LIP`, `LOWER_LIP` |

  Os valores são contínuos e servem para edição e explicação.
- **Camada de resíduo:**
  - deslocamento por vértice da cabeça, interpolado por RBF (thin-plate) a partir do erro em cada um dos 468 pontos
    depois do ajuste;
  - limite de 6 mm e suavização laplaciana fora das bordas de olhos e boca;
  - guarda a assimetria e o que o espaço não representa, e é salva por versão;
  - não muda a topologia: rig, roupa, LOD e GLB continuam iguais.
- **Expressões** (seção 14) ficam num conjunto separado de morphs, aplicadas *depois* da identidade.

---

## 10. Sistema de landmarks

| Camada | Pontos | Uso |
|---|---|---|
| Foto | 478 do MediaPipe (468 + 10 de íris), por vista, com visibilidade por ponto (normal × direção da câmera) | medição, reprojeção |
| Canônico | os 468 frontalizados e fundidos (`fuseShape`) | identidade |
| Corpo | os mesmos 468 na malha (`landmarksOn`, baricêntricas do exportador) | ajuste, resíduo, métrica |
| Âncoras | NECK_FRONT/BACK, TEMPLE_L/R, EAR_TOP_L/R, CHIN, NOSE_TIP… (derivadas) | cabelo, barba, óculos, gola (auditoria de roupas) |

**Reprojeção:** a câmera da foto é a semelhança já estimada (`sim`). Os 468 pontos do avatar são projetados com ela e
comparados aos da foto, por região (seção 15).

---

## 11. Sistema de confidence

**Valor de `confidence`:**

- regra por característica: visibilidade dos pontos, resolução da região, oclusão, concordância entre vistas;
- multiplicado pela qualidade da foto.

**Limiares:**

| Confiança | Efeito |
|---|---|
| < 0,4 | `source: DEFAULT` (neutro, sem inventar: orelhas escondidas, nuca) e marcada para a revisão |
| 0,4–0,7 | valor usado e pergunta leve na revisão |
| > 0,7 | valor usado sem pergunta |

**Revisão visual (req. 38):**

- até 5 cartões com a vista e duas ou três alternativas: "rosto está certo?", "cor dos olhos?", "cabelo?",
  "cor do cabelo?", "tom de pele?";
- a resposta vira `USER_CONFIRMED` ou `USER_EDITED` numa versão nova, que só atualiza aquela característica (req. 39).

**Uma foto só:** a confiança da profundidade (nariz, queixo, maçãs) é limitada a 0,6, e a tela sugere a foto de 3/4
(req. 35).

---

## 12. Detalhes individuais

| Nível | O que é | Representação |
|---|---|---|
| `MICRO_TEXTURE` | poros, espinha pequena, pelos finos | normal/roughness de detalhe (procedural + máscara) |
| `SURFACE_DETAIL` | sardas, pintas, manchas, olheiras, acne | albedo (máscara localizada) + normal suave |
| `GEOMETRIC_DETAIL` | cicatriz funda, ruga marcada, covinha | normal + deslocamento pequeno (≤ 1 mm), só com confiança alta |

**Detecção:** no albedo já sem a luz, por diferença local ao tom de pele (DoG). Cada achado vira
`DistinctiveFeature { kind, position(uv), orientation, length, width, color, relief, confidence }`.

**Limites:**

- a intensidade é a medida, sem exagero (cap = contraste observado);
- rugas estáticas no albedo e na normal; rugas de expressão nos morphs de expressão (seção 14);
- nenhum detalhe é removido automaticamente;
- a pessoa pode ocultar um detalhe na revisão (`USER_EDITED`), e o original continua na versão anterior.

---

## 13. Pipeline de cabelo

1. **Silhueta primeiro** (req. 64): a máscara de cabelo frontal (e lateral, se houver) dá meia-largura por altura,
   comprimento em cm, volume, linha do cabelo e franja (já existe parcialmente: `outline`, `fringe`).
2. **Risca e direção:** o tensor de estrutura da textura do cabelo (já calculado no perfil) mais um mínimo de
   densidade na faixa central.
3. **Curvatura:** frequência da textura ao longo do fio (já existe: straight…coily). O subtipo 1A–4C só sai com
   resolução suficiente.
4. **Cores:** base, mecha e raiz por clusters em CIELAB dentro da máscara, separando altura (raiz × pontas).
5. **Penteado:**
   - a biblioteca de penteados (fase 3 do plano de cabelo) é escolhida e deformada pela silhueta;
   - a malha usa o formato `HairGroom` e os níveis já entregues no HAIR-F2: cards no preview e no GLB, fios leves no
     padrão, fios densos em alta qualidade. O padrão continua sem dezenas de milhares de fios.
6. **Barba e bigode:**
   - máscara por região (buço, queixo, mandíbula, costeletas) na foto;
   - tipo, comprimento (pela borda que sai do contorno do rosto) e cor;
   - `FacialHairBuilder` com cards curtos presos às âncoras do rosto e textura de pelo;
   - a barba longa ganha volume abaixo do queixo.
7. **Coberturas** (lenço, boné): geometria própria com o tamanho medido, nunca maior que a silhueta da foto.

---

## 14. Rig facial

- **Ossos novos:** `Jaw`, `LeftEye`, `RightEye` e pálpebras (`LeftEyelidUpper/Lower`, `RightEyelid…`), filhos de `Head`.
  Os nomes ficam compatíveis com o Mixamo e o ARKit.
- **Blendshapes:**
  - os 52 do padrão ARKit (`eyeBlinkLeft`, `jawOpen`, `mouthSmileLeft`, `browInnerUp`…), gerados como deltas sobre a
    topologia canônica;
  - fonte: os alvos de expressão do MakeHuman (CC0, "face poseunits") retopologizados no exportador;
  - aplicados por cima da identidade (delta) e escalados pela geometria local, para não substituir o rosto da pessoa.
- **Rugas de expressão:** normal map ativado pelo peso do blendshape (`browInnerUp` → linhas da testa).
- **Boca:** dentes, gengiva e língua (malha CC0 do MakeHuman) nos níveis de detalhe 0–1. Sem eles nos níveis 2–3, com a
  boca fechada.
- **Integração:**
  - os blendshapes do MediaPipe da própria foto definem a expressão **neutra de referência**, e a expressão da foto é
    desfeita antes do ajuste;
  - o mesmo mapeamento permite animar o avatar por câmera no futuro.

---

## 15. Métricas de fidelidade

| Métrica | Definição | Hoje (15 retratos) |
|---|---|---|
| `identitySimilarity` | SFace e ArcFace foto × render de frente e 3/4; top-1 entre as fotos | frente: SFace 0,37 (8/15 ≥ 0,363), top-1 11/15; 3/4: 0,27 (2/15), top-1 10/15 |
| `landmarkReprojectionError` | RMS (mm na escala da cabeça) entre os pontos do avatar projetados na câmera da foto e os da foto, por região | proxy: resíduo do ajuste 1,7–3,4 mm (mediana olhos 2,3; nariz 1,7; boca 2,2; contorno 2,9) |
| `faceProportionError` | erro relativo das medidas da seção 5 | não medido (medidas ainda não existem) |
| `shapePreservation` | 1 − resíduo²/desvio² em relação ao rosto médio | 0,42–0,76 (mediana 0,64) |
| `asymmetryPreservation` | assimetria no avatar ÷ assimetria medida | **0,0** (0,1 mm de 0,3–4,5 mm) |
| `eyeAlignmentError`, `noseShapeError`, `mouthShapeError` | reprojeção por região + medidas da região | ver reprojeção |
| `hairSilhouetteError` | 1 − IoU entre a silhueta do cabelo renderizada e a máscara da foto | não medido no pipeline (proposta) |
| `skinColorError` | ΔE2000 entre o albedo renderizado sob luz neutra e o tom intrínseco medido | proxy: modelo × render ΔE 12; efeito da cor da luz ΔE 6,5 |
| `multiAngleIntegrity` | renders front, ±45°, ±perfil, costas sem buraco, costura ou flutuação (detector automático de costura de cor e de normal no pescoço) | costura rosto↔pescoço visível em parte dos casos |

---

## 16. Quality gate de identidade

| Métrica | Limiar para APPROVED |
|---|---|
| identitySimilarity (frente) | SFace ≥ 0,45 **e** ArcFace ≥ 0,40 **e** top-1 no conjunto de validação |
| identitySimilarity (3/4) | SFace ≥ 0,363 |
| landmarkReprojectionError | ≤ 1,5 mm (olhos, nariz e boca ≤ 1,2 mm) |
| asymmetryPreservation | ≥ 0,7 quando a assimetria medida for > 1 mm |
| hairSilhouetteError | ≤ 0,15 |
| skinColorError | ΔE2000 ≤ 5 |
| multiAngleIntegrity | nenhuma costura ou buraco |

- **Reprova:** `NEEDS_REFINEMENT`. O avatar ainda aparece para a própria pessoa, com aviso e as perguntas da revisão,
  mas não como versão aprovada.
- **Embeddings:** são só uma das seis famílias de métrica (req. 54). A aprovação final exige também a revisão da
  pessoa (botão "aprovar").

---

## 17. Testes automatizados

| Grupo | Conteúdo |
|---|---|
| Unidade | balanço de branco (cartões sintéticos de cor conhecida sob 5 iluminantes: erro ΔE ≤ 3); cor de íris em olhos sintéticos; resíduo RBF preserva assimetria sintética (≥ 90%); camada de resíduo não altera a topologia nem os pesos |
| Pipeline | conjunto de retratos autorizados (`docs/testes/`), um gate por foto e as métricas da seção 15 em JSON agregado |
| Casos obrigatórios (req. 66) | cabelo curto liso, longo liso, ondulado, cacheado, crespo, raspado, careca, entradas; pele clara, média e escura com subtons diferentes; sardas, pintas, acne, cicatrizes, rugas; barba, bigode, barba por fazer, sem pelos; com e sem óculos (óculos = acessório, retirado da geometria) |
| Oclusão (req. 67) | cabelo sobre o olho, mão, boné, sombra forte: a característica oculta sai com confiança < 0,4 e `DEFAULT` |
| Entrada (req. 68) | rosto ausente, resolução baixa, luz ruim, borrado, ocluído, cabeça virada: pede outra foto (já existe; ampliar com orientação visual) |
| Regressão | o gate roda em CI noturno com os renders em vez da foto; a métrica de semelhança não pode cair mais de 0,03 |
| Privacidade | teste que falha se `console.log` ou o `Audit` receber forma, textura, landmarks ou parâmetros completos (lista de chaves proibidas) |

**Política de dados:** retratos só autorizados; renders e formas nunca no repositório; só agregados.

---

## 18. Estratégia de LOD

| Nível | Uso | Cabeça | Pele | Cabelo | Olhos/boca |
|---|---|---|---|---|---|
| LOD0 | close-up, foto virtual | malha da cabeça subdividida 1× + resíduo completo | albedo 2K, normal + microdetalhe, SSS | fios 0 | shader completo, dentes |
| LOD1 | perfil, Meu Avatar 3D | malha base + resíduo | albedo 1K, normal | fios 1 (padrão) | shader completo |
| LOD2 | corpo inteiro, provador, espelho | malha base + resíduo | albedo 1K, sem microdetalhe | cards 2 | shader simples |
| LOD3 | feed, passarela, fundo | malha base simplificada (≈ 50%) | albedo 512 | cards 2 ou casca 3 | textura |

A escolha segue o nível do cabelo (aparelho + tempo de quadro, HAIR-F2) e a distância à câmera. O GLB leva o LOD2.

---

## 19. Integração com o provador 3D

- **Esqueleto e topologia canônicos:** o rosto mexe só nos vértices da cabeça (resíduo com peso zero abaixo da base do
  pescoço). O fitting de roupa (auditoria de roupas, seção 4) usa as mesmas âncoras NECK/SHOULDER/WAIST/HIP.
- **Pescoço (req. 74):** a transição rosto→pescoço→tronco ganha:
  - cor por gradiente do albedo do rosto para o tom do corpo (8–12 cm abaixo do queixo);
  - normais contínuas, porque o resíduo se anula com suavidade até a base do pescoço;
  - o loop do pescoço (circunferência real) que a `CollarFitConstraint` usa;
  - o parâmetro de pescoço no corpo (largura e comprimento), pedido pela auditoria de roupas.
- **Cabeça e corpo coerentes (req. 73):** o mesmo `renderProfile` e material de pele nos dois e escala pela estatura
  real. O `headScale` continua sendo um ajuste fino limitado.

---

## 20. Integração FashionAI / Scores

- **Serviço de identidade** (backend):
  - `GET /api/avatar-identity/{id}?version=` devolve o `CanonicalAvatarIdentity` aprovado (ou o último, para a dona);
  - `POST /versions` cria uma versão (reconstrução ou correção);
  - `POST /versions/{v}/approve` aprova;
  - `DELETE` apaga tudo.
- **Cada aplicação** (FashionAI, Scores) declara o próprio `renderProfile`, LOD e `animationRig` (subconjunto dos
  blendshapes). A identidade é a mesma e nunca é regenerada por tela (req. 36 e 71).
- **Provador 2D, Vista-me e fotos virtuais** leem a mesma versão aprovada (o espelho já usa o mesmo avatar).

---

## 21. Logs e observabilidade sem dados pessoais

| Pode registrar | Nunca registrar |
|---|---|
| ids (usuário, identidade, versão), tempos por etapa, códigos de aviso (`FACE_OCCLUDED`…), status do gate e **quais** métricas reprovaram, contagem de fotos, modo/LOD | imagens, atlas, máscaras, landmarks, forma do rosto, coeficientes, resíduo, embeddings, cor de pele, olhos ou cabelo, medidas do corpo |

- **Hoje:** o `Audit` registra só `photos` (ok). Não há `console.log` de dados no pipeline (verificado).
- **Modo de depuração (req. 59):**
  - landmarks, malha, máscaras de cabelo e pele, regiões e confiança, só em `/lab/*`, que já é ambiente de
    desenvolvimento atrás do gate de desenvolvedor;
  - nunca em produção para outras pessoas;
  - o JSON de métricas sai agregado.

---

## 22. Plano de implementação progressivo

| Fase | Entrega | Saída |
|---|---|---|
| I0 | Métricas e gate sobre o pipeline atual: reprojeção, preservação de forma e assimetria, cor, silhueta do cabelo; teste de privacidade dos logs | linha de base no CI |
| I1 | `CanonicalAvatarIdentity` v2 + `AvatarIdentityVersion` no backend (migração do v1, histórico, aprovação), confiança por característica | refazer não apaga mais a versão aprovada |
| I2 | **Camada de resíduo assimétrico** (FaceMorphFitter), morphs nomeados e medidas da seção 5 | assimetria ≥ 0,7; reprojeção ≤ 1,5 mm |
| I3 | Pele: balanço de branco, separação de luz, albedo + normal + rugosidade, transição do pescoço | skinColorError ≤ 5; sem costura |
| I4 | Olhos: cor da íris medida, shader, ossos; óculos (escuros removidos, de grau como acessório); sobrancelhas medidas | cor da íris nos casos de teste |
| I5 | Cabelo: risca, linha do cabelo, densidade × volume, cores (mecha/raiz), coberturas no tamanho real; barba e bigode | hairSilhouetteError ≤ 0,15; casos com barba |
| I6 | Rig facial (mandíbula, olhos, pálpebras, 52 blendshapes), dentes; detalhes individuais por máscara | expressões sem perder o gate |
| I7 | Revisão visual na tela Meu Avatar 3D (cartões), correção localizada, LOD 0–3, serviço para Scores | casos obrigatórios aprovados |

**Ordem com o restante do plano:** I0–I3 vêm antes do fitting novo de roupas (o pescoço e as âncoras são
compartilhados).

---

## 23. Estado da implementação

| Fase | Estado | Onde |
|---|---|---|
| I0 | **Entregue (05/10)** | `lib/avatar3d/identity/metrics.ts` (reprojeção por região, preservação da forma, captura, assimetria, CIEDE2000, IoU), `gate.ts` (limiares da seção 16; o que o aparelho não mede fica "não medido"), `privacy.ts` (`identityLogPayload`, chaves proibidas), `identity.test.ts` (referências de cor de Sharma et al., gate, varredura de `console.*`, **linha de base no CI** com rostos sintéticos). O `HumanAvatar` calcula a fidelidade ao montar o corpo (`parts.identity`), sem log. |
| I1 | **Entregue (05/10)** | `avatar_identity_versions` (V42; era V38 antes de trazer o `main`, que já usava V38–V41) + `AvatarIdentityVersion`; `user_avatars_3d` vira a versão atual (`identity_id`, `current_version`, `approved_version`, `identity_status`, `quality_json`). Os avatares existentes migram como versão 1 aprovada. Salvar cria uma versão: o gate é **recalculado no servidor** (`IdentityQuality`) a partir dos números do aparelho; reprovou → `NEEDS_REFINEMENT` e as outras pessoas continuam vendo a última aprovada (forma e textura por `?version=`). Endpoints `GET /api/me/avatar3d/versions`, `POST …/versions/{n}/approve` (com avisos só com `acceptWarnings`) e `POST …/versions/{n}/restore` (cria versão nova). Guarda a atual, a aprovada e as 5 mais recentes; o resto some com a textura. Auditoria só com versão, status e nomes das métricas. Tela Meu Avatar 3D: versão, status, o que reprovou em palavras, aprovar mesmo assim, histórico e restaurar. Testes: 6 novos no `Avatar3dServiceTest` (incluindo a auditoria sem dado pessoal) e verificação da migração num MySQL local com um avatar criado pela versão anterior. |
| I2 | **Entregue (05/10)** | `lib/avatar3d/human/face-residual.ts`: camada de resíduo assimétrico (RBF de Wendland C2 com suporte compacto, profundidade com peso 0,35, resíduo limitado a 6% da altura do rosto, λ = 0,008) sobre o espaço de rostos, na mesma topologia (rig, UV, pesos, cabelo e roupas valem). Os olhos andam inteiros com o campo. `fitFace` devolve o campo; `compose(..., residual)` aplica; `NEXT_PUBLIC_FACE_RESIDUAL=off` desliga. Medidas nomeadas da seção 5 em `identity/face-profile.ts`: 18 proporções, ângulo da mandíbula, classe do formato derivada, assimetria por região, confiança e origem; `proportionErrorPct` entra no relatório de qualidade. |
| I3 | **Entregue (05/10)** | `lib/avatar3d/skin-tone.ts`: cor da luz pela **esclera** (sem íris, cílios e reflexo), gray-world fraco como reserva; ganhos só de cromaticidade (a luminância não muda). O pipeline corrige cada foto antes de medir pele, cabelo e atlas (`NEXT_PUBLIC_SKIN_WB=off` desliga). `skinProfile`: tom em CIELAB, subtom pelo ângulo de matiz, melanina e vermelhidão, com confiança. `matchFaceToBody` leva a pele média do rosto ao tom do corpo e devolve `skinColorError` e a costura (ΔE da borda); entram no relatório do gate. Teste com 5 luzes × 3 tons de pele: ΔE2000 ≤ 3 depois da correção. |
| I4 | **Entregue (06/10)** | **Olhos:** `lib/avatar3d/iris.ts` mede cada íris pelos 5 pontos de íris do MediaPipe, dentro do contorno das pálpebras, na foto já corrigida pela esclera (anel 0,40–0,93 R; fora o reflexo e os cílios), com cor base, zona perto da pupila, padrão (RING, RADIAL, UNIFORM; CRYPT não é inferido) e confiança (íris < 18 px, olho semicerrado, pouca íris visível, luz sem correção). A classe sai da matiz e da saturação (11 classes); a malha usa a cor contínua. Heterocromia só com cor diferente (ΔE ≥ 15 **e** Δab ≥ 10), não com um olho na sombra. `human/eyes.ts`: a textura do olho é recolorida guardando as fibras, a pupila e o anel; ossos `LeftEye`/`RightEye` (nomes do Mixamo) presos ao `Head` no centro de cada globo; a córnea vira uma malha própria só de reflexo (IOR 1,376, verniz) e há a linha d'água na pálpebra de baixo; as duas ficam fora do GLB. **Óculos:** `lib/avatar3d/glasses.ts` detecta escuros (lente que cobre a pele abaixo do olho, sem esclera) e de grau (faixas finas, alinhadas e da mesma cor sob os dois olhos e na ponte ou na lateral, de cromaticidade diferente da pele) e tira da cópia que vira textura — a lente inteira ou só os traços finos da armação, na cor dela, nunca olho, cílios, pálpebra, vinco, sobrancelha, pinta, ruga ou olheira (preenchimento harmônico liso). `human/glasses-3d.ts` devolve os de grau como acessório preso ao `Head`: lente 12 mm à frente da córnea e ≥ 4 mm de qualquer ponto do rosto, ponte sobre o nariz, hastes por fora da cabeça até atrás da orelha, cor medida; a pessoa tira em "Óculos" (ajuste `glasses`). Com óculos escuros a íris fica a padrão (confiança 0) e o EYES_CLOSED deixa de bloquear. **Sobrancelhas:** `identity/brows.ts` mede cor, espessura, arco (reta, suave, alta) e densidade, com confiança baixa para franja por cima, sobrancelha clara ou armação cruzando (contraste relativo, sem punir pele escura). `AvatarModel.eyes`/`brows` validados no app (`validateEyes`, `validateBrows`) e no backend (`validEyes`, `validBrows`): fora das regras saem, o avatar fica. Avisos `GLASSES_SUNGLASSES`, `GLASSES_PRESCRIPTION`, `IRIS_LOW_CONFIDENCE` (e textos para `WB_GRAY_WORLD`/`WB_NONE`). Desligar: `NEXT_PUBLIC_AVATAR_GLASSES=off`. |


**Resultado do I2 nos 15 retratos autorizados** (reconhecedores independentes; agregados em
[`metricas-identidade-I2-2026-10-05.json`](metricas-identidade-I2-2026-10-05.json)):

| Medida | I0 (só espaço simétrico) | I2 (com resíduo) |
|---|---|---|
| SFace, frente, mediana | 0,369 | **0,476** |
| Acima do limiar "mesma pessoa" (0,363), frente | 8 de 15 | **14 de 15** |
| ArcFace, frente, mediana | 0,312 | **0,493** |
| A própria foto é a mais parecida (top-1), frente | 11 de 15 | **15 de 15** |
| SFace, 3/4, mediana | 0,279 | **0,404** |
| Acima do limiar, 3/4 | 2 de 14 | **9 de 14** |
| Top-1, 3/4 | 10 de 14 | **13 de 14** |

A semelhança de frente subiu em 15 de 15 retratos e a de 3/4 em 13 de 14. A frente já passa o limiar do gate (SFace ≥ 0,45);
o 3/4 ainda não (0,404 < 0,45 no conjunto; o gate de 3/4 pede ≥ 0,363 por pessoa, atendido em 9 de 14).

**Resultado do I3 nos mesmos retratos** ([`metricas-identidade-I3-2026-10-05.json`](metricas-identidade-I3-2026-10-05.json)):

| Medida | Valor |
|---|---|
| Erro de cor da pele (ΔE2000), mediana / máximo | 0,2 / 0,5 (meta ≤ 5) |
| Costura rosto↔pescoço (ΔE2000 da borda), mediana / máximo | 1,5 / 3,6 — **nenhuma costura** (limite 5) |
| Balanço de branco pela esclera | 15 de 15 |
| Gate de identidade (métricas do aparelho) | **14 de 15** passam (1 reprova na reprojeção da boca) |
| SFace de frente, mediana (I2 → I3) | 0,476 → 0,450 (14 de 15 acima do limiar nos dois) |
| SFace 3/4, mediana (I2 → I3) | 0,404 → 0,372 (9 → 8 de 14) |

A pequena queda nos reconhecedores é esperada: eles comparam o avatar com a foto **com** a cor da luz, e o I3 tira essa
cor da pele (o tom intrínseco é o certo para o provador e para a loja, que têm a própria luz). A troca fica documentada e
reversível pela variável acima.

**Resultado do I4 nos mesmos retratos**, cada um também com uma armação de grau e uma lente escura desenhadas pelo
laboratório sobre os pontos do rosto ([`metricas-identidade-I4-2026-10-06.json`](metricas-identidade-I4-2026-10-06.json)):

| Medida | Valor |
|---|---|
| Íris medida na foto | 16 de 16; confiança mediana 0,83 (3 abaixo de 0,5: olhos semicerrados ou íris menor que 18 px) |
| Classe da íris conferida no próprio olho (só no ambiente local) | 16 de 16 (10 castanho-escuro, 2 castanho, 2 cinza, 1 verde-acinzentado, 1 azul) |
| Mesma classe com a armação desenhada | 15 de 16 (a diferente tem confiança 0,25) |
| Heterocromia falsa | 0 (com só o ΔE, dois retratos com um olho na sombra davam falso) |
| Sem óculos → "nenhum" / armação → "de grau" / lente → "escuros" | 16/16 · 16/16 · 16/16 |
| Armação removida da textura (pixels devolvidos à pele original, ΔE < 10) | mediana 70% (59–82%); o restante é o aro de cima encostado na sobrancelha |
| Pixels mudados fora da armação | mediana 0%; até 29% do tamanho da armação, sempre colados nos cantos dela; sobrancelha intacta em 15 de 16 |
| Sobrancelhas | 16 de 16 medidas; 4 retas, 7 arco suave, 5 arco alto (limites nos tercis) |
| Gate de identidade (I3 → I4) | 14/15 → 14/15; reprojeção 0,6 mm, erro de cor da pele 0,2, nenhuma costura |
| SFace de frente, mediana (I3 → I4) | 0,450 → 0,448 (14 de 15 acima do limiar; top-1 15/15 nos dois) |
| SFace 3/4, mediana (I3 → I4) | 0,372 → 0,363 (8 → 7 de 14 acima; top-1 13 → 14) |

A regressão fica dentro do limite de 0,03 do plano. **Limites conhecidos:** as armações e lentes do teste são
sintéticas e todas do mesmo estilo (escura, retangular); armação fina de metal, sem aro ou da cor da pele pode passar
sem ser vista (aí nada é removido nem acrescentado). O aro de cima que encosta na sobrancelha fica na textura — pela cor
ele não se separa da sobrancelha, e tirá-lo apagaria o vinco da pálpebra em pele escura; com os óculos 3D ligados o aro
3D cobre, desligados ele aparece como um traço sob a sobrancelha. Com óculos escuros a pele em volta dos olhos é
preenchida lisa (copiar textura de outro ponto traria rugas que não estão ali) e o balanço de branco cai no gray-world.
Ficam para o I6: parallax da íris, sombra das pálpebras sobre o olho e o olhar animado pelos ossos novos.

**Linha de base do I0 (rostos sintéticos, sem foto de ninguém):**

| Caso | Valor |
|---|---|
| Olho e sobrancelha 3 mm mais altos, canto da boca 2 mm mais baixo | assimetria medida 1,08 mm; preservada **0,009** |
| O mesmo caso | reprojeção nos olhos 1,6 mm |
| Mandíbula 6% mais larga | captura 0,48 |

A regressão não pode piorar mais que 0,03; o I2 sobe estes pisos.
