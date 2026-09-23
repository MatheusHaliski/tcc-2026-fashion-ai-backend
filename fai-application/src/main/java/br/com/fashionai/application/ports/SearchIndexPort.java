package br.com.fashionai.application.ports;

import java.util.Map;
import java.util.UUID;

public interface SearchIndexPort {
    void index(String indexName, UUID id, Map<String, Object> document);

    void remove(String indexName, UUID id);
}
