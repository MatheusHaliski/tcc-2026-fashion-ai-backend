-- Look do Dia Vivido, F1 (docs/novos-rf/PROPOSTA_LOOK_DO_DIA_VIVIDO.md §5): o contexto do dia entra no registro datado
-- (daily_looks), não em schemes — o mesmo look pode ser vestido para uma entrevista numa segunda e para um jantar num
-- sábado. Tudo opcional e aditivo: um Look do Dia sem contexto continua igual.
--   purpose             : para quê (enum DailyLookPurpose; CUIDADO é sensível — nunca sai do perfil da pessoa)
--   purpose_note        : "Hoje eu vesti isso para…" (frase livre)
--   audience            : para quem (enum DailyLookAudience; SO_EU nunca sai do perfil da pessoa)
--   calendar_marks_json : marcas do calendário congeladas no dia — dia da semana, estação, clima, Momentos
ALTER TABLE daily_looks
  ADD COLUMN purpose VARCHAR(30) NULL,
  ADD COLUMN purpose_note VARCHAR(140) NULL,
  ADD COLUMN audience VARCHAR(20) NULL,
  ADD COLUMN calendar_marks_json JSON NULL;

-- "Quem mais está vivendo isso hoje" (F2) agrupa por propósito e data.
CREATE INDEX idx_daily_looks_purpose_date ON daily_looks(purpose, look_date);
