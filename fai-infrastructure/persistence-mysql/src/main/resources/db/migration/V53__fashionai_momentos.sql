-- FashionAI MOMENTOS (docs/momentos/MOMENTOS.md) — o tempo da moda dentro do FashionAI.
-- A antiga aba Desafios deixa de ser uma lista estática: "Desafio" vira UM tipo de Momento. Momentos são DADOS (nunca
-- páginas específicas): datas culturais, temporadas, eventos reais verificados, Momentos oficiais FashionAI, Momentos
-- privados de grupos FLAIR e missões pessoais usam as mesmas tabelas, com tema visual, regras, tags e desafios
-- configuráveis pela administração — adicionar o Halloween do ano seguinte não exige deploy.
--
-- Princípios gravados aqui:
--   * tempo em UTC (start_at/end_at) + fuso IANA do Momento: status efetivo e contagem regressiva vêm do servidor;
--   * natureza (cultural, sazonal, comercial, religiosa, FashionAI, privada): datas religiosas nunca viram competição
--     automaticamente (points_enabled = FALSE e sem votação por padrão);
--   * privacidade: só visibility = PUBLIC entra em descoberta, ranking global e perfil público;
--   * FAI Points pelo ledger idempotente (fai_points_ledger): regras novas abaixo, referência = momento(:look), 1× cada;
--   * reutilização premiada (guarda-roupa, redescoberta, remix) — nunca só compra;
--   * nada é apagado ao terminar: ACTIVE → ENDED vira Memória (memory_json) e alimenta Perfil → Momentos e o Replay.

-- fuso horário da pessoa (§4/§54): opcional; sem ele, vale o fuso do Momento. Nunca se assume o fuso norte-americano.
ALTER TABLE users ADD COLUMN timezone VARCHAR(50) NULL AFTER country;

CREATE TABLE moments (
  id CHAR(36) PRIMARY KEY,
  slug VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  names_json JSON NULL,
  description VARCHAR(1000) NULL,
  descriptions_json JSON NULL,
  type VARCHAR(20) NOT NULL,                       -- SEASONAL, CULTURAL, EVENT, FASHION_EVENT, COMMUNITY, CHALLENGE, PRIVATE_GROUP, PERSONAL, BRAND_EVENT, FLAIR_EVENT
  nature VARCHAR(20) NOT NULL DEFAULT 'FASHIONAI', -- CULTURAL, SEASONAL, COMMERCIAL, RELIGIOUS, FASHIONAI, PRIVATE
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',     -- DRAFT, SCHEDULED, ACTIVE, ENDED, ARCHIVED, CANCELLED
  start_at DATETIME(6) NOT NULL,
  end_at DATETIME(6) NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'America/Sao_Paulo',
  scope VARCHAR(20) NOT NULL DEFAULT 'GLOBAL',     -- GLOBAL, COUNTRY, REGION, GROUP, PERSONAL
  visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',-- PRIVATE, INVITE_ONLY, FRIENDS, GROUP, PUBLIC
  country CHAR(2) NULL,
  region VARCHAR(60) NULL,
  locale VARCHAR(10) NULL,
  season VARCHAR(10) NULL,
  theme_json JSON NULL,
  cover_url VARCHAR(500) NULL,
  banner_url VARCHAR(500) NULL,
  created_by_user_id CHAR(36) NULL,
  official BOOLEAN NOT NULL DEFAULT FALSE,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  sponsored BOOLEAN NOT NULL DEFAULT FALSE,
  sponsor_name VARCHAR(120) NULL,
  source_url VARCHAR(500) NULL,
  source_note VARCHAR(300) NULL,
  points_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  base_points INT NOT NULL DEFAULT 20,
  points_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  bonus_rules_json JSON NULL,
  style_tags VARCHAR(300) NULL,
  occasion_tags VARCHAR(300) NULL,
  color_tags VARCHAR(300) NULL,
  interpretations_json JSON NULL,
  required_items_json JSON NULL,
  suggested_items_json JSON NULL,
  rules_json JSON NULL,
  group_id CHAR(36) NULL,
  flair_mode VARCHAR(20) NULL,
  settings_json JSON NULL,
  cooperative_goal INT NULL,
  participant_count INT NOT NULL DEFAULT 0,
  memory_json JSON NULL,
  badge_code VARCHAR(40) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_moments_slug UNIQUE (slug),
  CONSTRAINT fk_moments_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_moments_group FOREIGN KEY (group_id) REFERENCES flair_teams(id) ON DELETE SET NULL
);
CREATE INDEX idx_moments_window ON moments(status, start_at, end_at);
CREATE INDEX idx_moments_group ON moments(group_id, start_at);
CREATE INDEX idx_moments_scope ON moments(visibility, scope, country);

