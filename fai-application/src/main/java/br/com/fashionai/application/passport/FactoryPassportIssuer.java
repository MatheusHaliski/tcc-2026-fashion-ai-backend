package br.com.fashionai.application.passport;

import br.com.fashionai.domain.model.passport.GarmentPassport;
import br.com.fashionai.domain.model.passport.PassportEvent;
import br.com.fashionai.domain.model.passport.PassportHolding;
import br.com.fashionai.domain.repository.passport.GarmentPassportRepository;
import br.com.fashionai.domain.repository.passport.PassportEventRepository;
import br.com.fashionai.domain.repository.passport.PassportHoldingRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Emite o passaporte de uma peça recém-produzida pela Fábrica FashionAI (fictícia): origem "Sob encomenda", composição e
 * cuidados preenchidos, registro de fabricação e um evento por etapa com proveniência do sistema ({@code FACTORY_*}).
 * Esses tipos não estão entre os que a pessoa registra à mão. Repetir a emissão não duplica passaporte nem eventos.
 */
@Component
public class FactoryPassportIssuer {
    public static final String KIND_PREFIX = "FACTORY_";
    public static final String ORIGIN = "SOB_ENCOMENDA";

    /** Evento de etapa: tipo {@code FACTORY_<ETAPA>}, data e nota da fábrica (visível para quem é dona da peça). */
    public record SystemEvent(String stage, LocalDate occurredOn, String notes) {
    }

    /** {@code keyPrefix} identifica a encomenda nas chaves dos eventos (idempotência). */
    public record Issue(String composition, String care, String manufacturingJson, List<SystemEvent> events, String keyPrefix) {
    }

    private final GarmentPassportRepository passports;
    private final PassportHoldingRepository holdings;
    private final PassportEventRepository events;

    public FactoryPassportIssuer(GarmentPassportRepository passports, PassportHoldingRepository holdings, PassportEventRepository events) {
        this.passports = passports;
        this.holdings = holdings;
        this.events = events;
    }

    @Transactional
    public UUID issue(UUID ownerId, UUID pieceId, Issue issue, Instant now) {
        GarmentPassport passport = passports.findByPieceId(pieceId).orElse(null);
        if (passport == null) {
            passport = new GarmentPassport();
            passport.setPieceId(pieceId);
            passport.setOwnerId(ownerId);
            passport.setOrigin(ORIGIN);
            passport.setComposition(clip(issue.composition()));
            passport.setCare(clip(issue.care()));
            passport.setManufacturingJson(issue.manufacturingJson());
            passport.setStateUpdatedAt(now);
            passports.saveAndFlush(passport);
            PassportHolding holding = new PassportHolding();
            holding.setPassportId(passport.getId());
            holding.setActivePassportId(passport.getId());
            holding.setOwnerId(ownerId);
            holding.setPieceId(pieceId);
            holding.setStartedAt(now);
            holdings.save(holding);
        }
        for (SystemEvent event : issue.events()) {
            String key = issue.keyPrefix() + "_" + event.stage().toLowerCase(java.util.Locale.ROOT);
            if (events.findByPassportIdAndAuthorIdAndCommandKey(passport.getId(), ownerId, key).isPresent()) {
                continue;
            }
            PassportEvent row = new PassportEvent();
            row.setPassportId(passport.getId());
            row.setAuthorId(ownerId);
            row.setKind(KIND_PREFIX + event.stage());
            row.setOccurredOn(event.occurredOn());
            row.setNotes(event.notes());
            row.setCommandKey(key);
            events.save(row);
        }
        return passport.getId();
    }

    private static String clip(String value) {
        return value == null ? null : value.substring(0, Math.min(value.length(), 1000));
    }
}
