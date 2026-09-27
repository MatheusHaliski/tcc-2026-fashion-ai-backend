# Serviços externos para o avatar 3D e o provador — levantamento e decisão

Levantamento de mercado feito em **27/09/2026** para responder a uma proposta concreta: trocar o pipeline próprio
(MediaPipe no aparelho + corpo paramétrico) por serviços de API pagos, no desenho **RF1 pede 2 fotos → Meshcapade
devolve o avatar → SMPL-X gera o rosto → Browzwear veste as peças → um serviço de imagem→3D gera o modelo da peça**.

O documento tem três partes: o que a apuração derrubou desse desenho (§2–§3), o catálogo completo de fornecedores por
função (§4), e os conjuntos recomendados com custo e risco (§5–§8).

---

## 1. Como ler este documento (ressalva metodológica)

A apuração usou 20 agentes de pesquisa, cada frente com uma rodada de **verificação adversarial** independente. O
resultado tem duas camadas de confiabilidade muito diferentes, e misturá-las seria o erro mais caro aqui:

| Camada | Estado | Por quê |
|---|---|---|
| Fatos técnicos verificáveis em código aberto (GitHub, npm, PyPI) | **confiáveis** | foram lidos em fonte primária, arquivo por arquivo |
| Preços, planos, "existe API self-serve", status de empresa | **não verificados** | a política de rede da sessão recusou (403) praticamente todos os domínios de fornecedor, e o orçamento de buscas esgotou |

Domínios recusados na apuração: `meshcapade.com`, `3dlook.ai`, `avatarsdk.com`, `didimo.co`, `browzwear.com`,
`meshy.ai`, `tripo3d.ai`, `hyper3d.ai`, `stability.ai`, `kaedim3d.com`, `in3d.io`, `readyplayer.me`, `arxiv.org`,
`huggingface.co` e todos os portais de notícia.

**Regra para o TCC: nenhum preço entra no texto sem captura de tela datada da página oficial.** Onde este documento
cita um valor, ele está marcado como *não verificado*, com uma exceção assinalada. A lista de verificação da §9 diz o
que abrir antes de escrever qualquer capítulo.

---

## 2. O que a apuração encontrou sobre o desenho proposto

| Passo | Veredito | Evidência |
|---|---|---|
| **2. Meshcapade devolve o avatar** | Indício forte de descontinuação; **não construa o RF1 em cima disso** | A organização Meshcapade no GitHub está parada e o add-on oficial de Blender ganhou o banner `⚠️ This repository has been discontinued` em **18/03/2026**, redirecionando para o GitLab do Max Planck (`gitlab.tuebingen.mpg.de/jtesch/smplx_blender_addon`). A narrativa de aquisição pela Epic Games apareceu em busca, mas **nenhuma fonte pôde ser aberta** — não cite isso. |
| **3. SMPL-X gera o rosto** | **Erro conceitual** | SMPL-X é um modelo paramétrico M(θ,β,ψ) — 10.475 vértices, 54 juntas. Não tem endpoint, não recebe foto. Herda do FLAME o espaço de **expressão**, não o de identidade facial, e é geometria pura, sem textura. E a Meshcapade **já devolvia SMPL-X**: o passo 3 é o mesmo artefato do passo 2. |
| **4. Browzwear veste as peças** | **Não existe API de runtime** | O SDK roda dentro do processo do VStitcher. Confirmado pelo `vstitcher-job-runner` da Resonance, empresa que industrializou Browzwear: o README diz que o plugin *"runs inside VStitcher itself"* e que o runner *"runs on the same machine as VStitcher"*. Um job documentado leva ~20 minutos. A entrada é **molde 2D + física do tecido**, não um GLB. |
| **5. Mais um serviço de 3D da peça** | **Já está integrado** | `Model3dService` (RF16) orquestra `MeshyModel3dAdapter` → `StabilityFast3dAdapter` → relevo local, como job assíncrono com timeout e um reprocessamento grátis. |

