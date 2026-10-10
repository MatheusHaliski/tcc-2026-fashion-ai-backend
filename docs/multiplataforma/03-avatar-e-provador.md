# 03 — Avatar canônico e provador

## 1. Identidade canônica do avatar

A identidade da pessoa é **dado do FashionAI**, não um asset de engine. Ela já existe versionada
(`avatar_identity_versions`, V42) e é o que todas as plataformas desenham:

| Característica | Onde está hoje | Origem registrada | Lacuna |
|---|---|---|---|
| Forma do rosto (468 pontos, pose neutra) | `model_json.shape` | vista de frente = OBSERVED; profundidade OBSERVED só com vista de perfil e sem `DEPTH_ESTIMATED` | sem confiança por região |
| Queixo, mandíbula, proporções | derivadas da forma | medidas nomeadas no manifesto (`jawWidthCm`, `jawToFaceRatio`, `chinHeightCm`, `faceWidthCm`, `faceHeightCm`) | — |
| Corpo (estatura, ombros, peito, cintura, quadril, pernas, braços, cabeça, porte, profundidades) | `model_json.body.params` | `observed` / `user` / `estimated` / `default` por medida | profundidades quase sempre estimadas (falta foto lateral) |
| Tom de pele | `model_json.skin` (balanço de branco pela esclera) | OBSERVED; USER quando a pessoa ajustou | — |
| Cabelo (cor, tom, corte, comprimento, textura, volume, silhueta) | `model_json.hair` + `adjust` | OBSERVED (frente/lados), USER (ajuste), parte de trás sempre ESTIMATED | — |
| Barba e bigode | **só na textura do rosto** | NOT_CAPTURED como geometria | **sem parâmetros** — o groom da Unreal precisa deles: pedido `CONFIRM_FACIAL_HAIR` |
| Características visíveis (óculos, sardas, pintas, cicatrizes, tatuagens, piercings) | não modeladas | NOT_CAPTURED | pedido opcional `DECLARE_VISIBLE_FEATURES` |

**Manifesto canônico** (`GET /api/me/avatar3d/canonical`, implementado): `identityHash` (SHA-256 do conteúdo
canônico com chaves ordenadas e números com 4 casas), origem de cada característica, pedidos de vista/correção e o que
cada perfil de qualidade muda. Dois aparelhos que mostram o mesmo `identityHash` estão desenhando a mesma pessoa.

**Nunca prometer reconstrução perfeita de uma foto.** O app mostra, ao lado do avatar, o que foi medido e o que foi
deduzido, e oferece os pedidos do manifesto (foto de perfil, foto de corpo de lado, confirmar barba, corrigir medidas).

### Privacidade

- Fotos de origem **não saem do aparelho** (já é assim no web; os apps mantêm: MediaPipe nativo no iOS/Android/desktop).
- Sobem só o modelo (números) e o atlas do rosto, em chave `restricted/` servida pela API com checagem de dono.
- Pessoa vê e restaura versões, aprova ou não, e apaga tudo (`DELETE /api/me/avatar3d` remove versões e texturas).
- Pendências: B1 (exclusão de conta efetiva) e B2 (mídia pública) do documento 01.

### Representação na Unreal (marco 3)

- **Corpo base:** o mesmo corpo MPFB2/MakeHuman (CC0) do web, importado como Skeletal Mesh `FAI_BODY_V1`, com o mesmo
  esqueleto (nomes Mixamo) e os mesmos morph targets. Assim, web e Unreal deformam a partir dos **mesmos parâmetros**.
- **Rosto:** os 468 pontos resolvem pesos de morph targets de rosto (mesma regressão do web, portada para C++), mais
  o atlas como textura base do material de pele.
- **Por que não MetaHuman como base canônica:** a licença de MetaHuman restringe o uso a renderização na Unreal; o
  cliente web (three.js) não poderia desenhar a mesma malha e as identidades divergiriam. MetaHuman pode entrar depois
  como **representação de alta qualidade** no perfil `DESKTOP_HIGH`/`CONSOLE`, se passar no teste de identidade da
  seção 4 do documento 04 [verificar licença vigente].
