package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.MirrorState;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.MirrorStateRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

/**
 * RF53 · Lote Final (P3-07) — Espelho com LookScores: o look montado no espelho (manual ou pelo Vista-me) traz os mesmos
 * seis números do Copilot e do Autopiloto (LookScorer): compatibilidade com o DNA, Hype (média do v2 das peças, Hype
 * pessoal do dono), novidade, reutilização, uso comprovado e sustentabilidade. Só peças do próprio dono entram; dimensão
 * sem base fica nula ("—", nunca 0); o GET só lê o Hype gravado — nada recalcula nem vira sinal.
 */
@SuppressWarnings("unchecked")
class MirrorScoresTest {
    private final UUID uid = UUID.randomUUID();
    private final CurrentUser me = new CurrentUser(uid, "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private MirrorStateRepository mirrors;
    private WardrobeItemRepository pieces;
    private WardrobeService wardrobe;
    private SchemeRepository schemes;
    private StyleDnaRepository dnas;
    private HypeQueryService hype;
    private ApplicationEventPublisher events;
    private AiEngine ai;
    private MirrorService mirror;
    private final MirrorState state = new MirrorState();
    private final List<WardrobeItem> closet = new ArrayList<>();
    private final Map<UUID, HypeScoreCurrent> hypeRows = new HashMap<>();

    private WardrobeItem piece(UUID owner, String name, String category, String subcategory, int wears, int daysSinceWorn) {
        User u = new User();
        u.assignId(owner);
        u.setProfileType(ProfileType.PESSOAL);
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(u);
        w.setName(name);
        w.setCategory(category);
        w.setSubcategory(subcategory);
        w.setColor("black");
        w.setMaterial("COTTON");
        w.setStyleTags("casual");
        w.setOccasionTags("casual");
        w.setWearCount(wears);
        w.setLastWornDate(LocalDate.now(FaiPointsService.ZONE).minusDays(daysSinceWorn));
        w.markCreatedAt(Instant.now().minusSeconds(300L * 86400));
        w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        w.setModerationStatus(ModerationStatus.APPROVED);
        w.setVisibility(Visibility.PRIVATE);
        w.setDisponivel(true);
        closet.add(w);
        return w;
    }

    private void hypeOf(WardrobeItem w, double score) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(HypeEntityType.PIECE);
        c.setEntityId(w.getId());
        c.setStatus(HypeStatus.AVAILABLE);
        c.setScore(BigDecimal.valueOf(score));
        c.setDimensions(new HypeDimensions());
        c.setPublicEligible(false);   // privada: Hype pessoal, que o dono vê
        hypeRows.put(w.getId(), c);
    }

    private void wear(WardrobeItem... look) {
        Map<String, Object> slots = new LinkedHashMap<>();
        List<String> acc = new ArrayList<>();
        for (WardrobeItem w : look) {
            String slot = MirrorService.slotOf(w);
            if (slot.equals("accessory")) {
                acc.add(w.getId().toString());
            } else {
                slots.put(slot, w.getId().toString());
            }
        }
        slots.put("accessory", acc);
        state.setSlotsJson(Json.write(slots));
    }

    @BeforeEach
    void setUp() {
        mirrors = mock(MirrorStateRepository.class);
        pieces = mock(WardrobeItemRepository.class);
        wardrobe = mock(WardrobeService.class);
        schemes = mock(SchemeRepository.class);
        dnas = mock(StyleDnaRepository.class);
        hype = mock(HypeQueryService.class);
        events = mock(ApplicationEventPublisher.class);
        ai = mock(AiEngine.class);
        ObjectProvider<MirrorService.PieceRestrictionProvider> restrictions = mock(ObjectProvider.class);
        mirror = new MirrorService(mirrors, pieces, wardrobe, mock(RoomService.class), mock(SchemeService.class), schemes,
                mock(SchemeItemRepository.class), mock(DailyLookService.class), dnas, restrictions, ai, new Audit(e -> { }), events, hype, mock(br.com.fashionai.domain.repository.TipoLookRepository.class));
        state.setUserId(uid);
        state.setSlotsJson("{}");
        state.setShownCombinationsJson("[]");
        when(mirrors.findByUserId(uid)).thenReturn(Optional.of(state));
        when(pieces.findByIdIn(anyCollection())).thenAnswer(inv -> closet.stream().filter(w -> ((Collection<UUID>) inv.getArgument(0)).contains(w.getId())).toList());
        when(schemes.findByUserIdOrderByCreatedAtDesc(uid)).thenReturn(List.of());
        when(hype.currentOf(eq(HypeEntityType.PIECE), anyCollection())).thenAnswer(inv -> {
            Map<UUID, HypeScoreCurrent> out = new HashMap<>();
            ((Collection<UUID>) inv.getArgument(1)).forEach(id -> { if (hypeRows.containsKey(id)) out.put(id, hypeRows.get(id)); });
            return out;
        });
    }

    private void withDna() {
        StyleDna dna = new StyleDna();
        dna.setStyleKeywords("casual");
        dna.setColorPalette("black");
        dna.setOccasionKeywords("casual");
        when(dnas.findByUserId(uid)).thenReturn(Optional.of(dna));
    }

