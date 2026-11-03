package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.DnaService.DnaCellForm;
import br.com.fashionai.application.service.DnaService.DnaSchemeForm;
import br.com.fashionai.domain.model.DnaScheme;
import br.com.fashionai.domain.model.DnaSchemeItem;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.DnaCell;
import br.com.fashionai.domain.model.enums.NarrativeType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.DnaSchemeItemRepository;
import br.com.fashionai.domain.repository.DnaSchemeRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Escrita dos Esquemas de DNA: criar, editar, arquivar, carimbar a identidade do DNA e validar
 * anatomia, alvo, narrativa e células.
 */
final class DnaSchemeWriter {
    private final UserRepository users;
    private final DnaSchemeRepository dnaSchemes;
    private final DnaSchemeItemRepository dnaItems;
    private final SchemeRepository schemes;
    private final Guard guard;
    private final DnaSynthesis synthesis;
    private final DnaSchemeViews schemeViews;

    DnaSchemeWriter(UserRepository users, DnaSchemeRepository dnaSchemes, DnaSchemeItemRepository dnaItems,
                    SchemeRepository schemes, Guard guard, DnaSynthesis synthesis, DnaSchemeViews schemeViews) {
        this.users = users;
        this.dnaSchemes = dnaSchemes;
        this.dnaItems = dnaItems;
        this.schemes = schemes;
        this.guard = guard;
        this.synthesis = synthesis;
        this.schemeViews = schemeViews;
    }

    Map<String, Object> createDnaScheme(CurrentUser user, DnaSchemeForm f) {
        guard.requireCanCreate(user);
        StyleDna dna = synthesis.ensureDna(user);
        DnaScheme d = new DnaScheme();
        d.setUser(users.findById(user.id()).orElseThrow());
        stamp(d, dna);
        d.setCreationMode("AI".equalsIgnoreCase(f.creationMode()) ? CreationMode.AI_ASSISTED : CreationMode.MANUAL);
        d.setStatus(SchemeStatus.DRAFT);
        apply(user, d, f, true);
        dnaSchemes.save(d);
        replaceCells(user, d, f.cells());
        dna.setLatestDnaSchemeId(d.getId());
        if (Boolean.TRUE.equals(f.publish())) {
            d.setStatus(SchemeStatus.PUBLISHED);
            d.setPublishedAt(Instant.now());
        }
        return schemeViews.dnaSchemeView(user, d);
    }

    /** Identidade do DNA (arquétipo, ousadia, frase, paleta) copiada para o esquema no momento em que ele é montado. */
    static void stamp(DnaScheme d, StyleDna dna) {
        d.setArchetype(dna.getArchetype());
        d.setBoldnessIndex(dna.getBoldnessIndex());
        d.setIdentityPhrase(dna.getIdentityPhrase());
        d.setColorPaletteJson(Json.write(Json.csv(dna.getColorPalette())));
    }

