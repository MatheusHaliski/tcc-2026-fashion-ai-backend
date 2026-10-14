# Erro 500 ao carregar o quarto

Os logs fornecidos em 12/10/2026 registram erro MySQL 1062 (chave única de `room_storage_map.wardrobe_item_id`) seguido de `UnexpectedRollbackException` em `/api/me/room` e `/api/me/room/list`.

A reconciliação apagava um endereço incompatível e criava outro registro para a mesma peça. No flush, o Hibernate pode emitir INSERT antes do DELETE, violando a chave única. A reconciliação agora altera o endereço na própria entidade, preservando seu ID e data de criação.

Peças ainda sem endereço usam INSERT ... ON DUPLICATE KEY UPDATE sem sobrescrever o endereço vencedor. A leitura bloqueante acontece depois da inserção atômica, para enxergar a linha vencedora mesmo sob REPEATABLE READ e evitar bloquear um intervalo vazio antes de inserir. O movimento manual continua atualizando o registro existente.

Validação: regressão de reparo em memória com o mesmo ID e uma linha por peça; teste da ordem inserção/leitura; MySQL 9.7 real com duas transações que leem ausência antes de inserir, terminando sem erro e com um único registro e endereço vencedor preservado. Nenhum SQL foi executado no banco de produção; não há migração nem exclusão manual necessária.

## Fotos do catálogo

O backend público retornou 404 para OPTIONS na rota `/api/catalog/products/{id}/preview-image`: o código do frontend foi publicado antes da rota correspondente no serviço Java. O cliente deixava qualquer erro como “Esta foto não permite um enquadramento seguro”. Agora só `CATEGORY_FRAME_UNAVAILABLE` recebe essa mensagem; indisponibilidade da fonte e falha do serviço têm mensagens distintas e tentativa manual. Respostas temporárias 429/502/503/504 recebem até três tentativas automáticas com intervalo crescente; fotos originais não são apresentadas como enquadradas.

Após integrar, publicar a versão atual da main no serviço Java do Railway e confirmar que está ACTIVE. Verificar JSON 200 de POST preview-image e GET /api/me/room e /api/me/room/list numa sessão autenticada. A presença da rota pode ser verificada sem autenticação por OPTIONS (Allow: POST, OPTIONS); isso não comprova que uma fotografia específica seja enquadrável.
