-- Issuer licenses are distinct from participant card entitlements.
CREATE TABLE aura_art_offers (
 code VARCHAR(80) NOT NULL PRIMARY KEY,
 name VARCHAR(160) NOT NULL,
 family VARCHAR(20) NOT NULL,
 config_json JSON NOT NULL,
 price_points INT NOT NULL,
 active BOOLEAN NOT NULL DEFAULT FALSE,
 version BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE aura_issuer_licenses (
 id CHAR(36) NOT NULL PRIMARY KEY,
 owner_id CHAR(36) NOT NULL,
 preset_code VARCHAR(80) NOT NULL,
 price_paid INT NOT NULL,
 purchased_at TIMESTAMP(6) NOT NULL,
 created_at TIMESTAMP(6) NOT NULL,
 updated_at TIMESTAMP(6) NOT NULL,
 created_by VARCHAR(80),
 last_modified_by VARCHAR(80),
 CONSTRAINT uq_aura_owner_preset UNIQUE(owner_id,preset_code),
 CONSTRAINT fk_aura_license_owner FOREIGN KEY(owner_id) REFERENCES users(id),
 CONSTRAINT fk_aura_license_preset FOREIGN KEY(preset_code) REFERENCES aura_art_offers(code)
);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_PRISMA_IVORY','Prisma · Marfim','METAMORPHOSE','{"auraMetamorphose":"PRISMA","border":{"mode":"GRADIENT","from":"#d8c4ab","to":"#eee5d9","effect":"SHIMMER"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_PRISMA_CHROME','Prisma · Cromo','METAMORPHOSE','{"auraMetamorphose":"PRISMA","border":{"mode":"GRADIENT","from":"#bacddd","to":"#c8bde0","effect":"SHIMMER"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_PRISMA_ROSE','Prisma · Rosé','METAMORPHOSE','{"auraMetamorphose":"PRISMA","border":{"mode":"GRADIENT","from":"#deafbc","to":"#c0acd8","effect":"SHIMMER"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_PRISMA_VIOLET','Prisma · Violeta','METAMORPHOSE','{"auraMetamorphose":"PRISMA","border":{"mode":"GRADIENT","from":"#b09ae4","to":"#82d0da","effect":"SHIMMER"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_PRISMA_MINT','Prisma · Mint','METAMORPHOSE','{"auraMetamorphose":"PRISMA","border":{"mode":"GRADIENT","from":"#85d4c8","to":"#c6dfe1","effect":"SHIMMER"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_CONSTELACAO_IVORY','Constelação · Marfim','METAMORPHOSE','{"auraMetamorphose":"CONSTELACAO","border":{"mode":"GRADIENT","from":"#d8c4ab","to":"#eee5d9","effect":"SHIMMER"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_CONSTELACAO_CHROME','Constelação · Cromo','METAMORPHOSE','{"auraMetamorphose":"CONSTELACAO","border":{"mode":"GRADIENT","from":"#bacddd","to":"#c8bde0","effect":"SHIMMER"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_CONSTELACAO_ROSE','Constelação · Rosé','METAMORPHOSE','{"auraMetamorphose":"CONSTELACAO","border":{"mode":"GRADIENT","from":"#deafbc","to":"#c0acd8","effect":"SHIMMER"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_CONSTELACAO_VIOLET','Constelação · Violeta','METAMORPHOSE','{"auraMetamorphose":"CONSTELACAO","border":{"mode":"GRADIENT","from":"#b09ae4","to":"#82d0da","effect":"SHIMMER"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_CONSTELACAO_MINT','Constelação · Mint','METAMORPHOSE','{"auraMetamorphose":"CONSTELACAO","border":{"mode":"GRADIENT","from":"#85d4c8","to":"#c6dfe1","effect":"SHIMMER"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_FIO_VIVO_IVORY','Fio Vivo · Marfim','METAMORPHOSE','{"auraMetamorphose":"FIO_VIVO","border":{"mode":"GRADIENT","from":"#d8c4ab","to":"#eee5d9","effect":"SHIMMER"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_FIO_VIVO_CHROME','Fio Vivo · Cromo','METAMORPHOSE','{"auraMetamorphose":"FIO_VIVO","border":{"mode":"GRADIENT","from":"#bacddd","to":"#c8bde0","effect":"SHIMMER"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_FIO_VIVO_ROSE','Fio Vivo · Rosé','METAMORPHOSE','{"auraMetamorphose":"FIO_VIVO","border":{"mode":"GRADIENT","from":"#deafbc","to":"#c0acd8","effect":"SHIMMER"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_FIO_VIVO_VIOLET','Fio Vivo · Violeta','METAMORPHOSE','{"auraMetamorphose":"FIO_VIVO","border":{"mode":"GRADIENT","from":"#b09ae4","to":"#82d0da","effect":"SHIMMER"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_FIO_VIVO_MINT','Fio Vivo · Mint','METAMORPHOSE','{"auraMetamorphose":"FIO_VIVO","border":{"mode":"GRADIENT","from":"#85d4c8","to":"#c6dfe1","effect":"SHIMMER"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_HOLOGRAFIA_IVORY','Holografia · Marfim','METAMORPHOSE','{"auraMetamorphose":"HOLOGRAFIA","border":{"mode":"GRADIENT","from":"#d8c4ab","to":"#eee5d9","effect":"HOLO"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_HOLOGRAFIA_CHROME','Holografia · Cromo','METAMORPHOSE','{"auraMetamorphose":"HOLOGRAFIA","border":{"mode":"GRADIENT","from":"#bacddd","to":"#c8bde0","effect":"HOLO"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_HOLOGRAFIA_ROSE','Holografia · Rosé','METAMORPHOSE','{"auraMetamorphose":"HOLOGRAFIA","border":{"mode":"GRADIENT","from":"#deafbc","to":"#c0acd8","effect":"HOLO"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_HOLOGRAFIA_VIOLET','Holografia · Violeta','METAMORPHOSE','{"auraMetamorphose":"HOLOGRAFIA","border":{"mode":"GRADIENT","from":"#b09ae4","to":"#82d0da","effect":"HOLO"}}',150,FALSE,0);
INSERT INTO aura_art_offers(code,name,family,config_json,price_points,active,version) VALUES ('META_HOLOGRAFIA_MINT','Holografia · Mint','METAMORPHOSE','{"auraMetamorphose":"HOLOGRAFIA","border":{"mode":"GRADIENT","from":"#85d4c8","to":"#c6dfe1","effect":"HOLO"}}',150,FALSE,0);
