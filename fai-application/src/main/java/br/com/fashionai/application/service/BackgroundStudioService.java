package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.ImageProviderPorts;
import br.com.fashionai.application.imaging.SchemeCardRenderer;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.AssetPreset;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.BackgroundAnimation;
import br.com.fashionai.domain.model.enums.ContainerOrigin;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.domain.repository.AssetPresetRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.image.BufferedImage;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * RF11 — Background Studio (etapa 4 do Criar Look): 4.1 arte do esquema (1 · Cor & Gradiente, 2 · Arte com AI)
 * e 4.2 arte das peças (3 · Background das peças). Os três modos coexistem e nada grava sozinho — o estado só
 * é persistido no "salvar" do modal. Inclui skins recomendados (/public/presets_recomendados), presets AURA,
 * materiais, combinações e mosaicos, Direção recomendada com container travado (auto + obrigatório) e o
 * efeito passe-partout.
 */
@Service
public class BackgroundStudioService {
    /** anatomias_card_v17: 3 anatomias base (Seção A) + 10 variações oficiais (Seção B). */
    public static final List<String> ANATOMIES = List.of("LISTA_VERTICAL", "GRADE_PECAS", "HERO_LISTA", "PASSARELA", "ETIQUETA",
            "RAIO_X", "BENTO", "ESPECTRO", "CUSTO_POR_USO", "SILHUETA_PROPORCAO", "HYPE_FOCUS", "CARTELA_SAZONAL", "LEGO");
    /** Versão por peça (Seção C): 7 das 10 variações. */
    public static final List<String> PIECE_ANATOMIES = List.of("PECA_AMPLIADO", "PASSARELA", "ETIQUETA", "RAIO_X", "BENTO",
            "ESPECTRO", "CUSTO_POR_USO", "LEGO");
    /**
     * Posição do selo por anatomia (docs/anatomias/anatomias_card_v17_1.html). Zonas: TITLE_ROW (linha "Título · selos ·
     * preço"), META_BLOCK (bloco "Selos · descrição · estilo"), COVER_CORNER (canto da capa/arte própria), HEADER
     * (cabeçalho do card-objeto, ao lado do label PREMIUM), STUDS (placas redondas 1×1 do LEGO). pieceRows indica que
     * cada linha/célula de peça também leva selo ("marca · nome · selos · preço"). O medalhão tem o tamanho do logo
     * FashionAI (44 px no card do look, 36 px no da peça); source diz se a posição está escrita na anatomia ou foi
     * derivada da estrutura da prancha (quando a prancha não traz a linha de selos).
     */
    public static final Map<String, Map<String, Object>> SEAL_PLACEMENT = new LinkedHashMap<>();
    public static final Map<String, Map<String, Object>> PIECE_SEAL_PLACEMENT = new LinkedHashMap<>();

    static {
        seal(SEAL_PLACEMENT, "LISTA_VERTICAL", "TITLE_ROW", true, "anatomia", Msg.k("backgroundStudio.linha_titulo_selos_preco_abaixo"));
        seal(SEAL_PLACEMENT, "GRADE_PECAS", "TITLE_ROW", true, "anatomia", Msg.k("backgroundStudio.linha_do_titulo_cada_celula"));
        seal(SEAL_PLACEMENT, "HERO_LISTA", "TITLE_ROW", true, "anatomia", Msg.k("backgroundStudio.linha_do_titulo_abaixo_do"));
        seal(SEAL_PLACEMENT, "PASSARELA", "COVER_CORNER", false, "derivada", Msg.k("backgroundStudio.canto_superior_direito_da_capa"));
        seal(SEAL_PLACEMENT, "ETIQUETA", "TITLE_ROW", false, "anatomia", Msg.k("backgroundStudio.linha_titulo_selos_preco_descricao"));
        seal(SEAL_PLACEMENT, "RAIO_X", "COVER_CORNER", false, "derivada", Msg.k("backgroundStudio.sobre_a_foto_do_scanner"));
        seal(SEAL_PLACEMENT, "BENTO", "META_BLOCK", false, "anatomia", Msg.k("backgroundStudio.bloco_selos_descricao_estilo_abaixo"));
        seal(SEAL_PLACEMENT, "ESPECTRO", "TITLE_ROW", false, "anatomia", Msg.k("backgroundStudio.linha_titulo_selos_preco_acima"));
        seal(SEAL_PLACEMENT, "CUSTO_POR_USO", "HEADER", false, "derivada", Msg.k("backgroundStudio.cabecalho_fashionai_valor_de_uso"));
        seal(SEAL_PLACEMENT, "SILHUETA_PROPORCAO", "TITLE_ROW", false, "derivada", Msg.k("backgroundStudio.linha_do_nome_da_silhueta"));
        seal(SEAL_PLACEMENT, "HYPE_FOCUS", "HEADER", false, "derivada", Msg.k("backgroundStudio.ao_lado_do_medidor_peca"));
        seal(SEAL_PLACEMENT, "CARTELA_SAZONAL", "COVER_CORNER", false, "derivada", Msg.k("backgroundStudio.canto_superior_direito_do_hero"));
        seal(SEAL_PLACEMENT, "LEGO", "STUDS", false, "anatomia", Msg.k("backgroundStudio.placas_redondas_1_1_no"));
        seal(PIECE_SEAL_PLACEMENT, "PECA_AMPLIADO", "META_BLOCK", false, "anatomia", Msg.k("backgroundStudio.linha_categoria_marca_sexo_selos"));
        seal(PIECE_SEAL_PLACEMENT, "PASSARELA", "COVER_CORNER", false, "derivada", Msg.k("backgroundStudio.canto_da_capa_oposto_ao"));
        seal(PIECE_SEAL_PLACEMENT, "ETIQUETA", "HEADER", false, "derivada", Msg.k("backgroundStudio.ao_lado_do_label_fashion"));
        seal(PIECE_SEAL_PLACEMENT, "RAIO_X", "COVER_CORNER", false, "derivada", Msg.k("backgroundStudio.sobre_a_foto_canto_oposto"));
        seal(PIECE_SEAL_PLACEMENT, "BENTO", "META_BLOCK", false, "derivada", Msg.k("backgroundStudio.bloco_atributos_a_grade_da"));
        seal(PIECE_SEAL_PLACEMENT, "ESPECTRO", "TITLE_ROW", false, "anatomia", Msg.k("backgroundStudio.linha_titulo_selos_preco_acima_2"));
        seal(PIECE_SEAL_PLACEMENT, "CUSTO_POR_USO", "HEADER", false, "derivada", Msg.k("backgroundStudio.cabecalho_ao_lado_do_label"));
        seal(PIECE_SEAL_PLACEMENT, "LEGO", "STUDS", false, "anatomia", Msg.k("backgroundStudio.placa_redonda_1_1_ao"));
    }

