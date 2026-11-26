package br.com.fashionai.application.passport;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.passport.GarmentPassportService.EventView;
import br.com.fashionai.application.passport.GarmentPassportService.EvidenceView;
import br.com.fashionai.application.passport.GarmentPassportService.ShareView;
import br.com.fashionai.application.passport.GarmentPassportService.TransferView;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.passport.PassportEvent;
import br.com.fashionai.domain.model.passport.PassportEvidence;
import br.com.fashionai.domain.model.passport.PassportShare;
import br.com.fashionai.domain.model.passport.PassportTransfer;
import br.com.fashionai.domain.repository.UserRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Projeções do passaporte da peça. Eventos de fábrica ({@code FACTORY_*}) são registrados pelo sistema; os demais são
 * declarações da pessoa. O registro de fabricação sai inteiro para a dona e só com os campos permitidos no link público.
 */
final class PassportViews {
    private PassportViews() {
    }

    static final String OWNER_DECLARED = "OWNER_DECLARED";
    static final String SYSTEM_RECORDED = "SYSTEM_RECORDED";
    /** Campos do registro de fabricação que podem ir para o link público (designers e rastreio nunca vão). */
    private static final Set<String> PUBLIC_MANUFACTURING = Set.of("factoryCode", "serialNumber", "lotCode", "revisionNumber",
            "specDigest", "sizeLabel", "sizeGrid", "measurements", "composition", "care", "producedAt");

    static String provenance(String kind) {
        return kind != null && kind.startsWith(FactoryPassportIssuer.KIND_PREFIX) ? SYSTEM_RECORDED : OWNER_DECLARED;
    }

    /** A narrativa privada de donas anteriores nunca acompanha a peça física. */
    static EventView event(PassportEvent e, UUID viewerId) {
        return new EventView(e.getId(), e.getKind(), e.getOccurredOn(), e.getAuthorId().equals(viewerId) ? e.getNotes() : null,
                provenance(e.getKind()), e.getCorrectsEventId());
    }

    static ShareView share(PassportShare s) {
        return new ShareView(s.getId(), Set.of(s.getFields().split(",")), s.getExpiresAt(), s.getRevokedAt() != null, s.getVersion());
    }

    static TransferView transfer(PassportTransfer t, Instant now) {
        String state = "PENDING".equals(t.getStatus()) && !t.getExpiresAt().isAfter(now) ? "EXPIRED" : t.getStatus();
        return new TransferView(t.getId(), t.getPassportId(), state, t.getExpiresAt(), t.getVersion(), t.getRecipientPieceId());
    }

    static EvidenceView evidence(PassportEvidence e, Instant now) {
        return new EvidenceView(e.getId(), e.getKind(), e.getExpiresAt().isAfter(now) ? "PRESENTED_UNVERIFIED" : "EXPIRED", e.getExpiresAt(), e.getVersion());
    }

    /** Registro de fabricação: inteiro (com o nome atual de cada designer) para a dona, filtrado para o link público. */
    static Map<String, Object> manufacturing(String json, UserRepository users, boolean publicScope) {
        Map<String, Object> record = Json.map(json);
        if (record.isEmpty()) {
            return null;
        }
        if (publicScope) {
            Map<String, Object> out = new LinkedHashMap<>();
            record.forEach((key, value) -> {
                if (PUBLIC_MANUFACTURING.contains(key)) {
                    out.put(key, value);
                }
            });
            out.put("provenance", SYSTEM_RECORDED);
            return out;
        }
        if (record.get("designers") instanceof List<?> designers) {
            List<Map<String, Object>> named = new ArrayList<>();
            for (Object item : designers) {
                if (item instanceof Map<?, ?> d && d.get("userId") instanceof String id) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("userId", id);
                    row.put("username", username(users, id));
                    row.put("role", d.get("role"));
                    named.add(row);
                }
            }
            record.put("designers", named);
        }
        record.put("provenance", SYSTEM_RECORDED);
        return record;
    }

    /** Etiqueta de cuidados estruturada do registro de fabricação, ou nulo quando a peça não veio da fábrica. */
    static Object careLabel(String json) {
        return Json.map(json).get("care");
    }

    private static String username(UserRepository users, String id) {
        try {
            return users.findById(UUID.fromString(id)).filter(u -> u.getStatus() != AccountStatus.DELETED).map(User::getUsername)
                    .orElse(Msg.t("account.conta_excluida"));
        } catch (IllegalArgumentException ex) {
            return Msg.t("account.conta_excluida");
        }
    }
}
