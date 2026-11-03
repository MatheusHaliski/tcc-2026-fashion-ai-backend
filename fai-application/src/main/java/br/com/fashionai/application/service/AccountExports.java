package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.audit.AuditActions;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.DataExportRequest;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ExportStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.repository.DataExportRequestRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.AccountService.EXPORT_TTL;

/**
 * RF3.CA04/CA24 — exportação dos dados em JSON: pacote em {@code restricted/} (só o dono baixa), lista com validade,
 * download e o job que apaga os arquivos vencidos.
 */
final class AccountExports {
    /** Mesma categoria de log de antes da extração (AccountService). */
    private static final Logger log = LoggerFactory.getLogger(AccountService.class);
    private final DataExportRequestRepository exports;
    private final MediaStoragePort storage;
    private final NotificationService notifications;
    private final Audit audit;
    private final AccountLookup lookup;
    private final AccountExportData dataPackage;

    AccountExports(DataExportRequestRepository exports, MediaStoragePort storage, NotificationService notifications, Audit audit,
                   AccountLookup lookup, AccountExportData dataPackage) {
        this.exports = exports;
        this.storage = storage;
        this.notifications = notifications;
        this.audit = audit;
        this.lookup = lookup;
        this.dataPackage = dataPackage;
    }

    Map<String, Object> requestExport(CurrentUser user) {
        User u = lookup.load(user);
        DataExportRequest req = new DataExportRequest();
        req.setUser(u);
        req.setStatus(ExportStatus.PROCESSING);
        exports.save(req);
        Map<String, Object> data = dataPackage.exportData(u);
        byte[] json = Json.write(Msg.resolveDeep(lookup.mailLocale(u), data)).getBytes(StandardCharsets.UTF_8);
        // restricted/: o /media/** público não entrega (nem guarda em cache) o pacote; só o download autenticado do dono
        MediaStoragePort.StoredObject stored = storage.put(exportKey(u.getId(), req.getId()), json, "application/json");
        req.setFileKey(stored.key());
        req.setStatus(ExportStatus.READY);
        req.setReadyAt(Instant.now());
        req.setExpiresAt(Instant.now().plus(EXPORT_TTL));
        notifications.notify(u.getId(), null, NotificationType.DATA_EXPORT_READY, "EXPORT", req.getId(),
                Msg.k("account.seus_dados_estao_prontos"), Msg.k("account.a_exportacao_em_json_fica"), null);
        audit.log(user, AuditActions.EXPORTACAO_CONTA, "export:" + req.getId(), Map.of("bytes", json.length));
        return Map.of("id", req.getId(), "status", req.getStatus(), "readyAt", req.getReadyAt(), "expiresAt", req.getExpiresAt(),
                "bytes", json.length);
    }

    static String exportKey(UUID userId, UUID exportId) {
        return "restricted/users/" + userId + "/exports/" + exportId + ".json";
    }

    /** Job de hora em hora: apaga o arquivo das exportações vencidas (7 dias); o registro fica como EXPIRED. */
    int purgeExpiredExports() {
        int removed = 0;
        for (DataExportRequest req : exports.findByExpiresAtBeforeAndFileKeyIsNotNull(Instant.now())) {
            try {
                storage.delete(req.getFileKey());
            } catch (RuntimeException ex) {
                log.warn("Exportação {}: arquivo já ausente ({})", req.getId(), ex.getMessage());
            }
            req.setFileKey(null);
            req.setStatus(ExportStatus.EXPIRED);
            removed++;
        }
        if (removed > 0) {
            log.info("Exportações LGPD vencidas removidas: {}", removed);
        }
        return removed;
    }

    List<Map<String, Object>> exportsOf(CurrentUser user) {
        return exports.findByUserIdOrderByCreatedAtDesc(user.id()).stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", e.getId());
            m.put("status", e.getExpiresAt() != null && e.getExpiresAt().isBefore(Instant.now()) ? ExportStatus.EXPIRED : e.getStatus());
            m.put("readyAt", e.getReadyAt());
            m.put("expiresAt", e.getExpiresAt());
            return m;
        }).toList();
    }

    byte[] downloadExport(CurrentUser user, UUID exportId) {
        DataExportRequest req = exports.findById(exportId).orElseThrow(() -> ApiException.notFound(Msg.t("account.exportacao")));
        if (!req.getUser().getId().equals(user.id())) {
            throw ApiException.forbidden(Msg.t("account.exportacao_de_outro_usuario"));
        }
        if (req.getExpiresAt() != null && req.getExpiresAt().isBefore(Instant.now()) || req.getFileKey() == null) {
            throw new ApiException(410, "EXPORTACAO_EXPIRADA", Msg.t("account.esta_exportacao_expirou_gere_uma"));
        }
        return storage.get(req.getFileKey());
    }
}
