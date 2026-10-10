# RF4 — fotografia com múltiplas peças

Uma foto com cinco roupas deve abrir cinco rascunhos independentes em **2 — Mais detalhes**. O catálogo e o modo **Fotografar (várias fotos)** agora compartilham a barra **Peça → Mais detalhes → Arte de fundo → Revisar e salvar**. A revisão acontece na página. Trocar de peça, foto ou etapa preserva nome, marca, recorte, visibilidade e arte de cada slot. Somente a última etapa envia os cadastros; a gravação continua foto por foto e reenvia apenas peças que falharam.

O formulário é o container principal em **Mais detalhes** e **Revisar e salvar**, com a prévia do card em uma coluna lateral de 280 px no desktop, igual ao catálogo. Os slots ficam no topo. A foto original com marcações fica recolhida, disponível para conferir recortes; ela não reaparece nas etapas de arte e revisão. O editor de arte ocupa a área inteira e usa sua própria prévia lateral, evitando duplicação. Em telas menores, os campos vêm antes da prévia.

## Detecção

O fallback anterior descartava toda proposta quando menos de 80% das bordas correspondiam ao mesmo fundo. Lençóis com sombras e móveis nas bordas terminavam numa única caixa cobrindo a foto inteira. A separação local agora também usa um grafo de vizinhos com limiar adaptativo por região, limitado a 480 × 480 pixels. Exclui regiões ligadas às bordas e ruído; fronteiras extensas de estampas/blocos de cor são reunidas antes de propor caixas. Não existe quantidade fixa de roupas nem divisão por posições predefinidas.

Cada região fornece sua própria cor aproximada, traduzida para a paleta existente. O fallback não reconhece categoria, material ou marca. A visão remota recebe uma instrução explícita para separar peças do mesmo tipo e retornar `brandName` por peça somente quando houver logo ou etiqueta reconhecível. Cada slot oferece o seletor pesquisável de marcas do catálogo (`GET /api/catalog/brands?q=`), com nome e identificador da marca selecionada. Texto livre continua permitido quando a marca não estiver cadastrada. Alterar o nome remove o identificador e o logo anteriores, sem afetar outros slots. A escolha segue no payload existente de `POST /api/pieces`; não há migração de banco.

## Arquivos e contratos

- `components/piece-creation-steps.tsx`: sequência compartilhada dos dois modos.
- `components/multi-piece-review.tsx`: rascunhos por foto/slot, validação, arte e cadastros separados.
- `LocalPieceRegions` / `FabricRegionGraph`: propostas locais e cor por região.
- `MultiPieceService`: `POST /api/pieces/analysis/multi`, parser de marca e rascunhos individuais de imagem.

## Validação e limites

Validação: 20 testes Java dirigidos, 32 testes de regressão do Lens, 19 testes do fluxo de fotografia e 4 testes do editor de arte passaram. Typecheck passou na atualização de layout e marca; o build do fluxo anterior passou no CI do PR #203. O novo PR executa novamente os checks de produção. As [capturas e o relatório](rf4-fotografia-evidence/browser.json) registram as condições dos testes de navegador.

Vitest verifica cinco slots, quatro etapas, arte e marca por peça, validação entre fotos e recuperação de salvamentos parciais sem duplicação. Chromium em 375 e 1280 px verifica o fluxo real, recortes separados, preservação dos dados e ausência de modal/overflow. A resposta da visão e a API foram simuladas nesses testes de navegador; as imagens são fixtures sintéticas, não a fotografia original do usuário.

Os testes Java reproduzem cinco camisetas sobre lençol com variação de iluminação e móveis nas bordas, contato curto entre mangas de cores diferentes, uma camiseta estampada, imagens vazias e fundos muito fragmentados. Isso não comprova separação perfeita em fotografias arbitrárias. Roupa da mesma cor do fundo, peças sobrepostas e limites invisíveis podem exigir IA remota ou ajuste manual. O fallback é apresentado como proposta a conferir, preservando inclusão e recorte manual.


## Detector local no servidor (10/10/2026) — "todas as fotos falham"

**Diagnóstico (logs de produção, serviço `api`, 10/10 16:24–16:38).** Em toda chamada do `MULTI_PIECE_DETECTOR` os dois
provedores remotos falharam: Claude respondeu `400 — credit balance is too low` (conta sem créditos) e o Gemini, `503 —
high demand` ou `TIMEOUT` (o cliente de visão tinha 6 s e o orçamento total do detector, 12 s). O motor caía no detector
local, que devolvia **uma região cobrindo a foto inteira** com a cor média da foto — daí "Peça 1", "Preto (#12100F)" e
sem marca para uma camiseta branca vestida.

**O que mudou.**

