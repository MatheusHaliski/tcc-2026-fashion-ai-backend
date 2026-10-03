-- RF20.CA24–CA30 · Editor "Cadastrar novo selo" sem campos textuais: a regra do selo é um objeto SealPolicy
-- (devolvido pelo Copilot "Definir selo", POST /api/copilot/seal-policy) guardado em seals.policy_json.
-- O tier ganha PERFIL (selo concedido a um perfil inteiro): a coluna tier continua VARCHAR(10) e guarda o nome do enum.
-- O formato (silhueta) do selo vira coluna própria: CIRCULAR (padrão, o que já existia), FOLHA ou FASHION_AI.
ALTER TABLE seals
  ADD COLUMN policy_json JSON NULL,
  ADD COLUMN format VARCHAR(12) NOT NULL DEFAULT 'CIRCULAR';
