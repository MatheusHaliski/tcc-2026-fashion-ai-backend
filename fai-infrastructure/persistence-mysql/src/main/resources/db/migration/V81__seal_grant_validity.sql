-- Validade do selo concedido, separada do fim da campanha (a janela de resgate só bloqueia novas concessões).
ALTER TABLE seals ADD COLUMN grant_validity_days INT NULL;
