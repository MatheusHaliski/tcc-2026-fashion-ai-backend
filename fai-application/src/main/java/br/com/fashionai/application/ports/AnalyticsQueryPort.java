package br.com.fashionai.application.ports;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Consultas analíticas agrupadas (SQL GROUP BY, views e stored procedures da V6) para o dashboard gerencial, o
 * painel do emissor de selos e o Explorador Global (RF26). Implementada no módulo MySQL.
 */
public interface AnalyticsQueryPort {
    record Filter(Instant from, Instant to, String country, String profileType) {
    }

    Map<String, Object> kpis(Filter filter);

    List<Map<String, Object>> series(String metric, Filter filter);

    List<Map<String, Object>> aiUsage(Filter filter);

    /** Custo e chamadas de IA por país do usuário (procedure sp_ai_cost_by_country, V10). */
    List<Map<String, Object>> aiCostByCountry(Filter filter);

    List<Map<String, Object>> brandUsage(int limit);

    List<Map<String, Object>> countries();

    List<Map<String, Object>> countryColors();

    List<Map<String, Object>> hypeBySeason(String country);

    List<Map<String, Object>> colorRanking(String country, int limit);

    List<Map<String, Object>> hypeBands();

    /** Faixas de Hype dos looks públicos com recorte de país/perfil do dono (dashboard). */
    List<Map<String, Object>> hypeBands(Filter f);

    List<Map<String, Object>> inventoryBands();

    List<Map<String, Object>> sealFunnel(Filter filter);

    List<Map<String, Object>> challengeStats();

    List<Map<String, Object>> pointsByAction(Filter filter);

    List<Map<String, Object>> usersByProfile(Filter filter);

    List<Map<String, Object>> bondSeries(UUID targetOwnerId, Filter filter);

    int purgeNotifications(int days);

    // ---------------------------------------------------------------- dashboard administrativo por abas
    /** Funil de ativação da coorte cadastrada no período: etapas em ordem (registered → daily_look) com quantos chegaram a cada uma. */
    List<Map<String, Object>> activationFunnel(Filter filter);
    /** Atividade registrada no audit_log por dia da semana (0 = domingo) e hora, no fuso de Brasília. */
    List<Map<String, Object>> activityHeatmap(Filter filter);
    /** Usuários mais ativos no período (peças, looks e curtidas recebidas), sem contas de teste. */
    List<Map<String, Object>> topUsers(Filter filter, int limit);
    List<Map<String, Object>> moderationByStatus(Filter filter);
    List<Map<String, Object>> moderationRecent(int limit);
    /** Falhas e negações do audit_log agrupadas por ação e resultado. */
    List<Map<String, Object>> auditFailures(Filter filter);
    List<Map<String, Object>> auditRecent(Filter filter, int limit);
    /** Por dia: logins falhos, acessos negados e erros. */
    List<Map<String, Object>> securitySeries(Filter filter);
    /** Por dia: curtidas, comentários e compartilhamentos. */
    List<Map<String, Object>> engagementSeries(Filter filter);
    List<Map<String, Object>> categories(Filter filter);
    List<Map<String, Object>> jobsByStatus(Filter filter);
    List<Map<String, Object>> jobsFailedRecent(int limit);
    /** Tempo de um SELECT 1 no banco, em milissegundos (saúde do sistema). */
    long dbLatencyMs();

    /** RF26 — recorte do painel global: estação (Scheme.season / WardrobeItem.market), cor e faixa de hypeScore. */
    record GlobalFilter(String season, String color, Double hypeMin, Double hypeMax) {
    }

    /** RF26.CA01 — esquemas públicos por país do dono (User.country), com hype médio, no recorte pedido. */
    List<Map<String, Object>> schemesByCountry(GlobalFilter filter);

    /** RF26.CA01 — peças públicas por país do dono (User.country), no recorte pedido. */
    List<Map<String, Object>> piecesByCountry(GlobalFilter filter);

    /** RF26.CA02 — facetas por marca (cores, estações e hype médio das peças) para os filtros de Marcas & lojas. */
    List<Map<String, Object>> brandFacets();

    /** RF26.CA03 — maior hypeScore médio dos looks por cor das peças. */
    List<Map<String, Object>> hypeByColor(int limit);

    /** RF26.CA03 — maior hypeScore médio dos looks por marca das peças. */
    List<Map<String, Object>> hypeByBrand(int limit);
}
