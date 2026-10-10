-- RF53 · P3-12 (docs/hype/HYPE_AUDITORIA_ABAS.md, Lote Final) — opção de não aparecer em "Criadores em alta".
-- Preferência da própria pessoa (Configurações › Privacidade › HypeScore e privacidade), salva junto das demais
-- preferências (GET/PUT /api/me/preferences, campo hypeCreatorOptOut). Com ela ligada:
--   * a pessoa some do agregado público de criadores (GET /api/hype/trending?type=CREATOR): os demais sobem;
--   * o lote GET /api/hype/groups?type=CREATOR devolve a chave dela como sem dados (sem valor, sem faixa e sem posição,
--     nunca 0);
--   * cada peça/look público dela continua com o próprio Hype público (o opt-out é só do agregado de criador).
-- Mudar a opção incrementa a geração do HypeCache (o ranking em cache nunca mostra o valor antigo).
-- Padrão FALSE: ninguém sai do ranking sem pedir. Exportado na LGPD (AccountService, bloco "preferences").

ALTER TABLE user_preferences ADD COLUMN hype_creator_opt_out BOOLEAN NOT NULL DEFAULT FALSE;