- **Cabelo, barba, bigode:** Groom (Strands) no desktop/console, cards no celular — gerados a partir dos mesmos
  parâmetros (cor, tom, volume, silhueta, comprimento). O teste de identidade compara silhueta e cor entre perfis.
- **Pele:** Subsurface Profile no desktop/console, SSS pré-integrado no celular; mesma cor base (ΔE ≤ 2 entre perfis).

## 2. Provador

### Regras (implementadas na sessão do provador)

- Quatro lugares: **TOP** (parte de cima), **BOTTOM** (parte de baixo), **SHOES** (calçado), **ACCESSORY** (acessório),
  decididos pela categoria gravada (`upper_piece`, `lower_piece`, `shoes_piece`, `accessory_piece`). Peça inteira
  (`full_body_piece`) ocupa TOP e libera BOTTOM; vestir BOTTOM tira a peça inteira.
- Experimentar **não** pede título, **não** cria look, **não** publica. "Salvar como look" é ação separada e opcional.
- Estado por conta, sincronizado entre aparelhos, com revisão (`ETag`/`If-Match`) e 412 quando outro aparelho mudou.
- Cada peça vem com a representação para o perfil do aparelho:
  - `MESH_3D`: existe `garment_assets_3d` **APPROVED** para a peça (ou para o produto do catálogo de onde ela veio),
    com arquivo para o perfil ou para um perfil mais leve da mesma família;
  - `PREVIEW_2D`: a foto da peça, com o rótulo "Prévia 2D — esta peça ainda não tem modelo 3D aprovado…". A interface
    mostra a prévia ao lado do avatar (ou como cartão sobre ele), **nunca** colada no corpo como se fosse roupa 3D.

### Asset 3D de roupa que veste

| Requisito | Como é garantido |
|---|---|
| Veste o avatar e acompanha poses | Skeletal Mesh com pesos no esqueleto `FAI_BODY_V1`; morph targets do corpo transferidos (a roupa acompanha o corpo de cada pessoa); Chaos Cloth nas partes soltas nos perfis que permitem |
| Preserva cor, estampa, logos autorizados e detalhes | Métricas `colorDeltaE` (≤ 3,0), `patternSsim` (≥ 0,85), `logoSsim` (≥ 0,90) contra a foto oficial; logo só com `logo_authorization = AUTHORIZED` e referência da autorização |
| Interseção | `penetrationP99Mm` ≤ 1,5 mm por pose |
| Cobertura | `coverage` ≥ 0,98 da região que a peça deve cobrir |
| Folga | `minEaseMm` ≥ 0 nas regiões justas |
| Deformações | `maxStretch` ≤ 1,10 e `maxCompression` ≥ 0,90 nas arestas |
| Poses testadas | A_POSE, WALK, SIT, ARMS_UP, TWIST — todas obrigatórias |
| Aprovação | gate automático (`GarmentFitGate`) → `IN_REVIEW` → revisão humana → `APPROVED`; aprovar aposenta a versão anterior |
| Tamanho | limite por perfil (3 MB celular, 12 MB desktop/console) |

Os limites são **propostos** e precisam ser calibrados com os primeiros 20 assets reais (marco 3). As métricas são
medidas pela ferramenta de importação (commandlet da Unreal que veste o corpo de referência e os corpos extremos do
conjunto de teste, roda as poses e mede) — essa ferramenta é trabalho do marco 3.

### Produção de assets (fontes possíveis)

| Fonte | Uso | Observação |
|---|---|---|
| PATTERN — moldes paramétricos (porte dos moldes procedurais do web para gerador offline) | básicos (camiseta, calça, saia, tênis genérico) | bom custo; cor/estampa vêm da foto |
| ARTIST — modelagem (Marvelous Designer/Blender) | peças de catálogo de marca | melhor fidelidade; custo por peça (ver 07) |
| GENERATED — Meshy/RF16 + retopologia + rig | prova de conceito | o GLB do RF16 hoje não tem esqueleto nem aprovação; só entra após retopologia, rig e gate |
| SCAN | peças físicas de parceiros | depende de equipamento |
