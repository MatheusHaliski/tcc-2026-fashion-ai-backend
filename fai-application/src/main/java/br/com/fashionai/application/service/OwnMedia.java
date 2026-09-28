package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ports.MediaStoragePort;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * URLs de mídia informadas pelo cliente em campos livres (foto do provador, capa de agrupamento, ícone de selo, logo da
 * marca na peça): só valem arquivos emitidos pelo nosso storage que sejam do próprio usuário ({@code users/<id>/…}) ou
 * de catálogo público do sistema. Nunca {@code restricted/} (documentos, rosto do avatar, fotos privadas), nunca
 * arquivo de outra pessoa e nunca link de terceiros (hotlink/rastreamento).
 */
@Component
public class OwnMedia {
    /** Prefixos de catálogo público, gerados pelo próprio sistema. */
    static final List<String> CATALOG = List.of("assets/", "brands/logos/");

    private final MediaStoragePort storage;

    public OwnMedia(MediaStoragePort storage) {
        this.storage = storage;
    }

    /** A URL é do próprio usuário (ou do catálogo, quando {@code allowCatalog})? */
    public boolean accepts(UUID ownerId, String url, boolean allowCatalog) {
        if (ownerId == null || url == null || url.isBlank()) {
            return false;
        }
        Optional<String> key = storage.keyOf(url.trim());
        return key.isPresent() && acceptsKey(ownerId, key.get(), allowCatalog);
    }

    /**
     * Valida o campo: vazio → null; URL aceita → a própria URL (sem espaços); qualquer outra coisa → 400.
     */
    public String require(UUID ownerId, String url, String field, boolean allowCatalog) {
        if (url == null || url.isBlank()) {
            return null;
        }
        if (!accepts(ownerId, url, allowCatalog)) {
            throw ApiException.badRequest("MIDIA_INVALIDA", Msg.t("ownMedia.use_uma_imagem_enviada_por_voce"), Map.of("field", field));
        }
        return url.trim();
    }

    /**
     * Como {@link #require}, mas o valor que o registro já tem, reenviado sem mudança, passa (formulários que mandam o
     * objeto inteiro a cada salvamento não quebram por dados gravados antes desta regra).
     */
    public String requireOrUnchanged(UUID ownerId, String url, String field, boolean allowCatalog, String current) {
        if (url != null && current != null && url.trim().equals(current)) {
            return current;
        }
        return require(ownerId, url, field, allowCatalog);
    }

    static boolean acceptsKey(UUID ownerId, String key, boolean allowCatalog) {
        String k = key.startsWith("/") ? key.substring(1) : key;
        // nada de travessia, barras duplas, barra invertida ou query (a chave precisa ser exatamente a do arquivo)
        if (k.isEmpty() || k.contains("..") || k.contains("//") || k.contains("\\") || k.contains("?") || k.contains("#")
                || k.contains("%") || k.startsWith("restricted/")) {
            return false;
        }
        if (k.startsWith("users/" + ownerId + "/")) {
            return true;
        }
        return allowCatalog && CATALOG.stream().anyMatch(k::startsWith);
    }
}
