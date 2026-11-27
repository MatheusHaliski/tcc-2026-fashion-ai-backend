ALTER TABLE flair3d_matches ADD COLUMN estado_json JSON NULL;

CREATE TABLE flair_cbc_squad_edicoes (
  elenco VARCHAR(32) PRIMARY KEY,
  ultima INT NOT NULL
);

INSERT INTO flair_cbc_squad_edicoes (elenco, ultima)
SELECT elencos.elenco, GREATEST(0, COALESCE(MAX(entregas.edicao), 0))
FROM (
  SELECT 'PRIMEIRO_ELENCO' AS elenco
  UNION ALL SELECT 'PALETA_ATELIE'
  UNION ALL SELECT 'CASA_MARCA'
  UNION ALL SELECT 'NOITE_ESTREIA'
  UNION ALL SELECT 'ELENCO_LENDARIO'
) AS elencos
LEFT JOIN flair_cbc_squad_entregas AS entregas
  ON entregas.elenco = elencos.elenco AND entregas.ok = TRUE
GROUP BY elencos.elenco;
