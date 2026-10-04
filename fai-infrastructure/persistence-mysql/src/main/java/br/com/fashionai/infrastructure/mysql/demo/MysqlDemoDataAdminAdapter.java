package br.com.fashionai.infrastructure.mysql.demo;

import br.com.fashionai.application.ports.DemoDataAdminPort;
import db.migration.V34__integridade_referencial_por_dominio;
import db.migration.V34__integridade_referencial_por_dominio.Fk;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * SQL do Demo/Test Data Pipeline. O plano do reset é montado a partir das FKs reais (INFORMATION_SCHEMA): para cada
 * tabela, a condição das linhas que o DELETE das contas leva por CASCADE; SET NULL e RESTRICT/NO ACTION que apontam
 * para essas linhas viram "perde a referência" e "bloqueia". Nada aqui desliga FOREIGN_KEY_CHECKS.
 *
 * <p>Tabelas polimórficas (target_type/target_id, resource_type/resource_id) não têm FK: o que outras contas fizeram
 * no conteúdo das contas de teste é apagado explicitamente, antes do DELETE em users.
 */
@Component
public class MysqlDemoDataAdminAdapter implements DemoDataAdminPort {
    static final String TEST_ORIGINS = "account_origin IN ('TEST_SEED','DEMO')";
    private static final Pattern IDENT = Pattern.compile("[a-z0-9_]{1,64}");
    private static final int BATCH = 25;

    /** Conteúdo que pode ser alvo de interação: tipo polimórfico → tabela dona (coluna user_id). */
    private static final Map<String, String> TARGETS = Map.of("PIECE", "wardrobe_items", "SCHEME", "schemes", "DNA", "dna_schemes");

    /** Tabela polimórfica → coluna de quem fez (essas linhas já saem por CASCADE quando quem fez é conta de teste). */
    private static final Map<String, String> INTERACTIONS = new LinkedHashMap<>();

    static {
        INTERACTIONS.put("reactions", "actor_user_id");
        INTERACTIONS.put("saved_items", "user_id");
        INTERACTIONS.put("shares", "user_id");
        INTERACTIONS.put("comments", "author_user_id");
    }

    private final NamedParameterJdbcTemplate jdbc;

    public MysqlDemoDataAdminAdapter(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    record Edge(String table, String column, String refTable, String refColumn, String rule) {
        Edge {
            for (String s : List.of(table, column, refTable, refColumn)) {
                if (!IDENT.matcher(s).matches()) {
                    throw new IllegalStateException("identificador inesperado no INFORMATION_SCHEMA: " + s);
                }
            }
            rule = rule.toUpperCase(Locale.ROOT);
        }

        String in(String parentCondition) {
            return "`" + column + "` IN (SELECT `" + refColumn + "` FROM `" + refTable + "` WHERE " + parentCondition + ")";
        }

        String label() {
            return table + "." + column + " → " + refTable + ("id".equals(refColumn) ? "" : "." + refColumn);
        }
    }

    List<Edge> edges() {
        return jdbc.query("""
                SELECT k.TABLE_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, r.DELETE_RULE
                FROM information_schema.KEY_COLUMN_USAGE k
                JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
                 AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME
                WHERE k.TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL
                ORDER BY k.TABLE_NAME, k.COLUMN_NAME""", Map.of(),
                (rs, i) -> new Edge(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5)));
    }

    /**
     * Condição SQL (sem alias; colunas resolvem na tabela do próprio nível) das linhas de cada tabela que o DELETE das
     * contas leva junto por CASCADE. Tabela ausente do mapa = não é afetada. Autorreferência (resposta de comentário)
     * entra com um nível.
     */
    static Map<String, String> deletedRows(List<Edge> edges) {
        Map<String, List<Edge>> cascadeInto = edges.stream().filter(e -> e.rule().equals("CASCADE"))
                .collect(Collectors.groupingBy(Edge::table, TreeMap::new, Collectors.toList()));
        Map<String, String> memo = new HashMap<>();
        memo.put("users", "`id` IN (:ids)");
        for (String t : cascadeInto.keySet()) {
            condition(t, cascadeInto, memo, new HashSet<>());
        }
        Map<String, String> out = new TreeMap<>();
        memo.forEach((t, c) -> {
            if (c != null) {
                out.put(t, c);
            }
        });
        return out;
    }

