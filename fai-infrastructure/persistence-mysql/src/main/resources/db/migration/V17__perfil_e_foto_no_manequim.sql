-- RF23 · Editar perfil (formato do Instagram): além de nome (display_name) e nome de usuário (username, o @ único),
-- pronomes e links do perfil.
ALTER TABLE users
  ADD COLUMN pronouns VARCHAR(40) NULL,
  ADD COLUMN links_json JSON NULL;

-- Foto com meu manequim (card Trello): enquadramento do rosto da foto de perfil na cabeça 3D do manequim.
ALTER TABLE user_preferences
  ADD COLUMN mannequin_face_json JSON NULL;

-- RF4 (peça superior/corpo inteiro) e RF5 (look inteiro): foto gerada com o manequim da pessoa — rosto 3D a partir
-- da foto de perfil — ou com o manequim padrão masculino/feminino quando não há foto.
ALTER TABLE wardrobe_items
  ADD COLUMN mannequin_image_url VARCHAR(1024) NULL,
  ADD COLUMN mannequin_image_face VARCHAR(20) NULL;
ALTER TABLE schemes
  ADD COLUMN mannequin_image_url VARCHAR(1024) NULL,
  ADD COLUMN mannequin_image_face VARCHAR(20) NULL;