    static Map<String, Object> scores(Map<String, Object> out) {
        return (Map<String, Object>) out.get("scores");
    }

    @Test
    void lookDoEspelhoTrazOsSeisNumerosComOHypePessoalDasPecas() {
        withDna();
        WardrobeItem top = piece(uid, "Camiseta preta", "upper_piece", "t_shirt", 12, 2);
        WardrobeItem bottom = piece(uid, "Calça jeans", "lower_piece", "jeans", 0, 120);
        WardrobeItem shoes = piece(uid, "Tênis", "shoes_piece", "casual_sneakers", 4, 30);
        hypeOf(top, 80);
        hypeOf(bottom, 40);                                   // o tênis não tem Hype: fica fora da média, nunca conta 0
        wear(top, bottom, shoes);

        Map<String, Object> s = scores(mirror.state(me));
        assertThat(s).containsOnlyKeys("compatibility", "hype", "novelty", "reuse", "usage", "sustainability");
        assertThat(s.get("hype")).isEqualTo(60);               // (80 + 40) / 2 — Hype pessoal (peças privadas do dono)
        assertThat(s.get("compatibility")).isNotNull();       // ao lado do Hype, nunca somado a ele
        assertThat(s.get("novelty")).isEqualTo(100);          // nenhum par já combinado em look salvo
        assertThat(s.get("usage")).isNotNull();
        assertThat(s.get("reuse")).isNotNull();
        assertThat(s.get("sustainability")).isNotNull();
    }

    @Test
    void dimensaoSemBaseFicaNulaNuncaZero() {
        // sem DNA, sem Hype calculado e uma peça só: compatibilidade, Hype e novidade sem base ("—" na tela)
        WardrobeItem top = piece(uid, "Camiseta", "upper_piece", "t_shirt", 0, 0);
        wear(top);
        Map<String, Object> s = scores(mirror.state(me));
        assertThat(s).containsOnlyKeys("compatibility", "hype", "novelty", "reuse", "usage", "sustainability");
        assertThat(s.get("compatibility")).isNull();
        assertThat(s.get("hype")).isNull();
        assertThat(s.get("novelty")).isNull();
        assertThat(s.get("usage")).isEqualTo(0);              // 0 de verdade (nenhum uso registrado) é número
    }

    @Test
    void espelhoVazioNaoTemNumeros() {
        Map<String, Object> out = mirror.state(me);
        assertThat(out).containsKey("scores");
        assertThat(out.get("scores")).isNull();
        verifyNoInteractions(hype);
    }

    @Test
    void soAsPecasDoDonoEntramEOGetNaoEmiteSinalNemRecalcula() {
        withDna();
        WardrobeItem top = piece(uid, "Camiseta", "upper_piece", "t_shirt", 3, 10);
        WardrobeItem shoes = piece(uid, "Tênis", "shoes_piece", "casual_sneakers", 3, 10);
        WardrobeItem alheia = piece(UUID.randomUUID(), "Calça de outra pessoa", "lower_piece", "jeans", 9, 1);
        hypeOf(top, 50);
        hypeOf(alheia, 99);                                   // Hype de terceiro nunca vaza pelo espelho
        wear(top, alheia, shoes);

        Map<String, Object> s = scores(mirror.state(me));
        assertThat(s.get("hype")).isEqualTo(50);
        ArgumentCaptor<Collection<UUID>> asked = ArgumentCaptor.forClass(Collection.class);
        verify(hype).currentOf(eq(HypeEntityType.PIECE), asked.capture());
        assertThat(asked.getValue()).containsExactlyInAnyOrder(top.getId(), shoes.getId());
        verifyNoMoreInteractions(hype);                        // só a leitura do estado gravado
        verifyNoInteractions(events);                          // GET: nenhum evento (nem sinal de Hype)
    }

    @Test
    void vistaMeDevolveOLookComOsSeisNumeros() {
        withDna();
        WardrobeItem top = piece(uid, "Camiseta", "upper_piece", "t_shirt", 6, 3);
        WardrobeItem bottom = piece(uid, "Calça", "lower_piece", "jeans", 2, 90);
        WardrobeItem shoes = piece(uid, "Tênis", "shoes_piece", "casual_sneakers", 10, 1);
        hypeOf(top, 70);
        when(wardrobe.eligible(uid)).thenReturn(List.of(top, bottom, shoes));
        when(ai.text(any())).thenReturn(new AiOutcome<>(null, null, AiCallResult.FALLBACK_LOCAL, true, "local", "local", 0, BigDecimal.ZERO, null, null, null));

        Map<String, Object> out = mirror.vistaMe(me, "algo confortável para o trabalho", List.of(), null, false);
        Map<String, Object> s = scores(out);
        assertThat(s).containsOnlyKeys("compatibility", "hype", "novelty", "reuse", "usage", "sustainability");
        assertThat(s.get("hype")).isEqualTo(70);
        assertThat(s.get("compatibility")).isNotNull();
    }
}
