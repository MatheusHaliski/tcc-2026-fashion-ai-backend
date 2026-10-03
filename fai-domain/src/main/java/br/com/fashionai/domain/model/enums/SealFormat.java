package br.com.fashionai.domain.model.enums;

/**
 * Formato (silhueta) do selo — escolha de primeira classe do editor "Cadastrar novo selo" e do Copilot "Definir selo"
 * ({@code #createsealpolicy formato «circular|folha|fashion ai»} → {@code SealPolicy.aesthetics.format}).
 * <ul>
 *   <li>{@link #CIRCULAR} — medalhão circular, proporções do logo FashionAI (1:1);</li>
 *   <li>{@link #FOLHA} — silhueta de folha (4:5);</li>
 *   <li>{@link #FASHION_AI} — folha perfurada 4:5 com o emblema Fashion AI, a geometria dos SVGs de
 *       {@code docs/novo-projeto/insumos/selos/fashion-ai/}.</li>
 * </ul>
 */
public enum SealFormat {
    CIRCULAR,
    FOLHA,
    FASHION_AI
}
