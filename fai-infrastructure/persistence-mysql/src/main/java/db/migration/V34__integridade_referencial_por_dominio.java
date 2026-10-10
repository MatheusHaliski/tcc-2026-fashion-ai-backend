package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Integridade referencial por domínio (docs/banco/integridade/AUDITORIA_FKS_E_PIPELINE_DEMO.md):
 * dado de quem é dono → CASCADE; catálogo global (marcas, modelos de desafio, móveis) → RESTRICT; SET NULL só onde
 * o filho continua válido sem o pai. A lista {@link #POLICY} saiu de docs/banco/integridade/fks_atuais.tsv.
 *
 * <p>Em Java porque o MySQL não tem "DROP FOREIGN KEY IF EXISTS" nem laço em SQL, e os nomes das constraints não são
 * presumidos: vêm do INFORMATION_SCHEMA. Nunca desliga FOREIGN_KEY_CHECKS.
 *
 * <ul>
 *   <li><b>Idempotente</b>: FK que já está na regra certa é pulada (NO ACTION = RESTRICT no InnoDB).</li>
 *   <li><b>Uma ALTER por FK</b> (DROP + ADD juntos): a tabela nunca fica sem a constraint entre dois comandos, e o
 *       índice da coluna é preservado.</li>
 *   <li><b>Falha segura</b>: com órfãos, coluna NOT NULL para SET NULL ou tipo/collation diferente do pai, aquela FK
 *       NÃO é alterada (a antiga continua valendo) e o motivo vai para o log; o resto da política é aplicado. O
 *       {@code verify} do pipeline demo lista as FKs que ficaram fora da política, para uma migration de correção.</li>
 * </ul>
 */
public class V34__integridade_referencial_por_dominio extends BaseJavaMigration {
    private static final Logger log = LoggerFactory.getLogger(V34__integridade_referencial_por_dominio.class);
    private static final Pattern IDENT = Pattern.compile("[a-z0-9_]{1,64}");

    public record Fk(String table, String column, String refTable, String refColumn, String onDelete) {
        public Fk(String table, String column, String refTable, String onDelete) {
            this(table, column, refTable, "id", onDelete);
        }

        public Fk {
            for (String s : List.of(table, column, refTable, refColumn)) {
                if (!IDENT.matcher(s).matches()) {
                    throw new IllegalArgumentException("identificador inválido: " + s);
                }
            }
            if (!List.of("CASCADE", "RESTRICT", "SET NULL").contains(onDelete)) {
                throw new IllegalArgumentException("ON DELETE inválido: " + onDelete);
            }
        }

        /** Nome novo (fkp_ = "política"): nunca colide com os nomes antigos (fk_..., *_ibfk_N). */
        public String constraintName() {
            String n = "fkp_" + table + "__" + column;
            if (n.length() <= 64) {
                return n;
            }
            return n.substring(0, 55) + "_" + sha(n).substring(0, 8);
        }

        @Override
        public String toString() {
            return table + "." + column + " → " + refTable + ("id".equals(refColumn) ? "" : "." + refColumn)
                    + " ON DELETE " + onDelete;
        }
    }

    /**
     * Política completa: as 89 FKs da auditoria (KEEP inclusive) + as 20 novas, as 19 que a V29 (captura adaptativa) e a
     * V30 (catálogo global) criaram já na regra certa — entram para o verify acusar desvio — e 3 novas em wardrobe_items.
     * Também as FKs de colunas simples criadas depois (V45 fila de revisão do catálogo, V46 linhagem do remix): num banco
     * novo a V34 roda antes delas e só registra "tabela ou coluna inexistente"; o verify do pipeline demo as confere.
     */
    public static final List<Fk> POLICY = List.of(
            // → users
            new Fk("acervo_groups", "user_id", "users", "CASCADE"),
            new Fk("ai_inference_log", "user_id", "users", "SET NULL"),
            new Fk("ai_review_items", "user_id", "users", "CASCADE"),
            new Fk("brand_profiles", "owner_user_id", "users", "CASCADE"),
            new Fk("capture_sessions", "user_id", "users", "CASCADE"),
            new Fk("celebrity_profiles", "owner_user_id", "users", "CASCADE"),
            new Fk("challenge_events", "user_id", "users", "CASCADE"),
            new Fk("challenge_notes", "user_id", "users", "CASCADE"),
            new Fk("challenge_participants", "user_id", "users", "CASCADE"),
            new Fk("challenge_votes", "voter_user_id", "users", "CASCADE"),
            new Fk("comments", "author_user_id", "users", "CASCADE"),
            new Fk("coupon_rights", "owner_user_id", "users", "CASCADE"),
            new Fk("coupon_rights", "user_id", "users", "CASCADE"),
            new Fk("daily_looks", "user_id", "users", "CASCADE"),
            new Fk("data_export_requests", "user_id", "users", "CASCADE"),
            new Fk("dna_schemes", "user_id", "users", "CASCADE"),
            new Fk("fai_points_ledger", "user_id", "users", "CASCADE"),
            new Fk("flair_coin_entries", "user_id", "users", "CASCADE"),
            new Fk("flair_combinations", "brand_user_id", "users", "CASCADE"),
            new Fk("flair_match_entries", "user_id", "users", "CASCADE"),
            new Fk("flair_matches", "created_by_user_id", "users", "CASCADE"),
            new Fk("flair_mode_states", "user_id", "users", "CASCADE"),
            new Fk("flair_profiles", "user_id", "users", "CASCADE"),
            new Fk("flair_redemptions", "user_id", "users", "CASCADE"),
            new Fk("flair_team_members", "user_id", "users", "CASCADE"),
            new Fk("flair_teams", "owner_user_id", "users", "CASCADE"),
            new Fk("flair_territories", "owner_user_id", "users", "SET NULL"),
            new Fk("flair_trophies", "user_id", "users", "CASCADE"),
            new Fk("follows", "follower_id", "users", "CASCADE"),
            new Fk("follows", "following_id", "users", "CASCADE"),
            new Fk("garment_embeddings", "user_id", "users", "CASCADE"),
            new Fk("hype_score_metrics", "user_id", "users", "CASCADE"),
            new Fk("inventory_score_snapshots", "user_id", "users", "CASCADE"),
            new Fk("item_embeddings", "user_id", "users", "CASCADE"),
            new Fk("mirror_states", "user_id", "users", "CASCADE"),
            new Fk("moderation_queue", "user_id", "users", "CASCADE"),
            new Fk("notifications", "actor_user_id", "users", "CASCADE"),
            new Fk("notifications", "recipient_user_id", "users", "CASCADE"),
            new Fk("photos", "user_id", "users", "CASCADE"),
            new Fk("piece_images", "user_id", "users", "CASCADE"),
            new Fk("piece_usage_diary", "user_id", "users", "CASCADE"),
            new Fk("pipeline_jobs", "user_id", "users", "CASCADE"),
            new Fk("processing_jobs_log", "user_id", "users", "CASCADE"),
            new Fk("promotion_redemptions", "issuer_user_id", "users", "CASCADE"),
            new Fk("promotion_redemptions", "user_id", "users", "CASCADE"),
            new Fk("promotions", "owner_user_id", "users", "CASCADE"),
            new Fk("ranking_opt_ins", "user_id", "users", "CASCADE"),
            new Fk("ranking_positions", "user_id", "users", "CASCADE"),
            new Fk("reactions", "actor_user_id", "users", "CASCADE"),
            new Fk("refresh_tokens", "user_id", "users", "CASCADE"),
            new Fk("render_jobs_log", "user_id", "users", "CASCADE"),
            new Fk("room_catalog", "creator_user_id", "users", "SET NULL"),
            new Fk("scheme_remix_sources", "source_owner_id", "users", "SET NULL"),
            new Fk("room_inventory", "user_id", "users", "CASCADE"),
            new Fk("room_layouts", "user_id", "users", "CASCADE"),
            new Fk("room_storage_map", "user_id", "users", "CASCADE"),
            new Fk("saved_items", "user_id", "users", "CASCADE"),
            new Fk("scheme_groupings", "owner_user_id", "users", "CASCADE"),
            new Fk("schemes", "user_id", "users", "CASCADE"),
            new Fk("seal_bonds", "requested_by_user_id", "users", "CASCADE"),
            new Fk("seal_bonds", "target_owner_user_id", "users", "CASCADE"),
            new Fk("seals", "owner_user_id", "users", "CASCADE"),
            new Fk("shares", "user_id", "users", "CASCADE"),
            new Fk("style_dna", "user_id", "users", "CASCADE"),
            new Fk("style_dna_versions", "user_id", "users", "CASCADE"),
            new Fk("training_candidates", "user_id", "users", "CASCADE"),
            new Fk("user_achievements", "user_id", "users", "CASCADE"),
            new Fk("user_avatars_3d", "user_id", "users", "CASCADE"),
            new Fk("user_consents", "user_id", "users", "CASCADE"),
            new Fk("user_preferences", "user_id", "users", "CASCADE"),
            new Fk("verification_codes", "user_id", "users", "CASCADE"),
            new Fk("wardrobe_availability_log", "user_id", "users", "CASCADE"),
            new Fk("wardrobe_items", "user_id", "users", "CASCADE"),
            new Fk("week_plans", "user_id", "users", "CASCADE"),
            // → brand_profiles
            new Fk("brands", "brand_profile_id", "brand_profiles", "SET NULL"),
            new Fk("wardrobe_items", "brand_profile_id", "brand_profiles", "SET NULL"),
            // → brands (catálogo global: o que é da marca vai junto; produto e peça de usuário seguram a marca)
            new Fk("brand_aliases", "brand_id", "brands", "CASCADE"),
            new Fk("catalog_products", "brand_id", "brands", "RESTRICT"),
            new Fk("catalog_sources", "brand_id", "brands", "CASCADE"),
            new Fk("wardrobe_items", "brand_id", "brands", "RESTRICT"),
            // → capture_sessions
            new Fk("brand_predictions", "session_id", "capture_sessions", "CASCADE"),
            new Fk("capture_requests", "session_id", "capture_sessions", "CASCADE"),
            new Fk("model_inferences", "session_id", "capture_sessions", "CASCADE"),
            new Fk("piece_images", "session_id", "capture_sessions", "CASCADE"),
            new Fk("wardrobe_items", "capture_session_id", "capture_sessions", "SET NULL"),
            // → catalog_products (a peça do usuário segura o produto: a revalidação só apaga produto sem dono)
            new Fk("ai_review_items", "product_id", "catalog_products", "CASCADE"),
            new Fk("catalog_images", "product_id", "catalog_products", "CASCADE"),
            new Fk("catalog_product_aliases", "product_id", "catalog_products", "CASCADE"),
            new Fk("catalog_variants", "product_id", "catalog_products", "CASCADE"),
            new Fk("wardrobe_items", "catalog_product_id", "catalog_products", "RESTRICT"),
            // → catalog_variants
            new Fk("catalog_images", "variant_id", "catalog_variants", "SET NULL"),
            new Fk("wardrobe_items", "catalog_variant_id", "catalog_variants", "SET NULL"),
            // → challenge_instances
            new Fk("challenge_events", "instance_id", "challenge_instances", "CASCADE"),
            new Fk("challenge_notes", "instance_id", "challenge_instances", "CASCADE"),
            new Fk("challenge_participants", "instance_id", "challenge_instances", "CASCADE"),
            new Fk("challenge_votes", "instance_id", "challenge_instances", "CASCADE"),
            // → challenge_templates
            new Fk("challenge_instances", "template_code", "challenge_templates", "code", "RESTRICT"),
            // → dataset_sources
            new Fk("training_candidates", "source_id", "dataset_sources", "RESTRICT"),
            // → comments
            new Fk("comments", "parent_comment_id", "comments", "CASCADE"),
            // → daily_looks
            new Fk("daily_looks", "materialized_from_id", "daily_looks", "SET NULL"),
            new Fk("hype_score_metrics", "daily_look_id", "daily_looks", "CASCADE"),
            // → dna_schemes
            new Fk("dna_scheme_items", "dna_scheme_id", "dna_schemes", "CASCADE"),
            // → kb_product_lines
            new Fk("kb_product_models", "product_line_id", "kb_product_lines", "SET NULL"),
            // → flair_combinations
            new Fk("flair_redemptions", "combination_id", "flair_combinations", "CASCADE"),
            // → flair_matches
            new Fk("flair_match_entries", "match_id", "flair_matches", "CASCADE"),
            // → flair_teams
            new Fk("flair_team_members", "team_id", "flair_teams", "CASCADE"),
            // → piece_images
            new Fk("garment_landmarks", "image_id", "piece_images", "CASCADE"),
            // → pipeline_jobs
            new Fk("processing_jobs_log", "pipeline_job_id", "pipeline_jobs", "CASCADE"),
            new Fk("quality_scores", "pipeline_job_id", "pipeline_jobs", "CASCADE"),
            new Fk("render_jobs_log", "pipeline_job_id", "pipeline_jobs", "CASCADE"),
            // → promotions
            new Fk("promotion_redemptions", "promotion_id", "promotions", "CASCADE"),
            // → room_catalog
            new Fk("room_inventory", "sku", "room_catalog", "sku", "RESTRICT"),
            // → schemes
            new Fk("challenge_votes", "entry_scheme_id", "schemes", "CASCADE"),
            new Fk("daily_looks", "scheme_id", "schemes", "CASCADE"),
            new Fk("dna_scheme_items", "scheme_id", "schemes", "CASCADE"),
            new Fk("flair_match_entries", "scheme_id", "schemes", "SET NULL"),
            new Fk("flair_redemptions", "scheme_id", "schemes", "SET NULL"),
            new Fk("hype_score_metrics", "scheme_id", "schemes", "CASCADE"),
            new Fk("render_jobs_log", "scheme_id", "schemes", "CASCADE"),
            new Fk("scheme_items", "scheme_id", "schemes", "CASCADE"),
            new Fk("scheme_remix_sources", "scheme_id", "schemes", "CASCADE"),
            new Fk("scheme_remix_sources", "source_scheme_id", "schemes", "SET NULL"),
            new Fk("schemes", "original_scheme_id", "schemes", "SET NULL"),
            new Fk("seal_bonds", "scheme_id", "schemes", "CASCADE"),
            new Fk("week_plan_days", "scheme_id", "schemes", "SET NULL"),
            // → seal_bonds
            new Fk("promotion_redemptions", "seal_bond_id", "seal_bonds", "CASCADE"),
            new Fk("promotions", "seal_bond_id", "seal_bonds", "SET NULL"),
            // → seals
            new Fk("promotions", "seal_id", "seals", "CASCADE"),
            new Fk("room_catalog", "seal_id", "seals", "SET NULL"),
            new Fk("seal_bonds", "seal_id", "seals", "CASCADE"),
            // → wardrobe_items
            new Fk("piece_usage_diary", "wardrobe_item_id", "wardrobe_items", "CASCADE"),
            new Fk("room_storage_map", "wardrobe_item_id", "wardrobe_items", "CASCADE"),
            new Fk("scheme_items", "wardrobe_item_id", "wardrobe_items", "CASCADE"),
            new Fk("scheme_remix_sources", "mapped_piece_id", "wardrobe_items", "SET NULL"),
            new Fk("scheme_remix_sources", "source_piece_id", "wardrobe_items", "SET NULL"),
            new Fk("wardrobe_availability_log", "wardrobe_item_id", "wardrobe_items", "CASCADE"),
            // → week_plans
            new Fk("week_plan_days", "week_plan_id", "week_plans", "CASCADE")
    );

    @Override
    public boolean canExecuteInTransaction() {
        return false;   // DDL no MySQL faz commit implícito; cada ALTER é atômica sozinha
    }

    @Override
    public void migrate(Context context) throws Exception {
        Connection c = context.getConnection();
        String schema = c.getCatalog();
        int applied = 0;
        int alreadyOk = 0;
        List<String> deferred = new ArrayList<>();
        for (Fk fk : POLICY) {
            List<String[]> current = existing(c, schema, fk);       // [nome, regra]
            if (current.size() == 1 && sameRule(current.get(0)[1], fk.onDelete())) {
                alreadyOk++;
                continue;
            }
            String problem = problem(c, schema, fk);
            if (problem != null) {
                deferred.add(fk + " — " + problem);
                log.warn("V34: {} NÃO aplicada ({}); {}", fk, problem,
                        current.isEmpty() ? "a FK não foi criada" : "a constraint atual continua valendo");
                continue;
            }
            StringBuilder sql = new StringBuilder("ALTER TABLE `").append(fk.table()).append("` ");
            for (String[] old : current) {
                sql.append("DROP FOREIGN KEY `").append(old[0].replace("`", "")).append("`, ");
            }
            sql.append("ADD CONSTRAINT `").append(fk.constraintName()).append("` FOREIGN KEY (`").append(fk.column())
                    .append("`) REFERENCES `").append(fk.refTable()).append("` (`").append(fk.refColumn()).append("`) ON DELETE ").append(fk.onDelete())
                    .append(" ON UPDATE RESTRICT");
            try (Statement st = c.createStatement()) {
                st.execute(sql.toString());
            }
            applied++;
        }
        log.info("V34: {} FKs aplicadas, {} já na política, {} adiadas{}", applied, alreadyOk, deferred.size(),
                deferred.isEmpty() ? "" : ": " + String.join(" | ", deferred));
    }

    public static boolean sameRule(String current, String wanted) {
        String a = norm(current);
        String b = norm(wanted);
        return a.equals(b);
    }

    private static String norm(String rule) {
        String r = rule == null ? "" : rule.trim().toUpperCase(Locale.ROOT);
        return r.equals("NO ACTION") ? "RESTRICT" : r;   // no InnoDB, NO ACTION é checado na hora = RESTRICT
    }

    static List<String[]> existing(Connection c, String schema, Fk fk) throws SQLException {
        String sql = "SELECT k.CONSTRAINT_NAME, r.DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE k "
                + "JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA "
                + "AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME "
                + "WHERE k.TABLE_SCHEMA = ? AND k.TABLE_NAME = ? AND k.COLUMN_NAME = ? AND k.REFERENCED_TABLE_NAME = ?";
        List<String[]> out = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, schema);
            ps.setString(2, fk.table());
            ps.setString(3, fk.column());
            ps.setString(4, fk.refTable());
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(new String[]{rs.getString(1), rs.getString(2)});
                }
            }
        }
        return out;
    }

    /** Motivo para não mexer nesta FK agora, ou null se ela pode ser (re)criada com segurança. */
    static String problem(Connection c, String schema, Fk fk) throws SQLException {
        String[] child = column(c, schema, fk.table(), fk.column());
        String[] parent = column(c, schema, fk.refTable(), fk.refColumn());
        if (child == null || parent == null) {
            return "tabela ou coluna inexistente";
        }
        if ("SET NULL".equals(fk.onDelete()) && "NO".equals(child[2])) {
            return "SET NULL numa coluna NOT NULL";
        }
        if (!child[0].equalsIgnoreCase(parent[0]) || !String.valueOf(child[1]).equalsIgnoreCase(String.valueOf(parent[1]))) {
            return "tipo/collation diferente do pai (" + child[0] + "/" + child[1] + " × " + parent[0] + "/" + parent[1] + ")";
        }
        String orphans = "SELECT COUNT(*) FROM `" + fk.table() + "` c LEFT JOIN `" + fk.refTable() + "` p ON p.`"
                + fk.refColumn() + "` = c.`" + fk.column() + "` WHERE c.`" + fk.column() + "` IS NOT NULL AND p.`"
                + fk.refColumn() + "` IS NULL";
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(orphans)) {
            rs.next();
            long n = rs.getLong(1);
            return n > 0 ? n + " órfão(s)" : null;
        }
    }

    /** [COLUMN_TYPE, COLLATION_NAME, IS_NULLABLE] ou null. */
    private static String[] column(Connection c, String schema, String table, String column) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT COLUMN_TYPE, COLLATION_NAME, IS_NULLABLE FROM "
                + "information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?")) {
            ps.setString(1, schema);
            ps.setString(2, table);
            ps.setString(3, column);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? new String[]{rs.getString(1), rs.getString(2), rs.getString(3)} : null;
            }
        }
    }

    private static String sha(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
