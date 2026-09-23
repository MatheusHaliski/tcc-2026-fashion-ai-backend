# Fashion AI - Servicos de IA por RF

Status: porta `AiProviderPort` e adaptador resiliente inicial criados. As chamadas passam por timeout de 30 s, retry com uma nova tentativa, circuit breaker, rate limit por usuario e auditoria RNF5 com provedor, modelo, latencia e custo estimado. Nenhuma chave de API deve sair do backend.

Fontes usadas: `RF24_MAPEAMENTO_IAS.md`, `RF24_mapa_ia_completo.xlsx`, Trello JSON exportado, diagramas do pacote oficial, `README_RF4.md`, `ANALISE_RF4_Flat_Lay_Pipeline.md`, `ANALISE_RF18_Provador_Virtual_2D.md`, `RFC_COMPLETE_ARCHITECTURE_RF4_RF18.md`, `DRESS_TESTER_PIPELINE_OUTLINE.md`, documentos RF6 Look do Dia/Hype Score e anatomias de cards.

Fonte explicitamente descartada para entidades: `ENTIDADES_RF4_RF5_DIAGRAMA_CLASSES.md`.

## Tabela de motores

| Motor / capacidade | RFs ligados | Provedor principal mapeado | Fallback/local | Entrada principal | Saida esperada | Status backend |
|---|---|---|---|---|---|---|
| Piece Analyzer | RF4, RF24 | Gemini Vision / Claude Vision | YOLO ou classificador local | Foto de peca, metadados opcionais | Categoria, subcategoria, cor, material, tags, confianca | Enum e porta prontos; deve rodar depois/ao lado do flat lay para metadados. |
| Flat Lay Standardizer | RF4, RF18, RF24 | Rembg.com + Cloudinary | OpenCV/PIL/Canvas local; Remove.bg/Cleanup.ai fallback | Upload JPEG/PNG de peca | PNG 1024x1024 padronizado, score de qualidade e metadados por etapa | `PipelineJobType.FLAT_LAY_STANDARDIZATION` modelado. Recomendado: 500-800 ms, US$0.01-0.02/img, 95%+ aceite, 2-3 semanas. |
| Content Moderator | RF1, RF4, RF5, RF19, RF24 | Modelo externo configuravel | Regras locais + lista de bloqueio | Texto/imagem/comentario/perfil | `APROVADO`, `REJEITADO` ou revisao | Boundary pronto; falta politica final de moderacao por CA. |
| Scheme Composer | RF5, RF10, RF24 | Claude / Gemini | Heuristica local por categoria/ocasiao | Pecas do guarda-roupa + contexto | Composicao de look e justificativa | Caso de uso criado; contrato deve respeitar a anatomia do `ClothesScheme`. |
| DNA Synthesizer | RF13, RF24 | Claude / Gemini | Analise local de tags e paleta | Historico de looks, favoritos e respostas | Perfil Style DNA, palavras-chave, paleta | Entidade `StyleDna` pronta; falta pipeline de inferencia. |
| Background Generator | RF11, RF23, RF24 | Adobe Firefly / Stable Diffusion / Replicate / Gemini Image | Presets estaticos RF23 e composicao local | Prompt, estilo, dimensoes, contexto visual | Imagem de fundo ou preset selecionavel | Storage e job prontos; falta adaptador especifico. |
| SealBond Matcher | RF20, RF21, RF24 | Embeddings locais / matcher semantico | Regras por marca/celebridade/catalogo | Look, tags, marca, celebridade | Score de afinidade e recomendacao de vinculo | Entidade de vinculo pronta; falta scorer real. |
| Style Advisor | RF10, RF13, RF24 | Claude / Gemini | Regras locais por ocasião/clima/tags | Pergunta do usuario + perfil + guarda-roupa | Conselho de estilo | Porta pronta; falta prompt e politicas. |
| Insight Generator | RF6, RF13, RF14, RF24 | Claude / Gemini | Agregacoes locais | Eventos, posts, looks, engajamento e Hype Score | Insights textuais e metricas interpretadas | Boundary pronto; RF6 usa sugestao IA sobre pior percentil do breakdown. |
| Brand Resolver | RF14, RF20, RF24 | Resolver externo configuravel | Catalogo local + similaridade textual | Nome/logo/URL/tag | Marca normalizada, confianca, possivel perfil | Perfil de marca pronto; falta base/crawler permitido. |
| Copilot | RF10, RF24 | Claude / Gemini | Fluxo local de recomendacoes | Conversa + contexto Fashion AI | Resposta assistiva e acoes sugeridas | Endpoint inicial `/api/ai/invoke`; falta orquestracao conversacional. |
| StyleInsight / PatternAnalysis | RF13, RF24 | Claude / Gemini | Estatistica local + embeddings | Historico de estilo | Padroes, lacunas e preferencias | `StyleDna` cobre persistencia; falta job analitico. |
| Edit Assistant | RF9, RF15, RF24 | Gemini / Claude | Validacoes locais | Pedido de edicao + objeto fashion | Patch sugerido, tags e validacoes | Caso de uso criado; falta politica de patch. |
| Acervo Grouping AI | RF4, RF8, RF13, RF24 | Embeddings locais | Clustering local | Pecas/fotos/tags | Grupos de acervo e colecoes | Portas de busca/storage prontas; falta job de clustering. |
| Affinity AI | RF17, RF19, RF20, RF21, RF24 | Embeddings locais | Heuristica por follows/reacoes/tags | Grafo social e interacoes | Ranking de usuarios/marcas/celebridades | Cassandra/Redis previstos; falta algoritmo. |
| 3D Generator / Meshy | RF16, RF24 | Meshy | Fora de escopo operacional inicial | Imagem/prompt/modelo base | Asset 3D | RF16 tratado como fronteira futura; sem chamada real ainda. |
| Outfit Render / Try-on AI | RF18, RF24 | FASHN.ai | Replicate/Miralabs ou modelo proprio futuro | Scheme + pecas principais | Manequim 2D vestido com peca base | `PipelineJobType.OUTFIT_RENDER` modelado. Recomendado: base FASHN.ai em 2-3 s, US$0.05-0.10. |
| Try-on Polish AI | RF18, RF24 | Cleanup.ai | Pos-processamento local simples | Resultado FASHN.ai | Imagem refinada sem artefatos | Recomendado para reduzir distorcoes em ~80%; custo adicional US$0.02-0.05/img. |
| Accessory/Canvas Compositor | RF18, RF24 | Local Canvas 2D | Rembg.com para isolar camadas | Imagem refinada + calcados/acessorios | Outfit completo com tenis/acessorios | Etapa local do pipeline RF18; cobre lacuna de FASHN.ai para shoes/accessories. |
| Category Fallback Compositor | RF4, RF5, RF11, RF24 | Local | Presets de assets/taxonomia | Categoria/subcategoria + asset base | Preview composto quando IA falha | Depende do manifesto de assets. |
| Photo Curator AI | RF12, RF24 | Gemini Vision / Claude Vision | Regras locais por qualidade/hash | Fotos do usuario | Ranking, descarte, tags e capa sugerida | Entidade `Photo` pronta; falta curadoria real. |

