package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.DnaService.CellRef;
import br.com.fashionai.application.service.DnaService.DnaCellForm;
import br.com.fashionai.application.service.DnaService.DnaSchemeForm;
import br.com.fashionai.domain.model.DnaScheme;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.DnaCell;
import br.com.fashionai.domain.model.enums.NarrativeType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Construtor igual ao RF5 (bloco 12): etapas 1–2 com os esquemas do usuário e a pré-visualização ao vivo.
 */
final class DnaBuilderSteps {
    private final SchemeRepository schemes;
    private final UserRepository users;
    private final Guard guard;
    private final SchemeService schemeService;
    private final DnaSynthesis synthesis;
    private final DnaSchemeViews schemeViews;
    private final DnaSchemeWriter writer;

    DnaBuilderSteps(SchemeRepository schemes, UserRepository users, Guard guard,
                    SchemeService schemeService, DnaSynthesis synthesis, DnaSchemeViews schemeViews, DnaSchemeWriter writer) {
        this.schemes = schemes;
        this.users = users;
        this.guard = guard;
        this.schemeService = schemeService;
        this.synthesis = synthesis;
        this.schemeViews = schemeViews;
        this.writer = writer;
    }

    // ================================================================== construtor igual ao RF5 (bloco 12)
    static final List<String> BUILDER_STEPS = List.of(Msg.k("dna.n1_modo"), Msg.k("dna.n2_esquemas"), Msg.k("dna.n3_dados"), Msg.k("dna.n4_background_studio"), Msg.k("dna.n5_revisar_e_salvar"));

    /** Etapas 1–2: os "itens" de um Esquema de DNA são os esquemas de vestimenta do próprio usuário (RF5), de 2 a 6. */
    Map<String, Object> builder(CurrentUser user) {
        StyleDna dna = synthesis.ensureDna(user);
        List<Scheme> own = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalSchemes", own.size());
        out.put("source", "RF5");
        if (own.size() < 2) {
            out.put("status", "INSUFICIENTE");
            out.put("message", Msg.t("dna.um_dna_de_estilo_referencia"));
            out.put("action", Map.of("label", Msg.t("dna.criar_esquema_de_vestimenta"), "href", "/schemes/new"));
        } else {
            out.put("status", "PRONTO");
        }
        Map<UUID, List<SchemeItem>> itemsBy = schemeViews.groupItems(own);
        out.put("schemes", own.stream().map(s -> schemeService.view(user, s, itemsBy.getOrDefault(s.getId(), List.of()))).toList());
        out.put("dna", DnaViews.view(dna, false));
        out.put("defaultVisibility", AccountService.defaultVisibility(users.findById(user.id()).orElseThrow()));
        out.put("steps", BUILDER_STEPS);
        out.put("layouts", DnaService.LAYOUTS);
        out.put("narratives", NarrativeType.values());
        out.put("seasons", Season.values());
        out.put("minCells", 2);
        out.put("maxCells", 6);
        return out;
    }

    /** Etapa 5 / pré-visualização ao vivo: monta o card do DNA sem salvar (células transitórias). */
    Map<String, Object> preview(CurrentUser user, DnaSchemeForm f) {
        StyleDna dna = synthesis.ensureDna(user);
        DnaScheme d = new DnaScheme();
        d.setUser(users.findById(user.id()).orElseThrow());
        DnaSchemeWriter.stamp(d, dna);
        d.setCreationMode("AI".equalsIgnoreCase(f.creationMode()) ? CreationMode.AI_ASSISTED : CreationMode.MANUAL);
        String title = f.title() == null || f.title().strip().length() < 2 ? Msg.t("common.sem_titulo") : f.title(); // a prévia aparece antes da etapa 3
        writer.apply(user, d, new DnaSchemeForm(title, f.cells(), f.cardLayout(), f.targetElement(), f.narrativeType(), f.occasion(), f.style(),
                f.seasonalTheme(), f.visibility(), f.background(), false, f.creationMode()), true);
        List<CellRef> refs = new ArrayList<>();
        DnaCell[] slots = DnaCell.values();
        Set<UUID> seen = new HashSet<>();
        for (DnaCellForm c : f.cells() == null ? List.<DnaCellForm>of() : f.cells()) {
            if (refs.size() == slots.length || c.schemeId() == null || !seen.add(c.schemeId())) {
                continue;
            }
            Scheme s = schemes.findById(c.schemeId()).orElseThrow(() -> ApiException.notFound("Esquema"));
            guard.requireOwner(user, s.getUser().getId(), "scheme:" + s.getId());
            refs.add(new CellRef(slots[refs.size()], s, c.eraLabel() == null ? null : InputSanitizer.clean(c.eraLabel(), 120), Boolean.TRUE.equals(c.milestone())));
        }
        return schemeViews.dnaSchemeView(user, d, refs);
    }
}
