package br.com.fashionai.infrastructure.mysql.demo;

import br.com.fashionai.application.ports.DemoDataAdminPort;
import br.com.fashionai.infrastructure.mysql.demo.MysqlDemoDataAdminAdapter.Edge;
import db.migration.V34__integridade_referencial_por_dominio;
import db.migration.V34__integridade_referencial_por_dominio.Fk;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;

import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Pipeline de dados demo: plano do reset a partir das FKs, apagamento em lotes e checagem de integridade. */
class MysqlDemoDataAdminAdapterTest {
    private final NamedParameterJdbcTemplate jdbc = mock(NamedParameterJdbcTemplate.class);
    private final MysqlDemoDataAdminAdapter adapter = new MysqlDemoDataAdminAdapter(jdbc);
    private final UUID a = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private final UUID b = UUID.fromString("00000000-0000-0000-0000-000000000002");

    @SuppressWarnings("unchecked")
    private void edges(List<Edge> edges) {
        when(jdbc.query(contains("information_schema.KEY_COLUMN_USAGE"), anyMap(), any(RowMapper.class))).thenReturn((List) edges);
    }

    /** COUNT(*) devolvido conforme o SQL. */
    private void counts(Function<String, Long> bySql) {
        when(jdbc.queryForObject(anyString(), any(SqlParameterSource.class), eq(Long.class)))
                .thenAnswer(inv -> bySql.apply(inv.getArgument(0)));
    }

