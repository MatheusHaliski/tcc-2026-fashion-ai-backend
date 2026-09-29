package br.com.fashionai.application.ai;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.enums.ConsentPurpose;

/**
 * Os 19 sub-motores do motor transversal de IA (RF24_mapa_ia_completo.xlsx, sheet 1) mais a etapa
 * de padronização Flat Lay do RF4. Cada capacidade declara o RF hospedeiro — é lá que o CA é
 * verificado — e a finalidade LGPD que precisa estar consentida para o envio a terceiros (RF24.CA15).
 * Sem consentimento a capacidade degrada para o processamento local, nunca viola.
 */
public enum AiCapability {
    PIECE_ANALYZER(1, Msg.k("aiCapability.piece_analyzer"), "RF4", ConsentPurpose.AI_EXTERNAL_PHOTO_PROCESSING, true),
    CONTENT_MODERATOR(2, Msg.k("aiCapability.content_moderator"), "RF4", ConsentPurpose.AI_EXTERNAL_PHOTO_PROCESSING, true),
    SCHEME_COMPOSER(3, Msg.k("aiCapability.scheme_composer"), "RF5", ConsentPurpose.AI_RECOMMENDATION, true),
    DNA_SYNTHESIZER(4, Msg.k("aiCapability.dna_synthesizer"), "RF13", ConsentPurpose.AI_RECOMMENDATION, true),
    BACKGROUND_GENERATOR(5, Msg.k("aiCapability.background_generator"), "RF11", null, true),
    SEALBOND_MATCHER(6, Msg.k("aiCapability.sealbond_matcher"), "RF20/RF21", null, true),
    STYLE_ADVISOR(7, Msg.k("aiCapability.style_advisor"), "RF6", ConsentPurpose.AI_RECOMMENDATION, true),
    INSIGHT_GENERATOR(8, Msg.k("aiCapability.insight_generator"), "RF26", null, true),
    BRAND_RESOLVER(9, Msg.k("aiCapability.brand_resolver"), "RF4/RF5/RF13", null, true),
    COPILOT(10, "Copilot", "RF10", ConsentPurpose.AI_RECOMMENDATION, true),
    STYLE_INSIGHT(11, Msg.k("aiCapability.styleinsight_patternanalysis"), "RF12", ConsentPurpose.HISTORY_FOR_RECOMMENDATION, true),
    EDIT_ASSISTANT(12, Msg.k("aiCapability.edit_assistant"), "RF9", ConsentPurpose.AI_RECOMMENDATION, true),
    ACERVO_GROUPING(13, Msg.k("aiCapability.acervo_grouping_ai"), "RF6", null, true),
    AFFINITY(14, Msg.k("aiCapability.affinity_ai"), "RF8", ConsentPurpose.HISTORY_FOR_RECOMMENDATION, true),
    THREE_D_GENERATOR(15, Msg.k("aiCapability.n3d_generator_meshy_stable_fast"), "RF16", ConsentPurpose.AI_EXTERNAL_PHOTO_PROCESSING, true),
    TRY_ON(16, Msg.k("aiCapability.try_on_ai_fashn_ai"), "RF18", ConsentPurpose.AI_EXTERNAL_PHOTO_PROCESSING, true),
    TRY_ON_POLISH(17, Msg.k("aiCapability.try_on_polish_ai"), "RF18", ConsentPurpose.AI_EXTERNAL_PHOTO_PROCESSING, true),
    CATEGORY_FALLBACK_COMPOSITOR(18, Msg.k("aiCapability.category_fallback_compositor"), "RF18", null, true),
    PHOTO_CURATOR(19, Msg.k("aiCapability.photo_curator_ai"), "RF12", ConsentPurpose.HISTORY_FOR_RECOMMENDATION, true),
    FLAT_LAY_STANDARDIZER(20, Msg.k("aiCapability.flat_lay_standardizer_pipeline_rf4"), "RF4", ConsentPurpose.AI_EXTERNAL_PHOTO_PROCESSING, true),
    BRAND_LOGO_FINDER(21, Msg.k("aiCapability.brand_logo_finder_busca_na"), "RF4/RF14/RF26", null, true),
    STUDIO_ENHANCER(22, Msg.k("aiCapability.studio_enhancer_foto_de_estudio"), "RF4", ConsentPurpose.AI_EXTERNAL_PHOTO_PROCESSING, true),
    MULTI_PIECE_DETECTOR(23, Msg.k("aiCapability.multi_piece_detector"), "RF4", ConsentPurpose.AI_EXTERNAL_PHOTO_PROCESSING, true),
    PIECE_IMAGE_RECREATOR(24, Msg.k("aiCapability.piece_image_recreator"), "RF4", ConsentPurpose.AI_EXTERNAL_PHOTO_PROCESSING, true);

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
