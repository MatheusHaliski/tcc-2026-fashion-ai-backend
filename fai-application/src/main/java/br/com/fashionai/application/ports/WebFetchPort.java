package br.com.fashionai.application.ports;

import java.util.Optional;

/**
 * Acesso de leitura à internet pública (logos de marca, Wikidata). A implementação só aceita https, recusa endereços
 * internos (proteção contra SSRF), limita tamanho, redirecionamentos e tempo — a URL pode vir de uma resposta de IA.
 */
public interface WebFetchPort {
    record Fetched(String finalUrl, String contentType, byte[] body) {
    }

    /** GET com limite de bytes; vazio quando a rede recusa, o host é interno, o status não é 2xx ou o tipo não bate. */
    Optional<Fetched> get(String url, int maxBytes, String acceptPrefix);
}
