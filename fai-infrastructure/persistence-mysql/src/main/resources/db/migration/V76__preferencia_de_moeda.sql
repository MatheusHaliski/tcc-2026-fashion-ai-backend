-- RF23.CA13 — moeda em que o usuário quer ver os preços (BRL, USD ou EUR). NULL = automática, pela moeda do idioma
-- (pt-BR → BRL, en → USD, es → EUR). Os preços continuam gravados na moeda de origem (price_currency); a interface
-- mostra o equivalente convertido pela cotação de referência do BCE (GET /api/exchange-rates).
ALTER TABLE user_preferences ADD COLUMN currency CHAR(3) NULL;
