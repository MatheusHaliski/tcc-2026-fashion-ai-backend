package br.com.fashionai.infrastructure.mysql.analytics;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Catálogos de SQL do analytics: constantes resolvidas na carga da classe, sem placeholder sobrando nem recorte perdido. */
class AnalyticsSqlCatalogTest {

    private static List<String> constants(Class<?> type) throws IllegalAccessException {
        List<String> out = new ArrayList<>();
        for (Field f : type.getDeclaredFields()) {
            if (Modifier.isStatic(f.getModifiers()) && f.getType() == String.class) {
                f.setAccessible(true);
                out.add((String) f.get(null));
            }
        }
        return out;
    }

    @Test
    void nenhumaConsultaFicaComPlaceholderDeFormatacao() throws IllegalAccessException {
        List<String> all = new ArrayList<>(constants(AnalyticsInsightsSql.class));
        all.addAll(constants(AnalyticsDashboardSql.class));
        assertThat(all).hasSizeGreaterThan(30).allSatisfy(sql -> {
            assertThat(sql).isNotBlank().doesNotContain("%1$s").doesNotContain("%2$s");
        });
    }

    @Test
    void funilDeAtivacaoAplicaACoorteEmTodasAsSeisEtapas() {
        String cohort = "FROM users u WHERE u.created_at BETWEEN :from AND :to AND u.test_account = FALSE AND"
                + AnalyticsDashboardSql.USER_SCOPE;
        assertThat(AnalyticsDashboardSql.ACTIVATION_FUNNEL.split(java.util.regex.Pattern.quote(cohort), -1)).hasSize(7);
    }

    @Test
    void recorteDeUsuarioEResultadosDeFalhaCompartilhados() {
        assertThat(AnalyticsDashboardSql.TOP_USERS).contains("u.test_account = FALSE AND" + AnalyticsDashboardSql.USER_SCOPE + "HAVING ");
        assertThat(AnalyticsDashboardSql.CATEGORIES).contains("AND" + AnalyticsDashboardSql.USER_SCOPE + " GROUP BY");
        assertThat(AnalyticsDashboardSql.HYPE_LEVELS_V2).contains("AND" + AnalyticsDashboardSql.USER_SCOPE + "GROUP BY");
        assertThat(AnalyticsDashboardSql.HYPE_COVERAGE_V2.split(java.util.regex.Pattern.quote(AnalyticsDashboardSql.USER_SCOPE), -1))
                .hasSize(3);
        assertThat(AnalyticsDashboardSql.AUDIT_FAILURES).contains("resultado IN " + AnalyticsDashboardSql.FAILURE_RESULTS);
        assertThat(AnalyticsDashboardSql.AUDIT_RECENT).contains("resultado IN " + AnalyticsDashboardSql.FAILURE_RESULTS);
    }

    @Test
    void datasDoHypeSaemEmIsoUtcSemSerFormatadasPeloJava() {
        assertThat(AnalyticsDashboardSql.HYPE_JOB_V2).contains("'%Y-%m-%dT%H:%i:%sZ'").contains("'%Y-%m-%d'");
        assertThat(AnalyticsDashboardSql.BONDED_LOOKS_HYPE_V2).contains("'%Y-%m-%dT%H:%i:%sZ'");
    }
}
