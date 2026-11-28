ALTER TABLE marketplace_negotiations
  DROP CHECK ck_marketplace_negotiation_status,
  ADD CONSTRAINT ck_marketplace_negotiation_status CHECK (status IN ('PENDING','ACCEPTED','REJECTED','CANCELLED'));

ALTER TABLE wardrobe_items MODIFY COLUMN aura_metamorphose_status VARCHAR(20)
  GENERATED ALWAYS AS (
    CASE
      WHEN JSON_UNQUOTE(JSON_EXTRACT(background_config_json, '$.auraMetamorphosePreset'))
        IN ('NIKE_ORANGE', 'ADIDAS_BLUE', 'ASICS_WHITE') THEN 'SPECIAL'
      WHEN JSON_TYPE(JSON_EXTRACT(background_config_json, '$.auraEntitlementCode')) = 'STRING'
        AND (JSON_UNQUOTE(JSON_EXTRACT(background_config_json, '$.auraMetamorphose')) NOT IN ('OFF', '')
             OR JSON_UNQUOTE(JSON_EXTRACT(background_config_json, '$.compositionPreset.family')) = 'METAMORPHOSE')
        THEN 'SPECIAL'
      ELSE 'STANDARD'
    END
  ) STORED;
