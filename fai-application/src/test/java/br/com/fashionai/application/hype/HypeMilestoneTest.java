package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.application.service.NotificationService;
import br.com.fashionai.domain.model.HypeMilestone;
import br.com.fashionai.domain.model.HypeMilestone.Kind;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Notification;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.NotificationCategory;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.HypeMilestoneRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.HypeScoreSnapshotRepository;
import br.com.fashionai.domain.repository.HypeSignalDailyRepository;
import br.com.fashionai.domain.repository.NotificationRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.context.ApplicationEventPublisher;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * RF53 · P1-10 — marco de Hype: só subida (nunca queda), 1ª vez por entidade + marco (dedupe), no máximo um resumo por
 * dono por dia, item privado = Hype pessoal avisado só ao dono, e nada disso vira sinal de Hype.
 */
class HypeMilestoneTest {
    private final List<HypeMilestone> store = new ArrayList<>();
    private final HypeMilestoneRepository repo = mock(HypeMilestoneRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final NotificationRepository notificationRows = mock(NotificationRepository.class);
    private final WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
    private final SchemeRepository schemes = mock(SchemeRepository.class);
    private final AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-10-05T15:00:00Z"));   // 12h em São Paulo
    private final Clock clock = new Clock() {
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now.get(); }
    };
    private final List<Notification> sent = new ArrayList<>();
    private HypeMilestoneNotifier notifier;
    private final User owner = user();
    private final User other = user();

    static User user() {
        User u = new User();
        u.assignId(UUID.randomUUID());
        return u;
    }

