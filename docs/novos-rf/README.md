# Novos RF (RF25–RF50): índice e mapa de numeração

A **numeração oficial é a do Trello** (board "TCC 2026 (Fashion AI) - Bryan,Matheus", lista *Requisitos Funcionais*).
Parte do código anterior usa outra numeração nos comentários e nos `@Operation` do Swagger, porque os requisitos do
Meu Guarda-Roupa foram implementados antes de o time reordenar o board. A tabela abaixo liga as duas numerações.

| Trello | Requisito | No código (comentários/Swagger) | Especificação | Diagramas |
|---|---|---|---|---|
| RF25 | Criar & editar selo de marca/celebridade + política de promoção | RF25 | cartão Trello · [diagrama do fluxo de cupons](RF25_Selos_Promocoes_Cupons_Atividades.png) | `docs/diagramas/RF25/` |
| RF26 | Explorador Global | RF26 | pacote de diagramas `RF26/` | `docs/diagramas/RF26/` (classes e componentes novos) |
| RF27 | Meu Quarto 3D | **RF32** | `docs/meu_guarda_roupa/01-especificacao-meu-quarto.md`, `docs/meu-quarto/05-elementos-do-quarto.md` | `docs/diagramas/RF27/` |
| RF28 | Smart Mirror + Vista-me | **RF33** | `docs/meu_guarda_roupa/01…` §2 | `docs/diagramas/RF28/` |
| RF29 | FAI Inventory Score, destaques e rankings | **RF34** | `docs/meu_guarda_roupa/02-inventory-score-calculo.md` | `docs/diagramas/RF29/` |
| RF30 | FAI Points, níveis e loja do quarto | **RF35** | `docs/meu_guarda_roupa/01…` §5 | `docs/diagramas/RF30/` |
| RF31 | Estados do acervo (favorita, disponível, indisponível, à venda) | **RF10 CA08–CA16** / RF7 | `docs/meu_guarda_roupa/01…` | `docs/diagramas/RF31/` |
| RF32 | Desafios (solo, duelo, grupo, equipes, comunidade) | **RF36** | `docs/meu_guarda_roupa/03-desafios-e-games.md` | `docs/diagramas/RF32/` |
| RF33 | Passarela 3D (Top 100 Global/Regional/País, filtros) | RF33 ("Passarela 3D") | [RF33-RF35.md](RF33-RF35.md) | `docs/diagramas/RF33/` |
| RF34 | Eras da celebridade (Insights de Eras, My Stage 3D) | RF22 (aba Eras) | [RF33-RF35.md](RF33-RF35.md) | `docs/diagramas/RF34/` |
| RF35 | Coleções da marca (Collections Insights, mini lojas 3D) | RF22/RF14 (aba Coleções) | [RF33-RF35.md](RF33-RF35.md) | `docs/diagramas/RF35/` |
| RF36 | Foto com meu manequim | RF4/RF5 · "Foto com meu manequim" | [RF36-RF39.md](RF36-RF39.md) | `docs/diagramas/RF36/` |
| RF37 | FLAIR (cartas, 15 modos, combinações das lojas) | FLAIR | [RF36-RF39.md](RF36-RF39.md) | `docs/diagramas/RF37/` |
| RF38 | Cupons Fashion AI (Meus cupons promocionais / resgatados) | RF38 | [RF36-RF39.md](RF36-RF39.md) | `docs/diagramas/RF38/` |
| RF39 | Criar guarda-roupa 3D + loja do guarda-roupa | RF39 | [RF39_Criar_Guarda_Roupa_3D.md](RF39_Criar_Guarda_Roupa_3D.md) | `docs/diagramas/RF39/` |
| RF40 | Meu Avatar 3D (busto fiel à foto, usado no manequim) | RF40 | [RF40-RF41.md](RF40-RF41.md) | — |
| RF41 | FAI Points em todos os jogos e criações | RF41 | [RF40-RF41.md](RF40-RF41.md) | — |
| RF45 | Imagens canônicas de peças (validação, segmentação, captura adaptativa) | RF4 (V29, `vision/`) | [RF04_ADAPTIVE_GARMENT_CAPTURE.md](../visao-computacional/RF04_ADAPTIVE_GARMENT_CAPTURE.md) | `docs/diagramas/RF45/` |
| RF46 | FAI Creative Engine e serviços Adobe | — (parcial: Background Studio, selos) | cartão Trello | `docs/diagramas/RF46/` |
| RF47 | Acervo & Busca Catalogada (catálogo global, criador de peça em etapa única e acervo oficial em escala) | RF47 (`CatalogService`, `scripts/catalog/`) | [RF47_ACERVO_BUSCA_CATALOGADA.md](../catalogo/RF47_ACERVO_BUSCA_CATALOGADA.md) · evolução originalmente proposta como RF49: [Acervo oficial em escala](RF49_Acervo_Oficial_Em_Escala.md) · testes: [busca-catalogada](../testes/busca-catalogada/README.md) | `docs/diagramas/RF47/` · `docs/diagramas/RF49/acervo-oficial/` |
| RF48 *(proposta; confirmar no Trello)* | FAI Points: resgate em dinheiro (Fundo de Criadores) e doações entre usuários ("Apoiar com FAI Points" no Look do dia) | — | [RF48_FAI_Points_Resgate_e_Doacoes.md](RF48_FAI_Points_Resgate_e_Doacoes.md) · concessão em todos os RFs: [RF41_v2_Concessao_FAI_Points_Todos_RFs.md](RF41_v2_Concessao_FAI_Points_Todos_RFs.md) · negócio: [PLANO_DE_ASSINATURA_E_MONETIZACAO.md](../negocio/PLANO_DE_ASSINATURA_E_MONETIZACAO.md) | `docs/diagramas/RF48/` |
| RF48 *(proposta concorrente; confirmar no Trello)* | FashionAI Lens: foto do mundo real → peças, estilo, guarda-roupa, DNA, Hype e Copilot (closet-first) | — (ainda não implementado) | [RF48_FashionAI_Lens.md](RF48_FashionAI_Lens.md) | diagramas no próprio documento (Mermaid) |
| RF49 | Proteger contas e a plataforma: sessão segura, limites contra força bruta, bancos endurecidos, dados demo isolados e entrega confiável | RF1–RF3 (autenticação), `infra/railway`, `demo/` | [RF49_Seguranca_Integridade_Operacao.md](RF49_Seguranca_Integridade_Operacao.md) | `docs/diagramas/RF49/` (+ `seguranca/`, `dados-demo/`) |
| RF50 | Criar selos em três tipos (Circular, Folha, Padrão FashionAI) num criador em 4 passos (Com IA/Sem IA), com folha e núcleo editáveis e política padronizada usada na detecção — evolução do RF25 | RF25 (comentários de `SealService`/`SealDesigns`) | [RF50_Criador_de_Selos.md](RF50_Criador_de_Selos.md) | `docs/diagramas/RF50/criador-de-selos/` |

