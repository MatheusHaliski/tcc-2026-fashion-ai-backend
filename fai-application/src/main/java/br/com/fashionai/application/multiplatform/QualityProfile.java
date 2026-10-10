package br.com.fashionai.application.multiplatform;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * MP-3 — Perfil de qualidade do cliente (cabeçalho {@code X-FAI-Quality}). Muda geometria, sombreamento e tamanho de
 * download; nunca muda a identidade do avatar (docs/multiplataforma/04-qualidade-desempenho-e-controles.md).
 * Os números são metas do plano, não medições.
 */
public enum QualityProfile {
    MOBILE_LOW(ClientPlatform.Family.MOBILE, 30, 2, "CARDS", false, 3_000_000L),
    MOBILE_HIGH(ClientPlatform.Family.MOBILE, 60, 1, "CARDS_DENSE", true, 3_000_000L),
    DESKTOP_MID(ClientPlatform.Family.DESKTOP, 60, 0, "STRANDS_LOD", true, 12_000_000L),
    DESKTOP_HIGH(ClientPlatform.Family.DESKTOP, 60, 0, "STRANDS", true, 12_000_000L),
    CONSOLE(ClientPlatform.Family.CONSOLE, 60, 0, "STRANDS_LOD", true, 12_000_000L),
    WEB(ClientPlatform.Family.WEB, 30, 1, "STRANDS_LOD", false, 6_000_000L);

    private final ClientPlatform.Family family;
    private final int targetFps;
    private final int avatarLod;
    private final String hair;
    private final boolean clothSimulation;
    private final long maxGarmentBytes;

    QualityProfile(ClientPlatform.Family family, int targetFps, int avatarLod, String hair, boolean clothSimulation, long maxGarmentBytes) {
        this.family = family;
        this.targetFps = targetFps;
        this.avatarLod = avatarLod;
        this.hair = hair;
        this.clothSimulation = clothSimulation;
        this.maxGarmentBytes = maxGarmentBytes;
    }

    public ClientPlatform.Family family() {
        return family;
    }

    public int targetFps() {
        return targetFps;
    }

    public int avatarLod() {
        return avatarLod;
    }

    /** Representação de cabelo, barba e bigode: muda a geometria, não a cor, o volume nem a silhueta. */
    public String hair() {
        return hair;
    }

    public boolean clothSimulation() {
        return clothSimulation;
    }

    public long maxGarmentBytes() {
        return maxGarmentBytes;
    }

    /** Perfis válidos para a família, do mais leve ao mais pesado. */
    public static List<QualityProfile> of(ClientPlatform.Family family) {
        return Arrays.stream(values()).filter(p -> p.family == family).toList();
    }

    /** Perfil pedido se for da família da plataforma; senão o mais leve da família (nunca sobe sem o cliente pedir). */
    public static QualityProfile resolve(ClientPlatform platform, String header) {
        List<QualityProfile> allowed = of(platform.family());
        if (header != null && !header.isBlank()) {
            try {
                QualityProfile asked = valueOf(header.trim().toUpperCase(Locale.ROOT));
                if (allowed.contains(asked)) {
                    return asked;
                }
            } catch (IllegalArgumentException ignored) {
                // perfil desconhecido: cai no padrão da família
            }
        }
        return allowed.get(0);
    }

    /** Ordem de queda quando um asset não tem o arquivo deste perfil: este, depois os mais leves da mesma família. */
    public List<QualityProfile> fallbackChain() {
        List<QualityProfile> same = of(family);
        return same.subList(0, same.indexOf(this) + 1).reversed();
    }
}
