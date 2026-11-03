package br.com.fashionai.application.lens;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.LensDetection;
import br.com.fashionai.domain.model.LensScan;
import br.com.fashionai.domain.repository.LensDetectionRepository;
import br.com.fashionai.domain.repository.LensScanRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** Histórico e inspirações do Lens: página de cartões dos scans do dono (salvos, não salvos, com peça "Quero"). */
final class LensHistory {
    private final LensScanRepository scans;
    private final LensDetectionRepository detections;
    private final LensMatcher matcher;
    private final LensRequestContext.Sources live;

    LensHistory(LensScanRepository scans, LensDetectionRepository detections, LensMatcher matcher,
                LensRequestContext.Sources live) {
        this.scans = scans;
        this.detections = detections;
        this.matcher = matcher;
        this.live = live;
    }

    /** {@code saved} filtra salvos/não salvos; {@code wanted} só scans com alguma peça "Quero". */
    Views.Page<LensViews.ScanCard> history(CurrentUser user, Boolean saved, Boolean wanted, int page, int size) {
        LensScanAccess.requireUser(user);
        int sz = Math.max(1, Math.min(50, size <= 0 ? 12 : size));
        int pg = Math.max(0, page);
        PageRequest req = PageRequest.of(pg, sz);
        boolean onlyWanted = Boolean.TRUE.equals(wanted);
        // "Quero" filtrado na consulta: a página, o total e o hasMore contam só os scans que casam
        Page<LensScan> result = onlyWanted ? scans.findWanted(user.id(), saved, req)
                : saved == null ? scans.findByUserIdOrderByCreatedAtDesc(user.id(), req)
                : saved ? scans.findByUserIdAndSavedAtIsNotNullOrderByCreatedAtDesc(user.id(), req)
                : scans.findByUserIdAndSavedAtIsNullOrderByCreatedAtDesc(user.id(), req);
        List<LensScan> rows = result.getContent();
        Map<UUID, List<LensDetection>> byScan = rows.isEmpty() ? Map.of()
                : detections.findByScanIdIn(rows.stream().map(LensScan::getId).toList()).stream()
                .filter(d -> d.getDismissedAt() == null)
                .collect(Collectors.groupingBy(LensDetection::getScanId));
        LensRequestContext ctx = live.open(user);
        List<LensViews.ScanCard> items = new ArrayList<>();
        for (LensScan s : rows) {
            List<LensDetection> ds = byScan.getOrDefault(s.getId(), List.of()).stream()
                    .sorted(Comparator.comparingInt(LensDetection::getOrdinal)).toList();
            int owned = 0, gaps = 0;
            for (LensDetection d : ds) {
                if (matcher.closetMatches(ctx, d).isEmpty()) {
                    gaps++;
                } else {
                    owned++;
                }
            }
            List<LensViews.StyleShare> st = LensReading.styles(ds.stream().map(LensDetectionFields::readingPiece).toList());
            items.add(new LensViews.ScanCard(s.getId(), s.getCreatedAt(), s.getSavedAt(), s.getStatus().name(), ds.size(),
                    st.isEmpty() ? null : st.get(0).key(), owned, gaps));
        }
        return new Views.Page<>(items, pg, sz, result.getTotalElements(), result.hasNext());
    }
}
