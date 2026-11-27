-- Desafios de Montagem DINÂMICOS (docs/flair/cbc/MONTAGEM_DINAMICA.md): quebra-cabeças em que cada peça é uma janela
-- para uma fonte em movimento — o vídeo da cena ou o símbolo FAI animado. O cenário decide a fonte no cliente
-- (lib/flair/montagem/dinamico/catalogo.ts); aqui só os dados dos cinco desafios, sempre disponíveis (sem Momento).
-- Idempotente: cada linha só entra se o slug ainda não existe. Sem DDL.

INSERT INTO flair_challenges (id, slug, name, names_json, description, descriptions_json, scenario, difficulty, status, moment_id,
  slots_json, requirements_json, theme_tags, points, repeat_limit, group_code, locks_cards, official, sort_order, version, created_at, updated_at)
SELECT '7e000000-0000-4000-8000-000000000101', 'fogo-em-movimento', 'Fogo em movimento', '{"pt-BR":"Fogo em movimento","en":"Fire in motion","es":"Fuego en movimiento"}',
  'Quatro peças da cena de fogo com a moeda FAI girando. Duas cartas vermelhas ou laranja.',
  '{"pt-BR":"Quatro peças da cena de fogo com a moeda FAI girando. Duas cartas vermelhas ou laranja.","en":"Four pieces of the fire scene with the FAI coin spinning. Two red or orange cards.","es":"Cuatro piezas de la escena de fuego con la moneda FAI girando. Dos cartas rojas o naranjas."}',
  'firefly-fogo', 'EASY', 'ACTIVE', NULL,
  '[{"key":"brasa","position":"SUP"},{"key":"chama","position":"INF"},{"key":"lava","position":"CAL"},{"key":"faisca","position":"ACE"}]',
  '[{"type":"tag","field":"color","anyOf":["red","orange"],"count":2}]',
  NULL, 15, 1, NULL, TRUE, TRUE, 200, 0, '2026-11-26 12:00:00', '2026-11-26 12:00:00'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM flair_challenges WHERE slug = 'fogo-em-movimento' OR id = '7e000000-0000-4000-8000-000000000101');

INSERT INTO flair_challenges (id, slug, name, names_json, description, descriptions_json, scenario, difficulty, status, moment_id,
  slots_json, requirements_json, theme_tags, points, repeat_limit, group_code, locks_cards, official, sort_order, version, created_at, updated_at)
SELECT '7e000000-0000-4000-8000-000000000102', 'arena-em-movimento', 'Arena em movimento', '{"pt-BR":"Arena em movimento","en":"Arena in motion","es":"Arena en movimiento"}',
  'Seis peças da arena em festa, em vídeo. Duas cartas de festa.',
  '{"pt-BR":"Seis peças da arena em festa, em vídeo. Duas cartas de festa.","en":"Six pieces of the partying arena, on video. Two party cards.","es":"Seis piezas de la arena en fiesta, en video. Dos cartas de fiesta."}',
  'arena', 'MEDIUM', 'ACTIVE', NULL,
  '[{"key":"arquibancada","position":"SUP"},{"key":"holofote","position":"ACE"},{"key":"palco","position":"INF"},{"key":"fogos","position":"CAL"},{"key":"pista","position":"ANY"},{"key":"camarote","position":"ANY"}]',
  '[{"type":"tag","field":"occasion","anyOf":["party"],"count":2}]',
  NULL, 25, 1, NULL, TRUE, TRUE, 201, 0, '2026-11-26 12:00:00', '2026-11-26 12:00:00'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM flair_challenges WHERE slug = 'arena-em-movimento' OR id = '7e000000-0000-4000-8000-000000000102');

INSERT INTO flair_challenges (id, slug, name, names_json, description, descriptions_json, scenario, difficulty, status, moment_id,
  slots_json, requirements_json, theme_tags, points, repeat_limit, group_code, locks_cards, official, sort_order, version, created_at, updated_at)
