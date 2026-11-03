package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.AiRequest;
import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SchemeService.ComposeRequest;
import br.com.fashionai.application.service.SchemeService.ComposeResult;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.DisplayMode;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.Mood;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * RF5 etapas 1–3 — o compositor (listas do guarda-roupa real por parte do corpo) e a etapa 2, gerar com IA: o acervo
 * inteiro (atributos, fotos, Hype v2, DNA de estilo) vai para a IA, com o compositor local como alternativa.
 */
final class SchemeComposeSteps {
    private final WardrobeService wardrobe;
    private final WardrobeItemRepository pieces;
    private final UserRepository users;
    private final MediaService media;
    private final AiEngine ai;
    private final StyleDnaRepository dna;
    private final SchemeHype hypeState;

    SchemeComposeSteps(WardrobeService wardrobe, WardrobeItemRepository pieces, UserRepository users, MediaService media, AiEngine ai,
                       StyleDnaRepository dna, SchemeHype hypeState) {
        this.wardrobe = wardrobe;
        this.pieces = pieces;
        this.users = users;
        this.media = media;
        this.ai = ai;
        this.dna = dna;
        this.hypeState = hypeState;
    }

    /** RF5.CA01/CA02/CA07b — listas por parte do corpo espelhando o guarda-roupa real (só disponíveis). */
    Map<String, Object> builder(CurrentUser user) {
        List<WardrobeItem> eligible = wardrobe.eligible(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        long total = pieces.countByUserId(user.id());
        out.put("totalPieces", total);
        out.put("eligiblePieces", eligible.size());
        // Etapa 3 (formulário): as peças exibidas são SEMPRE as cadastradas pelo usuário no RF4 (guarda-roupa próprio);
        // as indisponíveis/reprovadas ficam ocultas e o total informa quantas.
        out.put("source", "RF4");
        out.put("hiddenPieces", Math.max(0, total - eligible.size()));
        if (eligible.size() < 2 && eligible.stream().noneMatch(w -> "full_body_piece".equals(w.getCategory()))) {
            out.put("status", "INSUFICIENTE");
            out.put("message", Msg.t("scheme.voce_precisa_de_ao_menos"));
            out.put("action", Map.of("label", Msg.t("common.adicionar_nova_peca"), "href", "/pieces/new"));
        } else {
            out.put("status", "PRONTO");
        }
        Map<String, List<Views.PieceView>> lists = new LinkedHashMap<>();
        for (String cat : Taxonomy.SUBCATEGORIES.keySet()) {
            lists.put(cat, eligible.stream().filter(w -> cat.equals(w.getCategory()))
                    .map(w -> Views.piece(w, null, null)).toList());
        }
        out.put("lists", lists);
        User u = users.findById(user.id()).orElseThrow();
        out.put("defaultVisibility", AccountService.defaultVisibility(u));
        out.put("steps", List.of(Msg.t("scheme.n1_modo_de_geracao"), Msg.t("scheme.n2_prompt_da_ia"), Msg.t("scheme.n3_formulario_manual"), Msg.t("scheme.n4_arte_de_background"),
                Msg.t("scheme.n5_preview_slots_e_salvar")));
        out.put("displayModes", DisplayMode.values());
        out.put("moods", Mood.values());
        out.put("seasons", Season.values());
        out.put("anatomies", BackgroundStudioService.ANATOMIES);
        out.put("sealPlacements", BackgroundStudioService.SEAL_PLACEMENT);
        out.put("pieceSealPlacements", BackgroundStudioService.PIECE_SEAL_PLACEMENT);
        return out;
    }

    ComposeResult compose(CurrentUser user, ComposeRequest req, AiCapability capability) {
        List<WardrobeItem> eligible = wardrobe.eligible(user.id());
        if (eligible.size() < 2) {
            throw new ApiException(422, "ACERVO_INSUFICIENTE",
                    Msg.t("scheme.cadastre_ao_menos_2_pecas"), Map.of("href", "/pieces/new"));
        }
        Set<String> exclude = new HashSet<>(req.excludeCombinations() == null ? List.of() : req.excludeCombinations());
        Map<String, WardrobeItem> byRef = new LinkedHashMap<>();
        List<Map<String, Object>> catalog = new ArrayList<>();
        // RF53 (P2-14) — a IA recebe o HypeScore v2 das peças (Hype pessoal do dono: são as próprias peças), não o v1
        Map<UUID, HypeScoreCurrent> hype = hypeState.currentHype(HypeEntityType.PIECE, eligible.stream().map(WardrobeItem::getId).toList());
        int i = 1;
        for (WardrobeItem w : eligible) {
            String ref = "p" + i++;
            byRef.put(ref, w);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ref", ref);
            m.put("name", w.getName());
            m.put("category", w.getCategory());
            m.put("subcategory", w.getSubcategory());
            m.put("color", w.getColor());
            m.put("material", w.getMaterial());
            m.put("sex", w.getSex());
            m.put("style", Json.csv(w.getStyleTags()));
            m.put("occasion", Json.csv(w.getOccasionTags()));
            m.put("brand", w.getBrandName());
            // RF5 etapa 2 — tudo que a peça carrega no RF4 entra na interpretação da IA
            m.put("size", w.getSizeLabel());
            m.put("condition", w.getCondition() == null ? null : w.getCondition().name());
            m.put("price", w.getPrice());
            m.put("favorite", w.isFavorite());
            m.put("wearCount", w.getWearCount());
            m.put("lastWorn", w.getLastWornDate());
            HypeScoreCurrent h = hype.get(w.getId());
            // sem dados = nulo (nunca 0); a faixa acompanha o número
            m.put("hypeScore", h == null || h.getScore() == null ? null : h.getScore().setScale(0, java.math.RoundingMode.HALF_UP));
            HypeLevel level = h == null || h.getScore() == null ? null : hypeState.levelOf(h);
            m.put("hypeLevel", level == null ? null : level.name());
            m.put("tags", Json.csv(w.getTags()));
            m.put("notes", InputSanitizer.clean(w.getNotes(), 160));
            m.put("analysis", SchemeAiPayloads.pieceAnalysis(w));
            catalog.add(m);
        }
        List<AiRequest.AiImage> photos = new ArrayList<>();
        List<String> photoRefs = new ArrayList<>();
        for (Map.Entry<String, WardrobeItem> e : byRef.entrySet()) {
            if (photos.size() >= MAX_COMPOSE_PHOTOS) {
                break;
            }
            WardrobeItem w = e.getValue();
            if (w.isDefaultImage()) {
                continue;
            }
            String url = w.getThumbnailUrl() != null ? w.getThumbnailUrl() : w.getImageUrl();
            if (url == null) {
                continue;
            }
            media.read(url).ifPresent(bytes -> {
                photos.add(new AiRequest.AiImage(bytes, ImageOps.detectMime(bytes)));
                photoRefs.add(e.getKey());
            });
        }
        Map<String, Object> profile = new LinkedHashMap<>();
        users.findById(user.id()).ifPresent(u -> profile.put("country", u.getCountry()));
        dna.findByUserId(user.id()).ifPresent(d -> profile.put("styleDna", SchemeAiPayloads.dnaContext(d)));
        String system = """
                Você é o Scheme Composer do Fashion AI. Monte EXATAMENTE 3 looks distintos usando SOMENTE as peças do
                acervo informado (referências p1, p2...). Nunca invente peças. Cada look: 2 a 4 peças, no máximo 1 de cada
                tipo (upper/lower/shoes/accessory; full_body ocupa upper e lower), sexo coerente.
                Interprete TUDO que o acervo oferece: materiais (texturas e combinações — linho/algodão para calor, lã/couro
                para frio, evite três materiais pesados juntos), cores (harmonia, contraste, paleta e estação cromática do
                DNA de estilo), padrões/estampas (no máximo uma estampa forte por look; leia a estampa real nas fotos),
                as FOTOS anexadas (caimento, corte, comprimento, brilho, estado real da peça), tamanho/caimento, estado de
                conservação, preço (coerência entre peças), frequência de uso (varie peças pouco usadas quando o usuário
                pedir novidade), favoritas, notas/tags do usuário, além de ocasião, estilo, humor, estação e clima do país.
                hypeScore (0–100) e hypeLevel são o HypeScore v2: a relevância atual da peça no FashionAI, não qualidade
                nem gosto pessoal; nulo = sem dados. Use só como contexto, nunca como critério principal do look.
                As orientações livres do usuário podem citar materiais, cores, estampas ou peças específicas: respeite-as.
                Sintetize ocasião e estilo (máx. 3 cada, nunca concatene as tags das peças). No rationale, cite os
                atributos que pesaram (ex.: "linho cru + terracota, sem estampa, clima quente"). Responda SOMENTE com JSON:
                {"compositions":[{"title":string,"refs":["p1",...],"occasion":[...],"style":[...],"mood":one of
                [ENERGETIC,ELEGANT,COMFORTABLE,SOPHISTICATED],"rationale":"até 2 frases"}]}"""
                + "\nEscreva title e rationale em " + Msg.languageName() + "; refs, occasion, style e mood seguem os códigos acima.";
        String prompt = Msg.t("scheme.acervo_ocasiao_estilo_humor_estacao", Json.write(catalog), (photoRefs.isEmpty() ? "" : "\nFotos anexadas, na ordem, das peças: " + photoRefs), (profile.isEmpty() ? "" : "\nPerfil do usuário: " + Json.write(profile)), req.occasion(), req.style(), req.mood(), req.season(), (req.prompt() == null ? "" : InputSanitizer.clean(req.prompt(), 500)), (exclude.isEmpty() ? "" : "\nNÃO repita estas combinações (refs ordenadas): " + exclude));
        List<String> inputs = new ArrayList<>(List.of(Msg.t("scheme.pecas_do_acervo_com_todos", (eligible.size())),
                Msg.t("scheme.ocasiao_estilo_humor_estacao_pedidos"), Msg.t("common.orientacoes_livres")));
        if (!photoRefs.isEmpty()) {
            inputs.add(Msg.t("scheme.fotos_das_pecas_visao", (photoRefs.size())));
        }
        if (profile.containsKey("styleDna")) {
            inputs.add(Msg.t("scheme.dna_de_estilo_arquetipo_paleta"));
        }
        AiOutcome<List<LocalSchemeComposer.Composition>> outcome = ai.text(new AiEngine.TextCall<>(user.id(), capability,
                system, prompt, photos, 1800, inputs,
                text -> SchemeAiPayloads.parseCompositions(text, byRef, req, exclude),
                () -> LocalSchemeComposer.compose(eligible, req.occasion(), req.style(), req.season(), req.prompt(), 12).stream()
                        .filter(c -> !exclude.contains(SchemeService.combinationKey(c.items().stream().map(LocalSchemeComposer.Pick::wardrobeItemId).toList())))
                        .limit(3).toList(), null));
        List<LocalSchemeComposer.Composition> list = outcome.value() == null ? List.of() : outcome.value();
        String message = outcome.userMessage();
        if (list.size() < 3) {
            message = Msg.t("scheme.seu_acervo_permitiu_combinacao_oes", ((message == null ? "" : message + " ")), list.size());
        }
        return new ComposeResult(list, message, outcome.explanation(), outcome.inferenceId(), outcome.quota(),
                outcome.fallbackUsed(), outcome.provider());
    }

    /** Fotos enviadas à IA na etapa 2 (miniaturas das peças mais recentes). */
    static final int MAX_COMPOSE_PHOTOS = 12;
}