CREATE TABLE moment_challenges (
  id CHAR(36) PRIMARY KEY,
  moment_id CHAR(36) NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(120) NOT NULL,
  names_json JSON NULL,
  description VARCHAR(500) NULL,
  descriptions_json JSON NULL,
  kind VARCHAR(24) NOT NULL DEFAULT 'STYLE',       -- STYLE, COLOR, THEME, NO_BUY, REDISCOVERY, ONE_PIECE_MANY_LOOKS, EXPERIMENTAL, REMIX
  points INT NOT NULL DEFAULT 15,
  style_tags VARCHAR(300) NULL,
  color_tags VARCHAR(300) NULL,
  occasion_tags VARCHAR(300) NULL,
  params_json JSON NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_moment_challenges UNIQUE (moment_id, code),
  CONSTRAINT fk_moment_challenges_moment FOREIGN KEY (moment_id) REFERENCES moments(id) ON DELETE CASCADE
);

CREATE TABLE moment_participations (
  id CHAR(36) PRIMARY KEY,
  moment_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'INTERESTED', -- INTERESTED, JOINED, SUBMITTED, COMPLETED, LEFT
  approach VARCHAR(20) NULL,                        -- MY_STYLE, DISCOVERY, EXPERIMENTAL
  wardrobe_only BOOLEAN NOT NULL DEFAULT FALSE,
  remind BOOLEAN NOT NULL DEFAULT FALSE,
  prepared_scheme_id CHAR(36) NULL,
  joined_at DATETIME(6) NULL,
  submitted_at DATETIME(6) NULL,
  completed_at DATETIME(6) NULL,
  left_at DATETIME(6) NULL,
  points_earned INT NOT NULL DEFAULT 0,
  best_match INT NULL,
  ranking INT NULL,
  percentile INT NULL,
  badge_code VARCHAR(40) NULL,
  public_on_profile BOOLEAN NOT NULL DEFAULT TRUE,
  join_count INT NOT NULL DEFAULT 0,
  remind_sent BOOLEAN NOT NULL DEFAULT FALSE,      -- dedupe do aviso "começa esta semana" (§44: nunca spam)
  deadline_notified BOOLEAN NOT NULL DEFAULT FALSE,-- dedupe do aviso "faltam dois dias para enviar seu look"
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_moment_participations UNIQUE (moment_id, user_id),
  CONSTRAINT fk_moment_part_moment FOREIGN KEY (moment_id) REFERENCES moments(id) ON DELETE CASCADE,
  CONSTRAINT fk_moment_part_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_moment_part_prepared FOREIGN KEY (prepared_scheme_id) REFERENCES schemes(id) ON DELETE SET NULL
);
CREATE INDEX idx_moment_part_user ON moment_participations(user_id, status);

CREATE TABLE moment_submissions (
  id CHAR(36) PRIMARY KEY,
  moment_id CHAR(36) NOT NULL,
  participation_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  scheme_id CHAR(36) NOT NULL,
  challenge_id CHAR(36) NULL,
  match_score INT NULL,
  match_json JSON NULL,
  wardrobe_only BOOLEAN NOT NULL DEFAULT FALSE,
  rediscovered_json JSON NULL,
  points_json JSON NULL,
  points_earned INT NOT NULL DEFAULT 0,
  hype_at_submission INT NULL,
  vote_count INT NOT NULL DEFAULT 0,
  submitted_at DATETIME(6) NOT NULL,
  withdrawn BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_moment_submissions UNIQUE (moment_id, scheme_id),   -- o mesmo look entra 1× por Momento (anti-farming)
  CONSTRAINT fk_moment_sub_moment FOREIGN KEY (moment_id) REFERENCES moments(id) ON DELETE CASCADE,
  CONSTRAINT fk_moment_sub_part FOREIGN KEY (participation_id) REFERENCES moment_participations(id) ON DELETE CASCADE,
  CONSTRAINT fk_moment_sub_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_moment_sub_scheme FOREIGN KEY (scheme_id) REFERENCES schemes(id) ON DELETE CASCADE,
  CONSTRAINT fk_moment_sub_challenge FOREIGN KEY (challenge_id) REFERENCES moment_challenges(id) ON DELETE SET NULL
);
CREATE INDEX idx_moment_sub_moment ON moment_submissions(moment_id, withdrawn, submitted_at);
CREATE INDEX idx_moment_sub_user ON moment_submissions(user_id, withdrawn);

