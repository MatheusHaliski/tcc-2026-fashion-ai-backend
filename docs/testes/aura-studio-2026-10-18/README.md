# Verificação local — Studio e selos

Capturas feitas no Chromium/Playwright em 18/10/2026, com os componentes reais do app e APIs simuladas. A página temporária de teste foi removida antes do build/commit. Não são capturas de produção, geração personalizada ou inferência GPU.

1. [Cartela Hype](01-hype-40-tratamentos.png): abre os 40 tratamentos tecnológicos. O teste seleciona o 12º e confere que `auraHype` permanece `MESH_CHROME`, sem substituição silenciosa por SCANNER.
2. [Cartela Metamorfose](02-metamorfose-na-cartela.png): modos e direções de marca estão dentro da família correspondente.
3. [Ajuda de selos](03-selos-validade-e-resgate.png): explica marcadores automáticos, solicitação/aprovação institucional e validade.

`browser-result.json` registra APIs simuladas, contagem, seleção e ausência de erros de execução no browser. Nenhuma foto real nem saldo/coupon de usuário foi alterado.

O fluxo GPU permanece sem comprovação: o ambiente não possui identidade GCP vinculada e nenhum worker de vídeo foi configurado. Os testes de backend usam um worker simulado para verificar autorização, fila, idempotência, falha/QA, consentimento e aplicação; não provam que um modelo gerou a pessoa vestindo a peça.
