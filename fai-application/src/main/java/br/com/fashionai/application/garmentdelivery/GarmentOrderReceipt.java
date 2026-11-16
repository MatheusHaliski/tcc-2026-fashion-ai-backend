package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.Frozen;
import br.com.fashionai.application.passport.FactoryPassportIssuer;
import br.com.fashionai.application.passport.FactoryPassportIssuer.SystemEvent;
import br.com.fashionai.application.service.PieceImages;
import br.com.fashionai.application.service.ProjectionService;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.garmentdelivery.GarmentOrder;
import br.com.fashionai.domain.model.garmentdelivery.GarmentOrderEvent;
import br.com.fashionai.domain.repository.TipoLavagemRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Recebimento confirmado: a peça entra no guarda-roupa (e, por ser peça da dona, no ACERVO, sem lugar) com o tipo de
 * lavagem gravado, e o passaporte nasce com o registro de fabricação e um evento por etapa. Os efeitos de peça nova
 * (endereço no quarto, histórico de disponibilidade, Hype, busca) seguem o mesmo evento do cadastro comum.
 */
@Component
public class GarmentOrderReceipt {
    private final WardrobeItemRepository pieces;
    private final UserRepository users;
    private final TipoLavagemRepository washTypes;
    private final AssetCatalogService assets;
    private final ProjectionService projections;
    private final FactoryPassportIssuer passports;
    private final ApplicationEventPublisher lifecycle;

    public GarmentOrderReceipt(WardrobeItemRepository pieces, UserRepository users, TipoLavagemRepository washTypes,
                               AssetCatalogService assets, ProjectionService projections, FactoryPassportIssuer passports,
                               ApplicationEventPublisher lifecycle) {
        this.pieces = pieces;
        this.users = users;
        this.washTypes = washTypes;
        this.assets = assets;
        this.projections = projections;
        this.passports = passports;
        this.lifecycle = lifecycle;
    }

    /** Devolve o id da peça criada; o chamador grava a confirmação na encomenda sob o mesmo lock. */
    UUID receive(GarmentOrder order, Frozen frozen, List<GarmentOrderEvent> stages, Instant now) {
        User owner = users.findById(order.getOwnerId()).orElseThrow(() -> ApiException.notFound("Usuário"));
        String care = GarmentLabelTexts.care(frozen.care());
        WardrobeItem piece = FactoryPiece.create(owner, order, frozen, care,
                washTypes.findByCodigo(frozen.care().washCode()).orElse(null), now);
        PieceImages.useDefault(piece, assets);
        pieces.saveAndFlush(piece);
        List<SystemEvent> events = new ArrayList<>();
        for (GarmentOrderEvent stage : stages) {
            if (FactoryPlanRules.STAGES.contains(stage.getStage())) {
                events.add(new SystemEvent(stage.getStage(), date(stage.getOccurredAt()), GarmentLabelTexts.note(stage.getStage(), order, frozen)));
            }
        }
        events.add(new SystemEvent(FactoryPlanRules.RECEIVED, date(now), GarmentLabelTexts.note(FactoryPlanRules.RECEIVED, order, frozen)));
        passports.issue(owner.getId(), piece.getId(), new FactoryPassportIssuer.Issue(GarmentLabelTexts.composition(frozen.composition()),
                care, GarmentPassportRecord.json(order, frozen, stages, now), events, "gd_" + order.getId()), now);
        projections.piece(piece);
        lifecycle.publishEvent(new DomainEvents.PieceCreated(owner.getId(), piece.getId(), false));
        return piece.getId();
    }

    private static LocalDate date(Instant at) {
        return LocalDate.ofInstant(at, FactoryPlanRules.FACTORY_ZONE);
    }
}
