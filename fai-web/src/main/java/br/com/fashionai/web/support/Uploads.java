package br.com.fashionai.web.support;

import br.com.fashionai.application.common.ApiException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Set;

/** Leitura segura de uploads de imagem (RF4.CA02): tipo permitido e arquivo não vazio. */
public final class Uploads {
    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/heic", "image/heif");

    private Uploads() {
    }

    public static byte[] image(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("ARQUIVO_VAZIO", "Envie uma imagem.");
        }
        String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        if (!IMAGE_TYPES.contains(type)) {
            throw ApiException.badRequest("FORMATO_NAO_SUPORTADO", "Use JPG, PNG, WEBP ou HEIC.", java.util.Map.of("contentType", type));
        }
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw ApiException.badRequest("ARQUIVO_ILEGIVEL", "Não foi possível ler o arquivo enviado.");
        }
    }

    public static List<byte[]> images(List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            throw ApiException.badRequest("ARQUIVO_VAZIO", "Envie ao menos uma imagem.");
        }
        return files.stream().map(Uploads::image).toList();
    }

    public static String mime(MultipartFile file) {
        return file == null || file.getContentType() == null ? "image/jpeg" : file.getContentType();
    }
}
