package br.com.fashionai.application.passport;

import br.com.fashionai.application.passport.GarmentPassportService.EventView;
import br.com.fashionai.application.passport.GarmentPassportService.EvidenceView;
import br.com.fashionai.application.passport.GarmentPassportService.ShareView;
import br.com.fashionai.application.passport.GarmentPassportService.TransferView;
import br.com.fashionai.domain.model.passport.PassportEvent;
import br.com.fashionai.domain.model.passport.PassportEvidence;
import br.com.fashionai.domain.model.passport.PassportShare;
import br.com.fashionai.domain.model.passport.PassportTransfer;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/**
 * Projeções do passaporte da peça. Eventos de fábrica ({@code FACTORY_*}, gravados quando a encomenda existia) seguem
 * como registro do sistema; os demais são declarações da pessoa.
 */
final class PassportViews {
    private PassportViews() {
    }

    static final String OWNER_DECLARED = "OWNER_DECLARED";
    static final String SYSTEM_RECORDED = "SYSTEM_RECORDED";
    /** Prefixo dos eventos gravados pela antiga encomenda à Fábrica FashionAI (projeto futuro, docs/futuro/garment-delivery). */
    private static final String FACTORY_KIND_PREFIX = "FACTORY_";

    static String provenance(String kind) {
        return kind != null && kind.startsWith(FACTORY_KIND_PREFIX) ? SYSTEM_RECORDED : OWNER_DECLARED;
    }

    /** A narrativa privada de donas anteriores nunca acompanha a peça física. */
    static EventView event(PassportEvent e, UUID viewerId) {
        return new EventView(e.getId(), e.getKind(), e.getOccurredOn(), e.getAuthorId().equals(viewerId) ? e.getNotes() : null,
                provenance(e.getKind()), e.getCorrectsEventId());
    }

    static ShareView share(PassportShare s) {
        return new ShareView(s.getId(), Set.of(s.getFields().split(",")), s.getExpiresAt(), s.getRevokedAt() != null, s.getVersion());
    }

    static TransferView transfer(PassportTransfer t, Instant now) {
        String state = "PENDING".equals(t.getStatus()) && !t.getExpiresAt().isAfter(now) ? "EXPIRED" : t.getStatus();
        return new TransferView(t.getId(), t.getPassportId(), state, t.getExpiresAt(), t.getVersion(), t.getRecipientPieceId());
    }

    static EvidenceView evidence(PassportEvidence e, Instant now) {
        return new EvidenceView(e.getId(), e.getKind(), e.getExpiresAt().isAfter(now) ? "PRESENTED_UNVERIFIED" : "EXPIRED", e.getExpiresAt(), e.getVersion());
    }
}
