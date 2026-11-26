package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;

import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Leitura de uma escolha de opção num PATCH em mapa (perfil de marca e de celebridade): chave omitida mantém o que está
 * gravado; chave presente com valor vazio/nulo, ou o pedido explícito de limpar, remove a escolha; um UUID escolhe a
 * opção. Mandar o ID junto com o pedido de limpar, ou um ID que não é UUID, é inválido.
 */
final class ReferenceChoice {
    /** {@code keep}: nada foi pedido. Senão, {@code id} nulo quer dizer "limpar". */
    record Choice(boolean keep, UUID id) {
    }

    private ReferenceChoice() {
    }

    static Choice read(Map<String, ?> fields, String idKey, String clearKey, Supplier<ApiException> invalid) {
        boolean clear = isTrue(fields.get(clearKey));
        boolean sent = fields.containsKey(idKey);
        if (!sent && !clear) {
            return new Choice(true, null);
        }
        Object value = fields.get(idKey);
        String raw = value == null ? "" : String.valueOf(value).trim();
        if (raw.isEmpty()) {
            return new Choice(false, null);
        }
        if (clear) {
            throw invalid.get();
        }
        try {
            return new Choice(false, UUID.fromString(raw));
        } catch (IllegalArgumentException e) {
            throw invalid.get();
        }
    }

    private static boolean isTrue(Object value) {
        return Boolean.TRUE.equals(value) || (value instanceof String s && "true".equalsIgnoreCase(s.trim()));
    }
}
