# Fashion AI - Assets Localizados e Faltantes por RF

Status: os zips foram inventariados como fonte de verdade visual, mas os binarios nao foram copiados para o repositorio. O backend deve publicar/consumir esses arquivos via S3/MinIO, com um manifesto versionado contendo `id`, `rf`, `categoria`, `subcategoria`, `s3Key`, `mime`, `sha256`, dimensoes, variante e origem.

## Inventario localizado

| RF | Fonte localizada | Quantidade/estrutura | Uso esperado | O que ainda falta |
|---|---|---|---|---|
| RF23 | `/Users/matheushaliski/Downloads/assets_bg_interface_RF23.zip` | 5 PNGs de background de interface | Opcoes em configuracoes de perfil; backend persiste `User.interfaceBackgroundPresetId` | Normalizar nomes, gerar thumbnails, subir para S3/MinIO e criar catalogo de presets. |
| RF4 | `/Users/matheushaliski/Downloads/assets_pecas_de_roupa_FAI.zip` | Zip interno `FAI_Assets_3D_Frontal_78.zip` com 78 PNGs | Catalogo visual/taxonomia de pecas do guarda-roupa | Criar manifesto categoria/subcategoria, hashes e chaves S3. |
| RF4 | `/Users/matheushaliski/Downloads/FASHIONAI/DIAGRAMAS_OFICIAIS/FAI_Subcategorias_por_Categoria.pdf` | 5 categorias, 77 subcategorias + camiseta FAI | Validar taxonomia dos assets de roupa | Transformar em seed estruturado e testes de integridade. |
| RF11, RF23 | `/Users/matheushaliski/Downloads/materiais_com_GIF_nomeados (1).zip` | 12 MP4s animados, cada material em pasta propria, com `indice_de_correspondencia.csv` | Materiais/efeitos animados de fundo | Subir para S3/MinIO e gerar manifesto `animated=true`. |
| RF11, RF23 | `/Users/matheushaliski/Downloads/materiais_sem_GIF_nomeados (1).zip` | 12 JPGs estaticos, cada material em pasta propria, com `indice_de_correspondencia.csv` | Fallback leve/preview dos materiais | Subir para S3/MinIO e gerar manifesto `animated=false`. |
| RF11, RF23 | `/Users/matheushaliski/Downloads/presets_aura_sem_GIF_nomeados.zip` | 18 PNGs de presets AURA, cada preset em pasta propria, com `indice_de_correspondencia.csv` | Presets AURA/interface | Subir para S3/MinIO e gerar manifesto de variantes AURA. |
| RF11, RF23 | `/Users/matheushaliski/Downloads/materiais_mais_presets_sem_GIF_renomeados.zip` | Arquivo recebido tem 626 B e contem apenas a pasta raiz + `__MACOSX`, sem imagens | Fonte pretendida para AURA + material fundidos | Substituido pelos tres pacotes nomeados acima; reexportar se ainda houver assets fundidos AURA+material. |
| RF5 | `/Users/matheushaliski/Downloads/FASHIONAI/desenhos_esquemas_FAI/anatomias_card_v13 (3).html` e `look-do-dia.html` | HTMLs de anatomia/card/look | Referencia para metadados de card e preview de esquema | Extrair tokens visuais para contrato de API/frontend, sem copiar HTML para backend. |
| RF13 | `/Users/matheushaliski/Downloads/FASHIONAI/desenhos_esquemas_FAI/anatomia_cards_DNA_v2 (2).html` | HTML de card DNA | Referencia para representacao do Style DNA | Mapear campos persistidos em `StyleDna` para exibicao futura. |
| RF24 | `/Users/matheushaliski/Downloads/fashionai-diagramas-completo (10)-TOPrompt.zip` | Diagramas, xlsx e markdowns | Fonte de pipeline e provedores | Manter como referencia; nao e asset de runtime. |

## Assets RF23 encontrados

| Ordem sugerida | Arquivo original no zip | Nome tecnico sugerido |
|---|---|---|
| 1 | `ChatGPT Image 22 de set. de 2026, 21_44_46.png` | `rf23-bg-aura-01.png` |
| 2 | `Presets AURA (8).png` | `rf23-bg-aura-02.png` |
| 3 | `Presets AURA (9).png` | `rf23-bg-aura-03.png` |
| 4 | `Sem titulo - 22 de setembro de 2026 as 20.31.03 (2).png` | `rf23-bg-aura-04.png` |
| 5 | `ChatGPT Image 22 de set. de 2026, 21_47_25.png` | `rf23-bg-aura-05.png` |

