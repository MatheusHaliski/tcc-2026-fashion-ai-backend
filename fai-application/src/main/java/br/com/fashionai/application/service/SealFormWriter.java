package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.seal.SealDesigns;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.SealService.SealForm;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.repository.AiInferenceLogRepository;
import br.com.fashionai.domain.repository.SealRepository;
import br.com.fashionai.domain.repository.UserRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * RF25 — criação e edição do selo pelo emissor (política padronizada, desenho do medalhão, ícone, janela, teto e
 * validade) e os selos padrão da aprovação do perfil. Colaborador do {@link SealService} (R80).
 */
final class SealFormWriter {
    private final SealRepository seals;
    private final UserRepository users;
    private final Guard guard;
    private final Audit audit;
    private final OwnMedia ownMedia;
    private final SealIssuers issuers;
    private final SealViews views;
    private final Supplier<AiInferenceLogRepository> inferenceLogs;

    SealFormWriter(SealRepository seals, UserRepository users, Guard guard, Audit audit, OwnMedia ownMedia, SealIssuers issuers, SealViews views, Supplier<AiInferenceLogRepository> inferenceLogs) {
        this.seals = seals;
        this.users = users;
        this.guard = guard;
        this.audit = audit;
        this.ownMedia = ownMedia;
        this.issuers = issuers;
        this.views = views;
        this.inferenceLogs = inferenceLogs;
    }

    Map<String, Object> createSeal(CurrentUser user, SealForm form) {
        issuers.requireIssuer(user);
        User owner = users.findById(user.id()).orElseThrow();
        Seal s = new Seal();
        s.setOwner(owner);
        applySeal(s, form, owner);
        seals.save(s);
        audit.log(user, AuditActions.SELO_EDITADO, "seal:" + s.getId(), Map.of("op", "create"));
        return views.sealViews(List.of(s)).get(0);
    }

    Map<String, Object> updateSeal(CurrentUser user, UUID sealId, SealForm form) {
        issuers.requireIssuer(user);
        Seal s = seals.findById(sealId).orElseThrow(() -> ApiException.notFound("Selo"));
        guard.requireOwner(user, s.getOwner().getId(), "seal:" + sealId);
        applySeal(s, form, s.getOwner());
        audit.log(user, AuditActions.SELO_EDITADO, "seal:" + s.getId(), Map.of("op", "update"));
        return views.sealViews(List.of(s)).get(0);
    }

