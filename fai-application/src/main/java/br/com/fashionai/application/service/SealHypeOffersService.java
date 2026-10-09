package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/** Campanhas Hype de emissores aprovados, distintas dos medalhões automáticos do HypeSeals. */
@Service
public class SealHypeOffersService {
    private final SealService seals;
    private final SealRepository repository;
    private final SealBondRepository bonds;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;
    private final ObjectProvider<HypeQueryService> query;
    private final Guard guard;
    private final AiEngine ai;

    public SealHypeOffersService(SealService seals, SealRepository repository, SealBondRepository bonds,
                                 WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                                 BrandProfileRepository brands, CelebrityProfileRepository celebrities,
                                 ObjectProvider<HypeQueryService> query, Guard guard, AiEngine ai) {
        this.seals=seals; this.repository=repository; this.bonds=bonds; this.pieces=pieces; this.schemes=schemes;
        this.schemeItems=schemeItems; this.brands=brands; this.celebrities=celebrities; this.query=query; this.guard=guard; this.ai=ai;
    }

    private record Target(HypeEntityType type, UUID id, User owner, Scheme scheme, WardrobeItem piece,
                          List<WardrobeItem> pieces, List<String> occasions, List<String> styles, boolean canAssess) {
        SealTier tier() { return type == HypeEntityType.PIECE ? SealTier.PECA : SealTier.LOOK; }
        boolean publishable() {
            return canAssess && (piece != null ? piece.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED && piece.getModerationStatus() == ModerationStatus.APPROVED
                    : scheme.getStatus() == SchemeStatus.PUBLISHED && !scheme.isRevalidationPending());
        }
    }

    private Target target(CurrentUser viewer, HypeEntityType type, UUID id, boolean forRequest) {
        if (type == HypeEntityType.PIECE) {
            WardrobeItem item=(forRequest ? pieces.findForSealRequest(id) : pieces.findById(id)).filter(w -> SealService.canViewPiece(guard, viewer, w))
                    .orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
            return new Target(type,id,item.getUser(),null,item,List.of(item),Json.csv(item.getOccasionTags()),Json.csv(item.getStyleTags()),true);
        }
        Scheme scheme=(forRequest ? schemes.findForSealRequest(id) : schemes.findById(id)).filter(s -> SealService.canViewScheme(guard, viewer, s))
                .orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
        List<WardrobeItem> items=schemeItems.findBySchemeIdOrderBySortOrder(id).stream().map(SchemeItem::getWardrobeItem).filter(Objects::nonNull).toList();
        // A public look does not grant permission to inspect private wardrobe items through policy matches.
        boolean canAssess=items.stream().allMatch(item -> SealService.canViewPiece(guard,viewer,item));
        return new Target(type,id,scheme.getUser(),scheme,null,items,Json.csv(scheme.getOccasion()),Json.csv(scheme.getStyle()),canAssess);
    }

    private HypeScoreCurrent row(Target target) {
        HypeQueryService service=query.getIfAvailable();
        return service == null ? null : service.currentOf(target.type(),List.of(target.id())).get(target.id());
    }

    private Map<UUID,HypeScoreCurrent> freshPieceScores(Target target,HypeScoreCurrent row) {
        HypeQueryService service=query.getIfAvailable();
        if (service == null || !target.canAssess()) return Map.of();
        if (target.type() == HypeEntityType.PIECE)
            return SealService.freshHype(row,service) ? Map.of(target.id(),row) : Map.of();
        Map<UUID,HypeScoreCurrent> fresh=new HashMap<>();
        service.currentOf(HypeEntityType.PIECE,target.pieces().stream().map(WardrobeItem::getId).toList())
                .forEach((id,value) -> { if (SealService.freshHype(value,service)) fresh.put(id,value); });
        return fresh;
    }

    private SealPolicies.Verdict assess(Target target, Seal seal, HypeScoreCurrent row,Map<UUID,HypeScoreCurrent> fresh) {
        HypeQueryService service=query.getIfAvailable();
        if (!target.publishable() || !SealService.freshHype(row,service)) return new SealPolicies.Verdict(false,List.of(),null);
        SealPolicies.Policy policy=SealPolicies.parse(Json.map(seal.getBackgroundConfigJson()).get("policy"));
        if (policy == null || policy.hype() == null) return new SealPolicies.Verdict(false,List.of(),null);
        return SealPolicies.evaluate(policy,target.tier(),target.pieces(),target.occasions(),target.styles(),
                SealPolicies.HypeLookup.of(fresh,target.type() == HypeEntityType.SCHEME ? row : null));
    }

    private static boolean hypePolicy(Seal seal) {
        Object policy=Json.map(seal.getBackgroundConfigJson()).get("policy");
        return policy instanceof Map<?,?> value && "HYPE".equals(value.get("mode"));
    }

    private List<SealBond> targetBonds(Target target) {
        return target.piece() == null ? bonds.findBySchemeId(target.id()) : bonds.findByPieceId(target.id());
    }

    private SealBond activeBond(List<SealBond> targetBonds, Seal seal) {
        return targetBonds.stream().filter(b -> b.getTargetOwner().getId().equals(seal.getOwner().getId())
                && (b.getStatus() == SealBondStatus.APPROVED || b.getStatus() == SealBondStatus.PENDING_REVIEW)).findFirst().orElse(null);
    }

    private boolean requiresReview(User issuer) {
        return issuer.getProfileType() == ProfileType.CELEBRIDADE || brands.findByOwnerId(issuer.getId()).map(BrandProfile::isRequiresSealReview).orElse(true);
    }

