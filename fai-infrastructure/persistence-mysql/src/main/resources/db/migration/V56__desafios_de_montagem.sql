-- FLAIR-UT F5 · §14 (docs/plano/FLAIR_UT_Cartas_e_Desafios.md): Desafios de Montagem (Card Building Challenges)
-- dentro dos Momentos, com as regras tiradas de O Império do Efêmero (Lipovetsky): janela do Momento e Memória (E1–E3),
-- qualquer interpretação vale (P1–P3), sem compras e redescoberta (C1–C4), um desafio aberto a qualquer nível por
-- Momento (A1) e nenhum desafio em Momento religioso (R1). Os desafios são DADOS: a administração cria os próximos.

CREATE TABLE flair_challenge_groups (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  names_json JSON NULL,
  description VARCHAR(600) NULL,
  descriptions_json JSON NULL,
  points INT NOT NULL DEFAULT 0,
  badge_code VARCHAR(40) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
);

CREATE TABLE flair_challenges (
  id CHAR(36) PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  names_json JSON NULL,
  description VARCHAR(600) NULL,
  descriptions_json JSON NULL,
  scenario VARCHAR(40) NOT NULL,
  difficulty VARCHAR(12) NOT NULL,                  -- EASY, MEDIUM, HARD, LEGENDARY
  status VARCHAR(12) NOT NULL DEFAULT 'ACTIVE',     -- DRAFT, ACTIVE, ARCHIVED
  moment_id CHAR(36) NULL,
  start_at DATETIME(6) NULL,
  end_at DATETIME(6) NULL,
  slots_json JSON NOT NULL,
  requirements_json JSON NULL,
  theme_tags VARCHAR(300) NULL,
  points INT NOT NULL DEFAULT 0,
  repeat_limit INT NOT NULL DEFAULT 1,
  group_code VARCHAR(40) NULL,
  locks_cards BOOLEAN NOT NULL DEFAULT TRUE,
  official BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id CHAR(36) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT ck_flair_challenge_difficulty CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD', 'LEGENDARY')),
  CONSTRAINT ck_flair_challenge_status CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  CONSTRAINT ck_flair_challenge_points CHECK (points BETWEEN 0 AND 200),
  CONSTRAINT fk_flair_challenge_moment FOREIGN KEY (moment_id) REFERENCES moments(id) ON DELETE SET NULL,
  CONSTRAINT fk_flair_challenge_group FOREIGN KEY (group_code) REFERENCES flair_challenge_groups(code) ON DELETE SET NULL,
  INDEX ix_flair_challenge_moment (moment_id, sort_order)
);

CREATE TABLE flair_challenge_submissions (
  id CHAR(36) PRIMARY KEY,
  challenge_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  attempt INT NOT NULL DEFAULT 1,
  cards_json JSON NOT NULL,
  interpretation VARCHAR(40) NULL,
  sintonia INT NOT NULL,
  sintonia_max INT NOT NULL,
  story_json JSON NULL,
  points INT NOT NULL DEFAULT 0,
  bonus_json JSON NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  CONSTRAINT uq_flair_challenge_attempt UNIQUE (challenge_id, user_id, attempt),
  CONSTRAINT fk_flair_submission_challenge FOREIGN KEY (challenge_id) REFERENCES flair_challenges(id) ON DELETE CASCADE,
  CONSTRAINT fk_flair_submission_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX ix_flair_submission_user (user_id, created_at)
);

-- a carta guarda as tags da peça (requisitos e sintonia) e, entregue (D7), o desafio que a guardou como memória
ALTER TABLE flair_card_instance
  ADD COLUMN tags_json TEXT NULL,
  ADD COLUMN locked_challenge_id CHAR(36) NULL,
  ADD COLUMN locked_at DATETIME(6) NULL,
  ADD CONSTRAINT fk_flair_card_locked_challenge FOREIGN KEY (locked_challenge_id) REFERENCES flair_challenges(id) ON DELETE SET NULL;

INSERT INTO fai_points_rules (action_code, points, daily_cap, weekly_cap, once_per_ref, description) VALUES
('FLAIR_CBC',0,5,NULL,TRUE,'Desafio de Montagem entregue (valor do desafio x multiplicador do Momento)'),
('FLAIR_CBC_REDISCOVERY',10,5,NULL,TRUE,'Redescoberta: carta de peça sem uso há 60 dias ou mais num Desafio de Montagem'),
('FLAIR_CBC_GROUP',0,NULL,NULL,TRUE,'Grupo de Desafios de Montagem completo');

