package br.com.fashionai.application.lens;

import br.com.fashionai.application.view.Views;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/** RF54 · Lens: retenção de 30 dias, salvar como inspiração, exclusão do scan e da conta, filtro "Quero". */
class LensServiceRetentionTest extends LensServiceFixture {
    @Test
    void salvoNaoExpiraENaoSalvoSomeDepoisDe30Dias() {
        LensViews.ScanView kept = scan();
        LensViews.ScanView gone = scan();
        lens.correct(meUser, gone.id(), gone.detections().get(0).id(),
                new LensService.CorrectionCommand(null, null, "red", null, null, null, null));
        LensViews.ScanView saved = lens.setSaved(meUser, kept.id(), true);
        assertThat(saved.savedAt()).isNotNull();
        assertThat(saved.expiresAt()).isNull();

        assertThat(lens.purgeExpired(Instant.now())).isZero();                     // ninguém venceu ainda
        int removed = lens.purgeExpired(Instant.now().plus(Duration.ofDays(31)));
        assertThat(removed).isEqualTo(1);
        assertThat(scanRows).containsOnlyKeys(kept.id());
        assertThat(detectionRows.values()).allMatch(d -> d.getScanId().equals(kept.id()));
        assertThat(feedbackRows).isEmpty();
        assertThat(blobs.keySet()).noneMatch(k -> k.contains(gone.id().toString()));
        assertThat(blobs.keySet()).anyMatch(k -> k.contains(kept.id().toString()));

        LensViews.ScanView unsaved = lens.setSaved(meUser, kept.id(), false);
        assertThat(unsaved.expiresAt()).isAfter(Instant.now().plus(Duration.ofDays(29)));
        assertThat(lens.history(meUser, true, null, 0, 12).items()).isEmpty();
        assertThat(lens.history(meUser, false, null, 0, 12).items()).hasSize(1);
    }

    @Test
    void excluirScanEExcluirContaApagamImagemELinhas() {
        LensViews.ScanView a = scan();
        lens.delete(meUser, a.id());
        assertThat(scanRows).isEmpty();
        assertThat(detectionRows).isEmpty();
        assertThat(blobs).isEmpty();
        scan();
        lens.setSaved(meUser, scan().id(), true);
        lens.deleteAllFor(me.getId());
        assertThat(scanRows).isEmpty();
        assertThat(detectionRows).isEmpty();
        assertThat(blobs).isEmpty();
    }

    @Test
    void inspiracoesFiltramQueroAntesDePaginar() {
        List<UUID> wantedIds = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            LensViews.ScanView v = scan();
            if (i % 2 == 0) {
                lens.want(meUser, v.id(), v.detections().get(0).id(), true);
                wantedIds.add(v.id());
            }
        }
        Views.Page<LensViews.ScanCard> first = lens.history(meUser, null, true, 0, 2);
        assertThat(first.items()).hasSize(2);
        assertThat(first.total()).isEqualTo(3);
        assertThat(first.hasMore()).isTrue();
        Views.Page<LensViews.ScanCard> second = lens.history(meUser, null, true, 1, 2);
        assertThat(second.items()).hasSize(1);
        assertThat(second.hasMore()).isFalse();
        assertThat(Stream.concat(first.items().stream(), second.items().stream()).map(LensViews.ScanCard::id).toList())
                .containsExactlyInAnyOrderElementsOf(wantedIds);
        assertThat(lens.history(meUser, true, true, 0, 2).items()).isEmpty();
    }
}
