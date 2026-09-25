-- Dashboard administrativo (tipo de perfil ADMIN + painel de monitoramento por abas):
-- índices para as consultas agrupadas por dia/hora do audit_log e das interações sociais.
CREATE INDEX idx_audit_log_timestamp ON audit_log (`timestamp`);
CREATE INDEX idx_audit_log_resultado_timestamp ON audit_log (resultado, `timestamp`);
CREATE INDEX idx_reactions_created ON reactions (created_at);
CREATE INDEX idx_comments_created ON comments (created_at);
CREATE INDEX idx_shares_created ON shares (created_at);
CREATE INDEX idx_moderation_queue_created ON moderation_queue (created_at);
-- contas de administração já promovidas pelo papel continuam como estão; o tipo ADMIN é usado pelas contas criadas
-- pela inicialização (FAI_ADMIN_EMAIL) e nunca pelo cadastro público.
