-- RF35 — a pontuação por interação recebida usa ref_id = "<alvo>:<autor>" (dois UUIDs = 73 caracteres).
-- Com VARCHAR(64) o insert falhava e derrubava a curtida/comentário de outra pessoa. Folga para chaves compostas.
ALTER TABLE fai_points_ledger MODIFY ref_id VARCHAR(120) NULL;
ALTER TABLE fai_points_ledger MODIFY idempotency_key VARCHAR(240) NOT NULL;
