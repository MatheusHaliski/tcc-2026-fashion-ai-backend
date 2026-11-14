-- FLAIR 3D: partidas dos 15 núcleos (docs/flair/flair-3d/BASE_NUCLEOS.md) e looks do FLAIR 3D MAKE UP.
-- Uma linha por partida: o deck escolhido, a semente do sorteio, a entrega e o resultado calculados no servidor.
-- status: ABERTA, EM_ACAO (núcleos em etapas, entre a entrega e o último acionamento) ou ENTREGUE; estado_json guarda o
-- andamento (tentativas e acionamentos).

CREATE TABLE flair3d_matches (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  nucleo VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL,
  semente BIGINT NOT NULL,
  deck_json JSON NULL,
  participantes_json JSON NULL,
  entrega_json JSON NULL,
  estado_json JSON NULL,
  resultado_json JSON NULL,
  pontos INT NULL,
  estrelas INT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  INDEX ix_flair3d_match_user_nucleo (user_id, nucleo)
);

-- FLAIR 3D MAKE UP: cada entrega de brief; o Prestígio é a soma da coluna prestigio da pessoa.
CREATE TABLE flair_makeup_looks (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  brief VARCHAR(32) NOT NULL,
  look_json JSON NULL,
  pontos INT NOT NULL,
  estrelas INT NOT NULL,
  prestigio INT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  INDEX ix_flair_makeup_look_user_brief (user_id, brief)
);

-- FLAIR Card Building Challenge: entregas dos cinco elencos; a edição é a ordem de conclusão do elenco (repetir mantém a
-- edição da primeira conclusão da pessoa).
CREATE TABLE flair_cbc_squad_entregas (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  elenco VARCHAR(32) NOT NULL,
  cartas_json JSON NOT NULL,
  quimica INT NOT NULL,
  ok BOOLEAN NOT NULL,
  edicao INT NULL,
  created_at DATETIME(6) NOT NULL,
  INDEX ix_flair_cbc_squad_user_elenco (user_id, elenco),
  INDEX ix_flair_cbc_squad_elenco_edicao (elenco, edicao)
);

-- Contador da edição de cada elenco: a entrega bloqueia a linha do elenco (SELECT ... FOR UPDATE) antes de numerar, para
-- duas primeiras conclusões simultâneas nunca levarem o mesmo número.
CREATE TABLE flair_cbc_squad_edicoes (
  elenco VARCHAR(32) PRIMARY KEY,
  ultima INT NOT NULL
);

INSERT INTO flair_cbc_squad_edicoes (elenco, ultima) VALUES
  ('PRIMEIRO_ELENCO', 0),
  ('PALETA_ATELIE', 0),
  ('CASA_MARCA', 0),
  ('NOITE_ESTREIA', 0),
  ('ELENCO_LENDARIO', 0);