    private static void seal(Map<String, Map<String, Object>> target, String anatomy, String zone, boolean pieceRows, String source,
                             String description) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("anatomy", anatomy);
        m.put("zone", zone);
        m.put("pieceRows", pieceRows);
        m.put("size", target == PIECE_SEAL_PLACEMENT ? 36 : 44);
        m.put("maxVisible", "STUDS".equals(zone) ? 4 : 3);
        m.put("source", source);
        m.put("description", description);
        target.put(anatomy, m);
    }

    /** RF11 §7.6 — formato do Preset Aura + material. */
    public static final List<String> AURA_FORMATS = List.of("IMAGEM_UNICA", "MOSAICO");

    /** As quatro direções visuais do RF11 (Recommendation) — cada uma re-renderiza os wearstyles no seu estilo. */
    public static final Map<String, Map<String, Object>> DIRECTIONS = new LinkedHashMap<>();

    static {
        DIRECTIONS.put("EDITORIAL_SPREAD", Map.of("label", Msg.k("backgroundStudio.editorial_spread"), "skin", "editorial_ivory",
                "aura", "aura_editorial_mono__estudio", "material", "linho_natural", "wearstyles", "sublinhados",
                "styles", List.of("classic", "minimalist", "chic", "tailored", "preppy", "modern")));
        DIRECTIONS.put("LUXURY_GLASS", Map.of("label", Msg.k("backgroundStudio.luxury_glass"), "skin", "luxury_glass_warm",
                "aura", "aura_glam_noite__palco", "material", "cetim_liquido", "wearstyles", Msg.k("backgroundStudio.pilula_dourada"),
                "styles", List.of("luxury", "glam", "statement", "avant_garde", "futuristic")));
        DIRECTIONS.put("ATELIER", Map.of("label", "Atelier", "skin", "atelier_terracotta",
                "aura", "aura_boemio_terracota__dunas_douradas", "material", "couro_nappa", "wearstyles", "etiquetas tracejadas",
                "styles", List.of("boho", "vintage", "romantic", "resort", "utility", "grunge")));
        DIRECTIONS.put("SHOW_NOTES", Map.of("label", Msg.k("backgroundStudio.show_notes"), "skin", "show_notes",
                "aura", "aura_streetwear_neon__circuitos", "material", "nylon_ripstop", "wearstyles", "numerados",
                "styles", List.of("streetwear", "sporty", "athleisure", "techwear", "urban", "y2k", "edgy", "basic")));
    }

    private final AssetCatalogService assets;
    private final AssetPresetRepository presets;
    private final SchemeRepository schemes;
    private final WardrobeItemRepository pieces;
    private final UserRepository users;
    private final CelebrityProfileRepository celebrities;
    private final List<ImageProviderPorts.ImageGenerationPort> generators;
    private final AiEngine ai;
    private final MediaService media;
    private final Guard guard;

    public BackgroundStudioService(AssetCatalogService assets, AssetPresetRepository presets, SchemeRepository schemes,
                                   WardrobeItemRepository pieces, UserRepository users, CelebrityProfileRepository celebrities,
                                   List<ImageProviderPorts.ImageGenerationPort> generators, AiEngine ai, MediaService media,
                                   Guard guard) {
        this.assets = assets;
        this.presets = presets;
        this.schemes = schemes;
        this.pieces = pieces;
        this.users = users;
        this.celebrities = celebrities;
        this.generators = generators;
        this.ai = ai;
        this.media = media;
        this.guard = guard;
    }

    /** RF11.CA01 — galeria de fundos por categoria para a pré-visualização em tempo real. */
    public Map<String, Object> catalog() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("colors", List.of("#F4F2EF", "#FFFFFF", "#111111", "#F7F4EE", "#1B2A4A", "#6B1220", "#2F7A45", "#C9A227",
                "#DCD5EC", "#F2C09A", "#0D1B2A", "#3A2416"));
        out.put("gradients", assets.list("gradientAuraPresets"));
        out.put("seasonal", assets.list("seasonalPresets"));
        out.put("auraPresets", assets.list("auraPresets"));
        out.put("materials", assets.list("materials"));
        out.put("mosaics", assets.mosaics());
        out.put("categories", assets.list("categories"));
        out.put("skins", assets.skins());
        out.put("skinGeneration", assets.manifest().get("skinGeneration"));
        out.put("directions", DIRECTIONS);
        out.put("anatomies", ANATOMIES);
        out.put("sealPlacements", SEAL_PLACEMENT);
        out.put("pieceSealPlacements", PIECE_SEAL_PLACEMENT);
        out.put("pieceAnatomies", PIECE_ANATOMIES);
        out.put("auraFormats", AURA_FORMATS);
        out.put("animations", BackgroundAnimation.values());
        out.put("imageGenerationAvailable", generators.stream().anyMatch(ImageProviderPorts.ImageGenerationPort::available));
        return out;
    }

    public Map<String, Object> combination(String auraVariantId, String materialId, boolean animated, boolean mosaic) {
        return assets.resolveCombination(auraVariantId, materialId, animated, mosaic);
    }

    /** Direção recomendada pelo estilo do look (regra local; o usuário pode aplicar ou ignorar). */
    public Map<String, Object> recommend(List<String> styles, List<String> occasions) {
        String best = "EDITORIAL_SPREAD";
        int bestScore = -1;
        for (Map.Entry<String, Map<String, Object>> e : DIRECTIONS.entrySet()) {
            @SuppressWarnings("unchecked")
            List<String> st = (List<String>) e.getValue().get("styles");
            int score = styles == null ? 0 : (int) styles.stream().filter(st::contains).count();
            if (occasions != null && occasions.stream().anyMatch(o -> Set.of("party", "night_out").contains(o))
                    && e.getKey().equals("LUXURY_GLASS")) {
                score++;
            }
            if (score > bestScore) {
                bestScore = score;
                best = e.getKey();
            }
        }
        Map<String, Object> d = new LinkedHashMap<>(DIRECTIONS.get(best));
        d.put("id", best);
        d.put("combination", assets.resolveCombination((String) d.get("aura"), (String) d.get("material"), true, false));
        d.put("containerColor", assets.nativeContainer((String) d.get("skin")));
        d.put("reason", bestScore > 0 ? Msg.t("backgroundStudio.coerente_com_o_estilo_do", String.join("/", styles == null ? List.of() : styles))
                : Msg.t("backgroundStudio.direcao_neutra_padrao_funciona_com"));
        return d;
    }

    // ------------------------------------------------------------------ Arte com AI (RF11.CA03 / RF24.CA07)
    public record ArtRequest(String prompt, String direction, UUID celebrityId, String era, boolean passePartout,
                             String target) {
    }

    @Transactional
    public Map<String, Object> generateArt(CurrentUser user, ArtRequest req) {
        guard.requireCanCreate(user);
        if (req.prompt() == null || req.prompt().isBlank()) {
            throw ApiException.badRequest("PROMPT_VAZIO", Msg.t("backgroundStudio.descreva_o_cenario_da_arte"));
        }
        List<String> protectedNames = new ArrayList<>();
        celebrities.findAll().forEach(c -> {
            protectedNames.add(c.getStageName());
            if (c.getRealName() != null) {
                protectedNames.add(c.getRealName());
            }
        });
        String direction = req.direction() == null ? null : req.direction().toUpperCase(Locale.ROOT);
        Map<String, Object> dir = direction == null ? null : DIRECTIONS.get(direction);
        String prompt = Msg.t("backgroundStudio.fashion_card_background_no_people", (req.prompt().trim() + (dir == null ? "" : ", " + dir.get("label") + " art direction") + (req.era() != null ? Msg.t("backgroundStudio.chromatic_and_material_atmosphere_of", req.era()) : "")));
        String negative = Msg.t("backgroundStudio.avoid_faces_avoid_people_avoid");
        int w = 900;
        int h = "PIECE".equalsIgnoreCase(req.target()) ? 2080 : 2160;
        List<AiEngine.RemoteStep<byte[]>> steps = new ArrayList<>();
        for (ImageProviderPorts.ImageGenerationPort g : generators) {
            steps.add(new AiEngine.RemoteStep<>() {
                ImageProviderPorts.ProviderImage last;

                @Override
                public String provider() {
                    return g.getClass().getSimpleName().replace("Adapter", "").toLowerCase(Locale.ROOT);
                }

                @Override
                public String model() {
                    return "image-generation";
                }

                @Override
                public boolean available() {
                    return g.available();
                }

                @Override
                public AiEngine.RemoteResult<byte[]> call() {
                    ImageProviderPorts.ProviderImage img = g.generate(prompt, negative, 896, 1344)
                            .orElseThrow(() -> new IllegalStateException("provedor não devolveu imagem"));
                    last = img;
                    return new AiEngine.RemoteResult<>(img.bytes(), img.costUsd(), img.provider());
                }
            });
        }
        AiOutcome<byte[]> outcome = ai.execute(user.id(), AiCapability.BACKGROUND_GENERATOR,
                List.of(Msg.t("backgroundStudio.prompt_de_arte"), direction == null ? Msg.t("backgroundStudio.sem_direcao") : Msg.t("backgroundStudio.direcao", direction),
                        req.era() == null ? "sem era" : "era: " + req.era()),
                // valida só o texto do usuário (e a era): o sufixo de segurança "no people, no faces" que o sistema
                // acrescenta ao prompt final não pode ser lido como pedido de rosto
                req.prompt().trim() + (req.era() != null ? " " + req.era() : ""), protectedNames, steps, () -> null);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("inferenceId", outcome.inferenceId());
        out.put("explanation", outcome.explanation());
        out.put("quota", outcome.quota());
        if (outcome.value() == null) {
            // Fallback: galeria pré-gerada (AURA/material/mosaico) coerente com o prompt.
            out.put("status", "FALLBACK_GALLERY");
            out.put("message", outcome.userMessage() != null ? outcome.userMessage()
                    : Msg.t("backgroundStudio.geracao_por_ia_indisponivel_escolha"));
            out.put("suggestions", gallerySuggestions(req.prompt()));
            return out;
        }
        BufferedImage img = ImageOps.decode(outcome.value());
        BufferedImage cropped = cropTo(img, w, h);
        User owner = users.findById(user.id()).orElseThrow();
        String key = "users/" + user.id() + "/backgrounds/" + UUID.randomUUID() + ".png";
        MediaStoragePort.StoredObject stored = media.put(key, ImageOps.png(cropped), "image/png");
        media.register(owner, PhotoOrigin.BACKGROUND_STUDIO, null, stored, null, null, null, cropped.getWidth(),
                cropped.getHeight(), null, ModerationStatus.APPROVED, Map.of("prompt", req.prompt(), "provider", outcome.provider()));
        out.put("status", "READY");
        out.put("url", stored.url());
        out.put("provider", outcome.provider());
        out.put("latencyMs", outcome.latencyMs());
        out.put("costUsd", outcome.costUsd());
        out.put("passePartout", req.passePartout());
        return out;
    }

    private List<Map<String, Object>> gallerySuggestions(String prompt) {
        String p = prompt.toLowerCase(Locale.ROOT);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> preset : assets.list("auraPresets")) {
            String hay = (preset.get("prompt") + " " + preset.get("name") + " " + preset.get("archetype")).toLowerCase(Locale.ROOT);
            int hits = 0;
            for (String word : p.split("[^a-zà-ú0-9]+")) {
                if (word.length() > 3 && hay.contains(word)) {
                    hits++;
                }
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("presetId", preset.get("id"));
            m.put("name", preset.get("name"));
            m.put("score", hits);
            if (preset.get("variants") instanceof List<?> v && !v.isEmpty()) {
                m.put("variant", v.get(0));
            }
            out.add(m);
        }
        out.sort((a, b) -> Integer.compare((int) b.get("score"), (int) a.get("score")));
        return out.subList(0, Math.min(6, out.size()));
    }

    /** RF11.CA04 — imagem própria: valida formato/proporção e recorta para o formato do card. */
    @Transactional
    public Map<String, Object> upload(CurrentUser user, byte[] bytes, String target) {
        guard.requireCanCreate(user);
        ImageOps.requireAcceptedImage(bytes);
        BufferedImage img = ImageOps.decode(bytes);
        if (img.getWidth() < 400 || img.getHeight() < 400) {
            throw ApiException.badRequest("IMAGEM_PEQUENA", Msg.t("backgroundStudio.a_imagem_precisa_ter_ao"));
        }
        double ratio = img.getWidth() / (double) img.getHeight();
        if (ratio > 2.5 || ratio < 0.25) {
            throw ApiException.badRequest("PROPORCAO_INVALIDA", Msg.t("backgroundStudio.proporcao_muito_estreita_ou_larga"));
        }
        int w = 900;
        int h = "PIECE".equalsIgnoreCase(target) ? 2080 : 2160;
        BufferedImage cropped = cropTo(img, w, h);
        User owner = users.findById(user.id()).orElseThrow();
        String key = "users/" + user.id() + "/backgrounds/upload-" + UUID.randomUUID() + ".jpg";
        MediaStoragePort.StoredObject stored = media.put(key, ImageOps.jpeg(cropped, 0.9f), "image/jpeg");
        media.register(owner, PhotoOrigin.BACKGROUND_STUDIO, null, stored, null, null, bytes, cropped.getWidth(),
                cropped.getHeight(), null, ModerationStatus.APPROVED, Map.of("kind", "upload"));
        return Map.of("url", stored.url(), "width", w, "height", h, "croppedFrom", img.getWidth() + "x" + img.getHeight());
    }

    static BufferedImage cropTo(BufferedImage img, int w, int h) {
        double target = w / (double) h;
        double ratio = img.getWidth() / (double) img.getHeight();
        int cw = img.getWidth();
        int ch = img.getHeight();
        if (ratio > target) {
            cw = (int) Math.round(ch * target);
        } else {
            ch = (int) Math.round(cw / target);
        }
        BufferedImage crop = img.getSubimage((img.getWidth() - cw) / 2, (img.getHeight() - ch) / 2, cw, ch);
        return ImageOps.scale(crop, w, h);
    }

    // ------------------------------------------------------------------ salvar (só no botão salvar do modal)
    /**
     * Aplica o estado acumulado do Background Studio ao esquema. Regras do container:
     * obrigatório → cor travada (sem escape); cor escolhida → MANUAL; Direção recomendada → AUTO + obrigatório.
     */
    @SuppressWarnings("unchecked")
    public void applyToScheme(Scheme s, Map<String, Object> config, boolean applyRecommendedDirection) {
        if (config == null) {
            return;
        }
        Map<String, Object> scheme = config.get("scheme") instanceof Map<?, ?> m ? (Map<String, Object>) m : config;
        String color = (String) scheme.get("color");
        if (color != null) {
            requireHex(color);
            s.setBackgroundColor(color);
        }
        Object gradient = scheme.get("gradient");
        if (gradient != null) {
            s.setBackgroundGradient(gradient instanceof String g ? g : Json.write(gradient));
        } else if (scheme.containsKey("gradient")) {
            s.setBackgroundGradient(null);
        }
        if (scheme.get("gradientPresetId") instanceof String gid && assets.gradient(gid).isEmpty()) {
            throw ApiException.badRequest("PRESET_INVALIDO", Msg.t("backgroundStudio.gradiente_desconhecido", gid));
        }
        if (scheme.get("seasonalPresetId") instanceof String sid && assets.gradient(sid).isEmpty()) {
            throw ApiException.badRequest("PRESET_INVALIDO", Msg.t("backgroundStudio.preset_sazonal_desconhecido", sid));
        }
        Map<String, Object> aura = scheme.get("aura") instanceof Map<?, ?> a ? (Map<String, Object>) a : null;
        String auraVariant = aura == null ? null : (String) aura.get("variantId");
        if (auraVariant != null && assets.auraVariant(auraVariant).isEmpty()) {
            throw ApiException.badRequest("PRESET_INVALIDO", Msg.t("backgroundStudio.preset_aura_desconhecido", auraVariant));
        }
        String material = (String) scheme.get("materialId");
        if (material != null && assets.material(material).isEmpty()) {
            throw ApiException.badRequest("PRESET_INVALIDO", Msg.t("backgroundStudio.material_desconhecido", material));
        }
        String anatomy = scheme.get("layoutAnatomy") instanceof String a2 ? a2 : s.getLayoutAnatomy();
        if ("LEGO".equals(anatomy) && material != null) {
            // v17 prancha 10: com a anatomia LEGO a placa-base já é o material — o seletor fica desabilitado.
            throw ApiException.badRequest("MATERIAL_INDISPONIVEL", Msg.t("backgroundStudio.com_a_anatomia_lego_o"));
        }
        String format = aura == null ? null : (String) aura.get("format");
        if (format != null && !AURA_FORMATS.contains(format)) {
            throw ApiException.badRequest("FORMATO_INVALIDO", Msg.t("backgroundStudio.formato_do_preset_aura_imagem"));
        }
        if (format != null && (auraVariant == null || material == null)) {
            throw ApiException.badRequest("FORMATO_INVALIDO", Msg.t("backgroundStudio.o_formato_so_se_aplica"));
        }
        s.setBackgroundVideoUrl(null);
        if (auraVariant != null && material != null && format != null) {
            Map<String, Object> combo = assets.resolveCombination(auraVariant, material, true, "MOSAICO".equals(format));
            if ("asset".equals(combo.get("strategy"))) {
                s.setBackgroundVideoUrl((String) combo.get("url"));
                if (scheme.get("aiArt") == null && scheme.get("uploadUrl") == null) {
                    scheme.put("posterUrl", combo.get("posterUrl"));
                }
            }
        }
        Map<String, Object> aiArt = scheme.get("aiArt") instanceof Map<?, ?> art ? (Map<String, Object>) art : null;
        String upload = (String) scheme.get("uploadUrl");
        s.setBackgroundArtUrl(aiArt != null ? (String) aiArt.get("url") : upload);
        if (scheme.get("animation") instanceof String anim) {
            s.setBackgroundAnimationType(BackgroundAnimation.valueOf(anim));
        }
        if (Boolean.TRUE.equals(scheme.get("seasonalAuto"))) {
            // v17 prancha 09 — Cartela sazonal: opt-in, só com season preenchido; sobrescreve o fundo manual.
            if (s.getSeason() == null) {
                throw ApiException.badRequest("ESTACAO_OBRIGATORIA", Msg.t("backgroundStudio.preencha_a_estacao_etapa_3"));
            }
            String preset = switch (s.getSeason()) {
                case WINTER -> "frost";
                case SUMMER -> "solstice";
                case AUTUMN -> "ember";
                case SPRING -> "bloom";
            };
            assets.gradient(preset).ifPresent(p -> {
                s.setBackgroundGradient(Json.write(Map.of("type", "linear", "angle", 160, "stops", p.get("stops"))));
                Object anim = p.get("animation");
                if (anim instanceof String a3) {
                    try {
                        s.setBackgroundAnimationType(BackgroundAnimation.valueOf(a3));
                    } catch (IllegalArgumentException ignored) {
                        // animação CSS sem equivalente no enum
                    }
                }
            });
            scheme.put("seasonalPresetId", preset);
        }
        if (scheme.get("cardSkin") instanceof String skin) {
            if (assets.cardSkin(skin).isEmpty()) {
                throw ApiException.badRequest("SKIN_INVALIDA", Msg.t("backgroundStudio.skin_de_card_desconhecida", skin));
            }
            s.setCardSkin(skin);
        }
        if (scheme.get("layoutAnatomy") instanceof String anat) {
            if (!ANATOMIES.contains(anat) && !PIECE_ANATOMIES.contains(anat)) {
                throw ApiException.badRequest("ANATOMIA_INVALIDA", Msg.t("backgroundStudio.anatomia_de_card_desconhecida", anat));
            }
            s.setLayoutAnatomy(anat);
            // o layout escolhido na etapa 4 já carrega a posição do selo daquela anatomia
            scheme.put("sealPlacement", SEAL_PLACEMENT.getOrDefault(anat, SEAL_PLACEMENT.get("LISTA_VERTICAL")).get("zone"));
        }
        if (config.get("pieces") instanceof Map<?, ?> pc && pc.get("anatomy") instanceof String pAnat) {
            if (!PIECE_ANATOMIES.contains(pAnat)) {
                throw ApiException.badRequest("ANATOMIA_INVALIDA", Msg.t("backgroundStudio.anatomia_de_peca_desconhecida", pAnat));
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> pieces = (Map<String, Object>) pc;
            pieces.put("sealPlacement", PIECE_SEAL_PLACEMENT.get(pAnat).get("zone"));
        }
        if (applyRecommendedDirection) {
            String dirId = (String) scheme.getOrDefault("direction", "EDITORIAL_SPREAD");
            Map<String, Object> dir = DIRECTIONS.get(dirId);
            if (dir == null) {
                throw ApiException.badRequest("DIRECAO_INVALIDA", Msg.t("backgroundStudio.direcao_recomendada_desconhecida"));
            }
            s.setRecommendedDirection(dirId);
            s.setCardSkin((String) dir.get("skin"));
            s.setContainerOrigin(ContainerOrigin.AUTO);
            s.setContainerMandatory(true);
            s.setContainerColor(assets.nativeContainer(s.getCardSkin()));
        } else if (scheme.get("container") instanceof Map<?, ?> c) {
            Object cColor = c.get("color");
            if (s.isContainerMandatory()) {
                if (cColor != null && !String.valueOf(cColor).equalsIgnoreCase(s.getContainerColor())) {
                    throw new ApiException(409, "CONTAINER_TRAVADO",
                            Msg.t("backgroundStudio.o_container_foi_travado_pela"));
                }
            } else if (cColor != null && !String.valueOf(cColor).isBlank()) {
                requireHex(String.valueOf(cColor));
                s.setContainerColor(String.valueOf(cColor));
                s.setContainerOrigin(ContainerOrigin.MANUAL);
            } else if (c.containsKey("color")) {
                s.setContainerColor(null);
                s.setContainerOrigin(ContainerOrigin.INDEFINIDA);
            }
        }
        Map<String, Object> stored = new LinkedHashMap<>(config);
        Map<String, Object> resolved = new LinkedHashMap<>();
        if (auraVariant != null || material != null) {
            boolean animated = aura != null && (Boolean.TRUE.equals(aura.get("animated")) || format != null);
            boolean mosaic = "MOSAICO".equals(format) || Boolean.TRUE.equals(scheme.get("mosaic"));
            resolved.put("combination", auraVariant != null && material != null
                    ? assets.resolveCombination(auraVariant, material, animated, mosaic)
                    : auraVariant != null ? assets.auraVariant(auraVariant).map(v -> (Object) v).orElse(null)
                    : assets.material(material).map(v -> (Object) v).orElse(null));
        }
        resolved.put("containerOrigin", s.getContainerOrigin().name());
        resolved.put("containerMandatory", s.isContainerMandatory());
        resolved.put("containerColor", s.getContainerColor());
        resolved.put("passePartout", s.isContainerMandatory() && s.getBackgroundArtUrl() != null);
        resolved.put("backgroundVideoUrl", s.getBackgroundVideoUrl());
        resolved.put("auraFormat", format);
        // Mosaico = arte densa (12 painéis): sugere o container em cards de Esquema, sem torná-lo obrigatório.
        resolved.put("suggestContainer", "MOSAICO".equals(format) && s.getContainerOrigin() == ContainerOrigin.INDEFINIDA);
        stored.put("resolved", resolved);
        s.setStudioConfigJson(Json.write(stored));
    }

    private static void requireHex(String color) {
        if (!color.matches("^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$")) {
            throw ApiException.badRequest("COR_INVALIDA", Msg.t("backgroundStudio.use_cor_hexadecimal_rrggbb"));
        }
    }

    @Transactional
    public Map<String, Object> saveScheme(CurrentUser user, UUID schemeId, Map<String, Object> config, boolean applyDirection) {
        guard.requireCanCreate(user);
        Scheme s = schemes.findById(schemeId).orElseThrow(() -> ApiException.notFound("Esquema"));
        guard.requireOwner(user, s.getUser().getId(), "scheme:" + schemeId);
        applyToScheme(s, config, applyDirection);
        @SuppressWarnings("unchecked")
        Map<String, Object> piecesCfg = config != null && config.get("pieces") instanceof Map<?, ?> p ? (Map<String, Object>) p : Map.of();
        piecesCfg.forEach((pieceId, cfg) -> savePieceInternal(user, UUID.fromString(pieceId), cfg));
        return Map.of("schemeId", s.getId(), "studio", Json.map(s.getStudioConfigJson()), "cardSkin", s.getCardSkin(),
                "containerOrigin", s.getContainerOrigin(), "containerMandatory", s.isContainerMandatory(),
                "containerColor", String.valueOf(s.getContainerColor()));
    }

    /** RF11.CA05 — remover o fundo aplicado volta ao padrão sem perder os demais dados. */
    @Transactional
    public Map<String, Object> resetScheme(CurrentUser user, UUID schemeId) {
        Scheme s = schemes.findById(schemeId).orElseThrow(() -> ApiException.notFound("Esquema"));
        guard.requireOwner(user, s.getUser().getId(), "scheme:" + schemeId);
        s.setBackgroundColor("#F4F2EF");
        s.setBackgroundGradient(null);
        s.setBackgroundArtUrl(null);
        s.setBackgroundAnimationType(BackgroundAnimation.NONE);
        if (!s.isContainerMandatory()) {
            s.setContainerOrigin(ContainerOrigin.INDEFINIDA);
            s.setContainerColor(null);
        }
        s.setStudioConfigJson(null);
        return Map.of("schemeId", s.getId(), "reset", true, "containerMandatory", s.isContainerMandatory());
    }

    /** Modo 3 (4.2) — fundo de uma peça. */
    @Transactional
    public Map<String, Object> savePiece(CurrentUser user, UUID pieceId, Object cfg) {
        guard.requireCanCreate(user);
        return savePieceInternal(user, pieceId, cfg);
    }

    private Map<String, Object> savePieceInternal(CurrentUser user, UUID pieceId, Object cfg) {
        WardrobeItem w = pieces.findById(pieceId).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
        guard.requireOwner(user, w.getUser().getId(), "piece:" + pieceId);
        w.setBackgroundConfigJson(cfg == null ? null : Json.write(cfg));
        return Map.of("pieceId", pieceId, "background", cfg == null ? Map.of() : cfg);
    }

    /**
     * Thumbnails dos skins (00_dimensoes_e_metodologia.md / 08_negativo): gera em retrato e recorta ao centro
     * para 0,39:1 (220:566). Operação administrativa; sem provedor, a UI usa a miniatura CSS ao vivo.
     */
    @Transactional
    public Map<String, Object> generateSkinThumbnail(CurrentUser admin, String skinId, boolean pieceContext) {
        guard.requireAdmin(admin);
        Map<String, Object> skin = assets.skin(skinId).orElseThrow(() -> ApiException.notFound("Skin"));
        @SuppressWarnings("unchecked")
        Map<String, Object> prompts = (Map<String, Object>) skin.get("thumbnailPrompt");
        String prompt = (String) prompts.get(pieceContext ? "piece" : "scheme");
        String negative = (String) skin.get("negativePrompt");
        Optional<ImageProviderPorts.ImageGenerationPort> g = generators.stream().filter(ImageProviderPorts.ImageGenerationPort::available).findFirst();
        if (g.isEmpty()) {
            return Map.of("status", "FALLBACK", "strategy", "live-css-miniature",
                    "message", Msg.t("backgroundStudio.nenhum_provedor_de_imagem_configurado"));
        }
        AiOutcome<byte[]> outcome = ai.execute(admin.id(), AiCapability.BACKGROUND_GENERATOR, List.of(Msg.t("backgroundStudio.prompt_do_skin", skinId)),
                prompt, null, List.of(new AiEngine.RemoteStep<>() {
                    @Override
                    public String provider() {
                        return "image-generation";
                    }

                    @Override
                    public String model() {
                        return "portrait";
                    }

                    @Override
                    public boolean available() {
                        return true;
                    }

                    @Override
                    public AiEngine.RemoteResult<byte[]> call() {
                        ImageProviderPorts.ProviderImage img = g.get().generate(prompt, negative, 896, 1344).orElseThrow();
                        return new AiEngine.RemoteResult<>(img.bytes(), img.costUsd(), img.provider());
                    }
                }), () -> null);
        if (outcome.value() == null) {
            return Map.of("status", "FALLBACK", "strategy", "live-css-miniature", "message", String.valueOf(outcome.userMessage()));
        }
        BufferedImage cropped = cropTo(ImageOps.decode(outcome.value()), 440, 1132);
        MediaStoragePort.StoredObject stored = media.put("assets/skins/" + skinId + (pieceContext ? "-piece" : "") + ".png",
                ImageOps.png(cropped), "image/png");
        AssetPreset preset = presets.findById(skinId).orElse(null);
        if (preset != null) {
            preset.setPreviewUrl(stored.url());
            preset.setStatus("AVAILABLE");
        }
        return Map.of("status", "READY", "url", stored.url(), "aspect", "220:566");
    }

    /** Fundo resolvido para o renderer do card (RF5 preview / RF19 export). */
    @SuppressWarnings("unchecked")
    public SchemeCardRenderer.Background rendererBackground(Scheme s) {
        Map<String, Object> cfg = Json.map(s.getStudioConfigJson());
        Map<String, Object> scheme = cfg.get("scheme") instanceof Map<?, ?> m ? (Map<String, Object>) m : cfg;
        List<String> stops = new ArrayList<>();
        double angle = 135;
        boolean radial = false;
        Object g = scheme.get("gradient");
        if (g instanceof Map<?, ?> gm) {
            if (gm.get("stops") instanceof List<?> l) {
                l.forEach(x -> stops.add(String.valueOf(x)));
            }
            angle = gm.get("angle") instanceof Number n ? n.doubleValue() : 135;
            radial = "radial".equals(gm.get("type"));
        } else if (scheme.get("gradientPresetId") instanceof String gid) {
            assets.gradient(gid).ifPresent(p -> {
                if (p.get("stops") instanceof List<?> l) {
                    l.forEach(x -> stops.add(String.valueOf(x)));
                }
            });
        } else if (scheme.get("seasonalPresetId") instanceof String sid) {
            assets.gradient(sid).ifPresent(p -> {
                if (p.get("stops") instanceof List<?> l) {
                    l.forEach(x -> stops.add(String.valueOf(x)));
                }
            });
        }
        Map<String, Object> aura = scheme.get("aura") instanceof Map<?, ?> a ? (Map<String, Object>) a : null;
        BufferedImage art = s.getBackgroundArtUrl() == null ? null : media.readImage(s.getBackgroundArtUrl()).orElse(null);
        return new SchemeCardRenderer.Background(s.getBackgroundColor(), stops, angle, radial,
                aura == null ? null : (String) aura.get("variantId"), (String) scheme.get("materialId"), art,
                s.isContainerMandatory(), s.getContainerColor(), s.getCardSkin());
    }

    static BigDecimal zero() {
        return BigDecimal.ZERO;
    }
}
