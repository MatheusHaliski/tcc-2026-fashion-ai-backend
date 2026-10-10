package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.MirrorState;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.MirrorStateRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * WARDROBE-FIX: no espelho, a pessoa escolhe qualquer peça do guarda-roupa para um slot, sem IA. A lista segue as
 * mesmas regras do Vista-me (só peças elegíveis) e marca as que já estão no espelho.
 */
class MirrorWardrobePickerTest {

    private final UUID userId = UUID.randomUUID();
    private final CurrentUser user = new CurrentUser(userId, "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private MirrorStateRepository mirrors;
    private WardrobeService wardrobe;
    private AiEngine ai;
    private MirrorService service;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        mirrors = mock(MirrorStateRepository.class);
        wardrobe = mock(WardrobeService.class);
        RoomService room = mock(RoomService.class);
        ai = mock(AiEngine.class);
        ObjectProvider<MirrorService.PieceRestrictionProvider> restrictions = mock(ObjectProvider.class);
        when(restrictions.orderedStream()).thenAnswer(i -> Stream.empty());
        when(room.outOfSeason(userId)).thenReturn(Set.of());
        when(room.locateAll(userId)).thenReturn(Map.of());
        service = new MirrorService(mirrors, mock(WardrobeItemRepository.class), wardrobe, room, mock(SchemeService.class),
                mock(SchemeRepository.class), mock(SchemeItemRepository.class), mock(DailyLookService.class), mock(StyleDnaRepository.class),
                restrictions, ai, mock(Audit.class), mock(ApplicationEventPublisher.class), mock(HypeQueryService.class), mock(br.com.fashionai.domain.repository.TipoLookRepository.class));
    }

    private WardrobeItem piece(String name, String category) {
        WardrobeItem w = new WardrobeItem();
        ReflectionTestUtils.setField(w, "id", UUID.randomUUID());
        w.setName(name);
        w.setCategory(category);
        w.setDisponivel(true);
        w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        return w;
    }

    @Test
    @SuppressWarnings("unchecked")
    void listsEveryEligiblePieceOfTheSlotAndMarksTheOneAlreadyInTheMirror() {
        WardrobeItem shirt = piece("Camisa linho", "upper_piece");
        shirt.setSubcategory("camisa");
        WardrobeItem polo = piece("Polo azul", "upper_piece");   // sem subcategoria (cadastro antigo): continua "upper"
        WardrobeItem jeans = piece("Jeans reto", "lower_piece");
        when(wardrobe.eligible(userId)).thenReturn(List.of(shirt, polo, jeans));
        MirrorState state = new MirrorState();
        state.setUserId(userId);
        state.setSlotsJson("{\"upper\":\"" + shirt.getId() + "\"}");
        when(mirrors.findByUserId(userId)).thenReturn(Optional.of(state));

        Map<String, Object> out = service.wardrobe(user, "upper");

        List<Map<String, Object>> pieces = (List<Map<String, Object>>) out.get("pieces");
        assertThat(pieces).extracting(p -> p.get("name")).containsExactly("Camisa linho", "Polo azul");
        assertThat(pieces).extracting(p -> p.get("inMirror")).containsExactly(true, false);
        assertThat(out).doesNotContainKey("message");
        verifyNoInteractions(ai);   // escolha manual: nenhuma chamada de IA
    }

    @Test
    void emptySlotPointsToAddingAPieceInsteadOfFailing() {
        when(wardrobe.eligible(userId)).thenReturn(List.of(piece("Jeans reto", "lower_piece")));
        when(mirrors.findByUserId(any())).thenReturn(Optional.empty());

        Map<String, Object> out = service.wardrobe(user, "shoes");

        assertThat((List<?>) out.get("pieces")).isEmpty();
        assertThat(out.get("href")).isEqualTo("/pieces/new");
        assertThat(out.get("message")).isNotNull();
    }

    @Test
    void placingWithoutAPieceIsABadRequestNotAServerError() {
        assertThatThrownBy(() -> service.place(user, null)).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(400));
    }

    @Test
    void rejectsAnUnknownSlot() {
        assertThatThrownBy(() -> service.wardrobe(user, "chapeu")).isInstanceOf(ApiException.class);
    }
}