## Mudanças em RF antigos (2026-09-24)

| RF | Mudança | Documento | Diagramas |
|---|---|---|---|
| RF4 | Campo marca = buscador web de marcas (Wikidata, Simple Icons no GitHub, IA com busca na web), sem catálogo pré-cadastrado; logo filtrado (fundo branco, letras pretas nítidas) no slot | [RF4_Buscador_Web_Marcas.md](RF4_Buscador_Web_Marcas.md) | `docs/diagramas/RF4/` (v3) |
| RF5 / RF13 | Sem campo de marca no esquema/DNA: a marca de cada slot vem da peça inserida (somente leitura) | [RF4_Buscador_Web_Marcas.md](RF4_Buscador_Web_Marcas.md) | `docs/diagramas/RF5/` (v4) |

## Mudanças em RF antigos (2026-10-04)

| RF | Mudança | Documento |
|---|---|---|
| RF18 | Provador virtual de lojas: prova peças de várias marcas do catálogo (RF47) no Avatar 3D, combinando com o guarda-roupa; ambiente 3D muda conforme a marca (faixa do logo, letreiro, paredes, piso, luz); provas salvas, foto, link, troca de cor, "Já tenho esta peça" | [RF18_Provador_Virtual_Lojas.md](RF18_Provador_Virtual_Lojas.md) |

## Mudanças em RF antigos (2026-09-26)

| RF | Mudança | Documento |
|---|---|---|
| RF27 | CA12: peças e looks do quarto usados no FLAIR, Desafios, Destaques e Passarela 3D, com ou sem o Meu Avatar 3D | [RF40-RF41.md](RF40-RF41.md) |
| RF28 | CA16: "Usar em…" leva o look do espelho para FLAIR, Desafios, Destaques e Passarela 3D, com ou sem o Meu Avatar 3D | [RF40-RF41.md](RF40-RF41.md) |
| RF30 | Os jogos (RF32, RF37) passam a render FAI Points pelo RF41; peça que fica pronta numa edição também pontua | [RF40-RF41.md](RF40-RF41.md) |

> Atenção à colisão: no código, "RF33" nos `@Operation` do `MirrorController` é o **Smart Mirror/Vista-me** (Trello
> RF28), e "RF33" no `ShowcaseController` é a **Passarela 3D** (Trello RF33). O Swagger continua funcionando; a
> renumeração dos comentários pode ser feita num passo só de refatoração, se o time quiser.

## Como os diagramas foram gerados

- **Atividades e sequência**: escritos à mão a partir do código (serviços, endpoints e tabelas reais) e conferidos
  método a método.
- **Classes**: geradas das entidades JPA reais (`fai-domain/.../model`, `@Table`, `@ManyToOne`/`@OneToOne`) e dos enums.
- **Componentes**: gerados do grafo de injeção por construtor (controller → serviço → repositórios/ports) e das
  tabelas MySQL de cada repositório.
- Renderização: PlantUML 1.2024.7 com o layout embutido **Smetana** (`!pragma layout smetana`), porque o ambiente não
  tem Graphviz.
