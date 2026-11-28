package br.com.fashionai.application.marketplace;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.FaiPointsService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.domain.model.MarketplaceNegotiation;
import br.com.fashionai.domain.model.PhysicalStore;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.MarketplaceNegotiationRepository;
import br.com.fashionai.domain.repository.PhysicalStoreRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class MarketplaceNegotiationService {
    private final MarketplaceNegotiationRepository offers;
    private final WardrobeItemRepository pieces;
    private final PhysicalStoreRepository stores;
    private final UserRepository users;
    private final Guard guard;
    private final FaiPointsService points;

    public MarketplaceNegotiationService(MarketplaceNegotiationRepository offers, WardrobeItemRepository pieces,
                                         PhysicalStoreRepository stores, UserRepository users, Guard guard, FaiPointsService points) {
        this.offers = offers;
        this.pieces = pieces;
        this.stores = stores;
        this.users = users;
        this.guard = guard;
        this.points = points;
    }

    @Transactional(readOnly = true)
    public List<NegotiationView> mine(CurrentUser viewer, int page) {
        guard.requireSession(viewer);
        Instant now = Instant.now();
        return offers.findByOwnerUserIdOrCounterpartyUserIdOrderByUpdatedAtDesc(viewer.id(), viewer.id(),
                        PageRequest.of(Math.max(0, page), 30)).stream()
                .map(offer -> NegotiationView.from(offer, now)).toList();
    }

    public NegotiationView propose(CurrentUser viewer, UUID existing, NegotiationForm form) {
        active(viewer);
        Instant now = Instant.now();
        if (existing != null) {
            MarketplaceNegotiation offer = participant(viewer, existing);
            checkVersion(offer, form.version());
            if ("ACCEPTED".equals(offer.getStatus()) && offer.getExpiresAt().isAfter(now)) {
                throw conflict("Encerre o acordo vigente antes de propor novos termos.");
            }
            requireEligible(offer, piece(offer.getPieceId(), false), store(offer.getStoreId()));
            return saveTerms(offer, viewer, form, now);
        }
        WardrobeItem piece = piece(form.pieceId(), true);
        PhysicalStore store = store(form.storeId());
        UUID owner = piece.getUser().getId();
        UUID brand = storeOwner(store);
        UUID other = brand.equals(owner) ? recipient(viewer, owner, form.recipient()) : brand;
        if (!viewer.id().equals(owner) && !viewer.id().equals(other)) {
            throw ApiException.forbidden("Apenas o dono da peça e a outra parte podem negociar.");
        }
        if (offers.findByPieceIdAndStoreIdAndCounterpartyUserId(piece.getId(), store.getId(), other).isPresent()) {
            throw conflict("Já existe uma negociação para esta peça e loja. Abra a conversa existente.");
        }
        MarketplaceNegotiation offer = new MarketplaceNegotiation();
        offer.setPieceId(piece.getId());
        offer.setStoreId(store.getId());
        offer.setOwnerUserId(owner);
        offer.setCounterpartyUserId(other);
        requireEligible(offer, piece, store);
        return saveTerms(offer, viewer, form, now);
    }

    public NegotiationView decide(CurrentUser viewer, UUID id, NegotiationDecision decision) {
        active(viewer);
        MarketplaceNegotiation offer = participant(viewer, id);
        checkVersion(offer, decision.version());
        Instant now = Instant.now();
        if (decision.accept() && decision.reject()) {
            throw ApiException.badRequest("INVALID_NEGOTIATION_DECISION", "Escolha aceitar ou rejeitar.");
        }
        if (decision.accept() || decision.reject()) {
            if (!"PENDING".equals(offer.getStatus()) || !offer.getExpiresAt().isAfter(now)
                    || viewer.id().equals(offer.getProposedBy())) {
                throw conflict("Somente quem recebeu a proposta pode decidir enquanto ela estiver vigente.");
            }
            if (decision.accept()) requireEligible(offer, piece(offer.getPieceId(), true), store(offer.getStoreId()));
        } else if ("CANCELLED".equals(offer.getStatus()) || "REJECTED".equals(offer.getStatus())) {
            throw conflict("A negociação já está encerrada.");
        }
        if (decision.accept()) {
            WardrobeItem item = piece(offer.getPieceId(), true);
            var currentExpiry = item.getExpiresAt();
            if (currentExpiry != null && currentExpiry.isAfter(now)) {
                throw conflict("A peça já está vinculada a uma negociação vigente.");
            }
            item.setExpiresAt(offer.getExpiresAt());
            item.setNegotiationId(offer.getId());
            item.setNegotiationPartner(users.getReferenceById(offer.getCounterpartyUserId()));
            item.setNegotiationStartedAt(now);
            item.setForSale(true);
            item.setForDonation(false);
            if (item.getUser().getProfileType() == ProfileType.PESSOAL) {
                item.setPhysicalStoreItemId(offer.getStoreId());
                points.award(offer.getOwnerUserId(), "MARKETPLACE_PARTNERSHIP", "PIECE", item.getId().toString(), null);
            }
            if (viewer.id().equals(offer.getOwnerUserId())) {
                item.setArchiveOnExpiry(decision.archiveOnExpiry());
            }
        } else if ("ACCEPTED".equals(offer.getStatus()) && offer.getExpiresAt().isAfter(now)) {
            WardrobeItem item = piece(offer.getPieceId(), true);
            item.setExpiresAt(null);
            item.setNegotiationId(null);
            item.setNegotiationPartner(null);
            item.setNegotiationStartedAt(null);
            if (item.getUser().getProfileType() == ProfileType.PESSOAL) item.setPhysicalStoreItemId(null);
            item.setForSale(false);
        }
        offer.setStatus(decision.accept() ? "ACCEPTED" : decision.reject() ? "REJECTED" : "CANCELLED");
        offer.setUpdatedAt(now);
        return NegotiationView.from(offers.saveAndFlush(offer), now);
    }

    public void expiryPreference(CurrentUser viewer, UUID id, boolean archive) {
        active(viewer);
        WardrobeItem piece = piece(id, true);
        if (!viewer.id().equals(piece.getUser().getId())) {
            throw ApiException.forbidden("Somente o dono da peça pode alterar esta preferência.");
        }
        piece.setArchiveOnExpiry(archive);
    }

    private NegotiationView saveTerms(MarketplaceNegotiation offer, CurrentUser viewer, NegotiationForm form, Instant now) {
        if (form.amount() == null || form.amount().signum() <= 0 || form.amount().precision() - form.amount().scale() > 10
                || form.amount().stripTrailingZeros().scale() > 0 || form.expiresAt() == null || !form.expiresAt().isAfter(now)
                || (form.terms() != null && form.terms().length() > 1000) || !"FAI".equals(form.currency())) {
            throw ApiException.badRequest("INVALID_TERMS", "Informe o valor inteiro em FAI Points e uma data de expiração futura.");
        }
        offer.setCurrency("FAI");
        offer.setAmount(form.amount());
        offer.setTerms(form.terms());
        offer.setExpiresAt(form.expiresAt());
        offer.setUpdatedAt(now);
        offer.setProposedBy(viewer.id());
        offer.setStatus("PENDING");
        return NegotiationView.from(offers.saveAndFlush(offer), now);
    }

    private MarketplaceNegotiation participant(CurrentUser user, UUID id) {
        return offers.findById(id).filter(offer -> user.id().equals(offer.getOwnerUserId())
                        || user.id().equals(offer.getCounterpartyUserId()))
                .orElseThrow(() -> ApiException.notFound("Negociação"));
    }

    private void requireEligible(MarketplaceNegotiation offer, WardrobeItem piece, PhysicalStore store) {
        var owner = piece.getUser();
        var other = users.findById(offer.getCounterpartyUserId())
                .orElseThrow(() -> ApiException.notFound("Participante"));
        UUID brand = storeOwner(store);
        if (!owner.getId().equals(offer.getOwnerUserId()) || (!brand.equals(owner.getId()) && !brand.equals(other.getId()))
                || !eligible(owner) || !eligible(other) || guard.blocked(owner.getId(), other.getId())
                || WardrobeService.effectiveVisibility(piece) != Visibility.PUBLIC || piece.getModerationStatus() != ModerationStatus.APPROVED) {
            throw ApiException.forbidden("A negociação requer uma peça pública aprovada e participantes habilitados.");
        }
    }

    private UUID recipient(CurrentUser viewer, UUID owner, String username) {
        if (!viewer.id().equals(owner) || username == null || username.isBlank()) {
            throw ApiException.badRequest("RECIPIENT_REQUIRED", "Informe o usuário que receberá a proposta.");
        }
        return users.findByUsernameIgnoreCase(username.strip()).filter(user -> !user.getId().equals(owner))
                .orElseThrow(() -> ApiException.notFound("Participante")).getId();
    }

    private static UUID storeOwner(PhysicalStore store) {
        var profile = store.getBrand().getBrandProfile();
        if (profile == null || profile.getApprovalStatus() != ApprovalStatus.APROVADO || !profile.getOwner().isVerified()) {
            throw ApiException.forbidden("A loja precisa estar vinculada a uma marca verificada.");
        }
        return profile.getOwner().getId();
    }

    private PhysicalStore store(UUID id) {
        if (id == null) throw ApiException.notFound("Loja física");
        return stores.detail(id).orElseThrow(() -> ApiException.notFound("Loja física"));
    }

    private WardrobeItem piece(UUID id, boolean lock) {
        if (id == null) throw ApiException.notFound("Peça");
        return (lock ? pieces.findForSealRequest(id) : pieces.findById(id))
                .orElseThrow(() -> ApiException.notFound("Peça"));
    }

    private void active(CurrentUser viewer) {
        guard.requireCanCreate(viewer);
        if (viewer.status() != AccountStatus.ACTIVE) throw ApiException.forbidden("A conta precisa estar ativa.");
    }

    private static boolean eligible(User user) {
        return user.getStatus() == AccountStatus.ACTIVE;
    }

    private static void checkVersion(MarketplaceNegotiation offer, Long version) {
        if (version == null || offer.getVersion() != version) {
            throw conflict("A proposta mudou. Atualize a página para ler os termos atuais.");
        }
    }

    private static ApiException conflict(String message) {
        return ApiException.conflict("NEGOTIATION_CONFLICT", message);
    }
}