    private static String condition(String table, Map<String, List<Edge>> cascadeInto, Map<String, String> memo, Set<String> path) {
        if (memo.containsKey(table)) {
            return memo.get(table);
        }
        if (!path.add(table)) {
            return null;                                  // ciclo de CASCADE entre tabelas: a política não tem nenhum
        }
        List<String> parts = new ArrayList<>();
        List<Edge> self = new ArrayList<>();
        for (Edge e : cascadeInto.getOrDefault(table, List.of())) {
            if (e.refTable().equals(table)) {
                self.add(e);
                continue;
            }
            String parent = condition(e.refTable(), cascadeInto, memo, path);
            if (parent != null) {
                parts.add(e.in(parent));
            }
        }
        path.remove(table);
        String c = parts.isEmpty() ? null : "(" + String.join(" OR ", parts) + ")";
        if (c != null) {
            for (Edge e : self) {
                c = "(" + c + " OR " + e.in(c) + ")";
            }
        }
        memo.put(table, c);
        return c;
    }

    private static MapSqlParameterSource ids(List<UUID> ids) {
        return new MapSqlParameterSource("ids", ids.stream().map(UUID::toString).toList());
    }

    private long count(String sql, MapSqlParameterSource p) {
        Long n = jdbc.queryForObject(sql, p, Long.class);
        return n == null ? 0 : n;
    }

    private static List<UUID> uuids(List<String> raw) {
        return raw.stream().map(UUID::fromString).toList();
    }

    @Override
    public List<UUID> testAccountIds() {
        return uuids(jdbc.queryForList("SELECT id FROM users WHERE " + TEST_ORIGINS + " ORDER BY id", Map.of(), String.class));
    }

    @Override
    public long realAccountsAmong(List<UUID> ids) {
        if (ids.isEmpty()) {
            return 0;
        }
        return count("SELECT COUNT(*) FROM users WHERE id IN (:ids) AND NOT (" + TEST_ORIGINS + ")", ids(ids));
    }

    @Override
    public ResetCounts plan(List<UUID> ids) {
        if (ids.isEmpty()) {
            return new ResetCounts(Map.of(), Map.of(), Map.of(), List.of());
        }
        List<Edge> edges = edges();
        Map<String, String> deleted = deletedRows(edges);
        MapSqlParameterSource p = ids(ids);
        Map<String, Long> cascade = new TreeMap<>();
        deleted.forEach((table, condition) -> {
            long n = count("SELECT COUNT(*) FROM `" + table + "` WHERE " + condition, p);
            if (n > 0) {
                cascade.put(table, n);
            }
        });
        Map<String, Long> setNull = new TreeMap<>();
        List<String> blockers = new ArrayList<>();
        for (Edge e : edges) {
            String parent = deleted.get(e.refTable());
            if (parent == null || e.rule().equals("CASCADE")) {
                continue;
            }
            String own = deleted.get(e.table());
            long n = count("SELECT COUNT(*) FROM `" + e.table() + "` WHERE " + e.in(parent)
                    + (own == null ? "" : " AND NOT COALESCE(" + own + ", FALSE)"), p);
            if (n == 0) {
                continue;
            }
            if (e.rule().equals("SET NULL")) {
                setNull.put(e.table() + "." + e.column(), n);
            } else {
                blockers.add(e.label() + " (" + e.rule() + "): " + n + " linha(s)");
            }
        }
        return new ResetCounts(cascade, setNull, polymorphicCounts(ids), blockers);
    }

    /** Condição "alvo é conteúdo das contas" para uma tabela com colunas {@code typeCol}/{@code idCol}. */
    private static String targetsOwnedBy(String typeCol, String idCol) {
        return "(" + TARGETS.entrySet().stream().sorted(Map.Entry.comparingByKey())
                .map(t -> "(" + typeCol + " = '" + t.getKey() + "' AND " + idCol + " IN (SELECT id FROM " + t.getValue()
                        + " WHERE user_id IN (:ids)))")
                .collect(Collectors.joining(" OR ")) + ")";
    }

