package br.com.fashionai.application.seal;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;

import static br.com.fashionai.application.seal.SealPolicyValues.text;

/**
 * Exercício 13 — marca exigida por uma regra da política, referenciada por ID e não pelo nome digitado.
 * {@code kind} diz de qual tabela vem o ID: {@code CATALOG} = {@code brands}; {@code PROFILE} = {@code brand_profiles}
 * (um UUID sem a origem seria ambíguo). {@code nome} é só o texto exibido, gravado na hora do salvamento: quem decide
 * se a peça atende é o ID. A regra antiga, com {@code brand} em texto, continua existindo e sendo lida como texto.
 */
public record SealPolicyBrandReference(String kind, UUID id, String nome) {
    public static final String CATALOG = "CATALOG";
    public static final String PROFILE = "PROFILE";
    public static final Set<String> KINDS = Set.of(CATALOG, PROFILE);

    /** Valida o que veio da tela ({@code kind} e UUID); o nome enviado é descartado, porque o do banco é que vale. */
    static Map<String, Object> normalize(Object raw) {
        if (!(raw instanceof Map<?, ?> m) || (text(m.get("kind")) == null && text(m.get("id")) == null)) {
            return null;
        }
        String kind = kind(m.get("kind"));
        UUID id = uuid(m.get("id"));
        if (kind == null || id == null) {
            throw ApiException.badRequest("MARCA_POLITICA_INVALIDA", Msg.t("sealPolicy.marca_referencia_invalida"));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("kind", kind);
        out.put("id", id.toString());
        return out;
    }

    /** Leitura do que já está gravado: referência incompleta é ignorada (o JSON salvo nunca derruba a leitura). */
    static SealPolicyBrandReference parse(Object stored) {
        if (!(stored instanceof Map<?, ?> m)) {
            return null;
        }
        String kind = kind(m.get("kind"));
        UUID id = uuid(m.get("id"));
        return kind == null || id == null ? null : new SealPolicyBrandReference(kind, id, text(m.get("nome")));
    }

    /** Texto mostrado na frase da política: o nome gravado; sem ele, o próprio ID (nunca um nome inventado). */
    String label() {
        return nome != null ? nome : id.toString();
    }

    static String kind(Object raw) {
        String kind = text(raw);
        if (kind == null) {
            return null;
        }
        String upper = kind.toUpperCase(Locale.ROOT);
        return KINDS.contains(upper) ? upper : null;
    }

    static UUID uuid(Object raw) {
        String id = text(raw);
        if (id == null) {
            return null;
        }
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