| Camada | Antes | Agora |
|---|---|---|
| Orçamento da visão remota (`AiEngine.VISION_BUDGET_SECONDS`) | 12 s para os dois provedores | 45 s; o cliente de visão do Gemini passa de 6 s para 20 s e repete uma vez em 503/429 (`ProviderCircuit`) |
| Foto vestida, sem IA (`WornPieceRegions`) | foto inteira | o mapa de classes do segmentador ONNX local (`PersonSegmentationPort.classes`, MediaPipe multiclass 256 px) separa **boné** (roupa/acessório acima do rosto), **peça de cima × de baixo** (maior salto de cor entre as linhas da roupa), **calçado** (faixa de baixo após a pele das pernas ou pelo salto de cor no fim da calça) e **peça única** (uma cor do pescoço quase aos pés). Só a pessoa em primeiro plano conta (maior bloco conexo com rosto): vitrine ao fundo e outras pessoas ficam de fora. Bermuda × calça pelo ponto em que a peça termina (`bottomFrac < 0,80`) |
| Peças sobre superfície (`LocalPieceRegions`) | limiar fixo à cor da borda; cama com dobras virava um bloco; mais de 12 regiões = nenhuma | duas leituras e fica a que separa mais peças: **agrupamento de cores** (k-means, 9 cores; fundo decidido por componente — encosta em dois lados, faixa ao longo da borda, família da cor da borda; luz e sombra da mesma peça se fundem; estampa fica dentro da peça) e **limiar adaptativo** (espalhamento da própria borda, abertura/fechamento morfológicos). Teto de 16 peças (ficam as maiores, em ordem de leitura) |
| Cor | média da foto/da região | cor **dominante** dos pixels da própria peça (`PixelStats`: modo do histograma; estampa preta e branca não vira cinza); peças da IA sem cor recebem a cor da caixa |
| Marca | só a IA (recorte ampliado) | depois da IA, **OCR local** (`BrandReader`, PP-OCRv4) em cada recorte ainda sem marca — só marca confirmada no catálogo entra; nada é inferido por cor ou estilo |
| Resposta `source` | `ia` / `local` | `ia` / `local-pessoa` / `local-superficie` / `local`; a revisão mostra o aviso certo e o nome da peça vem do tipo lido ("Camiseta", "Bermuda") em vez de "Peça n" |
| Tempo no cliente | 25 s | 60 s (orçamento remoto + detector local) |

**Sonda com as fotos reais** (`MultiPieceLocalProbeTest`, `-Dfai.probe.dir=<pasta>`; as fotos ficam fora do repositório —
duas delas têm pessoa — e só as sobreposições sem pessoa estão em `docs/evidencias/rf4-multi-pecas-2026-10-10/`):

| Foto | Antes | Agora (sem IA remota) |
|---|---|---|
| Grade de catálogo com 14 peças (fundo branco) | 1 região | **14 regiões**, uma por peça, cores certas (blusa azul-clara `#d9e4f5`, laranja `#e96539`, saia cinza `#686868`, cardigã vinho `#48151b`, calça bege, calça marinho…) — `grade-catalogo-14-pecas.webp` |
| Cinco camisetas sobre a cama (dobras, mesa de cabeceira escura) | 1 bloco de 88 % | **5 regiões**: preta `#161614`, branca `#c5c3c8`, marinho `#121b2c`, vinho `#4a1319`, verde-oliva `#3a3926` — `cinco-camisetas-na-cama.webp` |
| Pessoa de polo marrom, chino bege e tênis (loja ao fundo com bolsas e sapatos) | foto inteira, "preto" | `UPPER #442c25` (camiseta, 27–56 %), `LOWER #b89775` (termina em 0,88 → calça), `SHOES #6a5348`; nada da vitrine |
| Pessoa de boné preto, camiseta branca e bermuda azul-clara (outras pessoas ao fundo) | foto inteira, "preto" | `UPPER #e9e5e8` (branca), `LOWER #88939b` (termina em 0,67 → bermuda), `SHOES #392729`; as outras pessoas ficam de fora |

Tempo do detector local: 0,15–1,4 s por foto (segmentador 256 px + k-means em 480 px).

**Testes.** `WornPieceRegionsTest` (boné/camiseta/bermuda/tênis com cor de cada um e caixas; calça até o sapato separada pelo
salto de cor; vestido como peça única; sem pessoa nada; vitrine ao fundo não entra; salto de cor exige dois lados
diferentes), `LocalPieceRegionsTest` (grade com 14 peças → 12 maiores em ordem de leitura; cama com textura → 5 regiões
com a cor certa; cor dominante ≠ média), `MultiPieceServiceTest`/`MultiPieceDetectionTest` (fonte `local-superficie`,
5 rascunhos independentes), `multi-piece-review.test.tsx` (aviso por origem; nome pelo tipo lido).

**Limites conhecidos.**

- Boné preto é lido como cabelo pelo segmentador: não vira peça (o chapéu claro vira). A pessoa adiciona pelo "+".
- Sem IA remota, o tipo é o padrão do lugar do corpo (camiseta, bermuda/calça, tênis, boné): polo × camiseta, jeans ×
  chino e o material ficam para a revisão.
- O OCR não leu "UNDER ARMOUR" na camiseta vestida (texto pequeno, dobrado); a marca segue vazia em vez de inventada.
- A marca por logotipo sem texto (swoosh, três listras) continua exigindo a IA de visão. **Em produção a conta Claude
  está sem créditos** (`credit balance is too low`): até isso ser resolvido no painel do provedor, só o Gemini responde —
  o detector local garante o cadastro, mas nome, subtipo e marca ficam para a pessoa confirmar.