    /** Notificações de outras contas cujo recurso é das contas de teste (a conta, uma peça, um look, um DNA, um comentário). */
    private static String notificationsAboutTestContent() {
        return "NOT (recipient_user_id IN (:ids) OR COALESCE(actor_user_id IN (:ids), FALSE)) AND ("
                + "(resource_type = 'USER' AND resource_id IN (:ids))"
                + " OR (resource_type = 'PIECE' AND resource_id IN (SELECT id FROM wardrobe_items WHERE user_id IN (:ids)))"
                + " OR (resource_type = 'SCHEME' AND resource_id IN (SELECT id FROM schemes WHERE user_id IN (:ids)))"
                + " OR (resource_type = 'DNA' AND (resource_id IN (SELECT id FROM dna_schemes WHERE user_id IN (:ids))"
                + "     OR resource_id IN (SELECT id FROM style_dna WHERE user_id IN (:ids))))"
                + " OR (resource_type = 'COMMENT' AND resource_id IN (SELECT id FROM comments WHERE author_user_id IN (:ids)"
                + "     OR " + targetsOwnedBy("target_type", "target_id") + ")))";
    }

    private Map<String, Long> polymorphicCounts(List<UUID> ids) {
        MapSqlParameterSource p = ids(ids);
        Map<String, Long> out = new TreeMap<>();
        long n = count("SELECT COUNT(*) FROM notifications WHERE " + notificationsAboutTestContent(), p);
        if (n > 0) {
            out.put("notifications", n);
        }
        INTERACTIONS.forEach((table, actor) -> {
            long c = count("SELECT COUNT(*) FROM " + table + " WHERE " + targetsOwnedBy("target_type", "target_id")
                    + " AND " + actor + " NOT IN (:ids)", p);
            if (c > 0) {
                out.put(table, c);
            }
        });
        return out;
    }

    @Override
    public void lockAccounts(List<UUID> ids) {
        if (!ids.isEmpty()) {
            jdbc.queryForList("SELECT id FROM users WHERE id IN (:ids) FOR UPDATE", ids(ids), String.class);
        }
    }

    @Override
    public List<UUID> pieceIdsOf(List<UUID> ids) {
        return ids.isEmpty() ? List.of()
                : uuids(jdbc.queryForList("SELECT id FROM wardrobe_items WHERE user_id IN (:ids)", ids(ids), String.class));
    }

    @Override
    public List<UUID> schemeIdsOf(List<UUID> ids) {
        return ids.isEmpty() ? List.of()
                : uuids(jdbc.queryForList("SELECT id FROM schemes WHERE user_id IN (:ids)", ids(ids), String.class));
    }

    @Override
    public List<String> storageKeysOf(List<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.queryForList("""
                SELECT storage_key FROM photos WHERE user_id IN (:ids) AND storage_key IS NOT NULL
                UNION SELECT storage_key FROM piece_images WHERE user_id IN (:ids) AND storage_key IS NOT NULL""",
                ids(ids), String.class);
    }

    @Override
    public List<CounterDelta> interactionsOnRealContent(List<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        String notOwned = TARGETS.entrySet().stream().sorted(Map.Entry.comparingByKey())
                .map(t -> "(x.target_type = '" + t.getKey() + "' AND x.target_id IN (SELECT id FROM " + t.getValue()
                        + " WHERE user_id NOT IN (:ids)))")
                .collect(Collectors.joining(" OR ", "(", ")"));
        return jdbc.query("""
                SELECT x.target_type, x.target_id, SUM(x.likes), SUM(x.comments), SUM(x.saves), SUM(x.shares) FROM (
                  SELECT target_type, target_id, 1 AS likes, 0 AS comments, 0 AS saves, 0 AS shares FROM reactions
                   WHERE actor_user_id IN (:ids) AND reaction_type = 'LIKE'
                  UNION ALL SELECT target_type, target_id, 0, 1, 0, 0 FROM comments WHERE author_user_id IN (:ids) AND active
                  UNION ALL SELECT target_type, target_id, 0, 0, 1, 0 FROM saved_items WHERE user_id IN (:ids)
                  UNION ALL SELECT target_type, target_id, 0, 0, 0, 1 FROM shares WHERE user_id IN (:ids)
                ) x WHERE\s""" + notOwned + " GROUP BY x.target_type, x.target_id ORDER BY x.target_type, x.target_id", ids(ids),
                (rs, i) -> new CounterDelta(rs.getString(1), UUID.fromString(rs.getString(2)), rs.getLong(3), rs.getLong(4),
                        rs.getLong(5), rs.getLong(6)));
    }

