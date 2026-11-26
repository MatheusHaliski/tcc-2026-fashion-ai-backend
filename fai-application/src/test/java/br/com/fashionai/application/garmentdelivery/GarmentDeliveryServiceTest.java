package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.atelierproject.AtelierProjectService;
import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.fit.SizeOptionsService;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.*;
import br.com.fashionai.application.passport.FactoryPassportIssuer;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.NotificationService;
import br.com.fashionai.application.service.ProjectionService;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.TipoLavagem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.atelierproject.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.model.passport.GarmentPassport;
import br.com.fashionai.domain.model.passport.PassportEvent;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.TipoLavagemRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import br.com.fashionai.domain.repository.atelierproject.*;
import br.com.fashionai.domain.repository.garmentdelivery.GarmentOrderEventRepository;
import br.com.fashionai.domain.repository.garmentdelivery.GarmentOrderRepository;
import br.com.fashionai.domain.repository.passport.GarmentPassportRepository;
import br.com.fashionai.domain.repository.passport.PassportEventRepository;
import br.com.fashionai.domain.repository.passport.PassportHoldingRepository;
import br.com.fashionai.domain.repository.sourcing.AtelierBomItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** FashionAI Garment Delivery — autorização, idempotência, relógio da fábrica, cancelamento e recebimento. */
class GarmentDeliveryServiceTest {
    static final String FICHA = "{\"family\":\"Camiseta\",\"modeling\":\"Reta\",\"fabric\":\"Jeans 98% algodão 2% elastano\","
            + "\"colors\":\"Azul marinho\",\"measurements\":[{\"point\":\"Tórax\",\"protocol\":\"Largura entre cavas\",\"centimeters\":52}]}";

    static final class Relogio extends Clock {
        Instant now = Instant.parse("2026-11-16T15:00:00Z");
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    DesignProjectRepository projects = MemoryRepository.of(DesignProjectRepository.class);
    DesignProjectMemberRepository members = MemoryRepository.of(DesignProjectMemberRepository.class);
    DesignRevisionRepository revisions = MemoryRepository.of(DesignRevisionRepository.class);
    UserRepository users = MemoryRepository.of(UserRepository.class);
    GarmentOrderRepository orders = MemoryRepository.of(GarmentOrderRepository.class);
    GarmentOrderEventRepository orderEvents = MemoryRepository.of(GarmentOrderEventRepository.class);
    WardrobeItemRepository pieces = MemoryRepository.of(WardrobeItemRepository.class);
    TipoLavagemRepository washTypes = MemoryRepository.of(TipoLavagemRepository.class);
    GarmentPassportRepository passports = MemoryRepository.of(GarmentPassportRepository.class);
    PassportEventRepository passportEvents = MemoryRepository.of(PassportEventRepository.class);
    NotificationService notifications = mock(NotificationService.class);
    Relogio clock = new Relogio();
    GarmentDeliveryService service;
    User ana, bia;
    DesignProject project;
    DesignRevision revision;

    CurrentUser actor(User u) { return CurrentUser.of(u, "127.0.0.1", "test"); }

    User person(String name) {
        User u = new User(name, name, name + "@x.invalid", "h" + name, "p", ProfileType.PESSOAL);
        u.setStatus(AccountStatus.ACTIVE);
        u.setEmailVerified(true);
        return users.save(u);
    }

