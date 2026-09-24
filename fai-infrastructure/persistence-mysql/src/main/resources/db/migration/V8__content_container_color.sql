-- RF23 — cor dos containers de conteúdo das páginas do app (padrão branco quando nulo).
ALTER TABLE user_preferences ADD COLUMN content_container_color VARCHAR(9) NULL;
