package br.com.fashionai.infrastructure.mysql.analytics;

/**
 * Texto SQL (MySQL) das abas do dashboard administrativo (ativação, atividade, moderação, auditoria, engajamento,
 * catálogo, jobs) e da leitura do HypeScore v2 do {@link MysqlAnalyticsAdapter}. Só constantes montadas uma vez:
 * o recorte de usuário ({@link #USER_SCOPE}) e a lista de resultados de falha da auditoria são compartilhados aqui;
 * o binding dos parâmetros e a execução ficam no adapter. Congelado por {@code MysqlAnalyticsSqlCharacterizationTest}.
 */
final class AnalyticsDashboardSql {
    private AnalyticsDashboardSql() {
    }

    static final String USER_SCOPE = " (:country IS NULL OR u.country = :country) AND (:profile IS NULL OR u.profile_type = :profile)";
    static final String FAILURE_RESULTS = "('NEGADO','NAO_AUTENTICADO','FALHA','ERRO','BLOQUEADO','REJEITADO')";

    private static final String COHORT =
            "FROM users u WHERE u.created_at BETWEEN :from AND :to AND u.test_account = FALSE AND" + USER_SCOPE;

    static final String ACTIVATION_FUNNEL = """
                SELECT stage, total FROM (
                  SELECT 1 AS ord, 'registered' AS stage, COUNT(*) AS total %1$s
                  UNION ALL SELECT 2, 'email_verified', COUNT(*) %1$s AND u.email_verified = TRUE
                  UNION ALL SELECT 3, 'first_piece', COUNT(*) %1$s AND EXISTS (SELECT 1 FROM wardrobe_items w WHERE w.user_id = u.id)
                  UNION ALL SELECT 4, 'first_scheme', COUNT(*) %1$s AND EXISTS (SELECT 1 FROM schemes s WHERE s.user_id = u.id)
                  UNION ALL SELECT 5, 'first_published', COUNT(*) %1$s AND EXISTS (SELECT 1 FROM schemes s WHERE s.user_id = u.id AND s.published_at IS NOT NULL)
                  UNION ALL SELECT 6, 'daily_look', COUNT(*) %1$s AND EXISTS (SELECT 1 FROM daily_looks d WHERE d.user_id = u.id)
                ) t ORDER BY ord""".formatted(COHORT);

    static final String ACTIVITY_HEATMAP = """
                SELECT DAYOFWEEK(CONVERT_TZ(a.`timestamp`, '+00:00', '-03:00')) - 1 AS dow, HOUR(CONVERT_TZ(a.`timestamp`, '+00:00', '-03:00')) AS hour, COUNT(*) AS total
                FROM audit_log a WHERE a.`timestamp` BETWEEN :from AND :to GROUP BY dow, hour ORDER BY dow, hour""";

    static final String TOP_USERS = """
                SELECT u.username, u.profile_type, u.country,
                       (SELECT COUNT(*) FROM wardrobe_items w WHERE w.user_id = u.id AND w.created_at BETWEEN :from AND :to) AS pieces,
                       (SELECT COUNT(*) FROM schemes s WHERE s.user_id = u.id AND s.created_at BETWEEN :from AND :to) AS schemes,
                       (SELECT COUNT(*) FROM reactions r JOIN schemes s2 ON s2.id = r.target_id
                          WHERE r.target_type = 'SCHEME' AND s2.user_id = u.id AND r.created_at BETWEEN :from AND :to) AS likes
                FROM users u WHERE u.test_account = FALSE AND""" + USER_SCOPE + """
                HAVING pieces + schemes + likes > 0 ORDER BY (pieces + schemes + likes * 2) DESC, u.username LIMIT :limit""";

    static final String MODERATION_BY_STATUS =
            "SELECT status, COUNT(*) AS total FROM moderation_queue WHERE created_at BETWEEN :from AND :to GROUP BY status ORDER BY total DESC";

    static final String MODERATION_RECENT = """
                SELECT id, target_type, content_excerpt, confidence, categories_json, created_at FROM moderation_queue
                WHERE status = 'PENDING_REVIEW' ORDER BY created_at DESC LIMIT :limit""";

    static final String AUDIT_FAILURES = "SELECT acao, resultado, COUNT(*) AS total FROM audit_log WHERE `timestamp` BETWEEN :from AND :to AND resultado IN "
            + FAILURE_RESULTS + " GROUP BY acao, resultado ORDER BY total DESC LIMIT 12";

    static final String AUDIT_RECENT = "SELECT actor, acao, recurso, resultado, ip, `timestamp` AS at FROM audit_log WHERE `timestamp` BETWEEN :from AND :to AND resultado IN "
            + FAILURE_RESULTS + " ORDER BY `timestamp` DESC LIMIT :limit";

    static final String SECURITY_SERIES = """
                SELECT DATE(`timestamp`) AS day,
                       SUM(CASE WHEN acao = 'LOGIN_FALHO' THEN 1 ELSE 0 END) AS login_failures,
                       SUM(CASE WHEN resultado = 'NEGADO' THEN 1 ELSE 0 END) AS denied,
                       SUM(CASE WHEN resultado IN ('FALHA','ERRO') AND acao <> 'LOGIN_FALHO' THEN 1 ELSE 0 END) AS errors
                FROM audit_log WHERE `timestamp` BETWEEN :from AND :to GROUP BY DATE(`timestamp`) ORDER BY day""";