    @Test
    void arestaRejeitaIdentificadorEstranhoENormalizaARegra() {
        assertThatThrownBy(() -> new Edge("users; drop", "id", "x", "id", "cascade"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("users; drop");
        Edge e = new Edge("photos", "user_id", "users", "id", "set null");
        assertThat(e.rule()).isEqualTo("SET NULL");
        assertThat(e.label()).isEqualTo("photos.user_id → users");
        assertThat(new Edge("photos", "owner", "users", "uuid", "RESTRICT").label()).isEqualTo("photos.owner → users.uuid");
        assertThat(e.in("x = 1")).isEqualTo("`user_id` IN (SELECT `id` FROM `users` WHERE x = 1)");
    }

    @Test
    void linhasApagadasSeguemOCascadeComAutorreferenciaECiclo() {
        List<Edge> edges = List.of(
                new Edge("comments", "author_user_id", "users", "id", "CASCADE"),
                new Edge("comments", "parent_id", "comments", "id", "CASCADE"),
                new Edge("photos", "user_id", "users", "id", "SET NULL"),
                new Edge("ciclo_a", "b_id", "ciclo_b", "id", "CASCADE"),
                new Edge("ciclo_b", "a_id", "ciclo_a", "id", "CASCADE"));
        Map<String, String> rows = MysqlDemoDataAdminAdapter.deletedRows(edges);
        assertThat(rows).containsKeys("users", "comments").doesNotContainKeys("photos", "ciclo_a", "ciclo_b");
        assertThat(rows.get("comments")).contains("`author_user_id` IN (SELECT `id` FROM `users`", "`parent_id` IN");
    }

    @Test
    void listasVaziasNaoTocamNoBanco() {
        assertThat(adapter.realAccountsAmong(List.of())).isZero();
        DemoDataAdminPort.ResetCounts plan = adapter.plan(List.of());
        assertThat(plan.cascade()).isEmpty();
        adapter.lockAccounts(List.of());
        assertThat(adapter.pieceIdsOf(List.of())).isEmpty();
        assertThat(adapter.schemeIdsOf(List.of())).isEmpty();
        assertThat(adapter.storageKeysOf(List.of())).isEmpty();
        assertThat(adapter.interactionsOnRealContent(List.of())).isEmpty();
        assertThat(adapter.deletePolymorphicTargeting(List.of())).isEmpty();
        assertThat(adapter.deleteTestAccounts(List.of())).isZero();
        assertThat(adapter.subtractCounters(List.of())).isZero();
        verifyNoInteractions(jdbc);
    }

    @Test
    void contasDeTesteEContasReaisNaLista() {
        when(jdbc.queryForList(contains("account_origin IN ('TEST_SEED','DEMO') ORDER BY id"), anyMap(), eq(String.class)))
                .thenReturn(List.of(a.toString(), b.toString()));
        assertThat(adapter.testAccountIds()).containsExactly(a, b);
        counts(sql -> null);
        assertThat(adapter.realAccountsAmong(List.of(a))).isZero();
        counts(sql -> 3L);
        assertThat(adapter.realAccountsAmong(List.of(a))).isEqualTo(3);
    }

    @Test
    void consultasPorDonoConvertemOsIds() {
        UUID piece = UUID.randomUUID();
        when(jdbc.queryForList(contains("FROM wardrobe_items WHERE user_id"), any(SqlParameterSource.class), eq(String.class)))
                .thenReturn(List.of(piece.toString()));
        when(jdbc.queryForList(contains("FROM schemes WHERE user_id"), any(SqlParameterSource.class), eq(String.class)))
                .thenReturn(List.of(piece.toString()));
        when(jdbc.queryForList(contains("storage_key"), any(SqlParameterSource.class), eq(String.class)))
                .thenReturn(List.of("photos/a.png"));
        assertThat(adapter.pieceIdsOf(List.of(a))).containsExactly(piece);
        assertThat(adapter.schemeIdsOf(List.of(a))).containsExactly(piece);
        assertThat(adapter.storageKeysOf(List.of(a))).containsExactly("photos/a.png");
        adapter.lockAccounts(List.of(a));
        verify(jdbc).queryForList(contains("FOR UPDATE"), any(SqlParameterSource.class), eq(String.class));
    }

    @Test
    void planoContaCascadeSetNullBloqueiosEPolimorficas() {
        edges(List.of(
                new Edge("wardrobe_items", "user_id", "users", "id", "CASCADE"),
                new Edge("photos", "user_id", "users", "id", "SET NULL"),
                new Edge("piece_images", "piece_id", "wardrobe_items", "id", "RESTRICT"),
                new Edge("brands", "owner_id", "users", "id", "SET NULL"),
                new Edge("orders", "item_id", "wardrobe_items", "id", "NO ACTION"),
                new Edge("audit", "brand_id", "brands", "id", "RESTRICT")));
        counts(sql -> {
            if (sql.startsWith("SELECT COUNT(*) FROM `users`")) return 2L;
            if (sql.startsWith("SELECT COUNT(*) FROM `wardrobe_items`")) return 0L;
            if (sql.startsWith("SELECT COUNT(*) FROM `photos`")) return 4L;
            if (sql.startsWith("SELECT COUNT(*) FROM `piece_images`")) return 1L;
            if (sql.startsWith("SELECT COUNT(*) FROM `brands`")) return 0L;
            if (sql.startsWith("SELECT COUNT(*) FROM `orders`")) return 5L;
            if (sql.contains("FROM notifications")) return 6L;
            if (sql.contains("FROM reactions")) return 2L;
            return 0L;
        });
        DemoDataAdminPort.ResetCounts plan = adapter.plan(List.of(a));
        assertThat(plan.cascade()).containsExactly(Map.entry("users", 2L));
        assertThat(plan.setNull()).containsExactly(Map.entry("photos.user_id", 4L));
        assertThat(plan.blockers()).containsExactly("piece_images.piece_id → wardrobe_items (RESTRICT): 1 linha(s)",
                "orders.item_id → wardrobe_items (NO ACTION): 5 linha(s)");
        assertThat(plan.polymorphic()).containsExactly(Map.entry("notifications", 6L), Map.entry("reactions", 2L));
    }

    @Test
    void planoExcluiDoBloqueioAsLinhasQueTambemSaemPorCascade() {
        edges(List.of(
                new Edge("wardrobe_items", "user_id", "users", "id", "CASCADE"),
                new Edge("wardrobe_items", "creator_id", "users", "id", "RESTRICT")));
        counts(sql -> sql.contains("FROM `wardrobe_items` WHERE `creator_id`") ? 0L : 1L);
        DemoDataAdminPort.ResetCounts plan = adapter.plan(List.of(a));
        assertThat(plan.blockers()).isEmpty();
        verify(jdbc).queryForObject(contains("AND NOT COALESCE("), any(SqlParameterSource.class), eq(Long.class));
    }

    @Test
    void interacoesEmConteudoRealViramDeltas() throws Exception {
        UUID target = UUID.randomUUID();
        @SuppressWarnings("unchecked")
        ArgumentCaptor<RowMapper<DemoDataAdminPort.CounterDelta>> mapper = ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.query(contains("GROUP BY x.target_type"), any(SqlParameterSource.class), mapper.capture())).thenReturn(List.of());
        assertThat(adapter.interactionsOnRealContent(List.of(a))).isEmpty();
        ResultSet rs = mock(ResultSet.class);
        when(rs.getString(1)).thenReturn("PIECE");
        when(rs.getString(2)).thenReturn(target.toString());
        when(rs.getLong(3)).thenReturn(1L);
        when(rs.getLong(4)).thenReturn(2L);
        when(rs.getLong(5)).thenReturn(3L);
        when(rs.getLong(6)).thenReturn(4L);
        assertThat(mapper.getValue().mapRow(rs, 0)).isEqualTo(new DemoDataAdminPort.CounterDelta("PIECE", target, 1, 2, 3, 4));
    }

    @Test
    void subtraiContadoresPorTipoEIgnoraTipoDesconhecido() {
        when(jdbc.update(anyString(), any(SqlParameterSource.class))).thenReturn(1);
        int changed = adapter.subtractCounters(List.of(
                new DemoDataAdminPort.CounterDelta("SCHEME", a, 1, 0, 0, 0),
                new DemoDataAdminPort.CounterDelta("PIECE", a, 1, 0, 0, 0),
                new DemoDataAdminPort.CounterDelta("DNA", a, 1, 0, 0, 0),
                new DemoDataAdminPort.CounterDelta("USER", a, 1, 0, 0, 0)));
        assertThat(changed).isEqualTo(3);
        verify(jdbc).update(contains("UPDATE schemes"), any(SqlParameterSource.class));
        verify(jdbc).update(contains("UPDATE wardrobe_items"), any(SqlParameterSource.class));
        verify(jdbc).update(contains("UPDATE dna_schemes"), any(SqlParameterSource.class));
    }

    @Test
    void apagaPolimorficasERemoveOsZeros() {
        when(jdbc.update(anyString(), any(SqlParameterSource.class))).thenAnswer(inv -> {
            String sql = inv.getArgument(0);
            return sql.startsWith("DELETE FROM notifications") ? 3 : sql.startsWith("DELETE FROM comments") ? 2 : 0;
        });
        assertThat(adapter.deletePolymorphicTargeting(List.of(a)))
                .containsExactly(Map.entry("notifications", 3L), Map.entry("comments", 2L));
    }

    @Test
    void apagaContasEmLotesDe25ComATravaDeOrigem() {
        List<UUID> ids = new ArrayList<>();
        for (int i = 0; i < 30; i++) ids.add(UUID.randomUUID());
        when(jdbc.update(anyString(), any(SqlParameterSource.class))).thenReturn(25, 5);
        assertThat(adapter.deleteTestAccounts(ids)).isEqualTo(30);
        verify(jdbc, times(2)).update(contains("AND account_origin IN ('TEST_SEED','DEMO')"), any(SqlParameterSource.class));
    }

    @Test
    void marcasDemoLiberadasSaoApagadasSoQuandoExistem() {
        edges(List.of(new Edge("wardrobe_items", "brand_id", "brands", "id", "RESTRICT"),
                new Edge("brand_follows", "brand_id", "brands", "id", "CASCADE"),
                new Edge("photos", "brand_id", "brands", "id", "SET NULL")));
        when(jdbc.queryForList(contains("SELECT b.id FROM brands"), anyMap(), eq(String.class))).thenReturn(List.of());
        assertThat(adapter.deleteUnreferencedDemoBrands()).isZero();
        verify(jdbc, never()).update(anyString(), any(SqlParameterSource.class));

        when(jdbc.queryForList(contains("SELECT b.id FROM brands"), anyMap(), eq(String.class))).thenReturn(List.of("x"));
        when(jdbc.update(contains("DELETE FROM brands"), any(SqlParameterSource.class))).thenReturn(1);
        assertThat(adapter.deleteUnreferencedDemoBrands()).isEqualTo(1);

        List<Map<String, Object>> rows = List.of(Map.of("slug", "demo"));
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        when(jdbc.queryForList(sql.capture(), anyMap())).thenReturn(rows);
        assertThat(adapter.demoCatalogBrands()).isSameAs(rows);
        assertThat(sql.getValue()).contains("(0 + (SELECT COUNT(*) FROM `wardrobe_items` r WHERE r.`brand_id` = b.`id`))")
                .doesNotContain("brand_follows", "photos");
    }

    @Test
    void contagensGlobais() {
        counts(sql -> sql.contains("catalog_origin = 'DEMO'") ? 2L : 1L);
        Map<String, Long> out = adapter.globalCounts();
        assertThat(out).containsKeys("users_real", "users_test", "brands", "catalog_products", "dataset_sources");
        assertThat(out.get("brands_demo")).isEqualTo(2L);
        assertThat(out.get("users_real")).isEqualTo(1L);
    }

    @Test
    void integridadeApontaFksContasFixturesOrfaosEMarcaDemo() {
        Fk first = V34__integridade_referencial_por_dominio.POLICY.get(0);
        Fk second = V34__integridade_referencial_por_dominio.POLICY.get(1);
        String wrong = first.onDelete().equals("CASCADE") ? "RESTRICT" : "CASCADE";
        edges(List.of(
                new Edge(first.table(), first.column(), first.refTable(), first.refColumn(), wrong),
                new Edge(second.table(), second.column(), second.refTable(), second.refColumn(), second.onDelete()),
                new Edge("tabela_nova", "user_id", "users", "id", "CASCADE")));
        when(jdbc.queryForList(contains("fixture_key IS NOT NULL"), any(SqlParameterSource.class), eq(String.class)))
                .thenReturn(List.of("real_com_fixture"));
        when(jdbc.queryForList(contains("account_origin = 'DEMO' AND (fixture_key IS NULL"), any(SqlParameterSource.class), eq(String.class)))
                .thenReturn(List.of("sem_prefixo"));
        when(jdbc.queryForList(contains("fixture_key IN (:keys)"), any(SqlParameterSource.class), eq(String.class)))
                .thenReturn(List.of("persona_a"));
        counts(sql -> sql.contains("FROM reactions x") ? 2L : sql.contains("JOIN brands b") ? 1L : 0L);

        List<String> problems = adapter.integrityProblems(List.of("persona_a", "persona_b"));

        assertThat(problems).contains(
                "[FK] " + first.table() + "." + first.column() + " → " + first.refTable()
                        + ("id".equals(first.refColumn()) ? "" : "." + first.refColumn())
                        + " está ON DELETE " + wrong + ", a política é " + first.onDelete(),
                "[FK] fora da política (falta na V34.POLICY): tabela_nova.user_id → users ON DELETE CASCADE",
                "[CONTA] conta real com fixture_key: real_com_fixture",
                "[CONTA] conta DEMO sem fixture_key ou sem o prefixo demo_: sem_prefixo",
                "[FIXTURE] persona ausente: persona_b",
                "[ÓRFÃO] reactions: 2 linha(s) apontando para conteúdo que não existe mais",
                "[CATÁLOGO] 1 peça(s) de conta real usam marca DEMO");
        assertThat(problems).anyMatch(p -> p.startsWith("[FK] ausente: "));
        assertThat(problems).noneMatch(p -> p.contains("persona_a"));
    }

    @Test
    void integridadeSemFixturesEsperadasNaoConsultaPersonas() {
        edges(List.of());
        counts(sql -> 0L);
        List<String> problems = adapter.integrityProblems(List.of());
        assertThat(problems).allMatch(p -> p.startsWith("[FK] ausente"));
        verify(jdbc, never()).queryForList(contains("fixture_key IN (:keys)"), any(MapSqlParameterSource.class), eq(String.class));
    }
}
