package br.com.fashionai.application.ports;

import java.time.Duration;

/**
 * RF47 · Download transitório de uma foto oficial (pipeline de imagens do catálogo). Diferente do {@link WebFetchPort}:
 * o endereço resolvido no DNS é FIXADO na conexão (sem janela de DNS rebinding), DNS que falha recusa (fail-closed),
 * o prazo vale para a resposta inteira (não só os cabeçalhos), o tipo declarado e os bytes mágicos precisam ser
 * JPEG/PNG/WebP e cada redirecionamento é reavaliado. Os bytes vivem só em memória: quem decide guardar é o gate de
 * licença ({@code ImageRightsPolicy}).
 */
public interface OfficialImageFetchPort {

    /** Limites por download. */
    record Limits(int maxBytes, int maxRedirects, Duration totalTimeout, String userAgent) {
        public static final Limits DEFAULT = new Limits(25 * 1024 * 1024, 3, Duration.ofSeconds(20),
                "FashionAI-CatalogImageBot/2.0 (+https://fashion-ai.app/catalog-bot)");
    }

    enum Status {
        OK,
        /** URL malformada, esquema ≠ https, porta ≠ 443, userinfo, host vazio ou IP literal */
        REJECTED_URL,
        /** host interno (localhost, .local, .internal…) ou fora da política da fonte */
        REJECTED_HOST,
        /** algum endereço do DNS é privado/reservado, ou o DNS falhou */
        REJECTED_ADDRESS,
        TOO_MANY_REDIRECTS,
        HTTP_ERROR,
        TIMEOUT,
        TOO_LARGE,
        /** Content-Type ausente ou fora de image/jpeg, image/png, image/webp */
        BAD_CONTENT_TYPE,
        /** bytes mágicos não batem com JPEG/PNG/WebP (ou com o tipo declarado) */
        MAGIC_MISMATCH,
        IO_ERROR,
        DISABLED
    }

    /**
     * @param finalUrl  URL depois dos redirecionamentos · @param mime tipo detectado pelos bytes mágicos
     * @param httpStatus status HTTP da última resposta (0 se não houve)
     */
    record Result(Status status, String finalUrl, String mime, byte[] body, int redirects, int httpStatus, long millis,
                  String detail) {
        public boolean ok() {
            return status == Status.OK;
        }
    }

    Result fetch(String url, Limits limits);
}
