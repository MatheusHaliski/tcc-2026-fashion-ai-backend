-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../17-dinamica-trend.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

SHOW CREATE TABLE community_trends;
SELECT kind,COUNT(*) AS quantidade FROM community_trends GROUP BY kind;
SELECT id,title,kind,status,published_at,ends_at FROM community_trends
WHERE status='PUBLISHED' AND ends_at>CURRENT_TIMESTAMP(6)
  AND kind='COR_EM_COMUM' ORDER BY published_at DESC;
-- Sem nova tabela/FK: o tipo validado já atende ao exercício.
-- Se for escolhido um CHECK futuro, validar antes todos os kind legados.
