package br.com.fashionai.application.ports;

import java.util.Map;
import java.util.UUID;

/**
 * Redis — contadores atômicos (piece_stats/scheme_stats: curtidas, reações, comentários, shares,
 * remixes, visualizações) com write-behind para o MySQL. Chave: stats:{tipo}:{id}.
 */
public interface CounterStorePort {
    long increment(String entityType, UUID entityId, String field, long delta);

    Map<String, Long> read(String entityType, UUID entityId);
}