    WardrobeItem piece(User u, String name) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(u);
        w.setName(name);
        when(pieces.findById(w.getId())).thenReturn(Optional.of(w));
        return w;
    }

    Scheme look(User u, String title) {
        Scheme s = new Scheme();
        s.assignId(UUID.randomUUID());
        s.setUser(u);
        s.setTitle(title);
        when(schemes.findById(s.getId())).thenReturn(Optional.of(s));
        return s;
    }

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        when(repo.findByEntityTypeAndEntityId(any(), any())).thenAnswer(a -> store.stream()
                .filter(m -> m.getEntityType() == a.getArgument(0) && m.getEntityId().equals(a.getArgument(1))).toList());
        when(repo.findByOwnerIdAndDigestDateOrderByAchievedAtAsc(any(), any())).thenAnswer(a -> store.stream()
                .filter(m -> m.getOwnerId().equals(a.getArgument(0)) && m.getDigestDate().equals(a.getArgument(1))).toList());
        when(repo.save(any())).thenAnswer(a -> { HypeMilestone m = a.getArgument(0); if (!store.contains(m)) store.add(m); return m; });
        when(repo.saveAll(anyList())).thenAnswer(a -> a.getArgument(0));
        when(pieces.findByIdIn(anyCollection())).thenAnswer(a -> ((Collection<UUID>) a.getArgument(0)).stream()
                .map(id -> pieces.findById(id).orElse(null)).filter(java.util.Objects::nonNull).toList());
        when(schemes.findByIdIn(anyCollection())).thenAnswer(a -> ((Collection<UUID>) a.getArgument(0)).stream()
                .map(id -> schemes.findById(id).orElse(null)).filter(java.util.Objects::nonNull).toList());
        when(notifications.notify(any(), any(), any(), any(), any(), anyString(), any(), any())).thenAnswer(a -> {
            Notification n = new Notification();
            n.assignId(UUID.randomUUID());
            User r = new User();
            r.assignId(a.getArgument(0));
            n.setRecipient(r);
            n.setType(a.getArgument(2));
            n.setResourceType(a.getArgument(3));
            n.setResourceId(a.getArgument(4));
            n.setTitle(a.getArgument(5));
            n.setBody(a.getArgument(6));
            sent.add(n);
            return n;
        });
        when(notificationRows.findById(any())).thenAnswer(a -> sent.stream().filter(n -> n.getId().equals(a.getArgument(0))).findFirst());
        when(notificationRows.save(any())).thenAnswer(a -> a.getArgument(0));
        notifier = new HypeMilestoneNotifier(repo, notifications, notificationRows, pieces, schemes, HypeScoreConfig.defaults(), null, clock);
    }

    static DomainEvents.HypeMilestone ev(HypeEntityType type, UUID id, UUID owner, Kind kind, boolean pub) {
        HypeLevel level = kind.isLevel() ? kind.level() : HypeLevel.RELEVANT;
        return new DomainEvents.HypeMilestone(type, id, owner, kind, level, kind == Kind.EMERGING ? HypeMomentum.EMERGING : HypeMomentum.RISING, 70.0, pub);
    }

    // ------------------------------------------------------------------ detecção no job (só subida)
    @Test
    void soSubidaParaEmAltaTendenciaOuViralViraMarco() {
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.RELEVANT, HypeMomentum.STABLE, HypeLevel.HOT, HypeMomentum.STABLE)).containsExactly(Kind.HOT);
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.RELEVANT, null, HypeLevel.VIRAL, null)).containsExactly(Kind.VIRAL);
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.HOT, null, HypeLevel.TRENDING, null)).containsExactly(Kind.TRENDING);
        // "dados insuficientes" (faixa nula) → Em alta é subida
        assertThat(HypeSnapshotService.milestones(true, null, null, HypeLevel.HOT, null)).containsExactly(Kind.HOT);
        // faixa e momento sobem juntos: dois marcos
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.RELEVANT, HypeMomentum.RISING, HypeLevel.HOT, HypeMomentum.EMERGING))
                .containsExactly(Kind.HOT, Kind.EMERGING);
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.LOW_SIGNAL, HypeMomentum.STABLE, HypeLevel.NICHE, HypeMomentum.EMERGING))
                .containsExactly(Kind.EMERGING);
    }

    @Test
    void quedaPermanenciaOuFaixaSemMarcoNuncaNotificam() {
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.HOT, HypeMomentum.STABLE, HypeLevel.HOT, HypeMomentum.STABLE)).isEmpty();
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.TRENDING, null, HypeLevel.HOT, null)).isEmpty();          // caiu
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.VIRAL, null, HypeLevel.RELEVANT, null)).isEmpty();        // caiu
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.VIRAL, null, null, null)).isEmpty();                     // ficou sem dados
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.NICHE, null, HypeLevel.RELEVANT, null)).isEmpty();        // subiu, mas não é marco
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.HOT, HypeMomentum.EMERGING, HypeLevel.HOT, HypeMomentum.EMERGING)).isEmpty();
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.HOT, HypeMomentum.EMERGING, HypeLevel.HOT, HypeMomentum.COOLING)).isEmpty();
        // sem estado anterior (1º cálculo ou nova versão do algoritmo): nada de avisos em massa
        assertThat(HypeSnapshotService.milestones(false, null, null, HypeLevel.VIRAL, HypeMomentum.EMERGING)).isEmpty();
    }

    /** O job publica o marco DEPOIS de gravar o estado (e o listener só roda após o commit). */
    @Test
    void jobPublicaOMarcoDepoisDeGravarOEstado() {
        HypeScoreConfig config = HypeScoreConfig.defaults();
        HypeScoreCurrentRepository current = mock(HypeScoreCurrentRepository.class);
        HypeScoreSnapshotRepository snaps = mock(HypeScoreSnapshotRepository.class);
        ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
        HypeSnapshotService job = new HypeSnapshotService(config, pieces, schemes, mock(SchemeItemRepository.class), mock(HypeSignalDailyRepository.class),
                current, snaps, mock(HypeCache.class), events);
        UUID id = UUID.randomUUID();
        HypeInputs strong = strongInputs(config);
        HypeResult r = new HypeCalculator(config).compute(strong, new HypeCalculator(config).baseline(List.of(strong)));
        assertThat(r.level()).as("entrada forte precisa cair numa faixa de marco").isIn(HypeLevel.HOT, HypeLevel.TRENDING, HypeLevel.VIRAL);

        HypeScoreCurrent before = new HypeScoreCurrent();
        before.setEntityType(HypeEntityType.PIECE);
        before.setEntityId(id);
        before.setStatus(HypeStatus.AVAILABLE);
        before.setLevel(HypeLevel.NICHE);
        when(current.findByEntityTypeAndAlgorithmVersion(HypeEntityType.PIECE, config.algorithmVersion())).thenReturn(List.of(before));
        job.persist(HypeEntityType.PIECE, List.of(new HypeSnapshotService.Entry(id, owner.getId(), strong, false, "TOPS", null, null)),
                LocalDate.of(2026, 10, 5), now.get());

        ArgumentCaptor<Object> published = ArgumentCaptor.forClass(Object.class);
        InOrder order = inOrder(current, events);
        order.verify(current).saveAll(anyList());
        order.verify(events).publishEvent(published.capture());
        DomainEvents.HypeMilestone m = (DomainEvents.HypeMilestone) published.getValue();
        assertThat(m.milestone()).isEqualTo(Kind.ofLevel(r.level()));
        assertThat(m.ownerId()).isEqualTo(owner.getId());
        assertThat(m.publicEligible()).isFalse();   // item privado: Hype pessoal (o aviso vai só para o dono)

        // segunda execução com o estado já gravado na mesma faixa: nenhum evento novo
        before.setLevel(r.level());
        before.setMomentum(r.momentum());
        job.persist(HypeEntityType.PIECE, List.of(new HypeSnapshotService.Entry(id, owner.getId(), strong, false, "TOPS", null, null)),
                LocalDate.of(2026, 10, 5), now.get());
        verify(events, times(1)).publishEvent(any(Object.class));
    }

    static HypeInputs strongInputs(HypeScoreConfig config) {
        int h = config.horizonDays();
        double[] activity = new double[h];
        double[] interactions = new double[h];
        double[] views = new double[h];
        for (int d = 0; d < h; d++) {
            double v = d < 7 ? 60 : d < 14 ? 6 : 2;   // crescimento forte e recente, com histórico
            activity[d] = v;
            interactions[d] = v * 0.8;
            views[d] = v * 3;
        }
        Map<HypeSignalType, double[]> windows = new EnumMap<>(HypeSignalType.class);
        windows.put(HypeSignalType.LIKE_CREATED, new double[]{200, 20});
        windows.put(HypeSignalType.SAVE_CREATED, new double[]{120, 10});
        return new HypeInputs(HypeEntityType.PIECE, activity, interactions, views, windows, 2000, 5000, 900, 60, 0.05, 40.0, 6.0, null, false);
    }

    // ------------------------------------------------------------------ notifier: 1ª vez, nunca queda
    @Test
    void cadaMarcoNotificaUmaVezSo() {
        WardrobeItem p = piece(owner, "Jaqueta jeans");
        assertThat(notifier.record(ev(HypeEntityType.PIECE, p.getId(), owner.getId(), Kind.HOT, true))).isTrue();
        // oscilou na borda (o recálculo ao vivo roda a cada 120 s) e subiu de novo para Em alta: nada
        assertThat(notifier.record(ev(HypeEntityType.PIECE, p.getId(), owner.getId(), Kind.HOT, true))).isFalse();
        now.set(now.get().plusSeconds(3 * 86_400));   // dias depois, ainda é a mesma 1ª vez
        assertThat(notifier.record(ev(HypeEntityType.PIECE, p.getId(), owner.getId(), Kind.HOT, true))).isFalse();
        verify(notifications, times(1)).notify(any(), any(), any(), any(), any(), anyString(), any(), any());
        assertThat(store).hasSize(1);
    }

    @Test
    void faixaMaisAltaCobreAsMenoresEEmergenteEhIndependente() {
        WardrobeItem p = piece(owner, "Bota");
        assertThat(notifier.record(ev(HypeEntityType.PIECE, p.getId(), owner.getId(), Kind.VIRAL, true))).isTrue();
        // caiu de Viral e voltou a "subir" para Em alta/Tendência: não é a 1ª vez nessas faixas
        assertThat(notifier.record(ev(HypeEntityType.PIECE, p.getId(), owner.getId(), Kind.HOT, true))).isFalse();
        assertThat(notifier.record(ev(HypeEntityType.PIECE, p.getId(), owner.getId(), Kind.TRENDING, true))).isFalse();
        assertThat(notifier.record(ev(HypeEntityType.PIECE, p.getId(), owner.getId(), Kind.EMERGING, true))).isTrue();
        assertThat(HypeMilestoneNotifier.alreadyReached(store, Kind.EMERGING)).isTrue();

        WardrobeItem q = piece(owner, "Saia");
        notifier.record(ev(HypeEntityType.PIECE, q.getId(), owner.getId(), Kind.HOT, true));
        // Em alta → Tendência é marco novo (faixa acima)
        assertThat(notifier.record(ev(HypeEntityType.PIECE, q.getId(), owner.getId(), Kind.TRENDING, true))).isTrue();
        // nada rebaixa nem apaga marco
        verify(repo, never()).delete(any());
        verify(repo, never()).deleteAll(anyList());
    }

    // ------------------------------------------------------------------ resumo diário
    @Test
    void umResumoPorDonoPorDia() {
        WardrobeItem a = piece(owner, "Jaqueta jeans");
        WardrobeItem b = piece(owner, "Tênis branco");
        Scheme c = look(owner, "Look de sábado");
        notifier.record(ev(HypeEntityType.PIECE, a.getId(), owner.getId(), Kind.HOT, true));
        Notification first = sent.get(0);
        assertThat(first.getResourceType()).isEqualTo("PIECE");
        assertThat(first.getResourceId()).isEqualTo(a.getId());
        first.setRead(true);   // a pessoa leu de manhã

        now.set(now.get().plusSeconds(3_600));
        notifier.record(ev(HypeEntityType.PIECE, b.getId(), owner.getId(), Kind.TRENDING, true));
        notifier.record(ev(HypeEntityType.SCHEME, c.getId(), owner.getId(), Kind.EMERGING, true));
        verify(notifications, times(1)).notify(any(), any(), any(), any(), any(), anyString(), any(), any());
        assertThat(first.isRead()).isFalse();   // novidade no mesmo resumo volta como não lida
        assertThat(first.getResourceType()).isEqualTo(HypeMilestoneNotifier.DIGEST_RESOURCE);
        assertThat(first.getResourceId()).isNull();
        assertThat(first.getPayloadJson()).contains("\"href\":\"/history?tab=hype\"").contains("\"count\":3");
        assertThat(Msg.resolve(Msg.PT_BR, first.getTitle())).isEqualTo("Seu Hype subiu: 3 itens hoje");
        assertThat(Msg.resolve(Msg.PT_BR, first.getBody())).contains("Jaqueta jeans entrou na faixa Em alta")
                .contains("Tênis branco chegou à faixa Tendência").contains("Look de sábado está emergindo");
        assertThat(store).extracting(HypeMilestone::getNotificationId).containsOnly(first.getId());

        // dia seguinte (São Paulo): novo resumo
        now.set(Instant.parse("2026-10-06T13:00:00Z"));
        WardrobeItem d = piece(owner, "Boné");
        notifier.record(ev(HypeEntityType.PIECE, d.getId(), owner.getId(), Kind.HOT, true));
        verify(notifications, times(2)).notify(any(), any(), any(), any(), any(), anyString(), any(), any());
        assertThat(sent.get(1).getId()).isNotEqualTo(first.getId());
        assertThat(store.get(store.size() - 1).getDigestDate()).isEqualTo(LocalDate.of(2026, 10, 6));
    }

    @Test
    void resumoNomeiaNoMaximoTresItensEOMarcoMaisAltoDeCadaUm() {
        List<HypeMilestone> day = new ArrayList<>();
        Map<UUID, String> names = new java.util.HashMap<>();
        UUID same = UUID.randomUUID();
        day.add(row(same, Kind.HOT, true));
        day.add(row(same, Kind.VIRAL, true));   // mesma peça subiu duas vezes no dia: vale a mais alta
        names.put(same, "Casaco");
        for (int i = 0; i < 4; i++) {
            UUID id = UUID.randomUUID();
            day.add(row(id, Kind.HOT, true));
            names.put(id, "Peça " + i);
        }
        HypeMilestoneNotifier.Content c = HypeMilestoneNotifier.content(day, names);
        String body = Msg.resolve(Msg.PT_BR, c.body());
        assertThat(body).contains("Casaco chegou à faixa Viral").doesNotContain("Casaco entrou na faixa Em alta").contains("E mais 2.");
        assertThat(Msg.resolve(Msg.PT_BR, c.title())).isEqualTo("Seu Hype subiu: 5 itens hoje");
        assertThat(c.payload().get("count")).isEqualTo(5);
        assertThat(HypeMilestoneNotifier.shortName("x".repeat(200))).hasSize(HypeMilestoneNotifier.NAME_MAX);
        assertThat(HypeMilestoneNotifier.shortName("a§b\u001Fc")).isEqualTo("a b c");   // não quebra o marcador de i18n
    }

    HypeMilestone row(UUID id, Kind kind, boolean pub) {
        HypeMilestone m = new HypeMilestone();
        m.setEntityType(HypeEntityType.PIECE);
        m.setEntityId(id);
        m.setOwnerId(owner.getId());
        m.setMilestone(kind);
        m.setLevel(kind.level());
        m.setPublicEligible(pub);
        return m;
    }

    @Test
    void textoTraduzidoNosTresIdiomas() {
        HypeMilestoneNotifier.Content c = HypeMilestoneNotifier.content(List.of(row(UUID.randomUUID(), Kind.TRENDING, false)),
                Map.of());
        assertThat(Msg.resolve(Msg.PT_BR, c.title())).isEqualTo("Seu Hype subiu");
        assertThat(Msg.resolve(Locale.ENGLISH, c.title())).isEqualTo("Your Hype went up");
        assertThat(Msg.resolve(Locale.forLanguageTag("es"), c.title())).isEqualTo("Tu Hype subió");
        for (Kind k : Kind.values()) {
            for (Locale l : Msg.SUPPORTED) {
                String text = Msg.resolve(l, Msg.k("notification.hype.body." + k.name(), "X"));
                assertThat(text).startsWith("X ").doesNotContain("notification.hype");
            }
        }
        assertThat(Msg.resolve(Locale.ENGLISH, Msg.k("notification.hype.personal"))).startsWith("Personal Hype");
    }

    // ------------------------------------------------------------------ privacidade
    @Test
    void itemPrivadoNotificaSoODonoComoHypePessoal() {
        WardrobeItem p = piece(owner, "Vestido (privado)");
        notifier.record(ev(HypeEntityType.PIECE, p.getId(), owner.getId(), Kind.HOT, false));
        ArgumentCaptor<UUID> to = ArgumentCaptor.forClass(UUID.class);
        verify(notifications).notify(to.capture(), isNull(), eq(NotificationType.HYPE_MILESTONE), eq("PIECE"), eq(p.getId()), anyString(), any(), any());
        assertThat(to.getAllValues()).containsOnly(owner.getId());
        assertThat(Msg.resolve(Msg.PT_BR, sent.get(0).getBody())).contains("Hype pessoal").contains("só você vê");
        assertThat(store.get(0).isPublicEligible()).isFalse();
    }

    @Test
    void nuncaAvisaOutraPessoaNemEntidadeQueSumiu() {
        WardrobeItem alheia = piece(other, "Peça de outra pessoa");
        // evento com dono errado (ex.: peça transferida entre o cálculo e o commit): ninguém é avisado
        assertThat(notifier.record(ev(HypeEntityType.PIECE, alheia.getId(), owner.getId(), Kind.VIRAL, true))).isFalse();
        assertThat(notifier.record(ev(HypeEntityType.SCHEME, UUID.randomUUID(), owner.getId(), Kind.HOT, true))).isFalse();
        assertThat(notifier.record(new DomainEvents.HypeMilestone(HypeEntityType.PIECE, alheia.getId(), null, Kind.HOT, HypeLevel.HOT, null, 70.0, true))).isFalse();
        verify(notifications, never()).notify(any(), any(), any(), any(), any(), anyString(), any(), any());
        assertThat(store).isEmpty();

        // resumo de hoje que não é do dono (id reaproveitado): cria outro em vez de editar a notificação alheia
        Notification foreign = new Notification();
        foreign.assignId(UUID.randomUUID());
        foreign.setRecipient(other);
        foreign.setType(NotificationType.HYPE_MILESTONE);
        sent.add(foreign);
        HypeMilestone stale = row(UUID.randomUUID(), Kind.HOT, true);
        stale.setDigestDate(LocalDate.of(2026, 10, 5));
        stale.setNotificationId(foreign.getId());
        store.add(stale);
        WardrobeItem mine = piece(owner, "Minha peça");
        notifier.record(ev(HypeEntityType.PIECE, mine.getId(), owner.getId(), Kind.HOT, true));
        ArgumentCaptor<UUID> to = ArgumentCaptor.forClass(UUID.class);
        verify(notifications).notify(to.capture(), any(), any(), any(), any(), anyString(), any(), any());
        assertThat(to.getValue()).isEqualTo(owner.getId());
        assertThat(foreign.getTitle()).isNull();
    }

    // ------------------------------------------------------------------ não é sinal de Hype
    @Test
    void notificacaoNuncaEmiteSinalDeHypeNemMarcaOHypeComoSujo() {
        Set<String> deps = Arrays.stream(HypeMilestoneNotifier.class.getDeclaredConstructors()).map(Constructor::getParameterTypes)
                .flatMap(Arrays::stream).map(Class::getSimpleName).collect(Collectors.toSet());
        assertThat(deps).doesNotContain("ApplicationEventPublisher", "HypeSignalRecorder", "HypeSignalDailyRepository", "HypeLiveRecalc",
                "DomainEventPublisherPort", "HypeSnapshotService");
        // o recálculo ao vivo não ouve o marco: notificar nunca dispara outro cálculo (sem laço)
        for (Method m : HypeLiveRecalc.class.getDeclaredMethods()) {
            assertThat(m.getParameterTypes()).doesNotContain(DomainEvents.HypeMilestone.class);
        }
        for (Method m : HypeSignalRecorder.class.getDeclaredMethods()) {
            assertThat(m.getParameterTypes()).doesNotContain(DomainEvents.HypeMilestone.class);
        }
        assertThat(NotificationType.HYPE_MILESTONE.category()).isEqualTo(NotificationCategory.ACHIEVEMENT);
        assertThat(NotificationType.HYPE_MILESTONE.optOutAllowed()).isTrue();
    }

    @Test
    void listenerRodaEmTransacaoPropriaDepoisDoCommit() throws Exception {
        SideEffectRunner runner = mock(SideEffectRunner.class);
        doAnswer(a -> { ((Runnable) a.getArgument(1)).run(); return null; }).when(runner).run(anyString(), any());
        HypeMilestoneNotifier wired = new HypeMilestoneNotifier(repo, notifications, notificationRows, pieces, schemes, HypeScoreConfig.defaults(), runner, clock);
        WardrobeItem p = piece(owner, "Camisa");
        wired.onMilestone(ev(HypeEntityType.PIECE, p.getId(), owner.getId(), Kind.HOT, true));
        verify(runner).run(eq("HypeMilestone"), any());
        assertThat(store).hasSize(1);
        var listener = HypeMilestoneNotifier.class.getMethod("onMilestone", DomainEvents.HypeMilestone.class)
                .getAnnotation(org.springframework.transaction.event.TransactionalEventListener.class);
        assertThat(listener.phase()).isEqualTo(org.springframework.transaction.event.TransactionPhase.AFTER_COMMIT);
    }
}
