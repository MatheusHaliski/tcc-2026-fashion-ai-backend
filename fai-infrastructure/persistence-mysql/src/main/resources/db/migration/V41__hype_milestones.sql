-- RF53 · P1-10 (docs/hype/HYPE_AUDITORIA_ABAS.md, Lote 5) — notificação de marco de Hype.
-- O job de snapshots (HypeSnapshotService) compara a faixa/momento anterior com o novo depois de gravar e publica um
-- evento só quando há SUBIDA para Em alta (HOT), Tendência (TRENDING) ou Viral (VIRAL), ou quando surge EMERGING.
-- Esta tabela guarda os marcos já alcançados:
--   * dedupe por (entidade, marco): oscilar na borda de uma faixa (o recálculo ao vivo roda a cada 120 s) nunca avisa
--     duas vezes; atingir Viral já cobre Em alta e Tendência;
--   * resumo diário: os marcos do dono no mesmo dia (digest_date, America/Sao_Paulo) apontam para UMA notificação.
-- Queda nunca gera linha (ETI-02). Nada daqui é sinal de Hype (hype_signal_daily não muda). Item privado ou só para
-- seguidores (public_eligible = FALSE) notifica só o dono, que é sempre o destinatário. Exportado na LGPD (AccountService).

CREATE TABLE hype_milestones (
  id CHAR(36) PRIMARY KEY,
  entity_type VARCHAR(10) NOT NULL,               -- PIECE, SCHEME
  entity_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  milestone VARCHAR(20) NOT NULL,                 -- HOT, TRENDING, VIRAL, EMERGING
  level VARCHAR(20) NULL,                         -- faixa no instante do marco
  momentum VARCHAR(20) NULL,
  score DECIMAL(6,2) NULL,
  public_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  algorithm_version VARCHAR(20) NOT NULL,
  achieved_at DATETIME(6) NOT NULL,
  digest_date DATE NOT NULL,
  notification_id CHAR(36) NULL,                  -- resumo do dia (sem FK: o expurgo de 90 dias das notificações não apaga o marco)
  CONSTRAINT uq_hype_milestones UNIQUE (entity_type, entity_id, milestone),
  CONSTRAINT fk_hype_milestones_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_hype_milestones_digest ON hype_milestones(owner_id, digest_date);