    @BeforeEach
    void setUp() {
        when(projects.lockById(any())).thenAnswer(inv -> projects.findById(inv.getArgument(0)));
        when(orders.lockById(any())).thenAnswer(inv -> orders.findById(inv.getArgument(0)));
        Guard guard = new Guard(mock(AuditService.class), MemoryRepository.of(FollowRepository.class));
        AtelierProjectService atelier = new AtelierProjectService(projects, members, revisions, MemoryRepository.of(DesignCommentRepository.class),
                MemoryRepository.of(DesignReviewRepository.class), MemoryRepository.of(DesignVoteRepository.class), users, guard, new ObjectMapper(), true);
        SizeOptionsService sizes = mock(SizeOptionsService.class);
        when(sizes.forTaxonomy(any(), any())).thenReturn(Map.of("grid", "letter",
                "sizes", List.of("PP", "P", "M", "G", "GG", "XG").stream().map(l -> Map.<String, Object>of("label", l)).toList()));
        AssetCatalogService assets = mock(AssetCatalogService.class);
        when(assets.defaultPieceImage(any(), any())).thenReturn("/_derived/pecas_default/t_shirt.webp");
        TipoLavagem maquina = new TipoLavagem();
        maquina.setCodigo("MAQUINA_40");
        maquina.setNome("Máquina até 40 °C");
        washTypes.save(maquina);
        GarmentOrderProgress progress = new GarmentOrderProgress(orders, orderEvents, notifications, clock);
        FactoryPassportIssuer issuer = new FactoryPassportIssuer(passports, MemoryRepository.of(PassportHoldingRepository.class), passportEvents);
        GarmentOrderReceipt receipt = new GarmentOrderReceipt(pieces, users, washTypes, assets, mock(ProjectionService.class), issuer,
                mock(ApplicationEventPublisher.class));
        service = new GarmentDeliveryService(atelier, revisions, members, MemoryRepository.of(AtelierBomItemRepository.class), orders, orderEvents,
                users, guard, progress, receipt, new GarmentQuoter(sizes, assets), clock);
        ana = person("ana");
        bia = person("bia");
        project = new DesignProject();
        project.setOwnerId(ana.getId());
        project.setTitle("Camiseta Aurora");
        project.setBrief("b");
        project.setVisibility(Visibility.PUBLIC);
        project.setState(DesignProject.State.IN_REVIEW);
        project.setSpecificationJson(FICHA);
        project.setCreationKey("k");
        project.setActivityAt(clock.now);
        projects.save(project);
        revision = new DesignRevision(project.getId(), null, null, ana.getId(), 1, "Camiseta Aurora", "b", FICHA, "r1", "d", null);
        revisions.save(revision);
    }

    CreateCmd cmd(String key) {
        return new CreateCmd(key, "G", "01310-100", "Casa", "DEMO", true);
    }

    OrderDetail order() {
        return service.create(actor(ana), project.getId(), revision.getId(), cmd("order-0001"));
    }

    @Test
    void cotacaoMostraEtiquetaPassaporteEPrecoIgualParaTodosOsTamanhos() {
        Quote m = service.quote(actor(ana), project.getId(), revision.getId(), "M", "01310100", "DEMO");
        Quote gg = service.quote(actor(ana), project.getId(), revision.getId(), "GG", "01310100", "DEMO");
        assertThat(m.eligible()).isTrue();
        assertThat(m.garment().subcategory()).isEqualTo("t_shirt");
        assertThat(m.care().washCode()).isEqualTo("MAQUINA_40");
        assertThat(m.price().total()).isEqualByComparingTo(gg.price().total());
        assertThat(m.designers()).extracting(Designer::username).containsExactly("ana");
        assertThat(m.delivery().cepMasked()).isEqualTo("01310-***");
        assertThatThrownBy(() -> service.quote(actor(ana), project.getId(), revision.getId(), "XXL", null, null))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("GARMENT_ORDER_INVALID_SIZE"));
    }

