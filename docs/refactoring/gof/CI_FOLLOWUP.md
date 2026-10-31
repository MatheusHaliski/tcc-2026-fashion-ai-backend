# Checks do PR415 — estado observado na continuação

Na revisão1ab356bb: API Java e line-inventory passaram; catálogo Python falhou com9 testes; frontend falhou na suíte Vitest (incluindo23 testes individuais e falhas em arquivos de vestimenta/matriz/smoke); Gitleaks encontrou1 ocorrência histórica.

Catálogo/avatar não tiveram código alterado pelos dois commits anteriores do PR. Isso delimita o diff, mas não prova uma falha preexistente: não foi executada uma baseline completa equivalente dessas suítes neste lote. Essas falhas permanecem pendentes; não foram alteradas expectativas nem regeneradas matrizes para escondê-las.

## Gitleaks

Scanner8.21.2 no intervalo7b473d2b..HEAD:2 commits,0 achados. No histórico de main:1 achado no commit444d9cd7, teste DevGateFilterFluxoTest, linha24. Inspeção confirmou constante sintética com marcador de teste usada para assinar fixtures HMAC. Nenhum valor foi publicado.

Ajustada apenas a impressão digital exata na .gitleaksignore; o arquivo inteiro continua sujeito ao scanner. Rechecagem do commit histórico após a exceção:0 achados. Não houve rotação/alteração de credenciais nem reescrita de histórico. A nova execução completa do CI ainda precisa confirmar o resultado.