    static final String ENGAGEMENT_SERIES = """
                SELECT day, SUM(likes) AS likes, SUM(comments) AS comments, SUM(shares) AS shares FROM (
                  SELECT DATE(created_at) AS day, COUNT(*) AS likes, 0 AS comments, 0 AS shares FROM reactions WHERE created_at BETWEEN :from AND :to GROUP BY DATE(created_at)
                  UNION ALL SELECT DATE(created_at), 0, COUNT(*), 0 FROM comments WHERE created_at BETWEEN :from AND :to GROUP BY DATE(created_at)
                  UNION ALL SELECT DATE(created_at), 0, 0, COUNT(*) FROM shares WHERE created_at BETWEEN :from AND :to GROUP BY DATE(created_at)
                ) t GROUP BY day ORDER BY day""";

    static final String CATEGORIES = "SELECT w.category, COUNT(*) AS total FROM wardrobe_items w JOIN users u ON u.id = w.user_id WHERE w.created_at BETWEEN :from AND :to AND"
            + USER_SCOPE + " GROUP BY w.category ORDER BY total DESC";

    static final String JOBS_BY_STATUS = "SELECT type, status, COUNT(*) AS total, ROUND(AVG(total_time_ms)) AS avg_ms FROM pipeline_jobs WHERE created_at BETWEEN :from AND :to GROUP BY type, status ORDER BY type, status";

    static final String JOBS_FAILED_RECENT = "SELECT type, error_code, MAX(error_message) AS error_message, COUNT(*) AS total, MAX(created_at) AS last_at FROM pipeline_jobs "
            + "WHERE status = 'FAILED' GROUP BY type, error_code ORDER BY last_at DESC LIMIT :limit";

    // ---------------------------------------------------------------- HypeScore v2 (RF53 · Lote 7) — só leitura de hype_scores
    // As datas saem formatadas em ISO-8601 UTC (as colunas DATETIME guardam UTC: hibernate.jdbc.time_zone), sem depender
    // do tipo que o driver devolve para DATETIME.

    /** LEFT JOIN: sem recorte, dono ausente não some; com recorte, a condição de usuário filtra normalmente. */
    static final String HYPE_LEVELS_V2 = """
                SELECT h.entity_type AS entity_type, h.level AS level, COUNT(*) AS total
                FROM hype_scores h LEFT JOIN users u ON u.id = h.owner_id
                WHERE h.algorithm_version = :version AND h.public_eligible = TRUE AND h.status = 'AVAILABLE' AND h.level IS NOT NULL
                  AND""" + USER_SCOPE + """
                GROUP BY h.entity_type, h.level""";

    private static final String HYPE_COUNTS = """
                COUNT(*) AS total,
                       SUM(CASE WHEN h.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available,
                       SUM(CASE WHEN h.status = 'INSUFFICIENT_DATA' THEN 1 ELSE 0 END) AS insufficient,
                       SUM(CASE WHEN h.id IS NULL THEN 1 ELSE 0 END) AS not_calculated,
                       SUM(CASE WHEN h.public_eligible THEN 1 ELSE 0 END) AS public_eligible""";

    static final String HYPE_COVERAGE_V2 = """
                SELECT 'PIECE' AS entity_type, %1$s
                FROM wardrobe_items w JOIN users u ON u.id = w.user_id
                LEFT JOIN hype_scores h ON h.entity_type = 'PIECE' AND h.entity_id = w.id AND h.algorithm_version = :version
                WHERE w.availability_status <> 'ARCHIVED' AND %2$s
                UNION ALL
                SELECT 'SCHEME', %1$s
                FROM schemes s JOIN users u ON u.id = s.user_id
                LEFT JOIN hype_scores h ON h.entity_type = 'SCHEME' AND h.entity_id = s.id AND h.algorithm_version = :version
                WHERE s.status <> 'ARCHIVED' AND %2$s""".formatted(HYPE_COUNTS, USER_SCOPE);

    static final String HYPE_JOB_V2 = """
                SELECT (SELECT DATE_FORMAT(MAX(calculated_at), '%Y-%m-%dT%H:%i:%sZ') FROM hype_scores WHERE algorithm_version = :version) AS last_calculated_at,
                       (SELECT DATE_FORMAT(MAX(snapshot_date), '%Y-%m-%d') FROM hype_score_snapshots WHERE algorithm_version = :version) AS last_snapshot_date,
                       (SELECT COUNT(*) FROM hype_scores WHERE algorithm_version = :version) AS rows_total""";

    static final String BONDED_LOOKS_HYPE_V2 = """
                SELECT s.id AS scheme_id, s.title AS title, s.cover_image_url AS cover_url, u.username AS owner,
                       h.status AS status, h.score AS score, h.level AS level, h.delta_points AS delta_points, h.direction AS direction,
                       h.public_eligible AS public_eligible, DATE_FORMAT(h.calculated_at, '%Y-%m-%dT%H:%i:%sZ') AS calculated_at
                FROM schemes s JOIN users u ON u.id = s.user_id
                LEFT JOIN hype_scores h ON h.entity_type = 'SCHEME' AND h.entity_id = s.id AND h.algorithm_version = :version
                WHERE s.status <> 'ARCHIVED'
                  AND s.id IN (SELECT b.scheme_id FROM seal_bonds b WHERE b.target_owner_user_id = :owner AND b.status = 'APPROVED')""";
}
