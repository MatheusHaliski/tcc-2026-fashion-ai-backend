package br.com.fashionai.application.service;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.ChallengeEvent;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.repository.ChallengeEventRepository;
import br.com.fashionai.domain.repository.ChallengeVoteRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ChallengeEntriesTest {
    @Test
    void soAsEntradasDeLookViramLinhasComTituloEDono() {
        UUID instanceId = UUID.randomUUID();
        UUID me = UUID.randomUUID();
        UUID schemeId = UUID.randomUUID();
        ChallengeInstance instance = mock(ChallengeInstance.class);
        when(instance.getId()).thenReturn(instanceId);
        when(instance.getState()).thenReturn("ATIVO");
        ChallengeEvent look = event(me, "LOOK", UUID.randomUUID());
        ChallengeEvent entry = event(me, "LOOK_ENTRY", schemeId);
        Scheme scheme = mock(Scheme.class);
        when(scheme.getId()).thenReturn(schemeId);
        when(scheme.getTitle()).thenReturn("Look azul");
        ChallengeEventRepository evidence = mock(ChallengeEventRepository.class);
        when(evidence.findByInstanceId(instanceId)).thenReturn(List.of(look, entry));
        SchemeRepository schemes = mock(SchemeRepository.class);
        when(schemes.findById(schemeId)).thenReturn(Optional.of(scheme));
        SchemeItemRepository items = mock(SchemeItemRepository.class);
        when(items.findBySchemeIdOrderBySortOrder(schemeId)).thenReturn(List.of());
        CurrentUser viewer = mock(CurrentUser.class);
        when(viewer.id()).thenReturn(me);

        List<Map<String, Object>> out = new ChallengeEntries(evidence, mock(ChallengeVoteRepository.class), schemes, items, mock(UserRepository.class))
                .list(viewer, instance, false);

        assertThat(out).hasSize(1);
        assertThat(out.get(0)).containsEntry("entryId", schemeId).containsEntry("title", "Look azul").containsEntry("mine", true);
    }

    private static ChallengeEvent event(UUID user, String type, UUID ref) {
        ChallengeEvent e = mock(ChallengeEvent.class);
        when(e.getUserId()).thenReturn(user);
        when(e.getEvidenceType()).thenReturn(type);
        when(e.getRefId()).thenReturn(ref);
        return e;
    }
}
