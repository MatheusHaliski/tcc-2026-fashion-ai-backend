-- Look do Dia Vivido, F2 e F3 (docs/novos-rf/PROPOSTA_LOOK_DO_DIA_VIVIDO.md §4, §5): tudo aditivo e nulo por padrão.
--   daily_looks.outcome_note        : "deu certo?" — resposta do fim do dia com o contexto (F2, §4.2)
--   daily_looks.personal_moment_id  : fase pessoal (Momento PERSONAL da própria pessoa) em que o dia foi vivido (F3, §4.4)
--   moments.phase_public_on_profile : a Memória da fase foi publicada no perfil pela dona (F3); só vale para type = PERSONAL
ALTER TABLE daily_looks
  ADD COLUMN outcome_note VARCHAR(140) NULL,
  ADD COLUMN personal_moment_id CHAR(36) NULL,
  ADD CONSTRAINT fk_daily_looks_personal_moment FOREIGN KEY (personal_moment_id) REFERENCES moments(id) ON DELETE SET NULL;

CREATE INDEX idx_daily_looks_personal_moment ON daily_looks(personal_moment_id, look_date);
CREATE INDEX idx_daily_looks_scheme_purpose ON daily_looks(scheme_id, purpose);

ALTER TABLE moments ADD COLUMN phase_public_on_profile BOOLEAN NOT NULL DEFAULT FALSE;