    @Override
    public int subtractCounters(List<CounterDelta> deltas) {
        int changed = 0;
        for (CounterDelta d : deltas) {
            MapSqlParameterSource p = new MapSqlParameterSource("id", d.targetId().toString()).addValue("likes", d.likes())
                    .addValue("comments", d.comments()).addValue("saves", d.saves()).addValue("shares", d.shares());
            String sql = switch (d.targetType()) {
                case "SCHEME" -> "UPDATE schemes SET like_count = GREATEST(0, like_count - :likes), comment_count = "
                        + "GREATEST(0, comment_count - :comments), save_count = GREATEST(0, save_count - :saves), "
                        + "share_count = GREATEST(0, share_count - :shares) WHERE id = :id";
                case "PIECE" -> "UPDATE wardrobe_items SET likes_count = GREATEST(0, likes_count - :likes), comment_count = "
                        + "GREATEST(0, comment_count - :comments), shares_count = GREATEST(0, shares_count - :shares) WHERE id = :id";
                case "DNA" -> "UPDATE dna_schemes SET like_count = GREATEST(0, like_count - :likes), comment_count = "
                        + "GREATEST(0, comment_count - :comments), share_count = GREATEST(0, share_count - :shares) WHERE id = :id";
                default -> null;
            };
            if (sql != null) {
                changed += jdbc.update(sql, p);
            }
        }
        return changed;
    }

    @Override
    public Map<String, Long> deletePolymorphicTargeting(List<UUID> ids) {
        Map<String, Long> out = new LinkedHashMap<>();
        if (ids.isEmpty()) {
            return out;
        }
        MapSqlParameterSource p = ids(ids);
        // notificações primeiro: a condição de COMMENT olha os comentários, que saem logo abaixo
        out.put("notifications", (long) jdbc.update("DELETE FROM notifications WHERE " + notificationsAboutTestContent(), p));
        INTERACTIONS.forEach((table, actor) -> out.put(table, (long) jdbc.update("DELETE FROM " + table + " WHERE "
                + targetsOwnedBy("target_type", "target_id") + " AND " + actor + " NOT IN (:ids)", p)));
        out.values().removeIf(n -> n == 0);
        return out;
    }

    @Override
    public long deleteTestAccounts(List<UUID> ids) {
        long deleted = 0;
        for (int i = 0; i < ids.size(); i += BATCH) {
            List<UUID> chunk = ids.subList(i, Math.min(ids.size(), i + BATCH));
            // a cláusula de origem é a trava final: mesmo com um id errado na lista, conta real nunca sai daqui
            deleted += jdbc.update("DELETE FROM users WHERE id IN (:ids) AND " + TEST_ORIGINS, ids(chunk));
        }
        return deleted;
    }

    /** Referências RESTRICT/NO ACTION que seguram uma marca (peças, produtos do catálogo...), das FKs reais. */
    private String brandReferences(String alias) {
        return edges().stream().filter(e -> e.refTable().equals("brands") && !e.rule().equals("CASCADE")
                        && !e.rule().equals("SET NULL"))
                .map(e -> "(SELECT COUNT(*) FROM `" + e.table() + "` r WHERE r.`" + e.column() + "` = " + alias + ".`"
                        + e.refColumn() + "`)")
                .collect(Collectors.joining(" + ", "(0 + ", ")"));
    }

    @Override
    public List<Map<String, Object>> demoCatalogBrands() {
        return jdbc.queryForList("SELECT b.fixture_key, b.name, b.slug, " + brandReferences("b") + " AS refs, "
                + "(SELECT COUNT(*) FROM wardrobe_items w WHERE w.brand_id = b.id) AS pieces "
                + "FROM brands b WHERE b.catalog_origin = 'DEMO' ORDER BY b.slug", Map.of());
    }

    @Override
    public long deleteUnreferencedDemoBrands() {
        List<String> free = jdbc.queryForList("SELECT b.id FROM brands b WHERE b.catalog_origin = 'DEMO' AND "
                + brandReferences("b") + " = 0", Map.of(), String.class);
        if (free.isEmpty()) {
            return 0;
        }
        return jdbc.update("DELETE FROM brands WHERE id IN (:ids) AND catalog_origin = 'DEMO'", new MapSqlParameterSource("ids", free));
    }

