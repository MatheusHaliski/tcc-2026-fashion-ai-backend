package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.domain.model.enums.CatalogImageType;
import tools.jackson.databind.JsonNode;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.AccessDeniedException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Leitura dos pedidos do protocolo do {@link CatalogImageBatchCli}: campos texto, caminho absoluto, arquivo local com
 * o teto de bytes da API, vista declarada e candidatos do {@code rank}. Pedido inválido vira {@link Failure}.
 */
final class CatalogBatchInput {
    private CatalogBatchInput() {
    }

    /** Caminho absoluto do campo {@code path}. */
    static Path path(JsonNode req) {
        Path path;
        try {
            path = Path.of(text(req, "path", true));
        } catch (InvalidPathException e) {
            throw new Failure("BAD_REQUEST", "path inválido: " + e.getMessage());
        }
        if (!path.isAbsolute()) {
            throw new Failure("BAD_REQUEST", "path deve ser absoluto: " + path);
        }
        return path;
    }

    /** Lê o arquivo com o mesmo teto de bytes do download da API (ImageOps.MAX_UPLOAD_BYTES), sem passar dele. */
    static byte[] read(Path path) {
        try {
            if (!Files.isRegularFile(path)) {
                throw new Failure("FILE_NOT_FOUND", "arquivo não encontrado: " + path);
            }
            if (Files.size(path) > ImageOps.MAX_UPLOAD_BYTES) {
                throw new Failure("FILE_TOO_LARGE", "arquivo maior que " + ImageOps.MAX_UPLOAD_BYTES + " bytes: " + path);
            }
            try (InputStream in = Files.newInputStream(path)) {
                byte[] bytes = in.readNBytes((int) ImageOps.MAX_UPLOAD_BYTES + 1);
                if (bytes.length > ImageOps.MAX_UPLOAD_BYTES) {
                    throw new Failure("FILE_TOO_LARGE", "arquivo maior que " + ImageOps.MAX_UPLOAD_BYTES + " bytes: " + path);
                }
                return bytes;
            }
        } catch (NoSuchFileException | AccessDeniedException e) {
            throw new Failure("FILE_NOT_FOUND", "arquivo não encontrado ou sem permissão de leitura: " + path);
        } catch (IOException e) {
            throw new Failure("INTERNAL: " + e.getClass().getSimpleName() + ": " + e.getMessage(), null);
        }
    }

    /** Candidatos do {@code rank}: id único, outcome do validador, quality número e detailView booleano. */
    static List<ImageCandidateRanker.Candidate> candidates(JsonNode req) {
        JsonNode list = req.get("candidates");
        if (list == null || !list.isArray()) {
            throw new Failure("BAD_REQUEST", "candidates deve ser uma lista");
        }
        List<ImageCandidateRanker.Candidate> candidates = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (JsonNode c : list) {
            if (!c.isObject()) {
                throw new Failure("BAD_REQUEST", "cada candidato deve ser um objeto");
            }
            String cid = text(c, "id", true);
            if (!ids.add(cid)) {
                throw new Failure("BAD_REQUEST", "candidato repetido: " + cid);
            }
            CatalogImageValidator.Outcome outcome;
            try {
                outcome = CatalogImageValidator.Outcome.valueOf(text(c, "outcome", true).toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw new Failure("BAD_REQUEST", "outcome inválido em " + cid + " (APPROVED, NEEDS_REPROCESSING ou REJECTED)");
            }
            JsonNode q = c.get("quality");
            if (q != null && !q.isNull() && !q.isNumber()) {
                throw new Failure("BAD_REQUEST", "quality deve ser número em " + cid);
            }
            JsonNode detail = c.get("detailView");
            if (detail != null && !detail.isNull() && !detail.isBoolean()) {
                throw new Failure("BAD_REQUEST", "detailView deve ser booleano em " + cid);
            }
            candidates.add(new ImageCandidateRanker.Candidate(cid, imageType(text(c, "imageType", false)), outcome,
                    q == null || q.isNull() ? 0 : q.asDouble(), detail != null && detail.asBoolean(false), text(c, "phash", false)));
        }
        return candidates;
    }

    /** Vista declarada como o nome do enum do banco (CatalogImageType); vazia = sem vista. */
    static String imageType(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String t = raw.trim().toUpperCase(Locale.ROOT);
        try {
            return CatalogImageType.valueOf(t).name();
        } catch (IllegalArgumentException e) {
            throw new Failure("BAD_REQUEST", "imageType inválido: " + raw);
        }
    }

    /** Campo texto do pedido; obrigatório ausente ou de outro tipo = BAD_REQUEST. */
    static String text(JsonNode node, String field, boolean required) {
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) {
            if (required) {
                throw new Failure("BAD_REQUEST", "campo obrigatório ausente: " + field);
            }
            return null;
        }
        if (!v.isString()) {
            throw new Failure("BAD_REQUEST", "campo " + field + " deve ser texto");
        }
        String s = v.asString();
        if (required && s.isBlank()) {
            throw new Failure("BAD_REQUEST", "campo obrigatório vazio: " + field);
        }
        return s;
    }

    /** Falha esperada de um pedido: vira {@code ok:false} com o código do protocolo. */
    static final class Failure extends RuntimeException {
        final String code;

        Failure(String code, String message) {
            super(message, null, false, false);
            this.code = code;
        }
    }
}
