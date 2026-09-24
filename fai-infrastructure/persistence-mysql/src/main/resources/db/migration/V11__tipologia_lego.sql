-- Bloco 11 — a tipologia/narrativa "Blocos" passa a se chamar LEGO (id e rótulo). Atualiza os dados já salvos.
UPDATE schemes SET layout_anatomy = 'LEGO' WHERE layout_anatomy = 'BLOCOS';
UPDATE dna_schemes SET narrative_type = 'LEGO' WHERE narrative_type = 'BLOCOS';
UPDATE schemes SET studio_config_json = CAST(REPLACE(CAST(studio_config_json AS CHAR), '"BLOCOS"', '"LEGO"') AS JSON)
 WHERE studio_config_json IS NOT NULL AND CAST(studio_config_json AS CHAR) LIKE '%"BLOCOS"%';
UPDATE dna_schemes SET studio_config_json = CAST(REPLACE(CAST(studio_config_json AS CHAR), '"BLOCOS"', '"LEGO"') AS JSON)
 WHERE studio_config_json IS NOT NULL AND CAST(studio_config_json AS CHAR) LIKE '%"BLOCOS"%';
