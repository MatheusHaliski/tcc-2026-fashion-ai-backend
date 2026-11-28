-- Vincula perfis existentes apenas quando nome canônico e domínio oficial coincidem.
UPDATE brands b
JOIN brand_profiles p ON p.slug = b.slug
JOIN users u ON u.id = p.owner_user_id
LEFT JOIN brands linked ON linked.brand_profile_id = p.id
SET b.brand_profile_id=p.id, b.verified_at=COALESCE(b.verified_at, UTC_TIMESTAMP(6)), b.version=b.version+1
WHERE b.brand_profile_id IS NULL AND linked.id IS NULL
  AND p.approval_status='APROVADO' AND u.profile_type='MARCA' AND u.status='ACTIVE' AND u.verified=TRUE
  AND b.website IS NOT NULL AND p.store_url IS NOT NULL
  AND TRIM(LEADING 'www.' FROM LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(b.website, '://', -1), '/', 1))) <> ''
  AND TRIM(LEADING 'www.' FROM LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(b.website, '://', -1), '/', 1)))
      = TRIM(LEADING 'www.' FROM LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(p.store_url, '://', -1), '/', 1)));

-- A retirada definitiva de uma peça mantém o total agregado da loja.
ALTER TABLE marketplace_sale_reports
  DROP FOREIGN KEY fk_marketplace_sale_piece,
  MODIFY COLUMN piece_id CHAR(36),
  ADD CONSTRAINT fk_marketplace_sale_piece_archive
    FOREIGN KEY (piece_id) REFERENCES wardrobe_items(id) ON DELETE SET NULL;
