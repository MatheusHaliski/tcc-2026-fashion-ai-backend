package br.com.fashionai.application.ai;

import br.com.fashionai.application.common.Msg;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Catálogo de provedores por capacidade (RF24): serviço primário, alternativa, fallback local, modalidade
 * de custo (G = gratuito/local, P = pago por uso, H = híbrido/free tier + excedente), custo estimado por
 * chamada, latência típica, cota diária por usuário e status de implementação.
 *
 * Preços de referência (USD, set/2026): Claude Opus 5 US$5/US$25 por MTok (entrada/saída); Claude Haiku 4.5
 * US$1/US$5; Gemini 2.5 Flash US$0,30/US$2,50 (com free tier); FASHN.ai ~US$0,075/imagem; remove.bg
 * ~US$0,20/imagem em créditos; Cloudinary free tier (25 créditos/mês); Replicate FLUX schnell ~US$0,003/imagem.
 * Custos por chamada são estimativas a partir do tamanho típico do prompt — o custo real sai do uso de
 * tokens devolvido pelo provedor e é gravado em ai_inference_log (RF24.CA16).
 */
public final class AiCatalog {
    public static final String CLAUDE_DEFAULT_MODEL = "claude-opus-5";
    public static final String CLAUDE_LIGHT_MODEL = "claude-haiku-4-5";
    public static final String GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

    public enum CostMode { G, P, H }

    public enum Kind { TEXT, VISION, IMAGE_GENERATION, IMAGE_PROCESSING, LOCAL, THREE_D }

    public record ProviderOption(String providerId, String service, String model, CostMode costMode,
                                 BigDecimal costPerCallUsd, String costNote, long typicalLatencyMs, String envKey,
                                 Kind kind) {
    }

    public record CapabilitySpec(AiCapability capability, String whatItDoes, ProviderOption primary,
                                 ProviderOption alternative, ProviderOption local, String fallbackBehavior,
                                 int dailyQuotaPerUser, int timeoutSeconds, String status, List<String> rnfs) {
    }

    private static final Map<AiCapability, CapabilitySpec> SPECS = new EnumMap<>(AiCapability.class);

