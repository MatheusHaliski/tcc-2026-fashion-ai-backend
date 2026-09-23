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

    List<Map<String, Object>> brandUsage(int limit);

    List<Map<String, Object>> countries();

    List<Map<String, Object>> countryColors();

    List<Map<String, Object>> hypeBySeason(String country);

    List<Map<String, Object>> colorRanking(String country, int limit);

    List<Map<String, Object>> hypeBands();

    List<Map<String, Object>> inventoryBands();

    List<Map<String, Object>> sealFunnel(Filter filter);

    List<Map<String, Object>> challengeStats();

    List<Map<String, Object>> pointsByAction(Filter filter);

    List<Map<String, Object>> usersByProfile(Filter filter);

    List<Map<String, Object>> bondSeries(UUID targetOwnerId, Filter filter);

    int purgeNotifications(int days);
}