    Map<String, Object> updateDnaScheme(CurrentUser user, UUID id, DnaSchemeForm f) {
        DnaScheme d = dnaSchemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("dna.esquema_de_dna")));
        guard.requireOwner(user, d.getUser().getId(), "dna:" + id);
        apply(user, d, f, false);
        if (f.cells() != null) {
            replaceCells(user, d, f.cells());
        }
        if (Boolean.TRUE.equals(f.publish()) && d.getStatus() != SchemeStatus.PUBLISHED) {
            d.setStatus(SchemeStatus.PUBLISHED);
            d.setPublishedAt(Instant.now());
        }
        return schemeViews.dnaSchemeView(user, d);
    }

    void apply(CurrentUser user, DnaScheme d, DnaSchemeForm f, boolean creating) {
        if (f.title() != null || creating) {
            d.setTitle(InputSanitizer.required("title", f.title(), 2, 120));
        }
        if (f.cardLayout() != null) {
            if (!DnaService.LAYOUTS.contains(f.cardLayout())) {
                throw ApiException.badRequest("LAYOUT_INVALIDO", "Anatomias: " + DnaService.LAYOUTS);
            }
            d.setCardLayout(f.cardLayout());
        } else if (creating) {
            d.setCardLayout("AMPLIADO");
        }
        String target = f.targetElement() == null ? (creating ? "DNA_COMPLETO" : d.getTargetElement()) : f.targetElement();
        if (!Set.of("DNA_COMPLETO", "ESQUEMA").contains(target)) {
            throw ApiException.badRequest("ALVO_INVALIDO", Msg.t("dna.elemento_alvo_dna_completo_ou"));
        }
        d.setTargetElement(target);
        if (f.narrativeType() != null) {
            // Seção B só existe quando o elemento-alvo da Etapa 1 é o Conjunto DNA completo
            if (!"DNA_COMPLETO".equals(target)) {
                throw ApiException.badRequest("NARRATIVA_INDISPONIVEL", Msg.t("dna.as_narrativas_so_aparecem_quando"));
            }
            d.setNarrativeType(f.narrativeType());
        } else if (creating || f.cardLayout() != null || !"DNA_COMPLETO".equals(target)) {
            // sem narrativa: o card usa só a anatomia base da Seção A escolhida na etapa 4
            d.setNarrativeType(null);
        }
        if (f.occasion() != null) {
            d.setOccasion(InputSanitizer.clean(f.occasion(), 120));
        }
        if (f.style() != null) {
            d.setStyle(InputSanitizer.clean(f.style(), 120));
        }
        if (f.seasonalTheme() != null) {
            d.setSeasonalTheme(f.seasonalTheme());
        }
        if (f.visibility() != null) {
            d.setVisibility(f.visibility());
        } else if (creating) {
            d.setVisibility(AccountService.defaultVisibility(d.getUser()));
        }
        if (f.background() != null) {
            d.setStudioConfigJson(Json.write(f.background()));
            Object color = f.background().get("color");
            if (color != null) {
                d.setBackgroundColor(String.valueOf(color));
            }
            Object video = f.background().get("backgroundVideoUrl");
            if (video != null) {
                d.setBackgroundVideoUrl(String.valueOf(video));
            }
        }
        if (d.getNarrativeType() == NarrativeType.CARTELA_SAZONAL && d.getSeasonalTheme() == null) {
            d.setSeasonalTheme(Season.AUTUMN);
        }
    }

    void replaceCells(CurrentUser user, DnaScheme d, List<DnaCellForm> cells) {
        if (cells == null || cells.size() < 2 || cells.size() > 6) {
            throw ApiException.badRequest("CELULAS_INVALIDAS", Msg.t("dna.um_dna_referencia_de_2"));
        }
        if (d.getId() != null) {
            dnaItems.deleteByDnaSchemeId(d.getId());
        }
        long milestones = cells.stream().filter(c -> Boolean.TRUE.equals(c.milestone())).count();
        if (milestones > 1) {
            throw ApiException.badRequest("MARCO_UNICO", Msg.t("dna.escolha_uma_unica_celula_como"));
        }
        DnaCell[] slots = DnaCell.values();
        Set<UUID> seen = new HashSet<>();
        for (int i = 0; i < cells.size(); i++) {
            DnaCellForm c = cells.get(i);
            if (!seen.add(c.schemeId())) {
                throw ApiException.badRequest("ESQUEMA_REPETIDO", Msg.t("dna.cada_esquema_entra_uma_vez"));
            }
            Scheme s = schemes.findById(c.schemeId()).orElseThrow(() -> ApiException.notFound("Esquema"));
            guard.requireOwner(user, s.getUser().getId(), "scheme:" + s.getId());
            DnaSchemeItem it = new DnaSchemeItem();
            it.setDnaScheme(d);
            it.setScheme(s);
            it.setCell(slots[i]);
            it.setEraLabel(c.eraLabel() == null ? null : InputSanitizer.clean(c.eraLabel(), 120));
            it.setMilestone(Boolean.TRUE.equals(c.milestone()));
            dnaItems.save(it);
        }
    }

    void deleteDnaScheme(CurrentUser user, UUID id) {
        DnaScheme d = dnaSchemes.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("dna.esquema_de_dna")));
        guard.requireOwner(user, d.getUser().getId(), "dna:" + id);
        d.setStatus(SchemeStatus.ARCHIVED);
        d.setVisibility(Visibility.PRIVATE);
    }
}
