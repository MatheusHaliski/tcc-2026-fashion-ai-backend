-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../06-estacao-look.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

SHOW CREATE TABLE schemes;
SELECT season,COUNT(*) AS quantidade FROM schemes GROUP BY season;
SELECT id,title,season FROM schemes WHERE id=@scheme_id;
-- Antes de propor CHECK, revisar todos os valores retornados pela consulta acima.
-- Nenhum ALTER é necessário se o enum já é persistido e validado pelo fluxo atual.
