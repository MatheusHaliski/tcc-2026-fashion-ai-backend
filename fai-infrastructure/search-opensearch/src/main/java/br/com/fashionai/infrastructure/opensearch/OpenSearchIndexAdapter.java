package br.com.fashionai.infrastructure.opensearch;

import br.com.fashionai.application.ports.SearchIndexPort;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

@Component
public class OpenSearchIndexAdapter implements SearchIndexPort {
    @Override
    public void index(String indexName, UUID id, Map<String, Object> document) {
        // Adapter boundary for OpenSearch. Concrete indexing is wired after index mappings are approved.
    }

    @Override
    public void remove(String indexName, UUID id) {
        // Adapter boundary for OpenSearch deletion.
    }
}