    static {
        ProviderOption none = null;
        put(AiCapability.PIECE_ANALYZER,
                Msg.k("aiCatalog.detecta_e_classifica_a_peca"),
                gemini(Kind.VISION, "0.0012", Msg.k("aiCatalog.n1_3_mil_tokens_de"), 1500),
                claude(CLAUDE_LIGHT_MODEL, Kind.VISION, "0.0031", Msg.k("aiCatalog.claude_haiku_4_5_com"), 2200),
                local(Msg.k("aiCatalog.analise_local_k_means_de"), 120),
                Msg.k("aiCatalog.pre_preenche_so_o_que"),
                60, Msg.k("aiCatalog.implementado_gemini_vision_claude"));
        put(AiCapability.CONTENT_MODERATOR,
                Msg.k("aiCatalog.modera_a_foto_contra_a"),
                gemini(Kind.VISION, "0.0010", Msg.k("aiCatalog.classificacao_de_seguranca_e_peca"), 1200),
                claude(CLAUDE_LIGHT_MODEL, Kind.VISION, "0.0028", Msg.k("aiCatalog.claude_haiku_4_5_com_2"), 2000),
                local(Msg.k("aiCatalog.heuristica_local_resolucao_cobertura_do"), 60),
                Msg.k("aiCatalog.nunca_aprova_por_omissao_duvida"),
                200, Msg.k("aiCatalog.implementado_remoto_heuristica_local"));
        put(AiCapability.SCHEME_COMPOSER,
                Msg.k("aiCatalog.compoe_3_esquemas_a_partir"),
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0500", Msg.k("aiCatalog.n4_12_mil_tokens_acervo"), 8000),
                gemini(Kind.TEXT, "0.0042", Msg.k("aiCatalog.mesma_entrada_no_gemini_flash"), 2500),
                local(Msg.k("aiCatalog.composicao_por_regras_ocasiao_estilo"), 40),
                Msg.k("aiCatalog.composicao_por_regras_locais_aviso"),
                30, Msg.k("aiCatalog.implementado_claude_gemini_regras_locais"));
        put(AiCapability.DNA_SYNTHESIZER,
                Msg.k("aiCatalog.sintetiza_arquetipo_kibbe_indice_de"),
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0300", Msg.k("aiCatalog.n3_mil_tokens_600_de"), 6000),
                gemini(Kind.TEXT, "0.0025", Msg.k("aiCatalog.planilha_original_citava_gpt_4o"), 2000),
                local(Msg.k("aiCatalog.arquetipo_por_mapeamento_estilo_kibbe"), 30),
                Msg.k("aiCatalog.card_exibido_sem_a_frase"),
                10, Msg.k("aiCatalog.implementado_claude_gemini_sintese_local"));
        put(AiCapability.BACKGROUND_GENERATOR,
                Msg.k("aiCatalog.gera_a_arte_de_fundo"),
                option("firefly", Msg.k("aiCatalog.adobe_firefly_services"), "firefly-image-4", CostMode.H, "0.0400",
                        Msg.k("aiCatalog.assinatura_com_cota_excedente_estimado"), 6000, "FIREFLY_CLIENT_ID", Kind.IMAGE_GENERATION),
                option("replicate", Msg.k("aiCatalog.replicate_flux_schnell_sdxl"), "black-forest-labs/flux-schnell", CostMode.P, "0.0030",
                        Msg.k("aiCatalog.por_imagem_1024px_gemini_image"), 4000, "REPLICATE_API_TOKEN", Kind.IMAGE_GENERATION),
                local(Msg.k("aiCatalog.galeria_pre_gerada_presets_aura"), 20),
                Msg.k("aiCatalog.oferece_a_galeria_de_fundos"),
                20, Msg.k("aiCatalog.implementado_firefly_replicate_galeria"));
        put(AiCapability.SEALBOND_MATCHER,
                Msg.k("aiCatalog.sugere_ate_3_vinculos_de"),
                local(Msg.k("aiCatalog.similaridade_de_embeddings_local_marca"), 50),
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0300", Msg.k("aiCatalog.catalogo_de_marcas_celebridades_em"), 6000),
                local(Msg.k("aiCatalog.regra_de_marca_exata"), 5),
                Msg.k("aiCatalog.vinculo_manual_pelo_usuario_rf20"),
                50, Msg.k("aiCatalog.implementado_local_primario_claude"));
        put(AiCapability.STYLE_ADVISOR,
                Msg.k("aiCatalog.gera_dica_de_estilo_acionavel"),
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0080", Msg.k("aiCatalog.n800_tokens_150_de_saida"), 3000),
                gemini(Kind.TEXT, "0.0006", Msg.k("aiCatalog.gemini_flash"), 1200),
                local(Msg.k("aiCatalog.dica_por_regra_da_metrica"), 5),
                Msg.k("aiCatalog.dica_local_pela_metrica_mais"),
                20, Msg.k("aiCatalog.implementado_claude_gemini_regra_local"));
        put(AiCapability.INSIGHT_GENERATOR,
                Msg.k("aiCatalog.leitura_textual_curta_dos_rankings"),
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0150", Msg.k("aiCatalog.n1_5_mil_tokens_de"), 4000),
                gemini(Kind.TEXT, "0.0012", Msg.k("aiCatalog.gemini_flash"), 1500),
                local(Msg.k("aiCatalog.texto_por_template_a_partir"), 5),
                Msg.k("aiCatalog.rankings_exibidos_com_leitura_por"),
                20, Msg.k("aiCatalog.implementado_claude_gemini_template"));
        put(AiCapability.BRAND_RESOLVER,
                Msg.k("aiCatalog.audita_texto_candidato_a_marca"),
                local(Msg.k("aiCatalog.fuzzy_match_jaro_winkler_contra"), 10),
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0063", Msg.k("aiCatalog.validacao_marca_real_500_tokens"), 3000),
                local(Msg.k("aiCatalog.normalizacao_match_exato"), 2),
                Msg.k("aiCatalog.nunca_cria_brand_por_omissao"),
                30, Msg.k("aiCatalog.implementado_local_validacao_claude"));
        put(AiCapability.COPILOT,
                Msg.k("aiCatalog.recomendacoes_de_pecas_esquemas_a"),
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0375", Msg.k("aiCatalog.n3_5_mil_tokens_800"), 7000),
                gemini(Kind.TEXT, "0.0031", Msg.k("aiCatalog.gemini_flash"), 2500),
                local(Msg.k("aiCatalog.recomendacao_por_regras_clima"), 30),
                Msg.k("aiCatalog.recomendacao_por_regras_locais_rf10"),
                30, Msg.k("aiCatalog.implementado_claude_gemini_regras_locais"));
        put(AiCapability.STYLE_INSIGHT,
                Msg.k("aiCatalog.detecta_padroes_no_historico_cores"),
                local(Msg.k("aiCatalog.estatistica_local_sobre_o_historico"), 30),
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0100", Msg.k("aiCatalog.narrativa_opcional_dos_padroes"), 4000),
                local(Msg.k("aiCatalog.estatistica_local"), 30),
                Msg.k("aiCatalog.cronologia_sem_narrativa_textual"),
                20, Msg.k("aiCatalog.implementado_local_narrativa_claude"));
        put(AiCapability.EDIT_ASSISTANT,
                "\"Melhorar com IA\": propõe um diff estruturado (JSON validado) aceito ou recusado item a item.",
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0225", "≈2 mil tokens + 500; saída JSON validada", 5000),
                gemini(Kind.TEXT, "0.0019", Msg.k("aiCatalog.gemini_flash"), 2000),
                local(Msg.k("aiCatalog.parser_de_intencoes_por_palavras"), 5),
                Msg.k("aiCatalog.edicao_manual_sem_sugestao_nunca"),
                30, Msg.k("aiCatalog.implementado_claude_gemini_parser_local"));
        put(AiCapability.ACERVO_GROUPING,
                Msg.k("aiCatalog.agrupa_pecas_esquemas_do_proprio"),
                local(Msg.k("aiCatalog.embeddings_de_atributos_k_means"), 60),
                option("vertex", Msg.k("aiCatalog.vertex_ai_matching_engine"), "—", CostMode.P, "0.0000",
                        Msg.k("aiCatalog.alternativa_da_planilha_nao_implementada"), 0, "—", Kind.TEXT),
                local(Msg.k("aiCatalog.sem_agrupamento"), 1),
                Msg.k("aiCatalog.exibe_o_acervo_sem_agrupamento"),
                100, Msg.k("aiCatalog.implementado_local"));
        put(AiCapability.AFFINITY,
                Msg.k("aiCatalog.ordena_o_feed_de_marcas"),
                local(Msg.k("aiCatalog.cosseno_entre_centroide_do_usuario"), 20),
                none,
                local(Msg.k("aiCatalog.ordena_por_mais_recentes"), 1),
                Msg.k("aiCatalog.sem_embeddings_suficientes_ordena_por"),
                200, Msg.k("aiCatalog.implementado_local"));
        put(AiCapability.THREE_D_GENERATOR,
                Msg.k("aiCatalog.gera_o_modelo_3d_glb"),
                option("meshy", Msg.k("aiCatalog.meshy_image_to_3d"), "meshy-5", CostMode.P, "0.4000",
                        Msg.k("aiCatalog.n20_creditos_por_modelo_com"), 120000, "MESHY_API_KEY", Kind.THREE_D),
                option("stability-sf3d", Msg.k("aiCatalog.stability_ai_stable_fast_3d"), "stable-fast-3d", CostMode.P, "0.1000",
                        Msg.k("aiCatalog.n10_creditos_por_modelo_poucos"), 8000, "STABILITY_API_KEY", Kind.THREE_D),
                local(Msg.k("aiCatalog.relevo_inflado_local_silhueta_do"), 400),
                Msg.k("aiCatalog.sem_provedor_ou_com_falha"),
                3, Msg.k("aiCatalog.implementado_meshy_assincrono_stable"));
        put(AiCapability.TRY_ON,
                Msg.k("aiCatalog.sobrepoe_os_slots_top_bottom"),
                option("fashn", "FASHN.ai", "tryon-v1.6", CostMode.P, "0.0750",
                        Msg.k("aiCatalog.por_geracao_rfc_estima_us"), 5000, "FASHN_API_KEY", Kind.IMAGE_PROCESSING),
                option("replicate", Msg.k("aiCatalog.idm_vton_via_replicate"), "cuuupid/idm-vton", CostMode.P, "0.0300",
                        Msg.k("aiCatalog.por_geracao_em_gpu_a40"), 9000, "REPLICATE_API_TOKEN", Kind.IMAGE_PROCESSING),
                local(Msg.k("aiCatalog.sobreposicao_aproximada_por_camadas_e"), 150),
                Msg.k("aiCatalog.sobreposicao_aproximada_com_aviso_rf18"),
                15, Msg.k("aiCatalog.implementado_fashn_ai_compositor_local"));
        put(AiCapability.TRY_ON_POLISH,
                Msg.k("aiCatalog.corrige_costuras_bordas_e_cor"),
                option("cleanup", Msg.k("aiCatalog.cleanup_pictures_api"), "cleanup-hd", CostMode.P, "0.0200",
                        "por imagem", 1500, "CLEANUP_API_KEY", Kind.IMAGE_PROCESSING),
                option("replicate", Msg.k("aiCatalog.real_esrgan_via_replicate"), "nightmareai/real-esrgan", CostMode.P, "0.0020",
                        "por imagem", 3000, "REPLICATE_API_TOKEN", Kind.IMAGE_PROCESSING),
                local(Msg.k("aiCatalog.suavizacao_de_borda_feather_casamento"), 60),
                Msg.k("aiCatalog.mantem_a_saida_bruta_so"),
                15, Msg.k("aiCatalog.implementado_cleanup_polimento_local"));
        put(AiCapability.CATEGORY_FALLBACK_COMPOSITOR,
                Msg.k("aiCatalog.posiciona_calcados_e_acessorios_rigidos"),
                local(Msg.k("aiCatalog.tabela_de_landmarks_pe_perna"), 40),
                none,
                local(Msg.k("aiCatalog.slot_sem_overlay"), 1),
                Msg.k("aiCatalog.slot_fica_sem_overlay_o"),
                500, Msg.k("aiCatalog.implementado_local"));
        put(AiCapability.PHOTO_CURATOR,
                Msg.k("aiCatalog.aba_para_voce_4_carrosseis"),
                local(Msg.k("aiCatalog.heuristica_local_embeddings_do_acervo"), 40),
                none,
                local(Msg.k("aiCatalog.grade_cronologica"), 1),
                Msg.k("aiCatalog.cai_no_modo_grade_padrao"),
                100, Msg.k("aiCatalog.implementado_local"));
        put(AiCapability.FLAT_LAY_STANDARDIZER,
                Msg.k("aiCatalog.pipeline_hibrido_flat_lay_remocao"),
                option("rembg", Msg.k("aiCatalog.rembg_auto_hospedado_onnx_u2net"), "u2net", CostMode.G, "0.0000",
                        Msg.k("aiCatalog.self_hosted_rfc_us_0"), 600, "REMBG_URL", Kind.IMAGE_PROCESSING),
                option("removebg", Msg.k("aiCatalog.remove_bg_api"), "remove.bg", CostMode.P, "0.2000",
                        Msg.k("aiCatalog.por_imagem_em_creditos_alternativa"), 1500, "REMOVE_BG_API_KEY", Kind.IMAGE_PROCESSING),
                local(Msg.k("aiCatalog.java2d_flood_fill_de_borda"), 450),
                Msg.k("aiCatalog.salva_com_a_foto_original"),
                60, Msg.k("aiCatalog.implementado_rembg_remove_bg_cloudinary"));
        put(AiCapability.STUDIO_ENHANCER,
                Msg.k("aiCatalog.depois_do_flat_lay_leva"),
                option("photoroom", Msg.k("aiCatalog.photoroom_image_editing_api_fundo"), "photoroom-v2-edit", CostMode.P, "0.1000",
                        Msg.k("aiCatalog.por_imagem_plano_plus_2"), 5000, "PHOTOROOM_API_KEY", Kind.IMAGE_PROCESSING),
                option("stability-upscale", Msg.k("aiCatalog.stability_ai_upscale_fast_4"), "stable-upscale-fast", CostMode.P, "0.0200",
                        Msg.k("aiCatalog.n2_creditos_por_imagem_1"), 2500, "STABILITY_API_KEY", Kind.IMAGE_PROCESSING),
                local(Msg.k("aiCatalog.java2d_bicubica_progressiva_clarity"), 900),
                Msg.k("aiCatalog.sem_provedor_o_estudio_local"),
                200, Msg.k("aiCatalog.implementado_photoroom_stability"));
        put(AiCapability.BRAND_LOGO_FINDER,
                Msg.k("aiCatalog.procura_na_internet_o_logo"),
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0350", Msg.k("aiCatalog.ate_3_buscas_na_web"), 15000),
                null,
                local(Msg.k("aiCatalog.monograma_svg_com_as_iniciais"), 5),
                Msg.k("aiCatalog.sem_logo_confiavel_a_interface"),
                200, Msg.k("aiCatalog.implementado_wikidata_claude_com_busca"));
    }

