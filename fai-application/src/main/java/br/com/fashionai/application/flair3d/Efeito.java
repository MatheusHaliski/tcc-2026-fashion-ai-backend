package br.com.fashionai.application.flair3d;

/**
 * Um item do efeito de uma carta num núcleo (o selo da tela do deck): código e valor ("MARCA_BR", 10). Quando a carta não
 * pontua, o item é o motivo ({@code motivo} verdadeiro, valor zero): "MARCA_NAO_BR", "FORA_DA_FAMILIA", "SEM_BONUS"...
 */
public record Efeito(String codigo, double valor, boolean motivo) {
    public static final String SEM_BONUS = "SEM_BONUS";

    public Efeito(String codigo, double valor) {
        this(codigo, valor, false);
    }

    /** O motivo de a carta não pontuar neste núcleo (o selo cinza da tela). */
    public static Efeito motivo(String codigo) {
        return new Efeito(codigo, 0, true);
    }
}
