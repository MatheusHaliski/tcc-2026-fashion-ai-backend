package br.com.fashionai.application.multiplatform;

import java.util.List;
import java.util.Locale;

/**
 * MP-1 — Plataforma do cliente que chama a API (cabeçalho {@code X-FAI-Platform}). A conta, o avatar, o guarda-roupa
 * e o provador são os mesmos em todas; muda a forma de interagir e o que o aparelho consegue fazer.
 */
public enum ClientPlatform {
    IOS(Family.MOBILE, true, List.of("TOUCH")),
    IPADOS(Family.MOBILE, true, List.of("TOUCH", "KEYBOARD_MOUSE")),
    ANDROID(Family.MOBILE, true, List.of("TOUCH")),
    WINDOWS(Family.DESKTOP, false, List.of("KEYBOARD_MOUSE", "GAMEPAD")),
    MACOS(Family.DESKTOP, false, List.of("KEYBOARD_MOUSE")),
    PLAYSTATION(Family.CONSOLE, false, List.of("GAMEPAD")),
    XBOX(Family.CONSOLE, false, List.of("GAMEPAD")),
    WEB(Family.WEB, false, List.of("TOUCH", "KEYBOARD_MOUSE"));

    public enum Family { MOBILE, DESKTOP, CONSOLE, WEB }

    private final Family family;
    private final boolean camera;
    private final List<String> inputs;

    ClientPlatform(Family family, boolean camera, List<String> inputs) {
        this.family = family;
        this.camera = camera;
        this.inputs = inputs;
    }

    public Family family() {
        return family;
    }

    /** Câmera traseira/frontal disponível para fotos de corpo, rosto e peça. Console nunca (fluxo de continuação). */
    public boolean camera() {
        return camera;
    }

    /** Escolher foto da galeria do sistema: celulares e computadores. */
    public boolean photoLibrary() {
        return family != Family.CONSOLE;
    }

    /** Formulários longos (cadastro, edição de perfil, recorte de foto) feitos no próprio aparelho. */
    public boolean longForms() {
        return family != Family.CONSOLE;
    }

    /** Modos de entrada em ordem de prioridade. */
    public List<String> inputs() {
        return inputs;
    }

    /** Lê o cabeçalho; ausente ou desconhecido → WEB (o app web atual continua funcionando sem mudar nada). */
    public static ClientPlatform parse(String header) {
        if (header == null || header.isBlank()) {
            return WEB;
        }
        try {
            return valueOf(header.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return WEB;
        }
    }
}
