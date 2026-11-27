package br.com.fashionai.application.service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.context.event.EventListener;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.SignaturePieceHistory;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserSignaturePiece;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.repository.SignaturePieceHistoryRepository;
import br.com.fashionai.domain.repository.UserSignaturePieceRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

/**
 * Exercício 18 — Peça Assinatura do perfil: a peça do PRÓPRIO guarda-roupa que a pessoa escolhe para representá-la, e
 * o histórico das escolhas. Só o dono escolhe ou remove (a pessoa vem sempre da sessão); só entra peça dele e não
 * arquivada. Cada mudança efetiva vira uma linha do histórico; repetir a mesma escolha não muda nada. Para quem
 * visita, a peça só aparece se o perfil e a peça forem visíveis para essa pessoa; o histórico é só do dono.
 */
@Service
public class SignaturePieceService {
    private static final int MAX_PAGE_SIZE = 50;

    private final UserSignaturePieceRepository choices;
    private final SignaturePieceHistoryRepository history;
    private final WardrobeItemRepository pieces;
    private final ProfileService profiles;
    private final Guard guard;

    public SignaturePieceService(UserSignaturePieceRepository choices, SignaturePieceHistoryRepository history,
                                 WardrobeItemRepository pieces, ProfileService profiles, Guard guard) {
        this.choices = choices;
        this.history = history;
        this.pieces = pieces;
        this.profiles = profiles;
        this.guard = guard;
    }

    /** A escolha da pessoa da sessão, com a revisão que a próxima gravação deve informar. */
    @Transactional(readOnly = true)
    public Map<String, Object> mine(CurrentUser user) {
        guard.requireSession(user);
        return ownerView(choices.findById(user.id()).orElse(null));
    }

    /** O que quem visita o perfil pode ver: a peça, ou nada (sem revelar se existe uma escolha privada). */
    @Transactional(readOnly = true)
    public Map<String, Object> ofProfile(CurrentUser viewer, String idOrUsername) {
        User owner = profiles.resolve(idOrUsername);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("signaturePiece", null);
        boolean self = viewer != null && viewer.id().equals(owner.getId());
        if (!self && (viewer != null && guard.blocked(viewer.id(), owner.getId())
                || !guard.canView(viewer, owner.getId(), owner.getProfileVisibility()))) {
            return out;
        }
        choices.findById(owner.getId()).flatMap(c -> pieces.findById(c.getPieceId()))
                .filter(w -> eligible(w, owner.getId()))
                .filter(w -> self || w.getModerationStatus() == ModerationStatus.APPROVED && guard.canView(viewer, owner.getId(), w.getVisibility()))
                .ifPresent(w -> out.put("signaturePiece", pieceView(w, self)));
        return out;
    }

