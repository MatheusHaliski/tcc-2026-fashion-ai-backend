# Auditoria e correções do provador 3D — 9 de outubro de 2026

O provador executa **Three.js/WebGL no navegador**, com React Three Fiber e Drei. Não executa Unreal Engine nem ray tracing. A roupa atual é uma malha paramétrica independente, derivada do corpo e ligada ao seu esqueleto; sua aparência usa uma fotografia e uma amostra de tecido. Isso permite uma **prévia aproximada**, mas não comprova corte, tamanho ou caimento físico do produto.

Esta entrega aplica as recomendações do texto de auditoria enviado: remove exposição sem função, separa fotografias de produtos de assets 3D, mantém a avaliação cromática neutra e impede que fotografias de modelos sejam aplicadas sem isolamento da roupa. **Não certifica qualidade AAA nem considera concluída uma prova física por SKU.** O inventário local contém 9.573 produtos em 75 subcategorias e nenhum asset 3D de produto declarado.

## Escopo e origem dos dados

- Inventário: `data/catalog/acervo/acervo-oficial-2026-10-05.jsonl.gz`, fonte `SNAPSHOT_LOCAL`. Não é uma nova consulta ao MySQL de produção.
- Amostra de referência: três blazers reais da AllSaints, com nomes, códigos, páginas oficiais e fotografias do snapshot. As fotografias baixadas foram mantidas em cache no harness para garantir repetição; a segmentação MediaPipe e a renderização não foram simuladas.
- Browser: Chromium com SwiftShader em 1.180 × 800; recortes da área de prova de 1.180 × 780. Os tempos desta máquina não são um benchmark de GPU de celular.
- [Inventário completo por subcategoria](evidence/provador-2026-10-09/subcategories.json) e [produtos utilizados](evidence/provador-2026-10-09/snapshot-products.json).

## Caminho real: seleção até renderização

| Etapa | Arquivo / contrato | Comportamento observado |
|---|---|---|
| Página e seleção | `app/(site)/(app)/try-on/page.tsx`, `components/try-on/fitting-room.tsx` | `FittingRoom` coordena loja, catálogo, guarda-roupa, slots, vista e iluminação. |
| Catálogo e banco | `CatalogController`, `application/catalog/CatalogService`, entidades `CatalogProduct` e `CatalogImage` | `/api/catalog/stores`, `/api/catalog/search` e `/api/catalog/products/{id}` retornam identidade, variante, referência e imagem. A imagem canônica tem prioridade sobre a primária. |
| Processamento da fotografia | `application/catalog/image/CatalogImagePipelineService`, `CatalogImagePipeline`, estratégias de enquadramento | Recorte semântico e padronização de fotografia; não geram malha, rig, UVs ou propriedades físicas da roupa. |
| Adaptação da peça | `lib/tryon/fitting-room-model.ts`: `fromCatalog`, `fromWardrobe`, `toLook3d` | Mantém identidade, categoria, imagem e cor. O catálogo atual não fornece asset 3D por SKU. O guarda-roupa pode trazer `model3dUrl`; isso não equivale a um contrato de vestimenta rigada e validada. |
| Perfil do ambiente | `use-fitting-scene.ts`, `scene.ts`, `fitting-studio.ts` | Resolve a marca e cria um perfil conceitual. Fotografias antigas ou de origem desconhecida são descartadas em ambiente de marca. |
| Cena | `components/three/fitting-room-scene.tsx`, `store-fixtures.tsx` | Sala, mobiliário, comunicação e luzes neutras; fotos em molduras, identificadas como referências. |
| Corpo e roupa | `mannequin.tsx`, `human-avatar.tsx`, `human-outfit.tsx` | Corpo MakeHuman/MPFB2; carregamento `fai-body-v1.json/.bin`. Cada roupa gera `SkinnedMesh` independente com os mesmos ossos do corpo. |
| Ajuste aproximado | `human/garments.ts`, `garment-relax.ts`, `garment-layers.ts`, `garment-trims.ts`, `shoes.ts` | Cobertura e folga por categoria, suavização, relaxamento, camadas, barras/golas e formas de calçados. Não existe simulação Chaos Cloth neste runtime. |
| Imagem e material | `garment-photo.ts`, `person-filter.ts`, `garments.ts` | Verifica pessoa/roupa antes de aplicar foto. Frente recebe referência; mangas, lados e costas recebem amostra/cor do tecido. Textura sRGB; material físico genérico com roughness/sheen por família. |
| Movimento | `human/pose.ts` | Skinning e pose natural/idle. Nesta sala `sway=false`; a rotação 360° é controlada pela câmera. Não há teste físico de caminhada/agachamento por SKU. |

### Classificação da vestimenta encontrada

A roupa **não altera o material da pele** e não é somente uma imagem plana. O código cria outra geometria e outros materiais. Entretanto, o molde segue famílias genéricas; a foto frontal é projetada nessa malha. Um blazer é adaptado da família `jacket`, com folga específica, sem uma modelagem digital fiel de lapelas, forro, costuras e tamanho do SKU. Este ponto continua sendo uma limitação de asset, não uma prova 3D concluída.

