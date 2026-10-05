package br.com.fashionai.application.service;

import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Lookbook › Publicações (RF53): só o que o perfil mostra ao mundo, em ordem cronológica. */
class LookbookPublicationsTest {
    private final User owner = new User();
    private final SchemeRepository schemes = mock(SchemeRepository.class);
    private final WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
    private final Guard guard = mock(Guard.class);
    private final LookbookService lookbook = new LookbookService(schemes, null, pieces, null, null, null, null, null, null, null, null, null, null, guard, null);

    LookbookPublicationsTest() {
        owner.assignId(UUID.randomUUID());
        owner.setProfileVisibility(Visibility.PUBLIC);
    }

    Scheme look(SchemeStatus status, Visibility v, Instant publishedAt) {
        Scheme s = new Scheme();
        s.assignId(UUID.randomUUID());
        s.setUser(owner);
        s.setStatus(status);
        s.setVisibility(v);
        s.setPublishedAt(publishedAt);
        return s;
    }

    WardrobeItem piece(Visibility v, ModerationStatus m) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(owner);
        w.setVisibility(v);
        w.setModerationStatus(m);
        w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        return w;
    }

    @Test
    void onlyPublishedLooksAndVisiblePiecesInChronologicalOrder() {
        Instant t0 = Instant.parse("2026-09-01T10:00:00Z");
        Scheme published = look(SchemeStatus.PUBLISHED, Visibility.PUBLIC, t0.plusSeconds(3600));
        Scheme draft = look(SchemeStatus.DRAFT, Visibility.PUBLIC, null);
        Scheme privateLook = look(SchemeStatus.PUBLISHED, Visibility.PRIVATE, t0);
        WardrobeItem visible = piece(Visibility.PUBLIC, ModerationStatus.APPROVED);
        visible.markCreatedAt(t0.plusSeconds(7200));
        WardrobeItem hidden = piece(Visibility.PRIVATE, ModerationStatus.APPROVED);
        hidden.markCreatedAt(t0);
        WardrobeItem inReview = piece(Visibility.PUBLIC, ModerationStatus.PENDING);
        inReview.markCreatedAt(t0);
        when(schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(owner.getId(), SchemeStatus.ARCHIVED)).thenReturn(List.of(draft, published, privateLook));
        when(pieces.findByUserIdOrderByCreatedAtDesc(owner.getId())).thenReturn(List.of(visible, hidden, inReview));
        when(guard.canView(any(), eq(owner.getId()), eq(Visibility.PUBLIC))).thenReturn(true);

        List<Object[]> rows = lookbook.publicationRows(null, owner);
        assertThat(rows).extracting(r -> r[1]).containsExactly(visible, published);
    }
}
