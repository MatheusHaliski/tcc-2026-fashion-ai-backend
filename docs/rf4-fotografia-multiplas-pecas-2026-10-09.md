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
- O OCR não leu "UNDER ARMOUR" na camiseta vestida na cópia de 768 px (texto de ~10 px por letra, dobrado); a marca
  segue vazia em vez de inventada. A leitura em tecido dobrado está na seção seguinte.
- A marca por logotipo sem texto (swoosh, três listras) continua exigindo a IA de visão. **Em produção a conta Claude
  está sem créditos** (`credit balance is too low`): até isso ser resolvido no painel do provedor, só o Gemini responde —
  o detector local garante o cadastro, mas nome, subtipo e marca ficam para a pessoa confirmar.

## Marca em tecido dobrado (10/10/2026)

**Problema.** Na camiseta vestida, o logo "UNDER ARMOUR" tem duas linhas com polaridades opostas ("UNDER" escuro
sobre o tecido claro, "ARMOUR" claro sobre uma faixa escura), o tecido está amassado (a linha ondula e inclina) e o
detector de texto junta as duas linhas numa caixa alta; o reconhecedor lê só pedaços da primeira ("UNPS", "INOER",
"UNPE"). A leitura normal (`BrandReader.find`) exige uma linha que case com o catálogo — e, certa, deixava a marca
vazia em vez de inventar.

**Solução — leitura robusta (`BrandReader.findRobust`).** Só nas 3 maiores peças da foto (as outras até 6 seguem com a
leitura normal), e só se a leitura normal não confirmar:

1. **Detector na polaridade invertida** em cada zona do peito (centro, peito esquerdo, peito direito; nunca a gola):
   acha a linha clara sobre a faixa escura que o detector normal não vê.
2. **Reconhecimento, sem detector, de cada caixa achada em variações baratas** (`TextReaderPort.recognize`, só o
   CRNN, ~30 ms cada): normal e invertida, cada uma reta e inclinada ±8° (a dobra inclina a linha); caixa alta
   (altura > 45 % da largura: duas linhas juntas) também a metade de cima e a de baixo nas duas polaridades.
3. **Decisão pelo catálogo**, nesta ordem: uma linha que casa (`match`) → **confirmada**; as linhas de uma passagem
   juntas em ordem de leitura ("UNDER" + "ARMOUR") → confirmada; **duas palavras distintas da mesma marca lidas em
   separado** (em variações diferentes) → confirmada; uma palavra inteira de marca de várias palavras ("UNDER",
   "TOMMY") → **possível** (7+ letras distintivas, como "HILFIGER", confirma sozinha); pedaços que **votam** na mesma
   marca (semelhança = 1 − distância/comprimento, também contra o começo e o fim da palavra, pois a dobra esconde o
   fim; voto ≥ 0,5 ponderado pela confiança; soma ≥ 0,9, duas leituras, uma ≥ 0,6 e vantagem de 1,3× sobre a segunda
   marca) → possível, com até 2 **alternativas**; texto firme que não casou → **ilegível** (`brand` nulo); nada → sem
   marca.
4. **Orçamento**: 6 s por peça; a passagem para quando estoura. Medido nas fotos de teste: 2,5–4 s por peça (antes do
   reconhecimento-sem-detector a mesma grade custava 7–9 s).

**Contrato.** `DetectedPiece.brandHint { brand, alternatives, evidence, zone, confidence }` (persistido no rascunho
junto com as peças). Só a marca **confirmada** entra em `brandName`; a lida com incerteza nunca preenche o campo: a
revisão mostra a nota "Marca lida com incerteza (tecido dobrado ou texto pequeno): Under Armour? Confirme ou corrija"
com os botões **Usar Under Armour** (e as alternativas) e o texto lido; com `brand` nulo, "Há um texto ou logo na peça
que não deu para ler (tecido dobrado?). Informe a marca ou fotografe a peça esticada." A nota some quando o campo é
preenchido. O criador de peça (modo Fotografar → "Usar esta peça") recebe a mesma nota abaixo do campo Marca — e a
marca confirmada passa a preencher o campo nesse caminho (antes não passava).

**Validação.**

| Caso | Leitura normal | Leitura robusta |
|---|---|---|
| Logo sintético de duas linhas, polaridades opostas, letras de 32 px, dobra de 20 px (`BrandReaderFoldedOcrTest`, OCR real) | nada | **Under Armour confirmada** ("UNDER" e "ARMOUR" lidos em separado), 2,5 s |
| Mesmo logo, 64 px, dobra de 9 px, inclinado 5° | confirmada | confirmada |
| Só "UNDER" visível (a dobra esconde a segunda linha) | — | **possível** Under Armour, não preenchida |
| Camiseta lisa | nada | nada (sem marca inventada) |
| Fotos de teste da pessoa (cópias de 768 px, 4 fotos, 7 peças ≥ 120 px) | nada | nada em 6; na camiseta Under Armour (recorte de 160×197 px): **ilegível** com o texto lido — nenhuma marca inventada |

Na cópia de 768 px cada letra do logo tem ~10 px: abaixo do que o PP-OCRv4 lê (os pedaços saem "INRIERE", "AMUE").
A foto original do celular (3 000–4 000 px) dá ~40 px por letra — a faixa em que a leitura robusta confirma no
sintético. O servidor usa a foto original inteira nos recortes (`MultiPieceService.crop`), não a cópia reduzida.

**Testes.** `BrandReaderTest` (semelhança com começo/fim da palavra; duas palavras do logo em variações diferentes →
confirmada; "UNDER" → possível e "HILFIGER" → confirmada; pedaços "UNPS/INOER/UNPE/INPIER" votam em Under Armour só
na robusta; texto firme sem casar → ilegível só na robusta; zonas da robusta; variações da caixa alta),
`BrandReaderFoldedOcrTest` (OCR ONNX real, casos da tabela), `MultiPieceServiceTest` (sugestão vira `brandHint` e não
preenche; confirmada preenche; persistida no rascunho), `multi-piece-review.test.tsx` (nota com "Usar", campo vazio
até tocar, ilegível sem botão). Sondas fora do repositório: `BrandRobustProbeTest` (`-Dfai.probe.dir`, com
`-Dfai.probe.debug` lista cada leitura por zona e variação) e `BrandOcrProbeTest`.

**Evidências.** `docs/evidencias/rf4-marca-dobrada-2026-10-10/` — nota de marca incerta com "Usar Under Armour", campo
preenchido ao tocar e texto ilegível, desktop e mobile (API simulada; a foto é a camiseta de referência do acervo).

