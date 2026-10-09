# RF4 — fotografia com múltiplas peças

Uma foto com cinco roupas deve abrir cinco rascunhos independentes em **2 — Mais detalhes**. O catálogo e o modo **Fotografar (várias fotos)** agora compartilham a barra **Peça → Mais detalhes → Arte de fundo → Revisar e salvar**. A revisão acontece na página. Trocar de peça, foto ou etapa preserva nome, marca, recorte, visibilidade e arte de cada slot. Somente a última etapa envia os cadastros; a gravação continua foto por foto e reenvia apenas peças que falharam.

## Detecção

O fallback anterior descartava toda proposta quando menos de 80% das bordas correspondiam ao mesmo fundo. Lençóis com sombras e móveis nas bordas terminavam numa única caixa cobrindo a foto inteira. A separação local agora também usa um grafo de vizinhos com limiar adaptativo por região, limitado a 480 × 480 pixels. Exclui regiões ligadas às bordas e ruído; fronteiras extensas de estampas/blocos de cor são reunidas antes de propor caixas. Não existe quantidade fixa de roupas nem divisão por posições predefinidas.

Cada região fornece sua própria cor aproximada, traduzida para a paleta existente. O fallback não reconhece categoria, material ou marca. A visão remota recebe uma instrução explícita para separar peças do mesmo tipo e retornar `brandName` por peça somente quando houver logo ou etiqueta reconhecível. A marca permanece editável e segue no payload existente de `POST /api/pieces`; não há migração de banco.

## Arquivos e contratos

- `components/piece-creation-steps.tsx`: sequência compartilhada dos dois modos.
- `components/multi-piece-review.tsx`: rascunhos por foto/slot, validação, arte e cadastros separados.
- `LocalPieceRegions` / `FabricRegionGraph`: propostas locais e cor por região.
- `MultiPieceService`: `POST /api/pieces/analysis/multi`, parser de marca e rascunhos individuais de imagem.

## Validação e limites

Validação: 20 testes Java dirigidos, 32 testes de regressão do Lens, 18 testes do fluxo de fotografia e 4 testes do editor de arte passaram. Typecheck e build de produção passaram. As [capturas e o relatório](rf4-fotografia-evidence/browser.json) registram as condições dos testes de navegador.

Vitest verifica cinco slots, quatro etapas, arte e marca por peça, validação entre fotos e recuperação de salvamentos parciais sem duplicação. Chromium em 375 e 1280 px verifica o fluxo real, recortes separados, preservação dos dados e ausência de modal/overflow. A resposta da visão e a API foram simuladas nesses testes de navegador; as imagens são fixtures sintéticas, não a fotografia original do usuário.

Os testes Java reproduzem cinco camisetas sobre lençol com variação de iluminação e móveis nas bordas, contato curto entre mangas de cores diferentes, uma camiseta estampada, imagens vazias e fundos muito fragmentados. Isso não comprova separação perfeita em fotografias arbitrárias. Roupa da mesma cor do fundo, peças sobrepostas e limites invisíveis podem exigir IA remota ou ajuste manual. O fallback é apresentado como proposta a conferir, preservando inclusão e recorte manual.
