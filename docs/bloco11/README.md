# Bloco 11 — frontend: Meu Quarto 3D, logos de marca e ajustes finais

Telas em [`docs/telas-bloco11`](../telas-bloco11).

## Meu Quarto 3D (RF32)

Implementação conforme a arquitetura da spec (`docs/meu_guarda_roupa/01-especificacao-meu-quarto.md` §6):

| Item da spec | Onde está |
|---|---|
| Cena React Three Fiber + drei | `components/room3d/room-scene.tsx` (carregado só no navegador via `next/dynamic`) |
| Móvel FAI Origem paramétrico: maleiro, 4 portas com cabideiro, 24 gavetas (3 × 8), base/sapateira | a mesma função desenha o móvel a partir das dimensões e do acabamento `finish{color, roughness}` que vêm de `GET /api/me/room` |
| Peças como plano com a foto sem fundo, GLB quando existe `model3dUrl` | `PieceMesh`; as texturas são carregadas fora do Suspense, e uma foto que falha vira cor lisa |
| Endereços `door:{n}/hanger:{k}`, `drawer:{n}`, `top`, `base` | cada módulo da API é posicionado pelo endereço (`moduleAnchor`) |
| CA03: abrir porta ou gaveta | clique anima a porta (dobradiça no par) ou a gaveta (desliza); a luz interna acende; clique na peça abre o modal de peça existente |
| CA06: estados | esquecida = véu de poeira; favorita = cabide dourado; indisponível = cesto; à venda = arara com etiqueta; ícone = vitrine de vidro; excedente = cadeira; Look do Dia = espelho |
| CA08: sem WebGL | detecção antes de montar o canvas; sem WebGL abre direto o 2.5D com as mesmas ações |
| CA09: "Mostrar no quarto" | `/room?piece={id}` enquadra a posição, abre a porta ou gaveta e destaca a peça com luz pulsante |
| CA10: acessibilidade | painel "Posições" com o rótulo de cada posição ("Gaveta 4, Acessórios, 2 peças") e a aba Lista |
| CA11: câmera 3/4 limitada | `OrbitControls` sem pan, com azimute, polar e zoom limitados pelos valores de `camera` da API (±35°, 55–80°, 0,8–1,6×) |
| Modo foto | "Foto do quarto" exporta o canvas em PNG |

## Logos de marca buscados na internet

`BrandLogoService` (backend) procura o logo oficial e guarda o arquivo no storage próprio. A interface nunca
depende de link direto para terceiros. A busca segue esta ordem:

1. logo já enviado pelo perfil de marca ou guardado no catálogo;
2. **Wikidata**: item de moda com o mesmo nome → logo oficial (P154), renderizado em PNG pelo Wikimedia Commons, e site oficial (P856);
3. **IA** (capacidade `BRAND_LOGO_FINDER`, Claude com a ferramenta de busca na web): devolve o domínio oficial e a URL do logo. A URL é baixada e validada no backend (imagem de verdade, tamanho mínimo, SVG de terceiros recusado);
4. ícone do site oficial (`apple-touch-icon`, serviços de favicon);
5. sem nada confiável: **monograma** (iniciais + cor estável) e nova tentativa em 3 dias (job a cada 2 h).

Segurança: `JdkWebFetchAdapter` aceita apenas https. Recusa endereços internos (loopback, rede privada,
link-local, 169.254.x, CGNAT, `.internal`), portas fora da 443 e credenciais na URL. Também limita a 3
redirecionamentos (cada um reavaliado), 8 s e 2 MB. A chamada de IA passa pela governança do RF24 (cota,
consentimento, registro em `ai_inference_log`).

API:
- `GET /api/brand-logos?name=Zara`: logo de uma marca;
- `GET /api/brand-logos/batch?names=…`: até 40 marcas por chamada, com no máximo 4 buscas novas; as demais entram na fila do job;
- `GET /api/admin/brand-logos`: lista para o admin, com fonte, confiança e próxima tentativa;
- `POST /api/admin/brand-logos/refresh?name=…`: força uma nova busca;
- `POST /api/admin/brand-logos/upload?name=…`: envio manual (fonte MANUAL).

Frontend: `components/brand-logo.tsx` + `lib/brand-logos.ts`. Os pedidos da mesma tela são agrupados numa chamada
ao `/batch` e ficam em cache. Os logos aparecem em:
- cards de peça e página da peça;
- listas de peças dos looks e cards (logo-chip, etiquetas, bento);
- DNA de Estilo;
- busca (aba Marcas), Marcas e perfil de marca;
- Explorador (grade e rankings);
- dashboard (marcas mais usadas);
- cadastro de peça e painel admin.

**Requisitos de produção:** `ANTHROPIC_API_KEY` configurada e saída de rede para `www.wikidata.org`,
`commons.wikimedia.org`, `upload.wikimedia.org`, os domínios oficiais das marcas e `www.google.com` /
`icons.duckduckgo.com` (favicons). O ambiente de desenvolvimento em nuvem usado aqui bloqueia esses hosts, então
todas as marcas reais ficaram com o monograma. As três marcas fictícias da demo (Maison Lune, Studio Nord, Sole
Milano) receberam logos de teste pelo envio manual.

## Outros itens do bloco

- **LEGO**: a tipologia/narrativa "Blocos" passa a se chamar LEGO (id e rótulo). A V11 atualiza os dados salvos, e a textura mudou para `public/textures/lego_placa_base*.webp`.
- **Arquivos com "+"**: 228 vídeos em `public/` passaram de `… GIF + Material.mp4` para `… GIF mais Material.mp4` (mesma convenção `_mais_` do catálogo). Os manifestos foram atualizados.
- **RF15/RF16 na página da peça**: botão "Editar foto (Canvas 2D)" abre o editor com a imagem da peça e salva como nova imagem, preservando a original em Minhas Fotos. Quando existe `model3dUrl`, a página alterna entre "Foto 2D" e "Modelo 3D" (rotação e zoom) e mostra o estado do job 3D.
- **Dashboard**: os widgets podem ser arrastados para reordenar e ocultados no próprio cartão; o layout fica salvo no perfil.
- **Correção V13**: `ai_inference_log.host_rf` tinha 10 caracteres, e capacidades como "RF4/RF5/RF13" (Brand Resolver) não conseguiam gravar o registro da inferência. A coluna agora tem 40.