## Decisoes de pipeline RF4/RF18

| RF | Alternativa recomendada | Custo/tempo estimado | Motivo |
|---|---|---|---|
| RF4 | Pipeline hibrido: Rembg.com, OpenCV local, Cloudinary/PIL, Canvas/Sharp, validador local | US$0.01-0.02 por imagem; 500-800 ms; implementacao 2-3 semanas | Melhor custo-beneficio, aceite esperado 95%+, rapido o suficiente para UX quase sincrona. |
| RF4 | Fine-tuned SDXL/ControlNet | US$0.008-0.02 por inferencia + treinamento US$500-1500; 3-6 meses | Maior qualidade, mas exige dataset e manutencao mais complexa. |
| RF4 | Processamento local puro | Custo externo zero na happy path; 200-400 ms; 1 semana | Barato, mas qualidade inconsistente e fallback frequente. |
| RF18 | FASHN.ai + Cleanup.ai + Rembg + Canvas 2D compositor | US$0.09-0.15 por outfit; 3-5 s; implementacao 2-4 semanas por fases | Corrige distorcoes, adiciona tenis/acessorios e preserva arquitetura modular. |
| RF18 | Modelo proprio/fine-tuned com GPU | US$0.01-0.03 por imagem depois do setup; 2-3 meses | Melhor controle no medio prazo, mas fora do primeiro corte. |
| RF18 | FASHN.ai + ajustes locais simples | US$0.05-0.10 por imagem; curto prazo | Paliativo rapido, mas nao resolve cobertura completa de acessorios. |

## Pendencias RF11 AURA/material

| Item | Situacao |
|---|---|
| Presets AURA | 18 variantes nomeadas em `presets_aura_sem_GIF_nomeados.zip`; todas devem entrar no manifesto RF11/RF23. |
| Materiais documentados | 10 materiais ja possuem fragmento em `RF11_PROMPTS_AURA_MATERIAIS (2).md`. |
| Materiais novos | `acolchoado_azul_marinho` e `brocado_floral` aparecem nos zips nomeados, mas ainda precisam de fragmentos de prompt para `MATERIAL_DIRECTIONS`. |
| Assets animados/estaticos | Cada material possui MP4 animado e JPG estatico; usar JPG como preview/fallback e MP4 quando a UI aceitar movimento. |

## Variaveis de ambiente previstas

| Variavel | Uso |
|---|---|
| `AI_GEMINI_API_KEY` | Vision, texto e possiveis imagens Gemini. |
| `AI_CLAUDE_API_KEY` | Texto/vision quando usado como provedor principal ou fallback. |
| `AI_REPLICATE_API_KEY` | Geracao/edicao de imagem e possiveis modelos hospedados. |
| `AI_FASHN_API_KEY` | Try-on RF18. |
| `AI_FIREFLY_API_KEY` | Background generator RF11/RF23, se aprovado. |
| `AI_MESHY_API_KEY` | RF16 futuro. |

## Eventos de auditoria obrigatorios nas chamadas IA

| Campo | Regra |
|---|---|
| `actor` | Usuario autenticado ou `system` quando job interno. |
| `acao` | `CHAMADA_IA`. |
| `recurso` | Nome do motor/capacidade e job relacionado. |
| `resultado` | Sucesso, falha, timeout, circuit-open ou rate-limited. |
| `metadata` | Provider, modelo, latencia, custo estimado e correlation id; nunca prompt sensivel, token, senha ou conteudo cifrado. |