    @Override
    public Map<String, Long> globalCounts() {
        Map<String, Long> out = new LinkedHashMap<>();
        out.put("users_real", count("SELECT COUNT(*) FROM users WHERE NOT (" + TEST_ORIGINS + ")", new MapSqlParameterSource()));
        out.put("users_test", count("SELECT COUNT(*) FROM users WHERE " + TEST_ORIGINS, new MapSqlParameterSource()));
        out.put("brands", count("SELECT COUNT(*) FROM brands", new MapSqlParameterSource()));
        out.put("brands_demo", count("SELECT COUNT(*) FROM brands WHERE catalog_origin = 'DEMO'", new MapSqlParameterSource()));
        for (String t : List.of("catalog_products", "room_catalog", "challenge_templates", "dataset_sources")) {
            out.put(t, count("SELECT COUNT(*) FROM `" + t + "`", new MapSqlParameterSource()));
        }
        return out;
    }

    @Override
    public List<String> integrityProblems(List<String> expectedFixtureKeys) {
        List<String> problems = new ArrayList<>();
        MapSqlParameterSource none = new MapSqlParameterSource();

        // 1. FKs: o banco segue a política da V34?
        Map<String, Edge> live = new TreeMap<>();
        for (Edge e : edges()) {
            live.put(e.table() + "." + e.column() + "→" + e.refTable(), e);
        }
        Set<String> inPolicy = new HashSet<>();
        for (Fk fk : V34__integridade_referencial_por_dominio.POLICY) {
            String key = fk.table() + "." + fk.column() + "→" + fk.refTable();
            inPolicy.add(key);
            Edge e = live.get(key);
            if (e == null) {
                problems.add("[FK] ausente: " + fk);
            } else if (!V34__integridade_referencial_por_dominio.sameRule(e.rule(), fk.onDelete())) {
                problems.add("[FK] " + e.label() + " está ON DELETE " + e.rule() + ", a política é " + fk.onDelete());
            }
        }
        live.forEach((key, e) -> {
            if (!inPolicy.contains(key)) {
                problems.add("[FK] fora da política (falta na V34.POLICY): " + e.label() + " ON DELETE " + e.rule());
            }
        });

        // 2. contas: fixture_key só em conta de teste; conta DEMO sempre com fixture_key e prefixo demo_
        jdbc.queryForList("SELECT username FROM users WHERE fixture_key IS NOT NULL AND NOT (" + TEST_ORIGINS + ")", none, String.class)
                .forEach(u -> problems.add("[CONTA] conta real com fixture_key: " + u));
        jdbc.queryForList("SELECT username FROM users WHERE account_origin = 'DEMO' AND (fixture_key IS NULL "
                        + "OR username NOT LIKE 'demo\\_%')", none, String.class)
                .forEach(u -> problems.add("[CONTA] conta DEMO sem fixture_key ou sem o prefixo demo_: " + u));
        if (!expectedFixtureKeys.isEmpty()) {
            Set<String> present = new HashSet<>(jdbc.queryForList("SELECT fixture_key FROM users WHERE fixture_key IN (:keys)",
                    new MapSqlParameterSource("keys", expectedFixtureKeys), String.class));
            expectedFixtureKeys.stream().filter(k -> !present.contains(k))
                    .forEach(k -> problems.add("[FIXTURE] persona ausente: " + k));
        }

        // 3. polimórficas órfãs (alvo apagado sem levar a interação)
        for (String table : INTERACTIONS.keySet()) {
            String orphan = TARGETS.entrySet().stream().sorted(Map.Entry.comparingByKey())
                    .map(t -> "(x.target_type = '" + t.getKey() + "' AND NOT EXISTS (SELECT 1 FROM " + t.getValue()
                            + " o WHERE o.id = x.target_id))")
                    .collect(Collectors.joining(" OR "));
            long n = count("SELECT COUNT(*) FROM " + table + " x WHERE " + orphan, none);
            if (n > 0) {
                problems.add("[ÓRFÃO] " + table + ": " + n + " linha(s) apontando para conteúdo que não existe mais");
            }
        }

        // 4. dado real preso a marca de QA (o reset do catálogo nunca vai conseguir tirá-la)
        long realOnDemoBrand = count("SELECT COUNT(*) FROM wardrobe_items w JOIN brands b ON b.id = w.brand_id "
                + "JOIN users u ON u.id = w.user_id WHERE b.catalog_origin = 'DEMO' AND NOT (u." + TEST_ORIGINS + ")", none);
        if (realOnDemoBrand > 0) {
            problems.add("[CATÁLOGO] " + realOnDemoBrand + " peça(s) de conta real usam marca DEMO");
        }
        return problems;
    }
}