    /** Histórico do dono, paginado (mais recente primeiro). */
    @Transactional(readOnly = true)
    public Map<String, Object> history(CurrentUser user, int page, int size) {
        guard.requireSession(user);
        Page<SignaturePieceHistory> pg = history.findByUserIdOrderByChangedAtDescIdDesc(user.id(),
                PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE)));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", pg.getContent().stream().map(SignaturePieceService::historyView).toList());
        out.put("page", pg.getNumber());
        out.put("size", pg.getSize());
        out.put("total", pg.getTotalElements());
        out.put("hasMore", pg.hasNext());
        return out;
    }

    /** Escolhe (ou troca) a Peça Assinatura. {@code expectedVersion} é a revisão lida; nula = sem conferência. */
    @Transactional
    public Map<String, Object> choose(CurrentUser user, UUID pieceId, Long expectedVersion) {
        guard.requireCanCreate(user);
        if (pieceId == null) {
            throw ApiException.badRequest("ASSINATURA_PECA_OBRIGATORIA", Msg.t("signaturePiece.peca_obrigatoria"));
        }
        UserSignaturePiece current = choices.findById(user.id()).orElse(null);
        requireVersion(current, expectedVersion);
        // peça de outra pessoa responde como inexistente: não revela que o ID existe
        WardrobeItem piece = pieces.findById(pieceId).filter(w -> w.getUser().getId().equals(user.id()))
                .orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
        if (!eligible(piece, user.id())) {
            throw ApiException.badRequest("ASSINATURA_PECA_INDISPONIVEL", Msg.t("signaturePiece.peca_indisponivel"));
        }
        if (current != null && pieceId.equals(current.getPieceId())) {
            return ownerView(current);                             // a mesma escolha: nada muda e o histórico não cresce
        }
        UserSignaturePiece next = current != null ? current : new UserSignaturePiece();
        next.setUserId(user.id());
        next.setPieceId(pieceId);
        next.setUpdatedAt(Instant.now());
        try {
            next = choices.saveAndFlush(next);
        } catch (OptimisticLockingFailureException | DataIntegrityViolationException e) {
            // duas gravações ao mesmo tempo (ou dois inserts da primeira escolha): só uma vale
            throw ApiException.conflict("ASSINATURA_ALTERADA", Msg.t("signaturePiece.alterada"));
        }
        record(user.id(), piece);
        return ownerView(next);
    }

    /** Remove a escolha atual; o histórico fica e ganha a linha da remoção. Sem escolha, não faz nada. */
    @Transactional
    public Map<String, Object> clear(CurrentUser user, Long expectedVersion) {
        guard.requireCanCreate(user);
        UserSignaturePiece current = choices.findById(user.id()).orElse(null);
        requireVersion(current, expectedVersion);
        if (current != null) {
            choices.delete(current);
            record(user.id(), null);
        }
        return ownerView(null);
    }

    /** A peça excluída deixa de ser a assinatura na mesma transação da exclusão. */
    @EventListener
    public void onPieceDeleted(DomainEvents.PieceDeleted event) {
        choices.findByPieceId(event.pieceId()).ifPresent(choice -> {
            choices.delete(choice);
            record(choice.getUserId(), null);
        });
    }

    private static void requireVersion(UserSignaturePiece current, Long expectedVersion) {
        long actual = current == null || current.getVersion() == null ? 0 : current.getVersion();
        if (expectedVersion != null && expectedVersion != actual) {
            throw ApiException.conflict("ASSINATURA_ALTERADA", Msg.t("signaturePiece.alterada"));
        }
    }

    /** Peça do dono e ainda no guarda-roupa (excluída, transferida ou de conta encerrada fica arquivada). */
    private static boolean eligible(WardrobeItem w, UUID ownerId) {
        return w.getUser().getId().equals(ownerId) && w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED;
    }

    private void record(UUID userId, WardrobeItem piece) {
        SignaturePieceHistory h = new SignaturePieceHistory();
        h.setUserId(userId);
        h.setPieceId(piece == null ? null : piece.getId());
        h.setSnapshotJson(piece == null ? null : Json.write(snapshot(piece)));
        h.setChangedAt(Instant.now());
        history.save(h);
    }

    /** Retrato mínimo guardado no histórico: nada de notas, preço, local de compra ou fotos. */
    static Map<String, Object> snapshot(WardrobeItem w) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("name", w.getName());
        s.put("category", w.getCategory());
        s.put("subcategory", w.getSubcategory());
        s.put("color", w.getColor());
        s.put("brandName", w.getBrand() != null ? w.getBrand().getName() : w.getBrandName());
        return s;
    }

    private Map<String, Object> ownerView(UserSignaturePiece choice) {
        WardrobeItem piece = choice == null ? null : pieces.findById(choice.getPieceId()).filter(w -> eligible(w, choice.getUserId())).orElse(null);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("signaturePiece", piece == null ? null : pieceView(piece, true));
        out.put("version", choice == null || choice.getVersion() == null ? 0 : choice.getVersion());
        out.put("updatedAt", choice == null ? null : choice.getUpdatedAt());
        return out;
    }

    /** Peça como aparece no perfil: identificação e imagem do card. A visibilidade só vai para o dono. */
    private static Map<String, Object> pieceView(WardrobeItem w, boolean owner) {
        Map<String, Object> v = new LinkedHashMap<>(snapshot(w));
        v.put("id", w.getId());
        v.put("colorHex", Taxonomy.hex(w.getColor()));
        v.put("imageUrl", w.getThumbnailUrl() != null ? w.getThumbnailUrl() : w.getImageUrl());
        if (owner) {
            v.put("visibility", w.getVisibility().name());
        }
        return v;
    }

    private static Map<String, Object> historyView(SignaturePieceHistory h) {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("id", h.getId());
        v.put("pieceId", h.getPieceId());
        v.put("changedAt", h.getChangedAt());
        v.put("removed", h.getSnapshotJson() == null);
        v.put("snapshot", h.getSnapshotJson() == null ? null : Json.map(h.getSnapshotJson()));
        return v;
    }
}
