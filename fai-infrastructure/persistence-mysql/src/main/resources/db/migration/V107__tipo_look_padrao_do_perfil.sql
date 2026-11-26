-- Nulo mantém o comportamento de criação anterior até a pessoa configurar um padrão.
ALTER TABLE user_preferences ADD COLUMN default_tipo_look_id CHAR(36) NULL;
ALTER TABLE user_preferences ADD CONSTRAINT fk_preferences_default_tipo_look
    FOREIGN KEY (default_tipo_look_id) REFERENCES TipoLook(id) ON DELETE SET NULL;
