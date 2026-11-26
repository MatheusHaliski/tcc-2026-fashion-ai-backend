package br.com.fashionai.application.scheme;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import br.com.fashionai.application.ai.*;
import br.com.fashionai.application.ai.local.LocalSchemeComposer;
import br.com.fashionai.application.common.*;
import br.com.fashionai.application.dna.CompositionContext;
import br.com.fashionai.application.imaging.*;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import br.com.fashionai.application.service.*;
import br.com.fashionai.application.service.SchemeService.*;

public final class SchemeComposition {
    private final WardrobeService wardrobe;
    private final MediaService media;
    private final UserRepository users;
    private final StyleDnaRepository dna;
    private final AiEngine ai;
    private final SchemeHype hype;

    public SchemeComposition(WardrobeService wardrobe, MediaService media, UserRepository users, StyleDnaRepository dna, AiEngine
                             ai, SchemeHype hype) {
        this.wardrobe = wardrobe;
        this.media = media;
        this.users = users;
        this.dna = dna;
        this.ai = ai;
        this.hype = hype;
    }

    public ComposeResult compose(CurrentUser user, ComposeRequest req, AiCapability capability) {
        List<WardrobeItem> eligible = wardrobe.eligible(user.id());
        if (eligible.size() < 2) {
            throw new ApiException(422, "ACERVO_INSUFICIENTE",
                    Msg.t("scheme.cadastre_ao_menos_2_pecas"), Map.of("href", "/pieces/new"));
        }
        Set<String> exclude = new HashSet<>(req.excludeCombinations() == null ? List.of() : req.excludeCombinations());
        Map<String, WardrobeItem> byRef = new LinkedHashMap<>();
        List<Map<String, Object>> catalog = new ArrayList<>();
        // RF53 (P2-14) — a IA recebe o HypeScore v2 das peças (Hype pessoal do dono: são as próprias peças), não o v1
        Map<UUID, HypeScoreCurrent> scores = hype.currentHype(HypeEntityType.PIECE, eligible.stream().map(WardrobeItem::getId).toList());
        int i = 1;
        for (WardrobeItem w : eligible) {
            String ref = "p" + i++;
            byRef.put(ref, w);
            HypeScoreCurrent h = scores.get(w.getId());
            catalog.add(SchemeComposePrompt.entry(ref, w, h, h == null || h.getScore() == null ? null : hype.levelOf(h)));
        }
        List<AiRequest.AiImage> photos = new ArrayList<>();
        List<String> photoRefs = new ArrayList<>();
        for (Map.Entry<String, WardrobeItem> e : byRef.entrySet()) {
            if (photos.size() >= SchemeComposePrompt.MAX_PHOTOS) {
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
        dna.findByUserId(user.id()).ifPresent(d -> profile.put("styleDna", CompositionContext.dnaContext(d)));
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
                SchemeComposePrompt.system(), prompt, photos, 1800, inputs,
                text -> SchemeComposePrompt.parse(text, byRef, req, exclude),
                () -> LocalSchemeComposer.compose(eligible, req.occasion(), req.style(), req.season(), req.prompt(), 12).stream()
                        .filter(c -> !exclude.contains(combinationKey(c.items().stream().map(LocalSchemeComposer.Pick::wardrobeItemId).toList())))
                        .limit(3).toList(), null));
        List<LocalSchemeComposer.Composition> list = outcome.value() == null ? List.of() : outcome.value();
        String message = outcome.userMessage();
        if (list.size() < 3) {
            message = Msg.t("scheme.seu_acervo_permitiu_combinacao_oes", ((message == null ? "" : message + " ")), list.size());
        }
        return new ComposeResult(list, message, outcome.explanation(), outcome.inferenceId(), outcome.quota(),
                outcome.fallbackUsed(), outcome.provider());
    }

    public static String combinationKey(List<UUID> ids) {
        return ids.stream().map(UUID::toString).sorted().collect(Collectors.joining("+"));
    }
}
