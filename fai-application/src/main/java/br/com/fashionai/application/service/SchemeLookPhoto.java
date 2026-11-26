package br.com.fashionai.application.service;

import java.awt.image.BufferedImage;
import java.util.List;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageOps;

/**
 * RF5 — a foto do conjunto, enviada como a foto de um post: formato aceito, ao menos 400×400 px, proporção de post
 * (entre 1:2 e 2:1) e no máximo 1600 px de lado. Puro; gravar, registrar na moderação e ligar ao look fica no
 * {@link SchemeService}. Extraído do SchemeService.
 */
final class SchemeLookPhoto {
    /** As etapas que a foto do look percorre, mostradas na tela depois do envio. */
    static final List<String> PIPELINE = List.of(Msg.k("scheme.formato_validado_jpeg_png_webp"), Msg.k("scheme.tamanho_minimo_400_400_px"),
            Msg.k("scheme.proporcao_de_post_entre_1"), Msg.k("scheme.redimensionada_para_no_maximo_1600"), Msg.k("scheme.metadados_removidos_exif_gps"),
            Msg.k("scheme.registrada_na_moderacao_de_midia"), Msg.k("scheme.filtros_aplicados_na_exibicao_sem"));

    private SchemeLookPhoto() {
    }

    /** A foto validada e redimensionada (o reencode em JPEG, sem metadados, é de quem grava). */
    static BufferedImage normalized(byte[] bytes) {
        ImageOps.requireAcceptedImage(bytes);
        BufferedImage img = ImageOps.decode(bytes);
        if (img.getWidth() < 400 || img.getHeight() < 400) {
            throw ApiException.badRequest("IMAGEM_PEQUENA", Msg.t("scheme.a_foto_do_look_precisa"));
        }
        double ratio = img.getWidth() / (double) img.getHeight();
        if (ratio > 2.0 || ratio < 0.5) {
            throw ApiException.badRequest("PROPORCAO_INVALIDA", Msg.t("scheme.use_uma_foto_com_proporcao"));
        }
        return ImageOps.scaleToFit(img, 1600, 1600);
    }
}