    private AiCatalog() {
    }

    public static CapabilitySpec spec(AiCapability capability) {
        return SPECS.get(capability);
    }

    public static Collection<CapabilitySpec> all() {
        return SPECS.values();
    }

    private static void put(AiCapability cap, String what, ProviderOption primary, ProviderOption alternative,
                            ProviderOption local, String fallback, int quota, String status) {
        SPECS.put(cap, new CapabilitySpec(cap, what, primary, alternative, local, fallback, quota, 30, status,
                List.of(Msg.t("aiCatalog.rnf5_registro_da_inferencia"), Msg.t("aiCatalog.rnf6_consentimento_transparencia"), Msg.t("aiCatalog.rnf8_timeout_30_s_fallback"))));
    }

    /**
     * Mesmo id com que o adaptador do Claude se registra ({@code ClaudeProvider.ID = "claude"}): com "anthropic" aqui o
     * motor não achava o provedor e nenhuma capacidade chegava a chamar o Claude (caía direto no local).
     */
    static final String CLAUDE_PROVIDER_ID = "claude";

    static ProviderOption claude(String model, Kind kind, String cost, String note, long latency) {
        return new ProviderOption(CLAUDE_PROVIDER_ID, Msg.t("aiCatalog.claude_anthropic_api"), model, CostMode.P, new BigDecimal(cost), note,
                latency, "ANTHROPIC_API_KEY", kind);
    }