-- L4 (moda aberta): o inverno também tem mais de uma leitura possível
UPDATE moments SET interpretations_json = '[{"key":"cozy","label":{"pt-BR":"Aconchego","en":"Cozy","es":"Acogedor"},"styleTags":["basic","romantic"],"colorTags":["brown","cream","beige"]},{"key":"winter-tailoring","label":{"pt-BR":"Alfaiataria de inverno","en":"Winter tailoring","es":"Sastrería de invierno"},"styleTags":["tailored","classic"],"colorTags":["navy","gray","black"]},{"key":"dark-layers","label":{"pt-BR":"Camadas escuras","en":"Dark layers","es":"Capas oscuras"},"styleTags":["grunge","edgy"],"colorTags":["black","charcoal"]},{"key":"mountain","label":{"pt-BR":"Montanha técnica","en":"Mountain tech","es":"Montaña técnica"},"styleTags":["techwear","sporty","utility"],"colorTags":["navy","green","orange"]}]'
WHERE slug = 'inverno-2027' AND interpretations_json IS NULL;

INSERT INTO flair_challenge_groups (id, code, name, names_json, description, descriptions_json, points, badge_code, sort_order, created_at, updated_at) VALUES
('7b000000-0000-4000-8000-000000000001','lenda-do-estilo','Lenda do estilo','{"pt-BR":"Lenda do estilo","en":"Style legend","es":"Leyenda del estilo"}',
 'Quatro desafios difíceis, quatro cenas: o casamento, Paris, a gala e o desfile.',
 '{"pt-BR":"Quatro desafios difíceis, quatro cenas: o casamento, Paris, a gala e o desfile.","en":"Four hard challenges, four scenes: the wedding, Paris, the gala and the show.","es":"Cuatro desafíos difíciles, cuatro escenas: la boda, París, la gala y el desfile."}',
 150,'CBC_LENDA_DO_ESTILO',1,'2026-10-07 12:00:00','2026-10-07 12:00:00');

