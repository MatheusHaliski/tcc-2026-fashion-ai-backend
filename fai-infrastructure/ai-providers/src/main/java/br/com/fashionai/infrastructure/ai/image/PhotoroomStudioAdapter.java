package br.com.fashionai.infrastructure.ai.image;

import br.com.fashionai.application.imaging.ImageProviderPorts.ProviderImage;
import br.com.fashionai.application.imaging.ImageProviderPorts.StudioShotPort;
import br.com.fashionai.infrastructure.ai.ProviderCircuit;
import br.com.fashionai.infrastructure.platform.Http;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Photoroom Image Editing API v2 (RF4 · estúdio): recebe o recorte e devolve a foto de produto com fundo na cor do
 * estúdio, reiluminação por IA ({@code lighting.mode=ai.auto}), sombra suave por IA ({@code shadow.mode=ai.soft}) e
 * enquadramento: margem pequena nos lados inteiros e, nos lados que a foto cortou, a peça encosta na borda
 * ({@code ignorePaddingAndSnapOnCroppedSides}), no quadro escolhido pelo estúdio (4:5, 1:1…).
 */
@Component
public class PhotoroomStudioAdapter implements StudioShotPort {
    private static final Logger log = LoggerFactory.getLogger(PhotoroomStudioAdapter.class);
    private static final String ID = "photoroom";
    private final RestClient client;
    private final String apiKey;

    public PhotoroomStudioAdapter(@Value("${fashionai.ai.photoroom-api-key:}") String apiKey) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.client = Http.client("https://image-api.photoroom.com", 60);
    }

    @Override
    public boolean available() {
        return ImageHttp.configured(apiKey) && ProviderCircuit.closed(ID);
    }

    @Override
    public Optional<ProviderImage> studio(byte[] cutoutPng, String backgroundHex, int width, int height, double padding) {
        long started = System.nanoTime();
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("background.color", backgroundHex.replace("#", ""));
        fields.put("lighting.mode", "ai.auto");
        fields.put("shadow.mode", "ai.soft");
        fields.put("padding", String.format(java.util.Locale.ROOT, "%.3f", padding));
        fields.put("ignorePaddingAndSnapOnCroppedSides", "true");
        fields.put("outputSize", width + "x" + height);
        fields.put("export.format", "jpeg");
        try {
            byte[] out = ProviderCircuit.run(ID, () -> client.post().uri("/v2/edit")
                    .header("x-api-key", apiKey)
                    .header("Accept", "image/*")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(ImageHttp.multipart("imageFile", cutoutPng, "image/png", fields))
                    .retrieve().body(byte[].class));
            return out == null || out.length == 0 ? Optional.empty()
                    : Optional.of(ImageHttp.result(out, "image/jpeg", ID, "0.1000", started, Map.of("background", backgroundHex)));
        } catch (Exception e) {
            log.warn("Photoroom indisponível: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