    static ProviderOption gemini(Kind kind, String cost, String note, long latency) {
        return new ProviderOption("gemini", Msg.t("aiCatalog.google_gemini_flash"), GEMINI_DEFAULT_MODEL, CostMode.H, new BigDecimal(cost),
                Msg.t("aiCatalog.free_tier_cobre_a_demonstracao", (note)), latency, "GEMINI_API_KEY", kind);
    }

    static ProviderOption local(String description, long latency) {
        return new ProviderOption("local", description, "local", CostMode.G, BigDecimal.ZERO, Msg.t("aiCatalog.processado_no_backend"),
                latency, "—", Kind.LOCAL);
    }

    static ProviderOption option(String id, String service, String model, CostMode mode, String cost, String note,
                                 long latency, String env, Kind kind) {
        return new ProviderOption(id, service, model, mode, new BigDecimal(cost), note, latency, env, kind);
    }

    /** Custo estimado pelo uso real de tokens (preço por MTok do modelo). */
    public static BigDecimal tokenCost(String model, long inputTokens, long outputTokens) {
        double in;
        double out;
        String m = model == null ? "" : model;
        if (m.startsWith("claude-haiku")) {
            in = 1.0;
            out = 5.0;
        } else if (m.startsWith("claude-sonnet")) {
            in = 2.0;
            out = 10.0;
        } else if (m.startsWith("claude-opus-5-5")) {
            in = 4.0;
            out = 20.0;
        } else if (m.startsWith("claude")) {
            in = 5.0;
            out = 25.0;
        } else if (m.startsWith("gemini")) {
            in = 0.30;
            out = 2.50;
        } else {
            return BigDecimal.ZERO;
        }
        double usd = inputTokens / 1_000_000.0 * in + outputTokens / 1_000_000.0 * out;
        return BigDecimal.valueOf(usd).setScale(6, java.math.RoundingMode.HALF_UP);
    }
}
