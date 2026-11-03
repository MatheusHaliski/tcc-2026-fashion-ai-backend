package br.com.fashionai.application.moments;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.moments.MomentService.AdminChallengeRequest;
import br.com.fashionai.application.moments.MomentService.AdminMomentRequest;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Moment;
import br.com.fashionai.domain.model.MomentChallenge;
import br.com.fashionai.domain.model.enums.MomentNature;
import br.com.fashionai.domain.model.enums.MomentScope;
import br.com.fashionai.domain.model.enums.MomentStatus;
import br.com.fashionai.domain.model.enums.MomentType;
import br.com.fashionai.domain.model.enums.MomentVisibility;

import java.math.BigDecimal;
import java.time.ZoneId;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.moments.MomentInput.enumOf;
import static br.com.fashionai.application.moments.MomentInput.parseInstant;

/** Administração (§56): criar/editar um Momento oficial e seus desafios. */
final class MomentAdminWriter extends MomentSupport {
    MomentAdminWriter(MomentContext ctx) {
        super(ctx);
    }

    /** Criar/editar um Momento oficial. Eventos externos exigem fonte (§21); patrocinado exige patrocinador (§47). */
    Map<String, Object> adminSave(CurrentUser admin, UUID id, AdminMomentRequest r) {
        guard.requireAdmin(admin);
        Moment m = id == null ? new Moment() : moments.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("moment.momento")));
        if (id == null) {
            m.setCreatedByUserId(admin.id());
            m.setOfficial(true);
            m.setStatus(MomentStatus.DRAFT);
        }
        if (r.name() != null) {
            m.setName(r.name().trim());
        }
        if (m.getName() == null || m.getName().isBlank()) {
            throw ApiException.badRequest("NOME_OBRIGATORIO", Msg.t("moment.de_um_nome_ao_momento"));
        }
        if (r.slug() != null && !r.slug().isBlank()) {
            String slug = r.slug().trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9-]+", "-");
            moments.findBySlug(slug).filter(x -> !x.getId().equals(m.getId())).ifPresent(x -> {
                throw ApiException.conflict("SLUG_EM_USO", Msg.t("moment.slug_em_uso"));
            });
            m.setSlug(slug);
        } else if (m.getSlug() == null) {
            m.setSlug(new MomentGroups(ctx).slugFor(m.getName(), "fai"));
        }
        if (r.names() != null) m.setNamesJson(Json.write(r.names()));
        if (r.description() != null) m.setDescription(r.description());
        if (r.descriptions() != null) m.setDescriptionsJson(Json.write(r.descriptions()));
        if (r.type() != null) m.setType(enumOf(MomentType.class, r.type(), "type"));
        if (r.nature() != null) m.setNature(enumOf(MomentNature.class, r.nature(), "nature"));
        // o fuso vem antes das datas: hora de parede sem offset é lida no fuso do Momento
        if (r.timezone() != null) m.setTimezone(MomentTime.zone(r.timezone()).getId());
        ZoneId zone = MomentTime.zone(m.getTimezone());
        if (r.startAt() != null) m.setStartAt(parseInstant(r.startAt(), "startAt", zone));
        if (r.endAt() != null) m.setEndAt(parseInstant(r.endAt(), "endAt", zone));
        if (m.getStartAt() == null || m.getEndAt() == null || !m.getEndAt().isAfter(m.getStartAt())) {
            throw ApiException.badRequest("PERIODO_INVALIDO", Msg.t("moment.o_fim_precisa_ser_depois"));
        }
        if (r.scope() != null) m.setScope(enumOf(MomentScope.class, r.scope(), "scope"));
        if (r.visibility() != null) m.setVisibility(enumOf(MomentVisibility.class, r.visibility(), "visibility"));
        if (r.country() != null) m.setCountry(r.country().isBlank() ? null : r.country().toUpperCase(Locale.ROOT));
        if (r.region() != null) m.setRegion(r.region().isBlank() ? null : r.region());
        if (r.locale() != null) m.setLocale(r.locale().isBlank() ? null : r.locale());
        // o formulário manda a estação sempre; vazio (ou só espaços) = "sem estação", inclusive para limpar uma existente
        if (r.season() != null) m.setSeason(r.season().isBlank() ? null : enumOf(br.com.fashionai.domain.model.enums.Season.class, r.season(), "season"));
        if (r.theme() != null) m.setThemeJson(Json.write(r.theme()));
        if (r.coverUrl() != null) m.setCoverUrl(r.coverUrl().isBlank() ? null : r.coverUrl());
        if (r.bannerUrl() != null) m.setBannerUrl(r.bannerUrl().isBlank() ? null : r.bannerUrl());
        if (r.featured() != null) m.setFeatured(r.featured());
        if (r.sponsored() != null) m.setSponsored(r.sponsored());
        if (r.sponsorName() != null) m.setSponsorName(r.sponsorName().isBlank() ? null : r.sponsorName());
        if (r.sourceUrl() != null) m.setSourceUrl(r.sourceUrl().isBlank() ? null : r.sourceUrl());
        if (r.sourceNote() != null) m.setSourceNote(r.sourceNote().isBlank() ? null : r.sourceNote());
        if (r.pointsEnabled() != null) m.setPointsEnabled(r.pointsEnabled());
        if (r.basePoints() != null) m.setBasePoints(Math.max(0, Math.min(100, r.basePoints())));
        if (r.pointsMultiplier() != null) m.setPointsMultiplier(BigDecimal.valueOf(Math.max(0.5, Math.min(3.0, r.pointsMultiplier()))));
        if (r.bonusRules() != null) m.setBonusRulesJson(Json.write(r.bonusRules()));
        if (r.styleTags() != null) m.setStyleTags(Json.csv(r.styleTags()));
        if (r.occasionTags() != null) m.setOccasionTags(Json.csv(r.occasionTags()));
        if (r.colorTags() != null) m.setColorTags(Json.csv(r.colorTags()));
        if (r.interpretations() != null) m.setInterpretationsJson(Json.write(r.interpretations()));
        if (r.requiredItems() != null) m.setRequiredItemsJson(Json.write(r.requiredItems()));
        if (r.suggestedItems() != null) m.setSuggestedItemsJson(Json.write(r.suggestedItems()));
        if (r.rules() != null) m.setRulesJson(Json.write(r.rules()));
        if (r.settings() != null) m.setSettingsJson(Json.write(r.settings()));
        if (r.badgeCode() != null) m.setBadgeCode(r.badgeCode().isBlank() ? null : r.badgeCode().trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_]", "_"));
        if (m.getType() == MomentType.BRAND_EVENT) {
            m.setSponsored(true);
            if (m.getSponsorName() == null) {
                throw ApiException.badRequest("PATROCINADOR_OBRIGATORIO", Msg.t("moment.momento_de_marca_exige_patrocinador"));
            }
        }
        if ((m.getType() == MomentType.FASHION_EVENT || m.getType() == MomentType.EVENT) && m.getSourceUrl() == null && m.getSourceNote() == null) {
            throw ApiException.badRequest("FONTE_OBRIGATORIA", Msg.t("moment.evento_externo_exige_fonte"));
        }
        if (m.getNature().sensitive()) {
            m.setPointsEnabled(false);
        }
        moments.save(m);
        if (r.challenges() != null) {
            List<MomentChallenge> existing = challenges.findByMomentIdOrderBySortOrderAsc(m.getId());
            Map<String, MomentChallenge> byCode = existing.stream().collect(Collectors.toMap(MomentChallenge::getCode, c -> c, (a, b) -> a));
            Set<String> kept = new HashSet<>();
            int order = 0;
            for (AdminChallengeRequest c : r.challenges()) {
                String code = c.code() == null ? null : c.code().trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_]", "_");
                if (code == null || code.isBlank()) {
                    continue;
                }
                MomentChallenge mc = byCode.getOrDefault(code, new MomentChallenge());
                mc.setMomentId(m.getId());
                mc.setCode(code);
                mc.setName(c.name() == null ? code : c.name());
                mc.setNamesJson(c.names() == null ? null : Json.write(c.names()));
                mc.setDescription(c.description());
                mc.setKind(c.kind() == null ? br.com.fashionai.domain.model.enums.MomentChallengeKind.STYLE : enumOf(br.com.fashionai.domain.model.enums.MomentChallengeKind.class, c.kind(), "kind"));
                mc.setPoints(c.points() == null ? 15 : Math.max(0, Math.min(100, c.points())));
                mc.setStyleTags(Json.csv(c.styleTags() == null ? List.of() : c.styleTags()));
                mc.setColorTags(Json.csv(c.colorTags() == null ? List.of() : c.colorTags()));
                mc.setOccasionTags(Json.csv(c.occasionTags() == null ? List.of() : c.occasionTags()));
                mc.setParamsJson(c.params() == null ? null : Json.write(c.params()));
                mc.setActive(c.active() == null || c.active());
                mc.setSortOrder(order++);
                challenges.save(mc);
                kept.add(code);
            }
            existing.stream().filter(c -> !kept.contains(c.getCode())).forEach(c -> {
                c.setActive(false);
                challenges.save(c);
            });
        }
        return new MomentAdmin(ctx).adminDetail(admin, m.getId());
    }
}