Acessórios sem asset dedicado não têm representação física certificada. O ramo legado de `mannequin.tsx` admite GLB e representações fotográficas de acessórios; o fluxo humano atual não estabelece transferência de pesos, colisões e aprovação de um GLB por SKU. Ativar um plugin ou aceitar uma URL GLB não resolve esses contratos.

## Causas e correções implementadas

| Falha | Causa comprovada | Correção e evidência |
|---|---|---|
| Fotografias sobre pedestais e em araras como roupas | Expositores combinavam planos de fotografia com volumes de exposição sem asset correspondente. | Removidos da sala. Até duas referências aparecem em molduras com legenda; não são apresentadas como roupas 3D penduradas. Capturas antes/depois abaixo. |
| Ambiente excessivamente tingido pela marca | Cores de identidade eram aplicadas em grandes superfícies e luzes. | Paredes, piso, cortina e iluminação neutros. Cor de marca aparece somente no detalhe da placa; `NeutralToneMapping`, exposição 1, texturas sRGB. Perfil conceitual explicitamente identificado. |
| Produtos da marca anterior após trocar loja | O perfil anterior poderia conservar o conjunto de exposição. | `resolveFittingStudio` filtra por marca, remove duplicatas e limita a galeria. `Room key={env.key}` recria o conjunto na troca. Teste de marca preserva a origem real dos produtos; não renomeia fotografias AllSaints para Lacoste. |
| Modelo humano pintado sobre a roupa | O filtro antigo só analisava superiores com proporção de corpo inteiro; fotos de meio corpo e outras famílias podiam passar. | Todos os grupos passam por isolamento com parte explícita: `upper`, `lower`, `full` ou `feet`. Sem segmentação comprovada, múltiplas pessoas ou isolamento incoerente, a referência é rejeitada e permanece a prévia uniforme. |
| Packshot confundido com falha de segmentação | Um resultado sem máscara era tratado como “sem pessoa”; o limite antigo de 5 s também podia vencer antes dos modelos locais carregarem. | `segmentationAvailable` distingue ausência de pessoa comprovada de modelo indisponível. Análise limitada a 30 s, malha já vestida durante processamento; resultados são reutilizados por imagem e parte. Os assets padrão locais conhecidos dispensam análise desnecessária. |

## Diagnóstico específico do packshot USM001QD-5

A primeira análise local da fotografia original levou **15.363 ms**, com zero pessoas, sem pose/rosto e máscara contendo somente fundo e roupa. Esse tempo excedia o limite anterior de 5 s; ausência de pessoa não era o motivo correto para descartar o packshot.

Na verificação final, **o pipeline real retornou uma fotografia preparada de 819 × 1.024 em 6.669 ms**. A confirmação com modelos já carregados levou 581 ms: `personFound=false`, `people=0`, `segmentationAvailable=true`, `garments=null`, `canUseOutfitPhoto=true`. Não foi removida nenhuma proteção contra projeção de pele/modelos. As mensagens “Created TensorFlow Lite XNNPACK delegate” são diagnósticos informativos, não erros de JavaScript.

[Resultado reproduzido](evidence/provador-2026-10-09/packshot-outfit-analysis.json) · [primeira análise da máscara](evidence/provador-2026-10-09/packshot-analysis.json).

O resultado confirma que **esse packshot é aceito**, não que um blazer preto reproduza sua construção física. Fotos com pessoas sem pose útil, segmentação ausente ou regiões não isoláveis continuam podendo usar cor uniforme. O timeout limita a espera assíncrona; inferências síncronas no thread principal podem afetar a responsividade em aparelhos lentos. Um worker dedicado continua sendo uma melhoria futura.

## Inventário dos objetos da cena

| Objeto | Função | Escala aproximada |
|---|---|---|
| Sala / piso / teto | Circulação e iluminação de prova | Largura 7,2 m; altura 3,2 m |
| Placa de identidade | Comunicação da marca selecionada | 1,48 × 0,50 m |
| Cortina e trilho | Privacidade de prova | Cortina 1,45 × 2,50 m |
| Espelho | Referência de prova | 0,82 × 2,18 m; superfície metálica, sem reflexão planar dinâmica |
| Banco | Sentar durante a prova | Assento a 0,46 m |
| Trilho com cabides | Organização | Sem fotografias fingindo roupas penduradas |
| Galeria | Comunicação da referência visual | No máximo duas fotos em molduras com nome do produto |

Não existem referências arquitetônicas oficiais de lojas no contrato atual. A sala é uma interpretação neutra e conceitual, não uma reprodução da AllSaints ou Lacoste.

## Matriz de validação e evidências