Observacao: alguns nomes aparecem com acentos corrompidos no `unzip -l`; a normalizacao deve acontecer antes do upload.

## Convencao AURA + Material

Os pacotes nomeados substituem os zips anonimos de `materiais_com_GIF.zip`, `materiais_sem_GIF.zip` e `presets_aura_sem_GIF.zip`. Para assets fundidos AURA + material, a convencao de manifesto esperada e:

| Nivel | Convencao | Exemplo |
|---|---|---|
| Pasta | `{auraPresetId}__{temaCurto}` | `aura_dark_academia__biblioteca` |
| Arquivo fundido | `{auraPresetId}_mais_{materialId}.{ext}` | `aura_natural_organico_mais_laminado_metalico.png` |
| Manifest ID | `{pasta}/{arquivoSemExt}` | `aura_dark_academia__biblioteca/aura_natural_organico_mais_laminado_metalico` |
| S3 key sugerida | `rf11/aura-material/{pasta}/{arquivo}` | `rf11/aura-material/aura_dark_academia__biblioteca/aura_natural_organico_mais_laminado_metalico.png` |

Cada registro do manifesto deve carregar `auraPresetId`, `materialId`, `tema`, `animated=false`, `rf=["RF11","RF23"]`, `sha256`, `mime`, dimensoes e `s3Key`.

## Materiais RF11 encontrados

| Material ID | Animado | Estatico | Prompt RF11 |
|---|---|---|---|
| `la_fria_alfaiataria` | MP4 | JPG | Documentado |
| `cetim_liquido` | MP4 | JPG | Documentado |
| `couro_nappa` | MP4 | JPG | Documentado |
| `veludo_profundo` | MP4 | JPG | Documentado |
| `linho_natural` | MP4 | JPG | Documentado |
| `malha_canelada` | MP4 | JPG | Documentado |
| `acolchoado_azul_marinho` | MP4 | JPG | Pendente: criar fragmento `MATERIAL_DIRECTIONS`. |
| `organza_translucida` | MP4 | JPG | Documentado |
| `brocado_floral` | MP4 | JPG | Pendente: criar fragmento `MATERIAL_DIRECTIONS`. |
| `denim_selvagem` | MP4 | JPG | Documentado |
| `tweed_boucle` | MP4 | JPG | Documentado |
| `laminado_metalico` | MP4 | JPG | Documentado |

## Presets AURA RF11 encontrados

| Preset/variante | Arquivo |
|---|---|
| `aura_alfaiataria__cabides` | `aura_alfaiataria__cabides/aura_alfaiataria__cabides.png` |
| `aura_editorial_mono__estudio` | `aura_editorial_mono__estudio/aura_editorial_mono__estudio.png` |
| `aura_romantico_petala__petalas` | `aura_romantico_petala__petalas/aura_romantico_petala__petalas.png` |
| `aura_boemio_terracota__dunas_douradas` | `aura_boemio_terracota__dunas_douradas/aura_boemio_terracota__dunas_douradas.png` |
| `aura_streetwear_neon__circuitos` | `aura_streetwear_neon__circuitos/aura_streetwear_neon__circuitos.png` |
| `aura_natural_organico__floresta` | `aura_natural_organico__floresta/aura_natural_organico__floresta.png` |
| `aura_boemio_terracota__deserto` | `aura_boemio_terracota__deserto/aura_boemio_terracota__deserto.png` |
| `aura_romantico_petala__brilho_suave` | `aura_romantico_petala__brilho_suave/aura_romantico_petala__brilho_suave.png` |
| `aura_avantgarde_cromo__fluxo_de_luz` | `aura_avantgarde_cromo__fluxo_de_luz/aura_avantgarde_cromo__fluxo_de_luz.png` |
| `aura_esportivo_performance__feixes` | `aura_esportivo_performance__feixes/aura_esportivo_performance__feixes.png` |
| `aura_avantgarde_cromo__cromo_lilas` | `aura_avantgarde_cromo__cromo_lilas/aura_avantgarde_cromo__cromo_lilas.png` |
| `aura_esportivo_performance__diagonais` | `aura_esportivo_performance__diagonais/aura_esportivo_performance__diagonais.png` |
| `aura_glam_noite__palco` | `aura_glam_noite__palco/aura_glam_noite__palco.png` |
| `aura_dark_academia__escritorio` | `aura_dark_academia__escritorio/aura_dark_academia__escritorio.png` |
| `aura_natural_organico__interiores` | `aura_natural_organico__interiores/aura_natural_organico__interiores.png` |
| `aura_boemio_terracota__crepusculo` | `aura_boemio_terracota__crepusculo/aura_boemio_terracota__crepusculo.png` |
| `aura_streetwear_neon__diagonais` | `aura_streetwear_neon__diagonais/aura_streetwear_neon__diagonais.png` |
| `aura_dark_academia__biblioteca` | `aura_dark_academia__biblioteca/aura_dark_academia__biblioteca.png` |