INSERT INTO flair_challenges (id, slug, name, names_json, description, descriptions_json, scenario, difficulty, status, moment_id, slots_json, requirements_json, theme_tags, points, repeat_limit, group_code, locks_cards, official, sort_order, version, created_at, updated_at) VALUES
('7c000000-0000-4000-8000-000000000001','verao-em-ipanema','Verão em Ipanema','{"pt-BR":"Verão em Ipanema","en":"Summer in Ipanema","es":"Verano en Ipanema"}','Três cartas, do calçadão ao quiosque. Qualquer nível vale.','{"pt-BR":"Três cartas, do calçadão ao quiosque. Qualquer nível vale.","en":"Three cards, from the boardwalk to the kiosk. Any level counts.","es":"Tres cartas, del paseo marítimo al quiosco. Cualquier nivel vale."}','ipanema','EASY','ACTIVE',NULL,'[{"key":"calcadao","position":"CAL"},{"key":"guarda_sol","position":"ACE"},{"key":"quiosque","position":"SUP"}]','[]',NULL,15,1,NULL,TRUE,TRUE,10,0,'2026-10-07 12:00:00','2026-10-07 12:00:00'),
('7c000000-0000-4000-8000-000000000002','primeiro-dia-de-estagio','Primeiro dia de estágio','{"pt-BR":"Primeiro dia de estágio","en":"First day at the internship","es":"Primer día de prácticas"}','Da recepção à reunião das 10h: monte o primeiro dia.','{"pt-BR":"Da recepção à reunião das 10h: monte o primeiro dia.","en":"From reception to the 10 a.m. meeting: build the first day.","es":"De la recepción a la reunión de las 10: arma el primer día."}','estagio','EASY','ACTIVE',NULL,'[{"key":"recepcao","position":"SUP"},{"key":"elevador","position":"INF"},{"key":"mesa","position":"ACE"},{"key":"reuniao","position":"CAL"}]','[]',NULL,15,1,NULL,TRUE,TRUE,20,0,'2026-10-07 12:00:00','2026-10-07 12:00:00'),
('7c000000-0000-4000-8000-000000000003','brecho-de-tesouros','Brechó de tesouros','{"pt-BR":"Brechó de tesouros","en":"Thrift-store treasures","es":"Tesoros de segunda mano"}','Só cartas Bronze: aqui o valor é o olhar, não o preço.','{"pt-BR":"Só cartas Bronze: aqui o valor é o olhar, não o preço.","en":"Bronze cards only: here the value is the eye, not the price.","es":"Solo cartas Bronce: aquí el valor es la mirada, no el precio."}','brecho','EASY','ACTIVE',NULL,'[{"key":"arara","position":"SUP"},{"key":"provador","position":"INF"},{"key":"espelho","position":"ACE"},{"key":"caixa","position":"CAL"},{"key":"sacola","position":"ANY"}]','[{"type":"tier","only":"BRONZE"}]',NULL,20,1,NULL,TRUE,TRUE,30,0,'2026-10-07 12:00:00','2026-10-07 12:00:00'),
('7c000000-0000-4000-8000-000000000004','festival-de-musica','Festival de música','{"pt-BR":"Festival de música","en":"Music festival","es":"Festival de música"}','Do portão à saída, com duas cartas da mesma marca.','{"pt-BR":"Do portão à saída, com duas cartas da mesma marca.","en":"From the gate to the exit, with two cards from the same brand.","es":"De la entrada a la salida, con dos cartas de la misma marca."}','festival','MEDIUM','ACTIVE',NULL,'[{"key":"portao","position":"CAL"},{"key":"palco","position":"SUP"},{"key":"food_truck","position":"INF"},{"key":"area_vip","position":"ACE"},{"key":"saida","position":"ANY"}]','[{"type":"sameBrand","count":2}]',NULL,25,1,NULL,TRUE,TRUE,40,0,'2026-10-07 12:00:00','2026-10-07 12:00:00'),
('7c000000-0000-4000-8000-000000000005','casamento-no-campo','Casamento no campo','{"pt-BR":"Casamento no campo","en":"Countryside wedding","es":"Boda en el campo"}','Cinco momentos da festa, com nota média 68 ou mais.','{"pt-BR":"Cinco momentos da festa, com nota média 68 ou mais.","en":"Five moments of the party, with an average rating of 68 or more.","es":"Cinco momentos de la fiesta, con nota media de 68 o más."}','casamento','MEDIUM','ACTIVE',NULL,'[{"key":"cerimonia","position":"SUP"},{"key":"fotos","position":"ACE"},{"key":"jantar","position":"INF"},{"key":"pista","position":"CAL"},{"key":"despedida","position":"ANY"}]','[{"type":"ovrAvg","min":68}]',NULL,25,1,'lenda-do-estilo',TRUE,TRUE,50,0,'2026-10-07 12:00:00','2026-10-07 12:00:00'),
('7c000000-0000-4000-8000-000000000006','viagem-a-paris','Viagem a Paris','{"pt-BR":"Viagem a Paris","en":"Trip to Paris","es":"Viaje a París"}','Seis paradas e pelo menos três marcas diferentes.','{"pt-BR":"Seis paradas e pelo menos três marcas diferentes.","en":"Six stops and at least three different brands.","es":"Seis paradas y al menos tres marcas distintas."}','paris','MEDIUM','ACTIVE',NULL,'[{"key":"aeroporto","position":"CAL"},{"key":"cafe","position":"SUP"},{"key":"museu","position":"ACE"},{"key":"sena","position":"INF"},{"key":"metro","position":"ANY"},{"key":"terraco","position":"ANY"}]','[{"type":"distinctBrands","count":3}]',NULL,30,1,'lenda-do-estilo',TRUE,TRUE,60,0,'2026-10-07 12:00:00','2026-10-07 12:00:00'),
('7c000000-0000-4000-8000-000000000007','noite-de-gala','Noite de gala','{"pt-BR":"Noite de gala","en":"Gala night","es":"Noche de gala"}','Sete vagas, três cartas Ouro e sintonia 15 ou mais.','{"pt-BR":"Sete vagas, três cartas Ouro e sintonia 15 ou mais.","en":"Seven slots, three Gold cards and chemistry of 15 or more.","es":"Siete casillas, tres cartas Oro y sintonía de 15 o más."}','gala','HARD','ACTIVE',NULL,'[{"key":"chegada","position":"CAL"},{"key":"tapete","position":"SUP"},{"key":"parede","position":"ACE"},{"key":"escadaria","position":"INF"},{"key":"salao","position":"ANY"},{"key":"camarim","position":"ANY"},{"key":"after","position":"ANY"}]','[{"type":"tier","min":"OURO","count":3},{"type":"sintonia","min":15}]',NULL,50,1,'lenda-do-estilo',TRUE,TRUE,70,0,'2026-10-07 12:00:00','2026-10-07 12:00:00'),
('7c000000-0000-4000-8000-000000000008','desfile-capsula','Desfile da coleção cápsula','{"pt-BR":"Desfile da coleção cápsula","en":"Capsule collection show","es":"Desfile de la colección cápsula"}','Oito vagas, do backstage à imprensa, com quatro cartas da mesma marca.','{"pt-BR":"Oito vagas, do backstage à imprensa, com quatro cartas da mesma marca.","en":"Eight slots, from backstage to the press, with four cards from the same brand.","es":"Ocho casillas, del backstage a la prensa, con cuatro cartas de la misma marca."}','desfile','HARD','ACTIVE',NULL,'[{"key":"backstage","position":"ANY"},{"key":"maquiagem","position":"ACE"},{"key":"passarela_1","position":"SUP"},{"key":"passarela_2","position":"INF"},{"key":"passarela_3","position":"CAL"},{"key":"passarela_4","position":"ANY"},{"key":"final","position":"ANY"},{"key":"imprensa","position":"ANY"}]','[{"type":"sameBrand","count":4}]',NULL,50,1,'lenda-do-estilo',TRUE,TRUE,80,0,'2026-10-07 12:00:00','2026-10-07 12:00:00'),
('7c000000-0000-4000-8000-000000000009','loja-pop-up','Loja pop-up de bairro','{"pt-BR":"Loja pop-up de bairro","en":"Neighbourhood pop-up store","es":"Tienda pop-up de barrio"}','Sete vagas, só cartas de peças, com sintonia 14 ou mais.','{"pt-BR":"Sete vagas, só cartas de peças, com sintonia 14 ou mais.","en":"Seven slots, piece cards only, with chemistry of 14 or more.","es":"Siete casillas, solo cartas de prendas, con sintonía de 14 o más."}','popup','HARD','ACTIVE',NULL,'[{"key":"vitrine","position":"SUP"},{"key":"balcao","position":"ACE"},{"key":"arara","position":"INF"},{"key":"provador","position":"ANY"},{"key":"caixa","position":"ANY"},{"key":"calcada","position":"CAL"},{"key":"vizinhanca","position":"ANY"}]','[{"type":"sintonia","min":14},{"type":"origin","only":"PIECE"}]',NULL,45,1,NULL,TRUE,TRUE,90,0,'2026-10-07 12:00:00','2026-10-07 12:00:00'),
('7c000000-0000-4000-8000-000000000010','primavera-no-jardim','Primavera no jardim','{"pt-BR":"Primavera no jardim","en":"Spring in the garden","es":"Primavera en el jardín"}','Quatro cartas, duas no tema. Flores, pastel, frescor ou cor: a leitura é sua.','{"pt-BR":"Quatro cartas, duas no tema. Flores, pastel, frescor ou cor: a leitura é sua.","en":"Four cards, two on theme. Florals, pastel, fresh or colour: the reading is yours.","es":"Cuatro cartas, dos en el tema. Flores, pastel, frescura o color: la lectura es tuya."}','primavera','EASY','ACTIVE','6a000000-0000-4000-8000-000000000001','[{"key":"jardim","position":"SUP"},{"key":"banco","position":"INF"},{"key":"lago","position":"ACE"},{"key":"caminho","position":"CAL"}]','[{"type":"theme","count":2}]',NULL,20,1,NULL,TRUE,TRUE,100,0,'2026-10-07 12:00:00','2026-10-07 12:00:00'),
('7c000000-0000-4000-8000-000000000011','de-volta-do-armario','De volta do armário','{"pt-BR":"De volta do armário","en":"Back from the closet","es":"De vuelta del armario"}','Três cartas, uma delas de uma peça parada há 60 dias ou mais.','{"pt-BR":"Três cartas, uma delas de uma peça parada há 60 dias ou mais.","en":"Three cards, one of them from a piece unworn for 60 days or more.","es":"Tres cartas, una de una prenda sin usar hace 60 días o más."}','armario','EASY','ACTIVE','6a000000-0000-4000-8000-000000000001','[{"key":"fundo","position":"ANY"},{"key":"cabide","position":"ANY"},{"key":"espelho","position":"ANY"}]','[{"type":"rediscovery","count":1,"idleDays":60}]',NULL,25,1,NULL,TRUE,TRUE,110,0,'2026-10-07 12:00:00','2026-10-07 12:00:00'),
('7c000000-0000-4000-8000-000000000012','noite-de-halloween','Noite de Halloween','{"pt-BR":"Noite de Halloween","en":"Halloween night","es":"Noche de Halloween"}','Seis vagas, três no tema. Dark, gótico, laranja e preto, minimal ou fantasia: nenhuma leitura é a certa.','{"pt-BR":"Seis vagas, três no tema. Dark, gótico, laranja e preto, minimal ou fantasia: nenhuma leitura é a certa.","en":"Six slots, three on theme. Dark, gothic, orange and black, minimal or costume: no reading is the right one.","es":"Seis casillas, tres en el tema. Dark, gótico, naranja y negro, minimal o disfraz: ninguna lectura es la correcta."}','halloween','MEDIUM','ACTIVE','6a000000-0000-4000-8000-000000000002','[{"key":"convite","position":"ANY"},{"key":"rua","position":"CAL"},{"key":"festa","position":"SUP"},{"key":"fotos","position":"ACE"},{"key":"pista","position":"INF"},{"key":"volta","position":"ANY"}]','[{"type":"theme","count":3}]',NULL,30,1,NULL,TRUE,TRUE,120,0,'2026-10-07 12:00:00','2026-10-07 12:00:00'),
('7c000000-0000-4000-8000-000000000013','halloween-sem-compras','Halloween sem compras','{"pt-BR":"Halloween sem compras","en":"No-buy Halloween","es":"Halloween sin compras"}','Quatro cartas de peças que você já tinha antes do Halloween, duas no tema.','{"pt-BR":"Quatro cartas de peças que você já tinha antes do Halloween, duas no tema.","en":"Four cards from pieces you already had before Halloween, two on theme.","es":"Cuatro cartas de prendas que ya tenías antes de Halloween, dos en el tema."}','halloween','EASY','ACTIVE','6a000000-0000-4000-8000-000000000002','[{"key":"rua","position":"CAL"},{"key":"festa","position":"SUP"},{"key":"pista","position":"INF"},{"key":"fotos","position":"ACE"}]','[{"type":"noBuy"},{"type":"theme","count":2}]',NULL,40,1,NULL,TRUE,TRUE,130,0,'2026-10-07 12:00:00','2026-10-07 12:00:00'),
('7c000000-0000-4000-8000-000000000014','carnaval-no-bloco','Carnaval no bloco','{"pt-BR":"Carnaval no bloco","en":"Carnival street party","es":"Carnaval en la comparsa"}','Da concentração à ressaca, três cartas no tema.','{"pt-BR":"Da concentração à ressaca, três cartas no tema.","en":"From the gathering to the morning after, three cards on theme.","es":"De la concentración a la resaca, tres cartas en el tema."}','carnaval','MEDIUM','ACTIVE','6a000000-0000-4000-8000-000000000008','[{"key":"concentracao","position":"CAL"},{"key":"bloco","position":"SUP"},{"key":"bateria","position":"INF"},{"key":"camarote","position":"ACE"},{"key":"dispersao","position":"ANY"},{"key":"ressaca","position":"ANY"}]','[{"type":"theme","count":3}]',NULL,30,1,NULL,TRUE,TRUE,140,0,'2026-10-07 12:00:00','2026-10-07 12:00:00'),
('7c000000-0000-4000-8000-000000000015','inverno-na-serra','Inverno na serra','{"pt-BR":"Inverno na serra","en":"Winter in the mountains","es":"Invierno en la sierra"}','Cinco paradas, três no tema do inverno.','{"pt-BR":"Cinco paradas, três no tema do inverno.","en":"Five stops, three on the winter theme.","es":"Cinco paradas, tres en el tema del invierno."}','serra','MEDIUM','ACTIVE','6a000000-0000-4000-8000-000000000010','[{"key":"estrada","position":"CAL"},{"key":"lareira","position":"SUP"},{"key":"trilha","position":"INF"},{"key":"fondue","position":"ACE"},{"key":"mirante","position":"ANY"}]','[{"type":"theme","count":3}]',NULL,30,1,NULL,TRUE,TRUE,150,0,'2026-10-07 12:00:00','2026-10-07 12:00:00'),
('7c000000-0000-4000-8000-000000000016','uma-semana-um-guarda-roupa','Uma semana, um guarda-roupa','{"pt-BR":"Uma semana, um guarda-roupa","en":"One week, one wardrobe","es":"Una semana, un armario"}','Sete dias, sete cartas, só peças que já estavam com você.','{"pt-BR":"Sete dias, sete cartas, só peças que já estavam com você.","en":"Seven days, seven cards, only pieces you already had.","es":"Siete días, siete cartas, solo prendas que ya tenías."}','semana','HARD','ACTIVE','6a000000-0000-4000-8000-000000000007','[{"key":"seg","position":"ANY"},{"key":"ter","position":"ANY"},{"key":"qua","position":"ANY"},{"key":"qui","position":"ANY"},{"key":"sex","position":"ANY"},{"key":"sab","position":"ANY"},{"key":"dom","position":"ANY"}]','[{"type":"noBuy"}]',NULL,60,1,NULL,TRUE,TRUE,160,0,'2026-10-07 12:00:00','2026-10-07 12:00:00');