    @Test
    void soQuemParticipaDoProjetoEncomendaESoADonaVeAEncomenda() {
        assertThatThrownBy(() -> service.create(actor(bia), project.getId(), revision.getId(), cmd("order-0002"))).isInstanceOf(ApiException.class);
        OrderDetail created = order();
        assertThatThrownBy(() -> service.detail(actor(bia), created.id()))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(404));
        assertThat(service.list(actor(bia))).isEmpty();
        assertThat(service.list(actor(ana))).hasSize(1);
    }

    @Test
    void criacaoEIdempotenteEGuardaSoOPrefixoDoCep() {
        OrderDetail first = order();
        assertThat(service.create(actor(ana), project.getId(), revision.getId(), cmd("order-0001")).id()).isEqualTo(first.id());
        assertThat(MemoryRepository.<Object>rows(orders)).hasSize(1);
        assertThat(orders.findById(first.id()).orElseThrow().getCepPrefix()).isEqualTo("01310");
        assertThat(first.serialNumber()).startsWith("FAI-2026-");
        assertThat(first.trackingCode()).isNull();
        assertThatThrownBy(() -> service.create(actor(ana), project.getId(), revision.getId(), new CreateCmd("order-0001", "M", "01310100", null, "DEMO", true)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("GARMENT_ORDER_KEY_REUSED"));
        assertThatThrownBy(() -> service.create(actor(ana), project.getId(), revision.getId(), new CreateCmd("order-0003", "M", "01310100", null, "DEMO", false)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("GARMENT_ORDER_SIMULATION_REQUIRED"));
    }

    @Test
    void fichaIncompletaNaoViraEncomenda() {
        DesignRevision incompleta = revisions.save(new DesignRevision(project.getId(), null, null, ana.getId(), 2, "Rascunho", "b",
                "{\"family\":\"Camiseta\",\"measurements\":[]}", "r2", "d", null));
        Quote quote = service.quote(actor(ana), project.getId(), incompleta.getId(), null, null, null);
        assertThat(quote.eligible()).isFalse();
        assertThat(quote.missingFields()).containsExactly("modeling", "fabric", "measurements");
        assertThatThrownBy(() -> service.create(actor(ana), project.getId(), incompleta.getId(), cmd("order-0004")))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("GARMENT_ORDER_INCOMPLETE_TECH_PACK"));
    }

    @Test
    void cancelarSoAntesDoCorteEEtapasSaoGravadasUmaVez() {
        OrderDetail created = order();
        clock.now = clock.now.plusSeconds(20);
        OrderDetail cancelled = service.cancel(actor(ana), created.id(), new VersionCmd(0));
        assertThat(cancelled.status()).isEqualTo("CANCELLED");
        assertThat(cancelled.timeline()).extracting(TimelineStep::state).contains("SKIPPED");
        assertThat(service.cancel(actor(ana), created.id(), new VersionCmd(9)).status()).isEqualTo("CANCELLED");
        OrderDetail other = service.create(actor(ana), project.getId(), revision.getId(), cmd("order-0005"));
        clock.now = clock.now.plusSeconds(45);
        assertThatThrownBy(() -> service.cancel(actor(ana), other.id(), new VersionCmd(0)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("GARMENT_ORDER_NOT_CANCELLABLE"));
        service.detail(actor(ana), other.id());
        service.detail(actor(ana), other.id());
        assertThat(orderEvents.findByOrderIdOrderByOccurredAtAsc(other.id())).extracting(e -> e.getStage())
                .containsExactly("PLACED", "PATTERN", "CUTTING");
    }

    @Test
    void recebimentoCriaPecaComTipoDeLavagemEPassaporteDeFabricaUmaVezSo() {
        OrderDetail created = order();
        assertThatThrownBy(() -> service.receive(actor(ana), created.id(), new VersionCmd(0)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("GARMENT_ORDER_NOT_DELIVERED"));
        clock.now = clock.now.plusSeconds(181);
        OrderDetail delivered = service.detail(actor(ana), created.id());
        assertThat(delivered.receivable()).isTrue();
        assertThat(delivered.trackingCode()).startsWith("FAI-TRK-");
        assertThat(delivered.measurements().getFirst().checked()).isNotNull();
        verify(notifications, times(2)).notify(eq(ana.getId()), isNull(), eq(NotificationType.GARMENT_DELIVERY), eq("GARMENT_ORDER"),
                eq(created.id()), any(), any(), any());
        assertThatThrownBy(() -> service.receive(actor(ana), created.id(), new VersionCmd(3)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo("GARMENT_ORDER_VERSION_CONFLICT"));
        OrderDetail received = service.receive(actor(ana), created.id(), new VersionCmd(0));
        assertThat(received.status()).isEqualTo("RECEIVED");
        assertThat(service.receive(actor(ana), created.id(), new VersionCmd(0)).pieceId()).isEqualTo(received.pieceId());
        List<WardrobeItem> made = MemoryRepository.rows(pieces);
        assertThat(made).hasSize(1);
        WardrobeItem piece = made.getFirst();
        assertThat(piece.getTipoLavagem().getCodigo()).isEqualTo("MAQUINA_40");
        assertThat(piece).extracting(WardrobeItem::getPieceOrigin, WardrobeItem::getSku, WardrobeItem::getSizeLabel, WardrobeItem::getMaterial)
                .containsExactly("SOB_ENCOMENDA", received.serialNumber(), "l", "DENIM");
        GarmentPassport passport = passports.findByPieceId(piece.getId()).orElseThrow();
        assertThat(passport.getOrigin()).isEqualTo("SOB_ENCOMENDA");
        assertThat(passport.getManufacturingJson()).contains(received.serialNumber(), received.lotCode(), "specDigest", "MAQUINA_40");
        List<PassportEvent> history = MemoryRepository.rows(passportEvents);
        assertThat(history).extracting(PassportEvent::getKind).contains("FACTORY_PLACED", "FACTORY_QUALITY_CHECK", "FACTORY_RECEIVED").hasSize(10);
        verify(notifications, times(2)).notify(any(), any(), any(), any(), any(), any(), any(), any());
    }
}
