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

    /** Looks públicos por estação (volume, sem Hype), com recorte de país do dono. */
    List<Map<String, Object>> looksBySeason(String country);

    List<Map<String, Object>> colorRanking(String country, int limit);

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

    /** RF26 — recorte do painel global: estação (Scheme.season / WardrobeItem.market) e cor. */
    record GlobalFilter(String season, String color) {
    }

    /** RF26.CA01 — esquemas públicos por país do dono (User.country), no recorte pedido (só volume). */
    List<Map<String, Object>> schemesByCountry(GlobalFilter filter);

    /** RF26.CA01 — peças públicas por país do dono (User.country), no recorte pedido. */
    List<Map<String, Object>> piecesByCountry(GlobalFilter filter);

    /** RF26.CA02 — facetas por marca (peças, cores e estações) para os filtros de Marcas & lojas. */
    List<Map<String, Object>> brandFacets();

    // ---------------------------------------------------------------- HypeScore v2 (RF53 · Lote 7) — só acréscimos
    // Os métodos de Hype v1 (faixas de juízo e médias de hype_score) saíram em P3-16. Estes leem o estado gravado pelo job em hype_scores
    // (GET nunca recalcula). Os defaults vazios mantêm compilando qualquer dublê de teste que implemente a porta.

    /**
     * Distribuição por faixa v2 (P2-21): linhas {@code entity_type} (PIECE/SCHEME), {@code level} e {@code total}. Só
     * estados AVAILABLE e {@code public_eligible} (agregado de terceiros), com recorte de país/perfil do dono.
     */
    default List<Map<String, Object>> hypeLevelsV2(Filter filter, String algorithmVersion) {
        return List.of();
    }

    /**
     * Cobertura v2 sobre as entidades ativas (peças e looks não arquivados), com o mesmo recorte de dono: por
     * {@code entity_type}, {@code total}, {@code available}, {@code insufficient}, {@code not_calculated} (sem linha
     * em hype_scores) e {@code public_eligible}. Só contagens: nenhum score individual sai daqui.
     */
    default List<Map<String, Object>> hypeCoverageV2(Filter filter, String algorithmVersion) {
        return List.of();
    }

    /**
     * Estado do job v2 (P3-14): {@code last_calculated_at} (ISO-8601 UTC, último cálculo gravado — job de 6 h ou
     * recálculo ao vivo), {@code last_snapshot_date} (AAAA-MM-DD) e {@code rows_total}. Vazio/nulos = nunca calculado.
     */
    default Map<String, Object> hypeJobV2(String algorithmVersion) {
        return Map.of();
    }

    /**
     * Looks com vínculo de selo APROVADO para o emissor (P2-20), um por look, com o estado v2 de cada um via LEFT JOIN
     * (sem linha = não calculado): {@code scheme_id}, {@code title}, {@code cover_url}, {@code owner}, {@code status},
     * {@code score}, {@code level}, {@code delta_points}, {@code direction}, {@code public_eligible},
     * {@code calculated_at}. Quem consome agrega só os {@code public_eligible}.
     */
    default List<Map<String, Object>> bondedLooksHypeV2(UUID issuerId, String algorithmVersion) {
        return List.of();
    }
}
