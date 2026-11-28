package br.com.fashionai.domain.repository;

final class CatalogProductVisibility {
    private CatalogProductVisibility() {}

    /** Unknown/legacy measurements remain visible; only the audited product marker excludes. */
    static final String SAFE_SQL = "AND (p.source_type <> 'VERIFIED_BRAND_PROFILE' OR EXISTS (SELECT 1 FROM wardrobe_items w "
            + "JOIN users u ON u.id=w.user_id JOIN brands b ON b.id=p.brand_id JOIN brand_profiles bp ON bp.id=b.brand_profile_id "
            + "WHERE w.id=p.managed_wardrobe_item_id AND bp.owner_user_id=u.id AND bp.approval_status='APROVADO' "
            + "AND u.status='ACTIVE' AND u.verified=TRUE AND u.profile_type='MARCA' "
            + "AND w.visibility='PUBLIC' AND w.for_sale=TRUE AND w.moderation_status='APPROVED' AND w.availability_status<>'ARCHIVED' "
            + "AND (w.expires_at IS NULL OR w.expires_at>UTC_TIMESTAMP(6)))) "
            + "AND NOT (COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json,'$.catalogPhotoEligibility.state')),'UNKNOWN') = 'INELIGIBLE' "
            + "AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json,'$.catalogPhotoEligibility.version')),'') = 'CATALOG_UNSAFE_QUARANTINE_V2' "
            + "AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json,'$.catalogPhotoEligibility.algorithmVersion')),'') = 'CATALOG_SOURCE_PREFLIGHT_V1' "
            + "AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json,'$.catalogPhotoEligibility.reason')),'') = 'SOURCE_GARMENT_BELOW_MIN_HEIGHT' "
            + "AND REGEXP_LIKE(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json,'$.catalogPhotoEligibility.reportSha256')),''),'^[0-9a-f]{64}$','c') "
            + "AND REGEXP_LIKE(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json,'$.catalogPhotoEligibility.evidenceSha256')),''),'^[0-9a-f]{64}$','c'))";

    static final String VISIBLE_SQL = "p.ingestion_status IN ('VALIDATED','PERSISTABLE','REFERENCE_ONLY') " + SAFE_SQL;
}
