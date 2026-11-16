# Análise em lote e tipo de lavagem

**GoF: NENHUM.** A extração separa a validação e a montagem dos resultados da análise em lote, sem mudar a transação ou a API do serviço.

O teste `PieceBatchAnalysisTest` caracterizou limites, ordem e rejeição de fotos antes da extração e passou novamente depois dela. `WardrobeService.java` diminuiu de 993 para 990 linhas, mesmo com o suporte compatível aos novos campos do formulário.