| ID real | Referência | Corpo / tamanho / cenário | Verificado | Limite |
|---|---|---|---|---|
| USM001QD-5 | Renegade Single Breasted Blazer; fotografia oficial | Corpo padrão masculino; tamanho real não transferido; sala conceitual AllSaints | Referência aceita por segmentação real; material/malha da prévia; vistas frontal, lateral e traseira | Corte e tamanho físico do produto não comprovados |
| USM009QD-5 | Germain Satin Single Breasted Blazer; fotografia oficial | Referência da galeria AllSaints | Exposição fotográfica deliberada, sem pedestal ou falsa arara | Não foi vestido e animado em todas as vistas; sem SKU 3D |
| USM016QE-5 | Leat Slim Fit Double Breasted Blazer; fotografia oficial | Candidato do mesmo catálogo | Limite da galeria impede acúmulo das três fotografias | Não foi vestido e animado em todas as vistas; sem SKU 3D |
| Troca AllSaints → Lacoste | Produtos mantêm sua marca AllSaints | Mesma prova, ambiente conceitual Lacoste | Referências AllSaints devem sair; a roupa escolhida permanece | Fixture não contém produto Lacoste: galeria correta é vazia |

Capturas históricas mostram a mesma peça e vistas antes/depois da correção de ambiente. Elas não medem equivalência cromática nem aprovam modelagem física.

| Vista | Antes | Depois |
|---|---|---|
| Frente | [captura](evidence/provador-2026-10-09/before-front.png) | [captura](evidence/provador-2026-10-09/after-front.png) |
| Perfil | [captura](evidence/provador-2026-10-09/before-side.png) | [captura](evidence/provador-2026-10-09/after-side.png) |
| Costas | [captura](evidence/provador-2026-10-09/before-back.png) | [captura](evidence/provador-2026-10-09/after-back.png) |

A captura antiga de “troca de marca” não é usada como prova: o harness renomeava incorretamente a marca dos produtos. A versão final mantém a origem AllSaints e valida o descarte por marca; os testes automatizados também cobrem essa regra.

### Testes executados

```bash
npx vitest run \
  lib/scene3d/fitting-studio.test.ts \
  lib/pieces/person-filter.test.ts \
  lib/avatar3d/human/garment-photo-person.test.ts \
  lib/avatar3d/human/garment-photo.test.ts \
  lib/avatar3d/human/garments.test.ts --maxWorkers=1
```

**46 testes passaram em cinco arquivos.** Cobrem origem/limite da galeria, troca de marca, isolamento por categoria, máscara ausente, múltiplas pessoas, timeout, cache, textura de tecido, continuidade de barras, UVs laterais/traseiros e skinning. As regressões geométricas existentes usam corpos masculino/feminino e pose idle, com tolerância localizada de penetração; não substituem medidas e provas físicas por produto. Não foi medida uma taxa de FPS, memória, ΔE de cor ou colisão de todas as 75 subcategorias nesta entrega.

## Atendimento às recomendações e pendências explícitas

| Recomendação enviada | Situação desta entrega |
|---|---|
| Rastrear tecnologia, dados e pipeline | Implementado e documentado acima |
| Remover pedestais, fotos flutuantes e exposição sem função | Implementado na sala do provador |
| Perfil conceitual quando não há referências oficiais | Implementado; reprodução de loja real não alegada |
| Identidade sem contaminar cor da roupa | Implementado no ambiente/material; métricas de cor controladas ainda não coletadas |
| Separar malha de roupa de pele / fotografia / asset por SKU | Construção real auditada; prévia genérica continua identificada como aproximação |
| Inventariar todas as categorias/subcategorias | Inventário completo do snapshot, 75 subcategorias, 9.573 produtos; nenhum SKU com asset 3D declarado |
| Provar peça exata 360°, wireframe, corpo oculto e vídeo de movimento | Vistas da prévia disponíveis; não há homologação física por SKU, vídeo ou pacote completo de inspeção de pesos/colisões nesta entrega |
| Ensaiar tamanhos, corpos, caminhada e agachamento de todas as famílias | Pendente: exige assets, medidas, rig e configurações de tecido por SKU |
| Critérios quantitativos por dispositivo/categoria | Regressões de código e tempo de análise coletados; benchmark completo ainda pendente |
| Migrar para Unreal / Skeletal Mesh / Physics Asset / Chaos Cloth | Não implementado nem executado neste Web App; planejamento depende da versão de Unreal e assets efetivamente adotados |

Para uma prova 3D homologada, cada SKU/variante precisa declarar malha completa, UVs, mapas de Base Color/normal/roughness, unidade de medida, rig e pesos, corpo/tamanhos suportados, folga, colisões, LODs, versão e evidências de aprovação. Camisas precisam de mangas/gola/barras próprias; calças, cós/entrepernas/pernas; saias e vestidos, volumes independentes; calçados, fôrma/sola; acessórios, pontos de fixação. Esses contratos ainda não são fornecidos pelas fotografias do catálogo.

Enquanto esses dados não existirem, “prévia aproximada”, “processando fotografia”, “fotografia não isolável” e “sem asset 3D homologado” são estados distintos. O runtime já mantém a roupa genérica durante processamento/falha, e o provador apresenta o aviso de prévia; não existe aprovação física automática de uma peça porque sua fotografia carregou ou porque a cena renderizou sem erro.
