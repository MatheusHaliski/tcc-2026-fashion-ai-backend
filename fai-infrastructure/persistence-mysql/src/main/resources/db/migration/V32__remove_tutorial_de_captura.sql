-- RF47 · O guia "Como fotografar" saiu do criador de peças (a peça nasce da busca catalogada, sem foto): a rota
-- /api/me/capture-tutorial foi removida e a preferência "Não mostrar novamente" por guia deixa de existir.
ALTER TABLE user_preferences DROP COLUMN capture_tutorial_json;
