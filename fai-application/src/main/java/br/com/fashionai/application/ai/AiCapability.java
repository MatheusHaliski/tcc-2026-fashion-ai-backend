package br.com.fashionai.application.ai;

import br.com.fashionai.domain.model.enums.ConsentPurpose;

/**
 * Os 19 sub-motores do motor transversal de IA (RF24_mapa_ia_completo.xlsx, sheet 1) mais a etapa
 * de padronização Flat Lay do RF4. Cada capacidade declara o RF hospedeiro — é lá que o CA é
 * verificado — e a finalidade LGPD que precisa estar consentida para o envio a terceiros (RF24.CA15).
 * Sem consentimento a capacidade degrada para o processamento local, nunca viola.
 */
public enum AiCapability {
    PIECE_ANALYZER(1, "Piece Analyzer", "RF4", ConsentPurpose.AI_EXTERNAL_PHOTO_PROCESSING, true),
    CONTENT_MODERATOR(2, "Content Moderator", "RF4", ConsentPurpose.AI_EXTERNAL_PHOTO_PROCESSING, true),
    SCHEME_COMPOSER(3, "Scheme Composer", "RF5", ConsentPurpose.AI_RECOMMENDATION, true),
    DNA_SYNTHESIZER(4, "DNA Synthesizer", "RF13", ConsentPurpose.AI_RECOMMENDATION, true),
    BACKGROUND_GENERATOR(5, "Background Generator", "RF11", null, true),
    SEALBOND_MATCHER(6, "SealBond Matcher", "RF20/RF21", null, true),
    STYLE_ADVISOR(7, "Style Advisor", "RF6", ConsentPurpose.AI_RECOMMENDATION, true),
    INSIGHT_GENERATOR(8, "Insight Generator", "RF26", null, true),
    BRAND_RESOLVER(9, "Brand Resolver", "RF4/RF5/RF13", null, true),
    COPILOT(10, "Copilot", "RF10", ConsentPurpose.AI_RECOMMENDATION, true),
    STYLE_INSIGHT(11, "StyleInsight / PatternAnalysis", "RF12", ConsentPurpose.HISTORY_FOR_RECOMMENDATION, true),
    EDIT_ASSISTANT(12, "Edit Assistant", "RF9", ConsentPurpose.AI_RECOMMENDATION, true),
    ACERVO_GROUPING(13, "Acervo Grouping AI", "RF6", null, true),
    AFFINITY(14, "Affinity AI", "RF8", ConsentPurpose.HISTORY_FOR_RECOMMENDATION, true),
    THREE_D_GENERATOR(15, "3D Generator (Meshy)", "RF16", ConsentPurpose.AI_EXTERNAL_PHOTO_PROCESSING, false),
    TRY_ON(16, "Try-on AI (FASHN.ai)", "RF18", ConsentPurpose.AI_EXTERNAL_PHOTO_PROCESSING, true),
    TRY_ON_POLISH(17, "Try-on Polish AI", "RF18", ConsentPurpose.AI_EXTERNAL_PHOTO_PROCESSING, true),
    CATEGORY_FALLBACK_COMPOSITOR(18, "Category Fallback Compositor", "RF18", null, true),
    PHOTO_CURATOR(19, "Photo Curator AI", "RF12", ConsentPurpose.HISTORY_FOR_RECOMMENDATION, true),
    FLAT_LAY_STANDARDIZER(20, "Flat Lay Standardizer (pipeline RF4)", "RF4", ConsentPurpose.AI_EXTERNAL_PHOTO_PROCESSING, true);

    private final int number;
    private final String officialName;
    private final String hostRf;
    private final ConsentPurpose consentPurpose;
    private final boolean inScope;

    AiCapability(int number, String officialName, String hostRf, ConsentPurpose consentPurpose, boolean inScope) {
        this.number = number;
        this.officialName = officialName;
        this.hostRf = hostRf;
        this.consentPurpose = consentPurpose;
        this.inScope = inScope;
    }

    public int number() {
        return number;
    }

    public String officialName() {
        return officialName;
    }

    public String hostRf() {
        return hostRf;
    }

    /** Finalidade LGPD exigida para usar o provedor externo; null = não trata dado pessoal (conteúdo ou agregado). */
    public ConsentPurpose consentPurpose() {
        return consentPurpose;
    }

    /** RF16 é tema futuro (confirmado 2026-09-22): fica atrás de feature flag. */
    public boolean inScope() {
        return inScope;
    }
}
