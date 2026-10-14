-- AURA Hype: preferência visual da pessoa; desligada por padrão para não introduzir animação sem consentimento.
ALTER TABLE user_preferences ADD COLUMN aura_hype_enabled BOOLEAN NOT NULL DEFAULT FALSE;
