# Plano A — esqueleto humanoide, exportação e rosto, sem contratar fornecedor

Plano de execução detalhado para o caminho escolhido em `servicos-externos-avatar-provador.md` §5: evoluir o pipeline
próprio em vez de assinar APIs. Escrito para ser executado por outra sessão/pessoa sem precisar reler a investigação.

**O que o Plano A entrega.** Um avatar com **esqueleto humanoide**, exportável em **GLB (glTF 2.0)**, com a roupa
amarrada ao mesmo esqueleto — o que fecha os defeitos D8 (sem esqueleto), D9 (sem arquivo exportável) e boa parte do
D10 (roupa projetada em plano) da tabela em `investigacao-pipeline-avatar.md` §3.

**O que ele não promete.** Realismo de pele, dobras e músculos; simulação física de tecido; e semelhança facial além
do que o RF40 já entrega. Continua sendo um **manequim estilizado com rosto semirrealista** (§5, resposta 22 daquela
investigação). Prometer mais que isso é o erro que a investigação documentou.

**Fora do escopo deste plano.** A geração do modelo 3D da peça (RF16: Meshy → Stability Fast 3D → relevo local, em
`Model3dService`) fica como está, sem mexer. Este plano trata do corpo, do rosto e do provador.

### Princípio do produto: roupa sempre vestida em alguém

Toda peça é exibida **vestida num corpo humano** — nunca flutuando, nunca como objeto de vitrine solto. É o que
distingue o produto e é o critério que decide as escolhas técnicas abaixo:

- A Fase 3 (roupa amarrada ao esqueleto) existe para isso: a peça acompanha o corpo em vez de pairar sobre ele.
- No provador 2D, o FASHN sempre recebe **um corpo** como imagem de modelo (§7).
- Calçados e acessórios, que o modelo principal do FASHN não cobre, continuam compostos **sobre o corpo** por
  âncora anatômica — não ao lado dele.
- O GLB da peça vindo do RF16 **não entra no provador** como objeto solto. Hoje `mannequin.tsx:82` escala esse GLB
  para caber numa caixa na frente do corpo, o que é exatamente uma peça *não vestida*. O lugar dele é a página da
  peça e o Meu Quarto 3D, onde ser objeto é o ponto.

---

## 1. Estado atual (verificado no código)

