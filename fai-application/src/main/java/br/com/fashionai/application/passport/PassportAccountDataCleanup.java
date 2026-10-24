package br.com.fashionai.application.passport;

import br.com.fashionai.application.privacy.AccountDataCleanup;
import br.com.fashionai.domain.model.passport.*;
import br.com.fashionai.domain.repository.passport.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.UUID;

/** Removes personal payloads even when the physical unit has already changed hands. Always active. */
@Component
public class PassportAccountDataCleanup implements AccountDataCleanup {
    private static final UUID ANONYMOUS=new UUID(0,0);
    private final GarmentPassportRepository passports;
    private final PassportEventRepository events;
    private final PassportEvidenceRepository evidence;
    private final PassportShareRepository shares;
    private final PassportTransferRepository transfers;
    private final PassportHoldingRepository holdings;
    public PassportAccountDataCleanup(GarmentPassportRepository passports, PassportEventRepository events,
            PassportEvidenceRepository evidence, PassportShareRepository shares, PassportTransferRepository transfers,
            PassportHoldingRepository holdings) {
        this.passports=passports; this.events=events; this.evidence=evidence; this.shares=shares;
        this.transfers=transfers; this.holdings=holdings;
    }
    @Override @Transactional
    public void purge(UUID userId) {
        Instant now=Instant.now();
        for(PassportEvidence e:evidence.findByControllerId(userId)) {
            e.setContentBase64(null); e.setContentHash(null); e.setDeletedAt(now); e.setControllerId(ANONYMOUS);
            e.setCommandKey("erased_"+e.getId()); evidence.save(e);
        }
        for(PassportEvent e:events.findByAuthorId(userId)) {
            e.setNotes(null); e.setAuthorId(ANONYMOUS); e.setCommandKey("erased_"+e.getId()); events.save(e);
        }
        for(PassportHolding h:holdings.findByOwnerId(userId)) { h.setOwnerId(ANONYMOUS); holdings.save(h); }
        for(PassportShare s:shares.findByOwnerId(userId)) {
            s.setRevokedAt(now); s.setOwnerId(ANONYMOUS); shares.save(s);
        }
        for(PassportTransfer t:transfers.findByFromOwnerIdOrRecipientId(userId,userId)) {
            if("PENDING".equals(t.getStatus())) t.setStatus("CANCELLED");
            if(userId.equals(t.getFromOwnerId())) t.setFromOwnerId(ANONYMOUS);
            if(userId.equals(t.getRecipientId())) t.setRecipientId(ANONYMOUS);
            t.setCommandKey("erased_"+t.getId()); transfers.save(t);
        }
        for(GarmentPassport p:passports.findByOwnerId(userId)) {
            // User row remains anonymized by AccountService; no account identity is invented for the physical unit.
            p.setComposition(null); p.setCare(null); p.setOrigin("UNKNOWN"); p.setPendingTransferId(null); p.setStateUpdatedAt(now);
            for(PassportShare s:shares.findByPassportId(p.getId())) { s.setRevokedAt(now); shares.save(s); }
            passports.save(p);
        }
    }
}