    private Map<String,Object> metrics(HypeScoreCurrent row) {
        Map<String,Object> value=new LinkedHashMap<>();
        boolean available=SealService.freshHype(row,query.getIfAvailable());
        value.put("available",available); value.put("stale",row != null && !available && row.getStatus() == HypeStatus.AVAILABLE);
        value.put("status",row == null ? "NOT_CALCULATED" : row.getStatus().name());
        value.put("score",row == null ? null : row.getScore()); value.put("level",row == null ? null : row.getLevel());
        value.put("momentum",row == null ? null : row.getMomentum()); value.put("dimensions",row == null ? Map.of() : SealPolicies.dimensions(row.getDimensions()));
        value.put("calculatedAt",row == null ? null : row.getCalculatedAt());
        return value;
    }

    @Transactional(readOnly=true)
    public Map<String,Object> offers(CurrentUser viewer,HypeEntityType type,UUID id,int requestedPage,int requestedSize) {
        Target target=target(viewer,type,id,false); HypeScoreCurrent row=row(target);
        Map<UUID,HypeScoreCurrent> fresh=freshPieceScores(target,row);
        List<SealBond> targetBonds=targetBonds(target);
        Map<UUID,Boolean> issuerAvailability=new HashMap<>();
        List<Seal> candidates=repository.findByStatus(SealStatus.ACTIVE).stream().filter(s -> s.getTier() == target.tier()
                && hypePolicy(s) && issuerAvailability.computeIfAbsent(s.getOwner().getId(), ignored -> seals.hypeIssuerAvailable(s.getOwner()))
                && (viewer == null || !guard.blocked(viewer.id(),s.getOwner().getId())) && SealService.available(s,Instant.now()))
                .sorted(Comparator.comparing(Seal::getCreatedAt,Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(Seal::getId)).toList();
        int size=Math.min(24,Math.max(1,requestedSize)),page=Math.max(0,requestedPage);
        List<Map<String,Object>> items=new ArrayList<>();
        long offset=(long)page*size;
        for (Seal seal : candidates.stream().skip(offset).limit(size).toList()) {
            SealPolicies.Verdict verdict=assess(target,seal,row,fresh); SealBond bond=activeBond(targetBonds,seal);
            boolean owned=viewer != null && viewer.id().equals(target.owner().getId());
            Map<String,Object> item=new LinkedHashMap<>(); item.put("seal",seals.sealView(seal));
            item.put("eligible",verdict.matched()); item.put("reason",verdict.matched() ? verdict.why()
                    : !SealService.freshHype(row,query.getIfAvailable()) ? Msg.t("sealHype.metrics_unavailable") : Msg.t("sealHype.not_eligible"));
            item.put("canRequest",owned && verdict.matched() && bond == null && viewer.status() == AccountStatus.ACTIVE && viewer.emailVerified());
            item.put("requiredImageRightsConsent",seal.getOwner().getProfileType() == ProfileType.CELEBRIDADE);
            item.put("requiresReview",requiresReview(seal.getOwner()));
            item.put("bond",owned && bond != null ? seals.bondView(bond) : null);
            item.put("issuerProfileUrl",brands.findByOwnerId(seal.getOwner().getId()).map(b -> "/brands/"+b.getSlug())
                    .orElseGet(() -> celebrities.findByOwnerId(seal.getOwner().getId()).map(c -> "/brands/"+c.getSlug()).orElse("/u/"+seal.getOwner().getUsername())));
            items.add(item);
        }
        Map<String,Object> out=new LinkedHashMap<>();out.put("type",type);out.put("id",id);out.put("hype",metrics(row));
        out.put("items",items);out.put("total",candidates.size());out.put("page",page);out.put("size",size);
        return out;
    }

    @Transactional
    public Map<String,Object> request(CurrentUser user,HypeEntityType type,UUID id,UUID sealId,Boolean consent) {
        guard.requireCanCreate(user);
        if (user.status() != AccountStatus.ACTIVE) throw ApiException.forbidden(Msg.t("sealHype.account_unavailable"));
        Target target=target(user,type,id,true);
        if (!user.id().equals(target.owner().getId())) throw ApiException.forbidden(Msg.t("guard.apenas_o_autor_pode_alterar"));
        Seal seal=repository.findForIssuance(sealId).filter(s -> s.getTier() == target.tier() && hypePolicy(s) && seals.hypeIssuerAvailable(s.getOwner()))
                .orElseThrow(() -> ApiException.notFound(Msg.t("common.selo")));
        if (guard.blocked(user.id(),seal.getOwner().getId())) throw ApiException.notFound(Msg.t("common.selo"));
        if (!SealService.available(seal,Instant.now())) throw ApiException.conflict("SELO_INDISPONIVEL",Msg.t("sealHype.issuer_unavailable"));
        HypeScoreCurrent row=row(target);
        SealPolicies.Verdict verdict=assess(target,seal,row,freshPieceScores(target,row));
        if (!verdict.matched()) throw ApiException.conflict("POLITICA_NAO_ATENDIDA",Msg.t("sealHype.not_eligible"));
        if (activeBond(targetBonds(target),seal) != null) throw ApiException.conflict("VINCULO_EXISTENTE",Msg.t("seal.este_esquema_ja_tem_vinculo"));
        if (seal.getOwner().getProfileType() == ProfileType.CELEBRIDADE && !Boolean.TRUE.equals(consent))
            throw ApiException.badRequest("CONSENTIMENTO_IMAGEM",Msg.t("seal.confirme_que_entende_que_o"));
        var analysis=ai.local(user.id(),AiCapability.SEALBOND_MATCHER,List.of("HypeScore atual", "Política de Hype do emissor"),() -> verdict);
        return seals.requestHype(user,seal,target.scheme(),target.piece(),verdict.why(),analysis.inferenceId(),consent);
    }
}