## Taxonomia dos 78 assets de roupa

| Categoria | Quantidade | Exemplos ja localizados no zip interno |
|---|---:|---|
| Parte superior | 18 | camiseta, camisa, blusa, regata, cropped, polo, body, sueter, hoodie, cardigan, colete, blazer, jaqueta, casaco, parka, corta-vento, kimono |
| Parte inferior | 14 | jeans, calca casual, alfaiataria, cargo, chino, moletom, jogger, legging, pantacourt, bermuda, shorts jeans, saia, shorts, short-saia |
| Calcados | 18 | tenis casual, corrida, treino, skate, loafer, cano alto, basquete, mocassim, oxford, derby, botas, sandalia, coturno, chinelo, salto alto, sapatilha, alpargata |
| Acessorios | 22 | bolsas, mochila, cinto, bone, chapeu, gorro, cachecol, gravatas, oculos, colar, pulseira, brincos, anel, relogio, luvas, meias, acessorio cabelo |
| Corpo inteiro | 5 | vestido, macacao, macaquinho, conjunto coordenado, jardineira |
| Variacao inicial | 1 | camiseta_letras_FAI |

## Faltantes por RF

| RF | Faltante | Motivo |
|---|---|---|
| RF4 | `asset_manifest_wardrobe.json` ou tabela seed equivalente | Necessario para ligar categoria/subcategoria ao arquivo e validar uploads. |
| RF5 | Capa/preview padrao de esquema quando nao houver imagem | Evita cards quebrados no feed/lookbook. |
| RF8 | Imagens otimizadas para resultados de busca | OpenSearch deve retornar referencias leves, nao binarios pesados. |
| RF11 | Manifesto S3/MinIO para 12 materiais e 18 presets AURA nomeados | Os arquivos existem nos zips renomeados; falta gerar manifesto/upload. |
| RF11 | Fragmentos de prompt para `acolchoado_azul_marinho` e `brocado_floral` | Estes materiais existem como assets, mas nao constavam nos 10 prompts originais. |
| RF12 | Politica de miniaturas e resolucoes por foto | Fotos originais ficam no S3, mas cards precisam de thumbs. |
| RF13 | Visual preset do DNA por paleta/identidade | O backend ja persiste dados; falta relacionar visual com metadados. |
| RF14 | Logos placeholder e regras de upload de marca | Perfis de marca precisam de midia padronizada. |
| RF18 | Assets de mascara/recorte e exemplos de try-on | FASHN.ai precisa entradas bem definidas e resultados versionados. |
| RF20/RF21 | Selos visuais de aprovado/recusado/caducado | O estado existe no backend; falta asset/contrato visual. |
| RF22 | Placeholder de celebridade verificada | Perfil de celebridade precisa midia padrao. |
| RF23 | Catalogo de backgrounds com `id`, nome exibido, preview e S3 key | Ja ha 5 PNGs; falta transformar em opcoes consumiveis. |
| RF24 | Imagens de fallback por motor de IA | Quando provider falhar, UI precisa representar status sem expor erro tecnico. |

## Proxima etapa recomendada

1. Extrair os zips para uma pasta temporaria fora do repo.
2. Gerar manifesto com hash SHA-256, dimensoes e MIME.
3. Validar manifesto contra a taxonomia oficial.
4. Subir binarios para MinIO/S3.
5. Criar seed Flyway ou configuracao versionada com os IDs publicos dos presets.