| Item | Onde | Situação |
|---|---|---|
| Corpo paramétrico | `lib/avatar3d/body-spec.ts:buildSpec` | ✅ articulações, cortes do tronco, membros, mãos, pés |
| Profundidade pela foto de perfil | `lib/avatar3d/body.ts:observeProfile` | ✅ entregue (PR #27) |
| Malha do corpo | `components/three/mannequin.tsx:bodyGeo` | ⚠️ malha **estática**, um material, sem ossos |
| Roupa | `lib/avatar3d/garment-geometry.ts` | ⚠️ molde inflado + foto projetada de frente, sem vínculo com pose |
| Rig / skinning | — | ❌ **não existe**: nenhum `SkinnedMesh`, `Bone` ou `Skeleton` no repositório |
| Exportação GLB | — | ❌ **não existe**: nenhum `GLTFExporter` |
| Rosto | RF40 (`lib/avatar3d/pipeline.ts`, `atlas.ts`, `geometry.ts`) | ✅ 468 pontos + atlas, no aparelho |
| Worker GPU | `markdowns/runpod-separated-deployment.md` | ✅ já existe e está pago (`blender-api` + `blender-worker`) |

Consumidores do manequim que **não podem quebrar**: `avatar-viewer.tsx`, `look-viewer.tsx`, `runway-scene.tsx`,
`stage-scene.tsx` (e, por eles, o provador, a Passarela, o My Stage e o Meu Quarto).

---

## 2. Fase 1 — Esqueleto humanoide

A vantagem deste projeto sobre um auto-rig genérico: **a malha é gerada por nós**, a partir da mesma descrição que
tem as articulações. Não é preciso adivinhar onde estão os ossos nem difundir pesos por calor — sabemos de que parte
do corpo cada vértice veio. Isso torna a Fase 1 um problema de bookkeeping, não de pesquisa.

### 2.1 Hierarquia de ossos

Nomes e hierarquia do padrão Humanoid da Unity, que exige no mínimo 15 ossos
([manual](https://docs.unity3d.com/Manual/ConfiguringtheAvatar.html)). Os opcionais melhoram a deformação mas não são
exigidos pelo Humanoid.

| Osso | Pai | Posição (origem) | Obrigatório |
|---|---|---|---|
| `Hips` | — (raiz) | `[0, levels.hip, 0]` | ✅ |
| `Spine` | Hips | `[0, levels.waist, 0]` | ✅ |
| `Chest` | Spine | `[0, levels.chest, 0]` | opcional |
| `UpperChest` | Chest | `[0, (levels.chest + levels.shoulder)/2, 0]` | opcional |
| `Neck` | UpperChest \| Chest \| Spine | `joints.neckBase` | ✅ (Head exige cadeia) |
| `Head` | Neck | `head.center` | ✅ |
| `LeftShoulder` / `RightShoulder` | UpperChest \| Chest | `[±sh*0.35, levels.shoulder + 0.01*H, 0]` | opcional |
| `LeftUpperArm` / `RightUpperArm` | Shoulder \| Chest | `joints.shoulderL` / `shoulderR` | ✅ |
| `LeftLowerArm` / `RightLowerArm` | UpperArm | `joints.elbowL` / `elbowR` | ✅ |
| `LeftHand` / `RightHand` | LowerArm | `joints.wristL` / `wristR` | ✅ |
| `LeftUpperLeg` / `RightUpperLeg` | Hips | `joints.hipL` / `hipR` | ✅ |
| `LeftLowerLeg` / `RightLowerLeg` | UpperLeg | `joints.kneeL` / `kneeR` | ✅ |
| `LeftFoot` / `RightFoot` | LowerLeg | `joints.ankleL` / `ankleR` | ✅ |
| `LeftToes` / `RightToes` | Foot | `[ankle.x, feet[i].size[1]*0.5, feet[i].center[2] + size[2]*0.35]` | opcional |

Total: 15 obrigatórios, até 21 com os opcionais. **Tudo já existe em `buildSpec()`** — `joints` e `levels` dão cada
posição; nenhum dado novo precisa ser coletado da pessoa.

**Pose de ligação (bind pose):** a própria pose A que o `buildSpec` já produz (braços a ~12° do tronco). Não converter
para T-pose: a Unity reconhece A-pose no Configure, e converter introduziria erro sem ganho.

### 2.2 Novo arquivo `lib/avatar3d/rig.ts`

Sem React, testável em node — a mesma regra que `garment-geometry.ts` já segue.

```ts
export type HumanBone = "Hips" | "Spine" | "Chest" | "UpperChest" | "Neck" | "Head"
  | "LeftShoulder" | "LeftUpperArm" | "LeftLowerArm" | "LeftHand" | /* ...direita e pernas... */;

export interface BoneSpec { name: HumanBone; parent: HumanBone | null; head: V3 }

/** Ossos nas articulações da especificação, em ordem topológica (pai sempre antes do filho). */
export function buildRig(s: Spec): BoneSpec[];

/** Até 4 influências por vértice, já normalizadas (somam 1). */
export interface SkinWeight { idx: [number, number, number, number]; w: [number, number, number, number] }

/** Pesos de um vértice, sabendo de que parte do corpo ele veio. */
export function weightsFor(part: PartName, v: V3, s: Spec, rig: BoneSpec[]): SkinWeight;

/** Verificações estruturais do rig (para os testes e para a tela de qualidade). */
export function rigChecks(rig: BoneSpec[], skin: SkinWeight[]): {
  requiredBones: Check; weightsSumToOne: Check; maxInfluences: Check; noEmptyBone: Check;
};
```

### 2.3 Pesos: por parte, com rampa nas articulações

`bodyGeo` (`mannequin.tsx:35`) já monta a malha a partir de partes nomeadas. A mudança é anotar cada parte com o osso
dela **antes** do merge, e resolver a transição perto das articulações:

| Parte gerada hoje | Osso | Mistura |
|---|---|---|
| `loftGeo(s.torso)` | Hips → Spine → Chest → UpperChest → Neck | por altura `y`, rampa linear entre os níveis |
| `neck` | Neck | rampa para Head no topo |
| `upperArm{L,R}` | LeftUpperArm / RightUpperArm | rampa para Shoulder na origem e LowerArm no fim |
| `forearm{L,R}` | LowerArm | rampa para Hand no fim |
| `thigh{L,R}` | UpperLeg | rampa para Hips na origem, LowerLeg no fim |
| `shin{L,R}` | LowerLeg | rampa para Foot no fim |
| `hand{L,R}` + polegar | Hand | — |
| `foot{L,R}` + calcanhar | Foot | rampa para Toes na frente |
| elipsoides de ombro | Shoulder ↔ UpperArm | 50/50 no centro, rampa pelos dois lados |
| elipsoides de articulação (cotovelo, joelho, punho, tornozelo) | os dois ossos que ela liga | rampa pela projeção no eixo do osso |

**Regra da rampa:** ao longo do eixo do osso, numa faixa de ±`r` (o raio do membro naquele ponto), o peso vai de 1
para 0 linearmente. Depois: ordenar por peso, manter as 4 maiores, normalizar para somar 1. É simples, determinístico
e testável — e é o suficiente para um manequim estilizado.

**Cuidado que derruba o merge:** hoje `bodyGeo` apaga `uv`/`uv1`/`uv2` e converte para não-indexado antes de juntar.
Os atributos `skinIndex` e `skinWeight` precisam ser criados **por parte, na mesma ordem**, e sobreviver ao
`mergeGeometries` — senão os pesos embaralham silenciosamente e o corpo se desmancha na primeira pose.

### 2.4 Mudanças em `components/three/mannequin.tsx`

- `bodyGeo(s, withNeck)` passa a devolver também os atributos de skinning (ou uma segunda função `bodySkin(s)`).
- O `<mesh>` do corpo vira `<skinnedMesh>` com um `THREE.Skeleton` construído de `buildRig`.
- `skeleton.calculateInverses()` cuida das *inverse bind matrices*; não calcular à mão.
- **Compatibilidade:** manter a pose de ligação como pose padrão. Nenhum dos quatro consumidores
  (`avatar-viewer`, `look-viewer`, `runway-scene`, `stage-scene`) muda de contrato, e o avatar renderiza igual —
  a diferença é que agora ele *pode* ser posado.

### 2.5 Testes (`lib/avatar3d/rig.test.ts`) e critérios de aceitação

| Teste | Critério |
|---|---|
| Os 15 ossos obrigatórios existem, com pai correto e em ordem topológica | invariante |
| Simetria: ossos esquerdo/direito espelhados em x | invariante |
| Todo vértice soma peso 1 (± 1e-5) e tem ≤ 4 influências | invariante |
| Nenhum osso sem vértice algum | invariante |
| Corpo em pose de ligação = malha estática de hoje (vértice a vértice) | ± 1e-6 |
| Extremos da faixa (`build 1.8`, pernas longas) continuam válidos | invariante |
| Amplitude: cotovelo 140°, joelho 120°, braço acima da cabeça, agachamento | sem inversão de normal; perda de volume na junta < 25% |

Esforço estimado: **3 a 5 dias**.

---

## 3. Fase 2 — Exportar GLB

**Onde gerar:** no navegador, na hora de salvar o avatar, com o `GLTFExporter` do three.js
(`three/examples/jsm/exporters/GLTFExporter.js`). O corpo já é montado ali; não precisa de GPU de servidor.

**Onde guardar:** `restricted/users/<id>/avatar3d/body-<ts>.glb`, pelo mesmo caminho da textura do rosto — o GLB do
corpo é dado pessoal. O `MediaProxyController` hoje dá cache público de 1 dia para o que não está em `restricted/`;
o corpo **precisa** ficar sob a regra restrita, com URL assinada de expiração curta.

**Nunca** depender de chamada de runtime a terceiro para exibir o avatar: o artefato é auto-suficiente e fica no seu
storage. É a lição do Ready Player Me, que o repositório já registra.

**Validação — nos dois lados:**

- *No CI*: `scripts/avatar3d/export-glb.mjs` gera GLBs das mesmas fixtures dos testes e roda o
  [glTF-Validator](https://github.com/KhronosGroup/glTF-Validator) (npm), exigindo **0 erros**.
- *No servidor*: o Java não valida glTF. Checar só o que é barato e importa: magic bytes `glTF`, versão 2, tamanho
  máximo, e recusar o resto — a validação real é a do CI.

Critérios objetivos (os da §13.2 da investigação, agora com dono):

| Critério | Valor |
|---|---|
| glTF-Validator | 0 erros |
| Unidade | metros |
| Altura da caixa | = estatura ± 1% |
| Pés | y = 0 |
| Frente do modelo | +Z |
| Influências por vértice | ≤ 4, pesos somando 1 |
| Juntas sem vértices | nenhuma |
| Texturas | sRGB |
| Unity | importa com glTFast → Humanoid → Configure sem osso obrigatório faltando |
| Blender | ida e volta sem perder juntas nem pesos |

Esforço: **2 a 3 dias**.

---

## 4. Fase 3 — Roupa amarrada ao mesmo esqueleto

É o que faz a roupa acompanhar o corpo em vez de flutuar. Sem simulação física: **transferência de pesos por
proximidade**, que é o que a maioria dos provadores 3D comerciais realmente faz.

1. O molde da peça já nasce do próprio corpo (`garmentMold` infla as regiões que a peça cobre) — então cada vértice
   da roupa tem um vértice de corpo correspondente muito próximo.
2. Para cada vértice do molde, copiar os pesos do vértice de corpo mais próximo (ou a média dos 3 mais próximos,
   ponderada pela distância). Reaproveitar `signedDistanceToBody` de `garment-metrics.ts:24`.
3. Manter `resolveCollisions` (`garment-metrics.ts:120`) **depois** da pose, não só na pose de ligação.
4. Camadas: a folga por camada (BASE → INTERMEDIATE → OUTER) vira um deslocamento ao longo da normal, para a jaqueta
   não atravessar a camiseta.

**Métricas de aceitação** (§13.3 da investigação): camiseta, calça e vestido em pé, sentado e caminhando, com
**nenhuma interseção roupa × corpo acima de 2 mm**; barra da calça no tornozelo; vestido cobrindo o quadril sem
atravessar as coxas no passo.

Esforço: **5 a 8 dias**. É a fase mais longa e a que mais muda o que a pessoa vê.

---

## 5. Fase 4 (opcional) — Pose e animação

Só vale se sobrar tempo. Testar amplitude com dados públicos (LaFAN1, já citado na bibliografia da investigação),
medir colapso de cotovelo/joelho, afundamento de ombro e torção de punho. Para a Passarela, um LOD com metade dos
segmentos, sem mudar as proporções.

---

## 6. Rosto: a decisão e a porta

O rosto é o **único buraco real** — e a investigação mostrou que o mercado não tem uma resposta self-serve barata.
O Avaturn foi eliminado: a API só existe no Pro (~US$ 800/mês, [pricing](https://avaturn.me/pricing/),
[docs](https://docs.avaturn.me/docs/integration/api/introduction/)).

| Opção | Custo | Licença | O que ganha | Veredito |
|---|---|---|---|---|
| **A. Manter o RF40** (468 pontos + atlas, no aparelho) | R$ 0 | própria | já funciona; nada sai do aparelho | **padrão** |
| **B. MICA / DECA / EMOCA no worker RunPod** | ~R$ 0 (GPU já paga) | *research-only* | forma 3D real do rosto (FLAME) e albedo estimado | **experimento do TCC** |
| C. Avatar SDK Head (itSeez3D) | ? | comercial | cabeça com rig | só se a Cloud API existir fora do Enterprise — **verificar** |
| D. Avaturn | US$ 800/mês | comercial | corpo + rosto integrados | **eliminado** por custo |
| E. Didimo | ? | comercial | cabeça com rig | CLI parado desde 18/10/2022 — evitar |

**Recomendação.** Ficar na **A** como padrão e usar a **B** como experimento comparativo. A B é academicamente
valiosa justamente porque dá um A/B para relatar (a comparação pareada cega da §6.3 da investigação), e roda na GPU
que você já paga. O impedimento dela é jurídico, não técnico: licença de pesquisa serve ao TCC e **bloqueia** o
produto — isso precisa estar escrito no texto.

**Encaixe técnico da B, se for feita:** a cabeça do SMPL-X e a do FLAME compartilham espaço, e os autores distribuem
listas de correspondência de vértices prontas — então uma reconstrução FLAME é enxertável. Não vale para cabeças de
fornecedores com topologia proprietária, onde a costura seria manual por usuário.

### 6.1 A porta, para não ficar preso a nenhuma escolha

Definir agora, mesmo mantendo a opção A, para que trocar de motor não toque no renderizador:

```java
// fai-application/.../imaging/ImageProviderPorts.java — ao lado de TryOnProviderPort e Model3dPort
public interface FaceReconstructionPort {
    boolean available();
    Optional<ProviderFace> reconstruct(List<byte[]> photos);   // frente + até 2 de 3/4
}
```

- `AiCapability.FACE_RECONSTRUCTION`, entrando na cadeia do `AiEngine`: provedor → **motor local (RF40)**.
- Job assíncrono pelo `PipelineJob`, como o `Model3dService` já faz (`QUEUED → PROCESSING → COMPLETED | FAILED`,
  timeout configurável, um reprocessamento grátis).
- Consentimento: `FACIAL_RECOGNITION` **e** `AI_EXTERNAL_PHOTO_PROCESSING` (os dois já existem no
  `ConsentPurpose`) — e, se a foto sair do país, registrar destinatário e país, que é o que falta hoje.
- Cota por usuário e log de inferência: o `AiEngine` já faz os dois.

**Gatilho para plugar um provedor externo:** só quando (1) existir cadastro self-serve com chave de API emitida no
ato, (2) a cláusula sobre treinamento nos uploads for lida e aceitável, e (3) o artefato vier como GLB próprio, sem
chamada de runtime. Sem os três, fica na opção A.

---

## 7. Provador 2D: o que fazer com o FASHN

O FASHN continua sendo o motor do acabamento fotorrealista, e é o que entrega o princípio "roupa sempre vestida".
Ele **já está integrado** — o que falta é corrigir a entrada e ampliar a cobertura.

### 7.1 Como está hoje

| Etapa | Onde | O que acontece |
|---|---|---|
| Orquestração | `TryOnService.render` | passa pelo `AiEngine` (cota, log de inferência, fallback), provider `fashn` |
| Imagem de modelo | `TryOnCompositor.java:81` | `drawMannequin(...)` desenha um manequim **em Java2D** e é ele que vai para o FASHN |
| Chamada | `TryOnCompositor.java:106` | `port.tryOn(ImageOps.png(canvas), g.imageBytes(), fashnCategory(g.slot()))`, **uma por peça**, cada uma sobre o canvas anterior |
| Adaptador | `FashnTryOnAdapter` | `tryon-v1.6`, polling de até 30 × 2 s; custo `0.075` **fixo no código** |
| Acessórios e calçados | etapa COMPOSITING | desviados do FASHN e compostos por âncora local |
| Fallback | `compositor.render(..., false)` | sobreposição local por âncora, sem custo |

### 7.2 Os quatro consertos, em ordem de impacto

**(a) Mandar um corpo de verdade como imagem de modelo.** É a correção que mais muda o resultado. Esses modelos são
treinados com fotos de pessoas; um manequim vetorial de Java2D é justamente a entrada para a qual eles não foram
feitos. O avatar 3D já renderiza no cliente e o visualizador já está preparado: `avatar-viewer.tsx:39` tem
`preserveDrawingBuffer: true` e um callback `onCanvas`. Caminho de menor risco:

- `POST /api/try-on/renders` ganha um campo **opcional** `modelImage` (PNG do avatar, capturado no cliente);
- havendo `modelImage`, o compositor usa; não havendo, cai no Java2D de hoje — ninguém quebra;
- os dois caminhos convivem, o que dá o A/B para medir e relatar no TCC.

**(b) Calçado e acessório também vestidos.** O `tryon-v1.6` só cobre `tops`, `bottoms` e `one-pieces` — por isso hoje
eles são desviados para a composição local. O endpoint que cobre calçado e acessório é o **`product-to-model`**.
Armadilha verificada: ele usa o campo **`product_image`**, não `garment_image`; trocar só
`fashionai.ai.fashn-model` quebra a chamada. Exige um ramo no adaptador por nome de modelo.

**(c) Tirar o custo do código.** `FashnTryOnAdapter` declara `0.075` fixo e `StabilityFast3dAdapter` declara `0.10`.
Citar esses números como preço de mercado é raciocínio circular — foi um erro que a própria apuração cometeu. Ler da
configuração e conferir contra a fatura real antes de qualquer tabela de custo.

**(d) Um segundo provedor na cadeia.** A porta já é uma `List<TryOnProviderPort>`, então basta um novo `@Component`.
O candidato é o **Google Virtual Try-On, a US$ 0,06 por imagem** — o único preço confirmado em tabela oficial de toda
a apuração, e mais barato que o valor presumido do FASHN. Ele marca a saída com SynthID, o que precisa ser dito na
interface.

### 7.3 Pontos de atenção

- **Custo por clique, não por usuário.** Cada peça é uma chamada paga: um look de 4 peças custa 4 chamadas. A cota
  por usuário do `AiEngine` já existe; falta definir o teto e um desligamento automático ao estourar.
- **Composição sequencial acumula artefato.** Cada peça é gerada sobre o resultado da anterior. Medir se compensa
  frente a uma chamada por camada sobre o corpo limpo.
- **Latência.** Oficiais do v1.6: 5 s (performance), 8 s (balanced), 12–17 s (quality). Com 4 peças em sequência, a
  requisição HTTP pode passar de um minuto — é caso para virar `PipelineJob` assíncrono, como o RF16 já faz.
- **Moderação.** Moda praia e lingerie não são excluídas pelo modelo: há `moderation_level`
  (`conservative` | `permissive` | `none`), hoje no padrão conservador. Expor como configuração consciente.
- **LGPD — muda de figura com o conserto (a).** Hoje sai um manequim sintético, que não é dado pessoal. Passar a
  enviar o render do avatar significa **enviar a textura do rosto da pessoa para um servidor no exterior**: vira
  dado biométrico em transferência internacional. Exige `AI_EXTERNAL_PHOTO_PROCESSING` e `FACIAL_RECOGNITION`
  (ambos já existem em `ConsentPurpose`) checados **antes** do envio, registro do destinatário e do país, e a opção
  de provar o look com o corpo sem o rosto.

### 7.4 Critérios de aceitação do provador

1. Toda peça aparece vestida num corpo — nenhuma flutuando, em nenhum caminho (FASHN, fallback local ou GLB).
2. Sem chave de API, o provador continua funcionando pelo compositor local (é o que garante o modo offline).
3. Calçado e acessório aparecem no corpo, pelo `product-to-model` ou pela âncora local.
4. Comparação lado a lado, na mesma peça e no mesmo corpo: manequim Java2D × render do avatar, avaliada por pessoas.
5. Nenhum envio externo sem consentimento específico registrado.
6. Custo por render medido na fatura, não estimado.

---

## 8. Backend: o que muda

| Item | Mudança |
|---|---|
| Migração `V27__avatar_rig.sql` | em `user_avatars_3d`: `rig_version INT NULL`, `glb_key VARCHAR(512) NULL`, `glb_bytes BIGINT NULL` |
| `UserAvatar3d` | os três campos, nulos — avatar antigo continua válido |
| `Avatar3dService` | aceitar o GLB no multipart do save; validar magic bytes, versão e tamanho; apagar o GLB antigo ao refazer (o mesmo `deleteQuietly` que a textura já usa) |
| `MediaProxyController` / `SecurityConfig` | o GLB do corpo entra na regra `restricted/`, com URL assinada de expiração curta — hoje só `ROLE_ADMIN` é tratado, e isso não serve para "o dono pode ver o próprio corpo" |
| `Avatar3dController` | nada novo: o GLB entra no mesmo `POST /api/me/avatar3d` |

`MODEL_VERSION` continua 1 (o modelo não muda); o rig ganha versão própria, para poder regerar sem invalidar o
avatar salvo.

---

## 9. Ordem de execução e esforço

| # | Fase | Esforço | Depende de |
|---|---|---|---|
| 1 | Esqueleto (`rig.ts` + `SkinnedMesh`) | 3–5 d | — |
| 2 | Exportar GLB + validação no CI | 2–3 d | 1 |
| 3 | Roupa no mesmo esqueleto | 5–8 d | 1 |
| 4 | Backend: migração, storage restrito, URL assinada | 2 d | 2 |
| 5 | Validação da profundidade com fita métrica | 2 d | — (pode ir em paralelo) |
| 6 | Provador: render do avatar como imagem de modelo do FASHN (§7.2a) + consentimento | 2–3 d | — (não depende do rig) |
| 7 | Provador: calçado e acessório pelo `product-to-model` (§7.2b) | 1–2 d | 6 |
| 8 | (opcional) Rosto B como experimento comparativo | 3–5 d | — |
| 9 | (opcional) Pose, ROM, LOD | 3–5 d | 1 |

Caminho mínimo para um TCC defensável: **1 → 2 → 3 → 4 → 5**. O item 5 é o que produz medição própria, que é o que
uma banca cobra.

O item **6 é o de melhor retorno por esforço de toda a lista** e não depende do rig: hoje o FASHN recebe um manequim
vetorial de Java2D, e trocar isso pelo render do avatar melhora o resultado visível sem tocar em geometria. Se o
tempo apertar, faça 6 antes de 3.

---

## 10. Critérios de aceitação do Plano A

O avatar está pronto quando, e só quando:

1. glTF-Validator devolve **0 erros** para os GLBs das fixtures, no CI.
2. A Unity importa o GLB, mapeia como Humanoid e o Configure não acusa osso obrigatório faltando.
3. Na pose de ligação, a malha com esqueleto é **idêntica** (± 1e-6) à malha estática de hoje.
4. Nas poses de amplitude, nenhuma normal invertida e perda de volume < 25% em cotovelo e joelho.
5. Camiseta, calça e vestido: **nenhuma interseção acima de 2 mm** em pé, sentado e caminhando.
6. Nenhum consumidor do manequim quebra (`avatar-viewer`, `look-viewer`, `runway-scene`, `stage-scene`).
7. O GLB do corpo só é servido ao dono (ou a terceiros quando o avatar é público), com URL assinada.
8. Erro das medidas contra fita métrica **relatado por estrato**, não só a média.
9. **Nenhuma peça aparece fora de um corpo**, em nenhum caminho do provador — o princípio do produto.
10. O provador continua funcionando sem chave de API, pelo compositor local.

E o critério que a investigação já fixou e continua valendo: **nunca aprovar como "fiel"** só por estar completo. A
aprovação exige plausibilidade anatômica, preservação do que a foto mostra, declaração do que foi estimado e
possibilidade de correção pela pessoa.

---

## 11. O que não fazer

- **Não** versionar arquivos de modelo SMPL-X (`.npz`, `.pkl`) nem servi-los ao navegador: a licença proíbe
  distribuição, e o repositório é público.
- **Não** trocar a malha própria por um auto-rig genérico (Mixamo e afins): eles resolvem o caso em que você *não*
  sabe onde estão as articulações — aqui você sabe.
- **Não** acoplar geração de avatar ao `POST /api/auth/register`.
- **Não** colar cabeça de um fornecedor em corpo de outro sem topologia compatível.
- **Não** citar preço de fornecedor no TCC sem captura de tela datada da página oficial — nem o que está fixo no
  código (`0.075` no `FashnTryOnAdapter`, `0.10` no `StabilityFast3dAdapter`), que é número nosso, não do mercado.
- **Não** exibir peça fora de um corpo no provador, nem mesmo o GLB do RF16.
- **Não** enviar o render do avatar a um serviço externo sem consentimento específico: ele carrega a textura do
  rosto, que é dado biométrico.
