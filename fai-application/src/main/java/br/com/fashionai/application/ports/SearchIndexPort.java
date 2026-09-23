package br.com.fashionai.application.ports;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** OpenSearch — índices pieces, schemes, users, dna (RF8/RF14/RF17/RF22/RF26). Projeção derivada do MySQL. */
public interface SearchIndexPort {
    void index(String indexName, UUID id, Map<String, Object> document);

    void remove(String indexName, UUID id);

    /** Retorna ids ordenados por relevância; lista vazia quando o índice está desabilitado. */
    List<UUID> search(String indexName, String term, Map<String, String> filters, int limit);

    boolean enabled();
}