    private void applySeal(Seal s, SealForm f, User owner) {
        s.setName(InputSanitizer.required("name", f.name(), 2, 160));
        s.setTier(f.tier() == null ? SealTier.LOOK : f.tier());
        // RF25 — política padronizada (regras avaliadas pelo sistema); o texto do card é gerado a partir delas. Sem regras,
        // vale o texto antigo (selos criados antes das regras continuam com a descrição que tinham).
        Map<String, Object> policy = SealPolicies.normalize(f.policy());
        boolean hypeMode = policy != null && "HYPE".equals(policy.get("mode"));
        if (hypeMode && (s.getTier() == SealTier.PERFIL || !issuers.hypeIssuerAvailable(owner)))
            throw ApiException.badRequest("POLITICA_INVALIDA", Msg.t("sealHype.invalid_policy"));
        Object oldPolicy = Json.map(s.getBackgroundConfigJson()).get("policy");
        boolean manual = policy != null && "MANUAL".equals(policy.get("generationMode"));
        boolean hasReference = policy != null && policy.get("referenceModel") instanceof Map<?, ?>;
        if (!hypeMode && !manual && (s.getId() == null || oldPolicy instanceof Map<?, ?> op && op.containsKey("referenceModel")) && !hasReference) {
            throw ApiException.badRequest("POLITICA_IA_OBRIGATORIA", Msg.t("sealCopilot.politica_obrigatoria"));
        }
        if (hasReference && !s.getTier().name().equals(((Map<?, ?>) policy.get("referenceModel")).get("tier"))) {
            throw ApiException.badRequest("MODELO_SELO_INVALIDO", Msg.t("sealCopilot.modelo_invalido"));
        }
        if (hasReference && !manual && (!(oldPolicy instanceof Map<?, ?> old)
                || !SealPolicyCopilot.fingerprint(policy).equals(SealPolicyCopilot.fingerprint(SealViews.castMap(old))))) {
            requireGeneratedPolicy(owner.getId(), f.policy(), policy);
        }
        if (manual && s.getTier() == SealTier.PERFIL && !hasReference)
            throw ApiException.badRequest("MODELO_SELO_INVALIDO", Msg.t("sealCopilot.modelo_invalido"));
        if (manual && hasReference && ((Map<?, ?>) policy.get("referenceModel")).get("earnedSeals") instanceof Map<?, ?> earned) {
            for (Object item : (List<?>) earned.get("rules")) {
                Map<?, ?> rule = (Map<?, ?>) item;
                Seal prerequisite = seals.findById(UUID.fromString(String.valueOf(rule.get("sealId")))).orElseThrow(() -> ApiException.notFound("Seal"));
                if (!prerequisite.getOwner().getId().equals(owner.getId()) || prerequisite.getTier() == SealTier.PERFIL || prerequisite.getStatus() != SealStatus.ACTIVE)
                    throw ApiException.badRequest("MODELO_SELO_INVALIDO", Msg.t("sealCopilot.selo_nao_encontrado"));
            }
        }
        SealPolicies.Policy parsed = SealPolicies.parse(policy);
        s.setPolicyText(parsed != null ? InputSanitizer.clean(SealPolicies.describe(parsed, s.getTier()), 2048)
                : f.policy() != null ? null : InputSanitizer.clean(f.policyText(), 2048));
        // RF25 — desenho do medalhão (validado contra o catálogo) guardado junto da arte de fundo do selo.
        Map<String, Object> design = SealDesigns.normalize(f.design());
        if (design == null) {
            Object existing = Json.map(s.getBackgroundConfigJson()).get("design");
            design = existing instanceof Map<?, ?> em ? SealDesigns.normalize(SealViews.castMap(em))
                    : SealDesigns.defaultDesign(owner.getProfileType() == ProfileType.CELEBRIDADE, s.getTier());
        }
        // imagem do núcleo/emblema: só arquivo enviado pelo próprio emissor (nunca de outra pessoa ou de terceiros)
        if (design.get("core") instanceof Map<?, ?> core && core.get("imageUrl") != null) {
            ownMedia.require(owner.getId(), String.valueOf(core.get("imageUrl")), "design.core.imageUrl", false);
        }
        if ("FOLHA".equals(design.get("kind")) && design.get("label") == null) {
            design.put("label", SealDesigns.labelFrom(s.getName()));            // o título da folha é o nome do selo
        }
        Map<String, Object> cfg = new LinkedHashMap<>(f.background() == null ? Map.of() : f.background());
        cfg.put("design", design);
        if (policy != null) {
            cfg.put("policy", policy);
        } else if (f.policy() == null) {
            Object old = Json.map(s.getBackgroundConfigJson()).get("policy");      // edição antiga sem o campo: mantém
            if (old != null) {
                cfg.put("policy", old);
            }
        }
        s.setBackgroundConfigJson(Json.write(cfg));
        // ícone: arquivo enviado pelo próprio emissor (ou do catálogo do sistema) — nunca de outra pessoa, restricted/ ou terceiros
        s.setIconUrl("UPLOAD".equals(design.get("mode"))
                ? ownMedia.requireOrUnchanged(owner.getId(), String.valueOf(design.get("uploadUrl")), "design.uploadUrl", false, s.getIconUrl())
                : ownMedia.requireOrUnchanged(owner.getId(), f.iconUrl(), "iconUrl", true, s.getIconUrl()));
        if (f.availableFrom() != null && f.availableUntil() != null && f.availableUntil().isBefore(f.availableFrom())) {
            throw ApiException.badRequest("PERIODO_INVALIDO", Msg.t("common.a_disponibilidade_termina_antes_de"));
        }
        s.setAvailableFrom(f.availableFrom());
        s.setAvailableUntil(f.availableUntil());
        if (f.usageLimit() != null && f.usageLimit() < 1) {
            throw ApiException.badRequest("LIMITE_INVALIDO", Msg.t("seal.o_limite_de_emissao_precisa"));
        }
        s.setUsageLimit(f.usageLimit());
        if (f.grantValidityDays() != null && (f.grantValidityDays() < 1 || f.grantValidityDays() > SealService.MAX_GRANT_VALIDITY_DAYS)) {
            throw ApiException.badRequest("VALIDADE_INVALIDA", Msg.t("seal.validade_da_concessao_invalida", SealService.MAX_GRANT_VALIDITY_DAYS));
        }
        if (f.grantValidityDays() != null) s.setGrantValidityDays(f.grantValidityDays());   // ausente na edição: mantém
        s.setStatus(f.status() == null ? SealStatus.ACTIVE : f.status());
        // RF21.CA20 — selo de celebridade é Premium (vítreo/holográfico); de marca é têxtil/dourado.
        s.setPremium(owner.getProfileType() == ProfileType.CELEBRIDADE);
    }

    private void requireGeneratedPolicy(UUID ownerId, Map<String, Object> raw, Map<String, Object> policy) {
        try {
            UUID inferenceId = UUID.fromString(String.valueOf(raw.get("aiInferenceId")));
            var log = inferenceLogs.get() == null ? null : inferenceLogs.get().findById(inferenceId).orElse(null);
            if (log != null && ownerId.equals(log.getUserId()) && "COPILOT".equals(log.getCapability())
                    && log.getResult() == br.com.fashionai.domain.model.enums.AiCallResult.SUCCESS
                    && !"local".equals(log.getProvider())
                    && Json.strings(log.getInputSummaryJson()).contains(SealPolicyCopilot.fingerprint(policy))) return;
        } catch (IllegalArgumentException ignored) { }
        throw ApiException.badRequest("POLITICA_IA_OBRIGATORIA", Msg.t("sealCopilot.politica_obrigatoria"));
    }

    /** Selos padrão criados na aprovação do perfil (um por tier), para que o vínculo sempre tenha selo a emitir. */
    void ensureDefaultSeals(User owner) {
        if (!seals.findByOwnerIdOrderByCreatedAtDesc(owner.getId()).isEmpty()) {
            return;
        }
        boolean premium = owner.getProfileType() == ProfileType.CELEBRIDADE;
        for (SealTier tier : List.of(SealTier.PECA, SealTier.LOOK)) {
            Seal s = new Seal();
            s.setOwner(owner);
            s.setName((premium ? Msg.t("seal.selo_premium") : "Selo ") + owner.getDisplayName() + (tier == SealTier.PECA ? Msg.t("seal.peca") : " · Look"));
            s.setTier(tier);
            s.setPremium(premium);
            s.setAutoIssued(true);
            s.setPolicyText(tier == SealTier.PECA ? Msg.t("seal.concedido_a_looks_com_1") : Msg.t("seal.concedido_a_looks_com_varias"));
            s.setBackgroundConfigJson(Json.write(Map.of("design", SealDesigns.defaultDesign(premium, tier))));
            seals.save(s);
        }
    }
}
