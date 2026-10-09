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