SELECT '7e000000-0000-4000-8000-000000000103', 'simbolo-fai-em-orbita', 'Símbolo FAI em órbita', '{"pt-BR":"Símbolo FAI em órbita","en":"FAI symbol in orbit","es":"Símbolo FAI en órbita"}',
  'O símbolo FAI gira, pulsa e se parte em oito setores: cada carta encaixa uma fatia. Duas cartas laranja ou pretas.',
  '{"pt-BR":"O símbolo FAI gira, pulsa e se parte em oito setores: cada carta encaixa uma fatia. Duas cartas laranja ou pretas.","en":"The FAI symbol spins, pulses and breaks into eight sectors: each card fits a slice. Two orange or black cards.","es":"El símbolo FAI gira, late y se parte en ocho sectores: cada carta encaja una porción. Dos cartas naranjas o negras."}',
  'logo-fai', 'MEDIUM', 'ACTIVE', NULL,
  '[{"key":"alca","position":"ACE"},{"key":"sacola","position":"SUP"},{"key":"rede","position":"INF"},{"key":"no","position":"CAL"},{"key":"brilho","position":"ANY"},{"key":"orbita","position":"ANY"},{"key":"borda","position":"ANY"},{"key":"centro","position":"ANY"}]',
  '[{"type":"tag","field":"color","anyOf":["orange","black"],"count":2}]',
  NULL, 30, 1, NULL, TRUE, TRUE, 202, 0, '2026-11-26 12:00:00', '2026-11-26 12:00:00'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM flair_challenges WHERE slug = 'simbolo-fai-em-orbita' OR id = '7e000000-0000-4000-8000-000000000103');

INSERT INTO flair_challenges (id, slug, name, names_json, description, descriptions_json, scenario, difficulty, status, moment_id,
  slots_json, requirements_json, theme_tags, points, repeat_limit, group_code, locks_cards, official, sort_order, version, created_at, updated_at)
SELECT '7e000000-0000-4000-8000-000000000104', 'logo-a-deriva', 'Logo à deriva', '{"pt-BR":"Logo à deriva","en":"Drifting logo","es":"Logo a la deriva"}',
  'O logo turquesa à deriva quebrou em sete cacos. Três marcas diferentes trazem os cacos de volta.',
  '{"pt-BR":"O logo turquesa à deriva quebrou em sete cacos. Três marcas diferentes trazem os cacos de volta.","en":"The drifting teal logo broke into seven shards. Three different brands bring the shards back.","es":"El logo turquesa a la deriva se rompió en siete fragmentos. Tres marcas distintas los traen de vuelta."}',
  'logo-deriva', 'MEDIUM', 'ACTIVE', NULL,
  '[{"key":"mare","position":"SUP"},{"key":"corrente","position":"INF"},{"key":"ilha","position":"CAL"},{"key":"farol","position":"ACE"},{"key":"onda","position":"ANY"},{"key":"rede","position":"ANY"},{"key":"porto","position":"ANY"}]',
  '[{"type":"distinctBrands","count":3}]',
  NULL, 25, 1, NULL, TRUE, TRUE, 203, 0, '2026-11-26 12:00:00', '2026-11-26 12:00:00'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM flair_challenges WHERE slug = 'logo-a-deriva' OR id = '7e000000-0000-4000-8000-000000000104');

INSERT INTO flair_challenges (id, slug, name, names_json, description, descriptions_json, scenario, difficulty, status, moment_id,
  slots_json, requirements_json, theme_tags, points, repeat_limit, group_code, locks_cards, official, sort_order, version, created_at, updated_at)
SELECT '7e000000-0000-4000-8000-000000000105', 'caleidoscopio-azul', 'Caleidoscópio azul', '{"pt-BR":"Caleidoscópio azul","en":"Blue kaleidoscope","es":"Caleidoscopio azul"}',
  'Seis setores do caleidoscópio da cena azul. Duas cartas azuis ou roxas.',
  '{"pt-BR":"Seis setores do caleidoscópio da cena azul. Duas cartas azuis ou roxas.","en":"Six sectors of the blue scene''s kaleidoscope. Two blue or purple cards.","es":"Seis sectores del caleidoscopio de la escena azul. Dos cartas azules o moradas."}',
  'caleidoscopio', 'EASY', 'ACTIVE', NULL,
  '[{"key":"espelho","position":"SUP"},{"key":"prisma","position":"ACE"},{"key":"reflexo","position":"INF"},{"key":"vitral","position":"CAL"},{"key":"lente","position":"ANY"},{"key":"cristal","position":"ANY"}]',
  '[{"type":"tag","field":"color","anyOf":["blue","purple"],"count":2}]',
  NULL, 20, 1, NULL, TRUE, TRUE, 204, 0, '2026-11-26 12:00:00', '2026-11-26 12:00:00'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM flair_challenges WHERE slug = 'caleidoscopio-azul' OR id = '7e000000-0000-4000-8000-000000000105');