CREATE TABLE moment_votes (
  id CHAR(36) PRIMARY KEY,
  moment_id CHAR(36) NOT NULL,
  submission_id CHAR(36) NOT NULL,
  voter_id CHAR(36) NOT NULL,
  dimension VARCHAR(12) NOT NULL,                   -- TREND, ELEGANT, CREATIVE, ORIGINAL, THEME
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_moment_votes UNIQUE (submission_id, voter_id, dimension),
  CONSTRAINT fk_moment_votes_moment FOREIGN KEY (moment_id) REFERENCES moments(id) ON DELETE CASCADE,
  CONSTRAINT fk_moment_votes_submission FOREIGN KEY (submission_id) REFERENCES moment_submissions(id) ON DELETE CASCADE,
  CONSTRAINT fk_moment_votes_voter FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_moment_votes_moment ON moment_votes(moment_id, voter_id);

-- FAI Points sazonais (§10–§11): participação + bônus de reutilização; nenhuma regra premia compra. Referência (ref_id)
-- sempre = momento(:look), então o ledger paga 1× (§39). Os valores 0 são sobrescritos pelo valor do desafio/prêmio.
INSERT INTO fai_points_rules (action_code, points, daily_cap, weekly_cap, once_per_ref, description) VALUES
('MOMENT_LOOK',20,3,NULL,TRUE,'Criar um look relacionado a um Momento (1x por Momento; multiplicador sazonal)'),
('MOMENT_PUBLISH',10,3,NULL,TRUE,'Publicar o look durante o período do Momento'),
('MOMENT_WARDROBE_BONUS',25,3,NULL,TRUE,'Wardrobe Bonus: só peças que você já possui'),
('MOMENT_REDISCOVERY_BONUS',15,3,NULL,TRUE,'Rediscovery Bonus: peça sem uso há mais de 60 dias de volta num look'),
('MOMENT_REMIX_BONUS',10,3,NULL,TRUE,'Remix Bonus: reinterpretar um look antigo'),
('MOMENT_NEW_STYLE',15,3,NULL,TRUE,'Experimentar um estilo novo num Momento'),
('MOMENT_CHALLENGE',0,NULL,NULL,TRUE,'Desafio de um Momento concluído (valor do desafio)'),
('MOMENT_FLAIR',20,3,NULL,TRUE,'Participar de um Momento FLAIR com o grupo'),
('MOMENT_COOP_GOAL',0,NULL,NULL,TRUE,'Meta cooperativa do grupo alcançada (todos recebem)'),
('MOMENT_PRIZE',0,NULL,NULL,TRUE,'Prêmio de um Momento FLAIR (1º/2º/3º)'),
('MOMENT_COMPLETED',25,NULL,NULL,TRUE,'Momento concluído');

-- Momentos oficiais do ciclo 2026/2027 (dados, editáveis em /admin/moments). Datas em UTC (00:00 em America/Sao_Paulo
-- = 03:00Z). Eventos externos (fashion weeks, premiações) NÃO são cadastrados aqui: exigem fonte verificada pela
-- administração (§21). Datas religiosas entram com nature = RELIGIOUS, sem pontos nem votação.
INSERT INTO moments (id, slug, name, names_json, description, descriptions_json, type, nature, status, start_at, end_at, timezone, scope, visibility, country, season,
  theme_json, official, featured, points_enabled, base_points, points_multiplier, bonus_rules_json, style_tags, occasion_tags, color_tags, interpretations_json, badge_code, version, created_at, updated_at) VALUES
('6a000000-0000-4000-8000-000000000001','primavera-2026','Primavera 2026','{"pt-BR":"Primavera 2026","en":"Spring 2026","es":"Primavera 2026"}',
 'Transição de estação no hemisfério sul: cores que acordam, camadas leves e florais reinterpretados.',
 '{"pt-BR":"Transição de estação no hemisfério sul: cores que acordam, camadas leves e florais reinterpretados.","en":"Season change in the southern hemisphere: waking colours, light layers and reinterpreted florals.","es":"Cambio de estación en el hemisferio sur: colores que despiertan, capas ligeras y florales reinterpretados."}',
 'SEASONAL','SEASONAL','ACTIVE','2026-09-22 03:00:00','2026-12-21 02:59:59','America/Sao_Paulo','COUNTRY','PUBLIC','BR','SPRING',
 '{"accent":"#2F9E6E","background":"#F2F8EF","gradient":"linear-gradient(135deg,#F2F8EF,#CDEBD4 55%,#F7D9E6)","icon":"🌸","animation":"none"}',
 TRUE,FALSE,TRUE,20,1.00,'{"wardrobe":25,"rediscovery":15,"remix":10,"newStyle":15,"publish":10}','romantic,boho,resort,minimalist','casual,outdoor,social','green,pink,yellow,white',
 '[{"key":"florals","label":{"pt-BR":"Florais","en":"Florals","es":"Florales"},"styleTags":["romantic","boho"]},{"key":"pastel","label":{"pt-BR":"Pastel","en":"Pastel","es":"Pastel"},"colorTags":["pink","yellow","white"]},{"key":"fresh-minimal","label":{"pt-BR":"Minimal fresco","en":"Fresh minimal","es":"Minimal fresco"},"styleTags":["minimalist","basic"]},{"key":"color-pop","label":{"pt-BR":"Cor viva","en":"Colour pop","es":"Color vivo"},"styleTags":["statement","modern"]}]',
 NULL,0,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6a000000-0000-4000-8000-000000000002','halloween-2026','Halloween 2026','{"pt-BR":"Halloween 2026","en":"Halloween 2026","es":"Halloween 2026"}',
 'Halloween não é só fantasia completa: dark, gothic, orange & black, minimal, pop culture ou experimental — o seu estilo interpreta o tema.',
 '{"pt-BR":"Halloween não é só fantasia completa: dark, gothic, orange & black, minimal, pop culture ou experimental — o seu estilo interpreta o tema.","en":"Halloween is not only a full costume: dark, gothic, orange & black, minimal, pop culture or experimental — your style interprets the theme.","es":"Halloween no es solo disfraz completo: dark, gothic, orange & black, minimal, pop culture o experimental — tu estilo interpreta el tema."}',
 'CULTURAL','CULTURAL','ACTIVE','2026-10-20 03:00:00','2026-11-01 02:59:59','America/Sao_Paulo','GLOBAL','PUBLIC',NULL,NULL,
 '{"accent":"#F57C1F","background":"#1A1020","gradient":"linear-gradient(135deg,#1A1020,#3B1D47 60%,#F57C1F)","icon":"🎃","animation":"none","tone":"dark"}',
 TRUE,TRUE,TRUE,20,1.50,'{"wardrobe":25,"rediscovery":15,"remix":10,"newStyle":15,"publish":10}','edgy,grunge,avant_garde,vintage,glam,minimalist,statement','party,night_out,festival,social','black,orange,purple,red,gray',
 '[{"key":"dark","label":{"pt-BR":"Dark","en":"Dark","es":"Dark"},"styleTags":["edgy","grunge"],"colorTags":["black","gray"]},{"key":"gothic","label":{"pt-BR":"Gothic","en":"Gothic","es":"Gótico"},"styleTags":["edgy","vintage","glam"],"colorTags":["black","purple"]},{"key":"orange-black","label":{"pt-BR":"Orange & Black","en":"Orange & Black","es":"Naranja y negro"},"colorTags":["orange","black"]},{"key":"costume","label":{"pt-BR":"Fantasia","en":"Costume","es":"Disfraz"},"styleTags":["statement","avant_garde"]},{"key":"minimal","label":{"pt-BR":"Minimal Halloween","en":"Minimal Halloween","es":"Halloween minimal"},"styleTags":["minimalist","basic"],"colorTags":["black"]},{"key":"pop-culture","label":{"pt-BR":"Pop culture","en":"Pop culture","es":"Cultura pop"},"styleTags":["y2k","streetwear"]},{"key":"vintage-horror","label":{"pt-BR":"Vintage horror","en":"Vintage horror","es":"Horror vintage"},"styleTags":["vintage","glam"]},{"key":"experimental","label":{"pt-BR":"Experimental","en":"Experimental","es":"Experimental"},"styleTags":["avant_garde","futuristic"]}]',
 'MOMENT_HALLOWEEN_2026',0,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6a000000-0000-4000-8000-000000000003','denim-week-2026','Denim Week','{"pt-BR":"Denim Week","en":"Denim Week","es":"Denim Week"}',
 'Momento FashionAI: uma semana para reinterpretar o jeans que você já tem — total denim, contraste de lavagens, uma peça em três looks.',
 '{"pt-BR":"Momento FashionAI: uma semana para reinterpretar o jeans que você já tem — total denim, contraste de lavagens, uma peça em três looks.","en":"FashionAI Moment: a week to reinterpret the denim you already own — total denim, wash contrast, one piece in three looks.","es":"Momento FashionAI: una semana para reinterpretar el denim que ya tienes — total denim, contraste de lavados, una pieza en tres looks."}',
 'COMMUNITY','FASHIONAI','SCHEDULED','2026-11-09 03:00:00','2026-11-16 02:59:59','America/Sao_Paulo','GLOBAL','PUBLIC',NULL,NULL,
 '{"accent":"#2D55C9","background":"#EEF2FA","gradient":"linear-gradient(135deg,#EEF2FA,#C9D6F2 55%,#2D55C9)","icon":"👖","animation":"none"}',
 TRUE,TRUE,TRUE,20,1.00,'{"wardrobe":25,"rediscovery":15,"remix":10,"newStyle":15,"publish":10}','streetwear,urban,basic,utility,vintage','casual,work,social','blue,indigo,white,black',
 '[{"key":"total-denim","label":{"pt-BR":"Total denim","en":"Total denim","es":"Total denim"},"colorTags":["blue","indigo"]},{"key":"wash-contrast","label":{"pt-BR":"Contraste de lavagens","en":"Wash contrast","es":"Contraste de lavados"}},{"key":"denim-office","label":{"pt-BR":"Denim no trabalho","en":"Denim at work","es":"Denim en el trabajo"},"styleTags":["tailored","classic"]},{"key":"vintage-denim","label":{"pt-BR":"Vintage","en":"Vintage","es":"Vintage"},"styleTags":["vintage"]}]',
 'MOMENT_DENIM_WEEK_2026',0,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6a000000-0000-4000-8000-000000000004','festas-2026','Natal e Festas 2026','{"pt-BR":"Natal e Festas 2026","en":"Christmas and Holiday Season 2026","es":"Navidad y Fiestas 2026"}',
 'Encontros de fim de ano: brilho, veludo, vermelho e dourado — ou um minimal elegante. Data de significado religioso para muitas pessoas: aqui ela é apresentada como ocasião, sem competição.',
 '{"pt-BR":"Encontros de fim de ano: brilho, veludo, vermelho e dourado — ou um minimal elegante. Data de significado religioso para muitas pessoas: aqui ela é apresentada como ocasião, sem competição.","en":"Year-end gatherings: shine, velvet, red and gold — or an elegant minimal. A date of religious meaning for many: presented here as an occasion, with no competition.","es":"Encuentros de fin de año: brillo, terciopelo, rojo y dorado — o un minimal elegante. Fecha de significado religioso para muchas personas: aquí se presenta como ocasión, sin competencia."}',
 'CULTURAL','RELIGIOUS','SCHEDULED','2026-12-15 03:00:00','2026-12-26 02:59:59','America/Sao_Paulo','GLOBAL','PUBLIC',NULL,NULL,
 '{"accent":"#B3262E","background":"#FBF3EE","gradient":"linear-gradient(135deg,#FBF3EE,#F3D9C6 55%,#B3262E)","icon":"✨","animation":"none"}',
 TRUE,FALSE,FALSE,0,1.00,NULL,'glam,chic,classic,romantic,minimalist','party,social,ceremony,home','red,gold,green,white,black',
 '[{"key":"shine","label":{"pt-BR":"Brilho","en":"Shine","es":"Brillo"},"styleTags":["glam"]},{"key":"red-gold","label":{"pt-BR":"Vermelho e dourado","en":"Red and gold","es":"Rojo y dorado"},"colorTags":["red","gold"]},{"key":"elegant-minimal","label":{"pt-BR":"Minimal elegante","en":"Elegant minimal","es":"Minimal elegante"},"styleTags":["minimalist","chic"]},{"key":"cozy","label":{"pt-BR":"Em casa","en":"At home","es":"En casa"},"styleTags":["basic"]}]',
 NULL,0,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6a000000-0000-4000-8000-000000000005','reveillon-2026','Réveillon','{"pt-BR":"Réveillon 2026","en":"New Year''s Eve 2026","es":"Nochevieja 2026"}',
 'Virada do ano: branco, brilho, metálicos e cores de desejo — na praia, na festa ou em casa.',
 '{"pt-BR":"Virada do ano: branco, brilho, metálicos e cores de desejo — na praia, na festa ou em casa.","en":"New Year''s Eve: white, shine, metallics and wish colours — on the beach, at the party or at home.","es":"Fin de año: blanco, brillo, metálicos y colores de deseo — en la playa, en la fiesta o en casa."}',
 'CULTURAL','CULTURAL','SCHEDULED','2026-12-26 03:00:00','2027-01-02 02:59:59','America/Sao_Paulo','GLOBAL','PUBLIC',NULL,NULL,
 '{"accent":"#C9A227","background":"#FFFFFF","gradient":"linear-gradient(135deg,#FFFFFF,#F4ECD3 55%,#C9A227)","icon":"🎆","animation":"none"}',
 TRUE,FALSE,TRUE,20,1.25,'{"wardrobe":25,"rediscovery":15,"remix":10,"newStyle":15,"publish":10}','glam,chic,resort,statement,minimalist','party,beach,night_out,social','white,gold,silver,yellow,red',
 '[{"key":"all-white","label":{"pt-BR":"All white","en":"All white","es":"Todo blanco"},"colorTags":["white"]},{"key":"metallic","label":{"pt-BR":"Metálico","en":"Metallic","es":"Metálico"},"colorTags":["gold","silver"]},{"key":"beach","label":{"pt-BR":"Praia","en":"Beach","es":"Playa"},"styleTags":["resort"]},{"key":"wish-colours","label":{"pt-BR":"Cor do desejo","en":"Wish colour","es":"Color del deseo"},"colorTags":["yellow","red","green"]}]',
 NULL,0,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6a000000-0000-4000-8000-000000000006','verao-2027','Verão 2027','{"pt-BR":"Verão 2027","en":"Summer 2027","es":"Verano 2027"}',
 'Temporada de calor no hemisfério sul: tecidos leves, cor solar, praia e cidade.',
 '{"pt-BR":"Temporada de calor no hemisfério sul: tecidos leves, cor solar, praia e cidade.","en":"Hot season in the southern hemisphere: light fabrics, solar colour, beach and city.","es":"Temporada de calor en el hemisferio sur: tejidos ligeros, color solar, playa y ciudad."}',
 'SEASONAL','SEASONAL','SCHEDULED','2026-12-21 03:00:00','2027-03-21 02:59:59','America/Sao_Paulo','COUNTRY','PUBLIC','BR','SUMMER',
 '{"accent":"#FF6A1A","background":"#FFF6EC","gradient":"linear-gradient(135deg,#FFF6EC,#FFD9B5 55%,#FF6A1A)","icon":"☀️","animation":"none"}',
 TRUE,FALSE,TRUE,20,1.00,'{"wardrobe":25,"rediscovery":15,"remix":10,"newStyle":15,"publish":10}','resort,basic,sporty,boho,minimalist','beach,vacation,casual,outdoor','white,orange,yellow,blue,green',NULL,NULL,0,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6a000000-0000-4000-8000-000000000007','no-buy-week-2027','No-Buy Week','{"pt-BR":"No-Buy Week","en":"No-Buy Week","es":"No-Buy Week"}',
 'Momento FashionAI: 7 dias, 7 looks, o mesmo guarda-roupa. Nenhuma peça nova entra na composição depois do início.',
 '{"pt-BR":"Momento FashionAI: 7 dias, 7 looks, o mesmo guarda-roupa. Nenhuma peça nova entra na composição depois do início.","en":"FashionAI Moment: 7 days, 7 looks, the same wardrobe. No new piece enters a look after the start.","es":"Momento FashionAI: 7 días, 7 looks, el mismo guardarropa. Ninguna prenda nueva entra en la composición después del inicio."}',
 'CHALLENGE','FASHIONAI','SCHEDULED','2027-01-11 03:00:00','2027-01-18 02:59:59','America/Sao_Paulo','GLOBAL','PUBLIC',NULL,NULL,
 '{"accent":"#1F7A76","background":"#EEF6F5","gradient":"linear-gradient(135deg,#EEF6F5,#C6E4E1 55%,#1F7A76)","icon":"♻️","animation":"none"}',
 TRUE,FALSE,TRUE,20,1.00,'{"wardrobe":40,"rediscovery":15,"remix":10,"newStyle":15,"publish":10}',NULL,NULL,NULL,NULL,'MOMENT_NO_BUY_WEEK_2027',0,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6a000000-0000-4000-8000-000000000008','carnaval-2027','Carnaval 2027','{"pt-BR":"Carnaval 2027","en":"Carnival 2027","es":"Carnaval 2027"}',
 'Cores vibrantes, brilho, maximalismo, bloco de rua, tropical, retrô ou minimal: o Carnaval admite muitas leituras.',
 '{"pt-BR":"Cores vibrantes, brilho, maximalismo, bloco de rua, tropical, retrô ou minimal: o Carnaval admite muitas leituras.","en":"Vibrant colours, shine, maximalism, street carnival, tropical, retro or minimal: Carnival admits many readings.","es":"Colores vibrantes, brillo, maximalismo, carnaval de calle, tropical, retro o minimal: el Carnaval admite muchas lecturas."}',
 'CULTURAL','CULTURAL','SCHEDULED','2027-02-05 03:00:00','2027-02-18 02:59:59','America/Sao_Paulo','COUNTRY','PUBLIC','BR',NULL,
 '{"accent":"#C6275E","background":"#FFF0F5","gradient":"linear-gradient(135deg,#FFE066,#FF6A1A 45%,#C6275E 80%,#2D55C9)","icon":"🎭","animation":"none"}',
 TRUE,TRUE,TRUE,20,1.50,'{"wardrobe":25,"rediscovery":15,"remix":10,"newStyle":15,"publish":10}','statement,glam,boho,streetwear,resort,vintage,minimalist','festival,party,outdoor,beach','yellow,pink,orange,green,blue,gold,silver',
 '[{"key":"vibrant","label":{"pt-BR":"Cores vibrantes","en":"Vibrant colours","es":"Colores vibrantes"},"colorTags":["yellow","pink","orange","green","blue"]},{"key":"shine","label":{"pt-BR":"Brilho","en":"Shine","es":"Brillo"},"styleTags":["glam"],"colorTags":["gold","silver"]},{"key":"maximal","label":{"pt-BR":"Maximalismo","en":"Maximalism","es":"Maximalismo"},"styleTags":["statement"]},{"key":"street","label":{"pt-BR":"Bloco de rua","en":"Street carnival","es":"Carnaval de calle"},"styleTags":["streetwear","sporty"]},{"key":"tropical","label":{"pt-BR":"Tropical","en":"Tropical","es":"Tropical"},"styleTags":["resort","boho"]},{"key":"retro","label":{"pt-BR":"Retrô","en":"Retro","es":"Retro"},"styleTags":["vintage"]},{"key":"minimal","label":{"pt-BR":"Minimal","en":"Minimal","es":"Minimal"},"styleTags":["minimalist"]},{"key":"custom","label":{"pt-BR":"Customização","en":"Customisation","es":"Customización"},"styleTags":["avant_garde"]}]',
 'MOMENT_CARNAVAL_2027',0,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6a000000-0000-4000-8000-000000000009','festa-junina-2027','Festa Junina 2027','{"pt-BR":"Festa Junina 2027","en":"Festa Junina 2027","es":"Fiesta Junina 2027"}',
 'Xadrez, jeans, chapéu de palha e cores de fogueira — ou uma leitura urbana da festa.',
 '{"pt-BR":"Xadrez, jeans, chapéu de palha e cores de fogueira — ou uma leitura urbana da festa.","en":"Plaid, denim, straw hats and bonfire colours — or an urban reading of the festival.","es":"Cuadros, denim, sombrero de paja y colores de hoguera — o una lectura urbana de la fiesta."}',
 'CULTURAL','CULTURAL','SCHEDULED','2027-06-01 03:00:00','2027-07-01 02:59:59','America/Sao_Paulo','COUNTRY','PUBLIC','BR',NULL,
 '{"accent":"#B8862B","background":"#FDF6E7","gradient":"linear-gradient(135deg,#FDF6E7,#F4D58A 55%,#B8862B)","icon":"🔥","animation":"none"}',
 TRUE,FALSE,TRUE,20,1.25,'{"wardrobe":25,"rediscovery":15,"remix":10,"newStyle":15,"publish":10}','boho,vintage,basic,streetwear,romantic','festival,party,outdoor','red,yellow,orange,blue,brown',NULL,'MOMENT_FESTA_JUNINA_2027',0,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6a000000-0000-4000-8000-000000000010','inverno-2027','Inverno 2027','{"pt-BR":"Inverno 2027","en":"Winter 2027","es":"Invierno 2027"}',
 'Winter Style: camadas, texturas, lã e couro — e as peças de frio que ficaram paradas o ano inteiro.',
 '{"pt-BR":"Winter Style: camadas, texturas, lã e couro — e as peças de frio que ficaram paradas o ano inteiro.","en":"Winter Style: layers, textures, wool and leather — and the cold-weather pieces that sat idle all year.","es":"Winter Style: capas, texturas, lana y cuero — y las prendas de frío que quedaron paradas todo el año."}',
 'SEASONAL','SEASONAL','SCHEDULED','2027-06-21 03:00:00','2027-09-23 02:59:59','America/Sao_Paulo','COUNTRY','PUBLIC','BR','WINTER',
 '{"accent":"#2B3A67","background":"#EEF1F7","gradient":"linear-gradient(135deg,#EEF1F7,#C8D0E6 55%,#2B3A67)","icon":"🧣","animation":"none"}',
 TRUE,FALSE,TRUE,20,1.00,'{"wardrobe":25,"rediscovery":20,"remix":10,"newStyle":15,"publish":10}','classic,tailored,grunge,minimalist,techwear','work,casual,night_out,outdoor','black,gray,brown,navy,white',NULL,NULL,0,'2026-09-01 12:00:00','2026-09-01 12:00:00');

-- Desafios do Halloween (§12): estilos diferentes participam; NO_BUY vale mais por premiar o próprio guarda-roupa.
INSERT INTO moment_challenges (id, moment_id, code, name, names_json, description, kind, points, style_tags, color_tags, params_json, sort_order, created_at, updated_at) VALUES
('6b000000-0000-4000-8000-000000000001','6a000000-0000-4000-8000-000000000002','DARK_MINIMAL','Dark Minimal','{"pt-BR":"Dark Minimal","en":"Dark Minimal","es":"Dark Minimal"}','Preto, linhas limpas, um só detalhe sombrio.','STYLE',15,'minimalist,edgy','black,gray',NULL,1,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6b000000-0000-4000-8000-000000000002','6a000000-0000-4000-8000-000000000002','ORANGE_BLACK','Orange & Black','{"pt-BR":"Orange & Black","en":"Orange & Black","es":"Naranja y negro"}','As duas cores do tema no mesmo look.','COLOR',20,NULL,'orange,black',NULL,2,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6b000000-0000-4000-8000-000000000003','6a000000-0000-4000-8000-000000000002','HORROR_ICON','Horror Icon','{"pt-BR":"Horror Icon","en":"Horror Icon","es":"Ícono del terror"}','Referência a um ícone do terror, sem precisar de fantasia completa.','THEME',25,'statement,glam,vintage','black,red,purple',NULL,3,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6b000000-0000-4000-8000-000000000004','6a000000-0000-4000-8000-000000000002','VINTAGE_HALLOWEEN','Vintage Halloween','{"pt-BR":"Vintage Halloween","en":"Vintage Halloween","es":"Halloween vintage"}','Anos 50–90 com atmosfera de Halloween.','STYLE',25,'vintage','black,orange,purple',NULL,4,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6b000000-0000-4000-8000-000000000005','6a000000-0000-4000-8000-000000000002','NO_BUY_HALLOWEEN','No-Buy Halloween','{"pt-BR":"No-Buy Halloween","en":"No-Buy Halloween","es":"Halloween sin comprar"}','Use apenas o seu guarda-roupa.','NO_BUY',40,NULL,NULL,'{"wardrobeOnly":true}',5,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6b000000-0000-4000-8000-000000000006','6a000000-0000-4000-8000-000000000002','EXPERIMENTAL_HALLOWEEN','Experimental Halloween','{"pt-BR":"Experimental Halloween","en":"Experimental Halloween","es":"Halloween experimental"}','Um estilo que você nunca usou nos seus looks.','EXPERIMENTAL',30,'avant_garde,futuristic',NULL,'{"newStyle":true}',6,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6b000000-0000-4000-8000-000000000007','6a000000-0000-4000-8000-000000000002','BACK_FROM_THE_CLOSET','Back from the Closet','{"pt-BR":"Back from the Closet","en":"Back from the Closet","es":"De vuelta del armario"}','Traga de volta uma peça sem uso há mais de 60 dias.','REDISCOVERY',15,NULL,NULL,'{"idleDays":60}',7,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
-- Denim Week
('6b000000-0000-4000-8000-000000000011','6a000000-0000-4000-8000-000000000003','TOTAL_DENIM','Total denim','{"pt-BR":"Total denim","en":"Total denim","es":"Total denim"}','Jeans de cima a baixo.','COLOR',20,NULL,'blue,indigo',NULL,1,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6b000000-0000-4000-8000-000000000012','6a000000-0000-4000-8000-000000000003','ONE_PIECE_THREE_LOOKS','One piece / three looks','{"pt-BR":"Uma peça, três looks","en":"One piece, three looks","es":"Una prenda, tres looks"}','Escolha uma peça jeans e crie 3 looks diferentes com ela.','ONE_PIECE_MANY_LOOKS',30,NULL,NULL,'{"looksRequired":3}',2,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6b000000-0000-4000-8000-000000000013','6a000000-0000-4000-8000-000000000003','DENIM_REDISCOVERY','Jeans esquecido','{"pt-BR":"Jeans esquecido","en":"Forgotten denim","es":"Denim olvidado"}','Uma peça jeans parada há mais de 90 dias volta ao look.','REDISCOVERY',15,NULL,NULL,'{"idleDays":90}',3,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
-- No-Buy Week: 7 dias / 7 looks
('6b000000-0000-4000-8000-000000000021','6a000000-0000-4000-8000-000000000007','SEVEN_DAYS_SEVEN_LOOKS','7 dias / 7 looks','{"pt-BR":"7 dias / 7 looks","en":"7 days / 7 looks","es":"7 días / 7 looks"}','Mesmo guarda-roupa, 7 combinações.','NO_BUY',40,NULL,NULL,'{"wardrobeOnly":true,"looksRequired":7}',1,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6b000000-0000-4000-8000-000000000022','6a000000-0000-4000-8000-000000000007','FORGOTTEN_PIECES','Forgotten pieces','{"pt-BR":"Peças esquecidas","en":"Forgotten pieces","es":"Prendas olvidadas"}','Três peças sem uso há mais de 60 dias de volta.','REDISCOVERY',25,NULL,NULL,'{"idleDays":60,"piecesRequired":3}',2,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
-- Carnaval
('6b000000-0000-4000-8000-000000000031','6a000000-0000-4000-8000-000000000008','COLOR_CLASH','Color Clash','{"pt-BR":"Color Clash","en":"Color Clash","es":"Color Clash"}','Três cores vibrantes no mesmo look.','COLOR',20,NULL,'yellow,pink,orange,green,blue','{"distinctColors":3}',1,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6b000000-0000-4000-8000-000000000032','6a000000-0000-4000-8000-000000000008','STREET_CARNIVAL','Bloco de rua','{"pt-BR":"Bloco de rua","en":"Street carnival","es":"Carnaval de calle"}','Conforto para andar e dançar.','STYLE',15,'streetwear,sporty',NULL,NULL,2,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6b000000-0000-4000-8000-000000000033','6a000000-0000-4000-8000-000000000008','MINIMAL_CARNIVAL','Carnaval minimal','{"pt-BR":"Carnaval minimal","en":"Minimal carnival","es":"Carnaval minimal"}','Uma cor, um brilho, nada mais.','STYLE',20,'minimalist',NULL,NULL,3,'2026-09-01 12:00:00','2026-09-01 12:00:00'),
('6b000000-0000-4000-8000-000000000034','6a000000-0000-4000-8000-000000000008','NO_BUY_CARNIVAL','No-Buy Carnaval','{"pt-BR":"No-Buy Carnaval","en":"No-Buy Carnival","es":"Carnaval sin comprar"}','Customize o que você já tem.','NO_BUY',40,NULL,NULL,'{"wardrobeOnly":true}',4,'2026-09-01 12:00:00','2026-09-01 12:00:00');