**O ponto que decide tudo:** nenhum dos quatro fornecedores resolve a **semelhança do rosto**, que é o defeito que
originou toda a investigação (`docs/avatar3d/investigacao-pipeline-avatar.md`, §2: *"a semelhança se perdia no
mapeamento da textura"*). A Meshcapade reconstruía forma corporal (os β do SMPL-X) e entregava cabeça genérica, sem
identidade e sem textura facial. Browzwear não toca no rosto. Meshy não toca no rosto. O desenho trocaria um pipeline
de custo zero, que roda no aparelho, por quatro contratos — e o boneco continuaria não se parecendo com a pessoa.

### 2.1 Incompatibilidade interna do desenho

Os passos 4 e 5 se excluem. O passo 5 produz, por imagem→3D, uma **casca fechada** (*watertight*) de escala
arbitrária, sem interior, sem aberturas de gola/manga/barra, sem costura e sem molde. É exatamente o tipo de malha que
um simulador de tecido não aceita como entrada. Não dá para gerar a peça com Meshy e simular com Browzwear.

### 2.2 RF1 não é o lugar

`POST /api/auth/register` hoje é síncrono e responde em milissegundos. Geração de avatar é job de dezenas de segundos
a dezenas de minutos. Além do problema de UX, acoplar isso ao cadastro transforma **consentimento biométrico em
condição para criar conta**, o que a LGPD não admite (art. 11, finalidade específica e destacada).

**Correção:** as duas fotos continuam na proposta, mas como passo **opcional e assíncrono do onboarding**, com
consentimento próprio, e com o avatar paramétrico funcionando enquanto isso.

---

## 3. Correções factuais a propagar

Achados da verificação adversarial que contrariam o que se lê por aí (todos lidos em fonte primária):

- **SPAR3D e Stable Fast 3D não são MIT.** Código *e* pesos estão sob a *Stability AI Community License*, com limiar
  de US$ 1.000.000 de receita anual (limiar confirmado textualmente).
- **TRELLIS não é MIT limpo.** O submódulo `diffoctreerast`, necessário para inferência, proíbe explicitamente uso
  comercial. Serve para o TCC; não serve se virar produto.
- **ContourCraft já suporta SMPL-X** (item marcado como concluído no README), o que o torna a opção neural alinhada ao
  corpo paramétrico. Mas **não** exporta Alembic nem faz re-malha automática — são itens em aberto.
- **XRTailor não é `docker run`.** O Dockerfile tem 13 linhas, é só ambiente de build (Ubuntu 16.04 + CUDA 11.3), sem
  `COPY`, `ENTRYPOINT` ou `CMD`. O esforço real é compilar C++/CUDA.
- **IDM-VTON, OOTDiffusion e CatVTON são CC BY-NC-SA 4.0** — proíbem uso comercial. O Leffa declara MIT, mas o próprio
  README admite ter partido dos dois primeiros: risco de obra derivada.
- **FASHN:** o endpoint que cobre calçado e acessório é o `product-to-model`, **não** o `tryon-max`. E migrar não é só
  trocar o nome do modelo: o campo de entrada muda de `garment_image` para `product_image`, então mudar só
  `fashionai.ai.fashn-model` quebra a chamada. Latências oficiais do v1.6: 5 s / 8 s / 12–17 s. Moda praia e lingerie
  **não** são excluídas — há `moderation_level` configurável.
- **Google Virtual Try-On: US$ 0,06 por imagem** — **o único preço confirmado em tabela oficial** de toda a apuração.
  A saída é marcada com SynthID. "Vertex AI" foi renomeado para "Gemini Enterprise Agent Platform".
- **SAM 3D Body + MHR (Meta):** a licença foi lida por inteiro e **não** tem restrição comercial nem limite de usuários
  ativos. As restrições são de controle de exportação e uso militar.
- **Anny (NAVER LABS):** a topologia SOMA é Apache-2.0; só a topologia SMPL-X dentro dele é não comercial.
- **Licença do SMPL-X:** *non-commercial scientific research*, com cláusula literal de não-distribuição. Servir os
  `.npz`/`.pkl` ao navegador **é** redistribuição, e publicar o repositório com eles dentro também.

---

## 4. Catálogo por função

Legenda de acesso: `self-serve` = cadastro por cartão · `contrato` = falar com vendas · `desktop/SDK` = não é API ·
`self-host` = você roda. Confiança é a da apuração após a verificação.

### 4.1 Corpo 3D a partir de foto

| Serviço | Acesso | Nota |
|---|---|---|
| Meshcapade Me | descontinuado (indício) | entregava SMPL-X com rig e medidas; **nunca** entregou rosto com identidade |
| Avaturn (Goodsize) | self-serve *(não verificado)* | corpo + rosto integrados, GLB pronto para three.js |
| Avatar SDK MetaPerson (itSeez3D) | contrato | confirmar se a REST existe fora do Enterprise |
| in3D (mesma empresa da Avaturn) | contrato | exige escaneamento por vídeo, não 2 fotos |
| Ready Player Me | encerrado | o próprio `investigacao-pipeline-avatar.md` já registra: API encerrada em 31/01/2026 |
| **SAM 3D Body + MHR (Meta)** | self-host | **Apache-2.0, sem trava comercial** — licença lida |
| **Anny (NAVER LABS)** | self-host | Apache-2.0 + assets MakeHuman CC0 |
| SMPL-X / SUPR (Max Planck) | self-host | **não comercial**, com cláusula de não-distribuição |
| MakeHuman / MPFB2 | desktop | assets CC0 |

### 4.2 Medidas corporais por 2 fotos (frente + perfil)

| Serviço | Acesso | Nota |
|---|---|---|
| 3DLOOK Mobile Tailor | contrato | SDK npm ativo (`@3dlook/saia-sdk` 2.19.0, 03/09/2026): `gender`+`height` obrigatórios, `frontImage`/`sideImage`, fluxo assíncrono por *taskset*. **Não documenta download de malha** |
| Bodygram | não verificado | sem org no GitHub, sem SDK npm |
| **Sizebay** | contrato | **brasileira** — evita a transferência internacional de dado sensível |
| Esenca, Size Stream, TG3D, Volumental, Nettelo, MTailor | desconhecido | nada verificável |
| Presize | encerrado | adquirida pela Meta em 2022 |

### 4.3 Rosto 3D com semelhança — o único buraco real

| Serviço | Acesso | Nota |
|---|---|---|
| Avatar SDK Head 2.0 | self-serve? | **decisivo**: confirmar se a Cloud API sai do Enterprise |
| Didimo | desconhecido | `didimo-cli` parado na 2.7.0 desde **18/10/2022** — indício de canal self-serve abandonado |
| Epic MetaHuman | desktop | nunca teve REST; só dentro do Unreal |
| Polywink, Reallusion Headshot 3 | desktop / encomenda | offline |
| DECA / EMOCA / PIXIE / MICA | self-host | reconstrução FLAME, licença *research-only*. PIXIE estima albedo (textura) |
| Union Avatars, Alter | encerrados | — |

**Problema transversal — a costura.** Cada fornecedor usa topologia, UV e rig próprios. Colar a cabeça de um no corpo
de outro exige retopologia, casamento de tom de pele no pescoço e re-skinning: trabalho manual por usuário, não
automatizável num cadastro. Se um dia integrar, prefira um reconstrutor **FLAME**: a cabeça do SMPL-X compartilha o
espaço do FLAME e os autores distribuem listas de correspondência de vértices prontas.

### 4.4 Modelo 3D da peça (imagem→3D)

| Serviço | Acesso | Nota |
|---|---|---|
| **Meshy** | self-serve | já integrado |
| **Tripo3D (VAST)** | self-serve | principal alternativa |
| Rodin / Hyper3D (Deemos) | contrato | API só no plano Business |
| **Stability SF3D / SPAR3D** | self-serve | já integrado; Community License (ver §3) |
| Sloyd.ai, Masterpiece X | self-serve | — |
| Kaedim | contrato | humano no loop, entrega em horas/dias |
| Alpha3D, 3DFY, Hexa, Luma Genie, CSM.ai | desconhecido | status não confirmado |
| Hunyuan3D-2.1 (Tencent) | self-host | licença cobre o Brasil, exclui UE/UK/Coreia |
| TRELLIS (Microsoft) | self-host | ver §3 — não é MIT limpo |
| InstantMesh, Unique3D, Stable Zero123 | self-host | — |

Todos resolvem o problema errado para **vestir**: geram casca fechada de escala arbitrária. Servem como vitrine 3D do
produto. A literatura dedicada (Garment3DGen, Dress-1-to-3, SewFormer, GarmentCode) existe justamente porque nenhum
imagem→3D genérico entrega peça *simulation-ready*.

### 4.5 CAD de vestuário — o que o Browzwear realmente é

Browzwear VStitcher · CLO 3D + CLO-SET · Style3D Atelier · Marvelous Designer (API Python) · Optitex · TUKA3D ·
Assyst Vidya · SEDDI · uDraper.

Nenhum tem API de runtime. Uso realista: **offline**, para produzir a biblioteca de peças já simuladas por tamanho,
exportar GLB, e o app só carregar. O CLO é o mais pragmático (SDK C++ e scripting Python documentados).

### 4.6 Caimento em runtime — a categoria que o passo 4 queria

| Opção | Acesso | Nota |
|---|---|---|
| **LBS no three.js** | self-host | amarrar a peça ao mesmo esqueleto do avatar; é o que a maioria dos provadores 3D comerciais faz |
| **ContourCraft** | self-host | MIT no código, suporta SMPL-X, ~15 fps em GPU |
| HOOD | self-host | MIT; só SMPL |
| XRTailor | self-host | Apache-2.0; ver §3 sobre o esforço real |
| SNUG, DrapeNet, TailorNet, PBNS, GarmentCode | self-host | pesquisa |
| Blender headless (`bpy`) | self-host | **já existe worker GPU no projeto** |
| 3DLOOK YourFit, Perfitly, Fit:Match, Veesual, Vue.ai | contrato | sem preço público |

Nas buscas realizadas, **não foi encontrado** nenhum serviço de nuvem self-serve que aceite (malha SMPL-X + malha de
roupa) e devolva a roupa drapeada.

### 4.7 Try-on 2D generativo (acabamento fotorrealista)

| Serviço | Acesso | Nota |
|---|---|---|
| **FASHN v1.6** | self-serve | já integrado; categorias `auto/tops/bottoms/one-pieces` |
| FASHN `product-to-model` | self-serve | cobre calçado e acessório (ver §3) |
| **Google Virtual Try-On** | self-serve | **US$ 0,06/imagem, preço confirmado**; SynthID na saída |
| Kling/Kolors (via fal.ai), Pixelcut, Photoroom | self-serve | — |
| Veesual, Vue.ai, Botika, Flair.ai | contrato | — |
| IDM-VTON, OOTDiffusion, CatVTON | self-host | **CC BY-NC-SA 4.0 — sem uso comercial** |
| Leffa | self-host | MIT declarado, risco de obra derivada |
| OutfitAnyone | — | só aceita upload de roupa; modelos pré-definidos |

Nenhum fornecedor documenta o comportamento com **render 3D** no lugar de foto. A literatura trata isso como *domain
gap* conhecido.

### 4.8 Categorias que faltavam no desenho

| Função | Situação no projeto |
|---|---|
| Rigging/skinning automático da peça | ausente. Mixamo, AccuRIG, Anything World, ou script Blender no worker |
| Otimização e compressão de GLB | ausente. `components/three/common.tsx:4`, `room3d/room-scene.tsx:6` e `piece-model-viewer.tsx:6` usam `GLTFLoader` puro, sem Draco/meshopt/KTX2, e `MAX_GLB_BYTES = 40 MB` |
| Entrega privada do GLB | o `MediaProxyController` dá cache público de 1 dia fora de `restricted/`. Um GLB do corpo é dado pessoal: precisa de URL assinada |
| Conversão para USDZ (AR no iOS) | ninguém entrega; decidir se está fora de escopo |
| Moderação da foto de corpo e gate de idade | `CONTENT_MODERATION` existe, mas ancorado no RF4 (peça) |
| Fila/worker GPU | **já existe**: `markdowns/runpod-separated-deployment.md` documenta o split `blender-api` + `blender-worker` com imagem publicada e base `runpod/pytorch cu128/torch280` |

---

## 5. Conjuntos recomendados

### Plano A — TCC, sem contratar nada (recomendado)

O conjunto mínimo de serviços externos **novos** é zero.

1. Manter MediaPipe no aparelho + corpo paramétrico + RF40 para o rosto.
2. **Implementado nesta entrega:** profundidade do tronco medida na foto de perfil (§7).
3. Manter FASHN no provador 2D e Meshy/Stability no 3D da peça, como já estão.
4. Se quiser corpo com esqueleto: SAM 3D Body + MHR ou Anny (Apache-2.0) no worker RunPod **que já está pago**.

Custo externo adicional: **R$ 0**. Risco de fornecedor: nenhum. É também o único caminho que sobrevive ao
desligamento de um fornecedor — que foi o que a apuração documentou acontecendo duas vezes (Ready Player Me e,
provavelmente, Meshcapade).

### Plano B — um serviço externo, para a banca ver semelhança de rosto

Plano A + **um** fornecedor de rosto (Avatar SDK Head ou Avaturn), no menor plano com API, usado apenas em uma
demonstração com poucos usuários. **Condição de entrada:** a REST API precisa existir fora do Enterprise. Se só
existir em Enterprise, o plano morre por orçamento, e vale escrever isso no TCC como resultado da investigação.

Sobre o **conjunto de planos a assinar**, de forma geral: em todos os fornecedores desta apuração, o padrão é
*free tier* → *pago mensal* → *Enterprise*, e **a API costuma estar só no topo**. Portanto a ordem de compra é
sempre a mesma: (1) criar conta no *free tier* e tentar emitir uma chave de API — se não emitir, o fornecedor está
eliminado, independentemente do preço; (2) só então assinar o menor plano pago que inclua API, **mensal, nunca
anual**, porque a apuração mostrou que esses produtos somem; (3) medir uma fatura real antes de citar custo no TCC.

### Plano C — produto, fora do escopo de um TCC

Corpo por API (3DLOOK ou Bodygram) + rosto por API + biblioteca de peças produzida offline em CAD + caimento
pré-calculado no worker + FASHN/Google para o acabamento. A apuração estimou um **piso fixo** de assinaturas na casa
de quatro dígitos em dólares por mês *(não verificado)*, independente de volume — a 100 usuários isso é inviável.

### Custo por eixo, para a planilha do TCC

Os três eixos se comportam de forma oposta e precisam ser orçados separados:

| Eixo | Comportamento | Observação |
|---|---|---|
| Por **avatar** | uma vez por usuário | aceitável; cresce com o cadastro |
| Por **usuário ativo** | recorrente todo mês | o mais perigoso |
| Por **try-on** | por clique | explode em uso real; precisa de cota por usuário — o `AiEngine` já tem |

Custos escondidos a contabilizar: armazenamento perpétuo de GLB + textura por usuário; egresso a cada visualização;
e **reprocessamento em massa** quando o formato mudar (`Avatar3dService.MODEL_VERSION = 1`: subir para 2 significa
regerar tudo — e regerar exige colher consentimento de novo).

---

## 6. Riscos

**LGPD.** Hoje a extração roda no navegador e só saem números e a textura facial, que vai para `restricted/`. Enviar
as imagens para um processador estrangeiro transforma o RF1 em tratamento de dado biométrico (art. 11) com
transferência internacional (art. 33). O `ConsentPurpose` já tem `FACIAL_RECOGNITION`, `BODY_MEASUREMENTS` e
`AI_EXTERNAL_PHOTO_PROCESSING`; o que falta é DPA, registro do destinatário e do país, política de retenção e RIPD.

**Termos de uso sobre treinamento.** Nenhuma frente conseguiu verificar se algum fornecedor treina nos uploads. É o
item mais eliminatório da lista: para cada finalista, localizar a cláusula literal e colá-la no TCC.

**Dependência de fornecedor.** O projeto já perdeu o Ready Player Me e o levantamento sugere a perda da Meshcapade.
Isso rende uma seção curta no TCC que **justifica** academicamente a escolha pelo pipeline próprio.

**Menores de idade.** Se houver usuários com menos de 18 anos, a coleta de fotos de corpo inteiro exige consentimento
parental (art. 14) e a transferência internacional desse dado é indefensável.

---

## 7. O que já foi implementado a partir deste levantamento

A ideia mais valiosa da proposta — **a foto de perfil** — não precisa de fornecedor nenhum, e foi implementada:

| Arquivo | O que mudou |
|---|---|
| `lib/avatar3d/body-spec.ts` | `chestD`/`waistD`/`hipD` **opcionais**; `effectiveDepth()`; `buildSpec` usa a profundidade medida quando existe; `validateBody` tolerante (corpo salvo antes continua válido) |
| `lib/avatar3d/body.ts` | `observeProfile()`: mede a profundidade do tronco na foto de lado, com as mesmas regras de origem da foto de frente |
| `lib/avatar3d/metrics.ts` | o erro de proporção passa a conferir também a profundidade |
| `components/avatar3d/body-editor.tsx` | segunda foto (perfil), réguas de profundidade com selo de origem, comparação lado a lado na vista de perfil |
| `Avatar3dService.java` | aceita e valida as três profundidades como campos opcionais |

Decisões que valem registrar no TCC:

- **Sem foto de perfil, nada muda.** A profundidade continua saindo de uma razão fixa sobre a largura
  (`DEPTH_FROM_WIDTH`), agora com nome e marcada como estimativa. Há teste que prova a equivalência do tronco.
- **A foto de perfil não mexe em largura nenhuma**, e a de frente não inventa profundidade. Há teste para os dois.
- **Foto de frente enviada como perfil é recusada** (aviso `NOT_PROFILE`), em vez de gerar números errados.
- **A regra do braço muda de vista.** De frente, o braço encostado soma largura e a medida vira oculta. De lado, o
  braço fica na frente do tronco e normalmente **não** alarga a silhueta — só atrapalha quando sai do contorno.
- **As alturas dos níveis são fixas** (tórax a 72% e cintura a 38% do caminho quadril → ombro, as mesmas que o corpo
  desenha), em vez de "a linha mais estreita": de lado, em quem tem barriga, a mais estreita seria o tórax.

Validação: **82 testes de frontend** (7 novos) e **8 testes** em `Avatar3dServiceTest` (1 novo), todos passando;
`tsc --noEmit` limpo; `scripts/i18n/check.js --fail` com 0 erros.

O que falta para fechar a fase 2 do plano do `investigacao-pipeline-avatar.md`: validar contra fita métrica com os
voluntários previstos na §11 daquele documento, e relatar o erro em cm **por estrato**, não só a média.

---

## 8. Próximos passos sugeridos, em ordem

1. Validar a profundidade contra fita métrica (é o que transforma isto em resultado de TCC).
2. Rodar a lista de verificação da §9 e registrar o que cada fornecedor respondeu.
3. Decidir entre Plano A e Plano B com base no que a §9 devolver — não antes.
4. Se sobrar fôlego: compressão de GLB e URL assinada para o corpo (§4.8), que são baratos e reduzem risco.

---

## 9. Lista de verificação antes de citar qualquer coisa no TCC

Numa rede normal, fora do ambiente desta apuração:

1. Abrir `meshcapade.com` e `me.meshcapade.com` — ainda há cadastro?
2. Criar conta e pagar com cartão pessoal em Avaturn, Avatar SDK e Tripo3D. Se pedir "fale com vendas" ou CNPJ, o
   fornecedor está eliminado para este projeto.
3. **Para cada finalista, transcrever a cláusula literal sobre:** treinamento nos uploads, prazo de retenção,
   endpoint de exclusão, país dos servidores, DPA para pessoa física.
4. Avatar SDK: a Cloud API existe fora do Enterprise? É a pergunta que decide o Plano B.
5. Browzwear: existe licença acadêmica gratuita? E confirmar que a entrada é molde 2D (DXF-AAMA) + física do tecido.
6. Baixar um GLB real de cada finalista e medir: MB, triângulos, resolução de textura e FPS num celular médio na cena
   do Meu Quarto com avatar + 4 peças.
7. Conferir a licença dos **pesos** (não só do código) de qualquer modelo que for rodar no worker.
8. Medir p50 e p95 de latência com 5 fotos suas, por fornecedor, contra o timeout de 10 minutos configurado em
   `Model3dService`.
9. Rodar um mês real com o fornecedor escolhido e conferir a fatura, incluindo IOF e spread do cartão.
10. Alinhar o custo declarado no `StabilityFast3dAdapter` (US$ 0,10 no código) com o preço real da página oficial.
11. Se o repositório for público: garantir que nenhum arquivo de modelo (`.npz`, `.pkl`) seja versionado antes de
    qualquer experimento com SMPL-X.
12. Verificar com a instituição se a coleta de fotos dos voluntários exige submissão a comitê de ética.
