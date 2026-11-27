package br.com.fashionai.web.passport;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.passport.RepairOrderService;
import br.com.fashionai.application.security.CurrentUser;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import static br.com.fashionai.application.passport.RepairOrderViews.*;

/** RF-PESQ-05 — ordens de reparo do passaporte; o recibo é privado e nunca é servido pelo QR público. */
@RestController
public class RepairOrderController {
    private final RepairOrderService service;

    public RepairOrderController(RepairOrderService service) {
        this.service = service;
    }

    @GetMapping("/api/passports/{id}/repair-orders")
    public List<Map<String, Object>> forPassport(CurrentUser user, @PathVariable UUID id) {
        return service.forPassport(user, id);
    }

    @PostMapping("/api/passports/{id}/repair-orders")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> request(CurrentUser user, @PathVariable UUID id, @RequestBody RequestCmd body) {
        return service.request(user, id, body);
    }

    @GetMapping("/api/me/repair-orders")
    public List<Map<String, Object>> inbox(CurrentUser user) {
        return service.providerInbox(user);
    }

    @GetMapping("/api/repair-orders/{id}")
    public Map<String, Object> get(CurrentUser user, @PathVariable UUID id) {
        return service.get(user, id);
    }

    @PostMapping("/api/repair-orders/{id}/quote")
    public Map<String, Object> quote(CurrentUser user, @PathVariable UUID id, @RequestBody QuoteCmd body) {
        return service.quote(user, id, body);
    }

    @PostMapping("/api/repair-orders/{id}/authorize")
    public Map<String, Object> authorize(CurrentUser user, @PathVariable UUID id, @RequestBody VersionCmd body) {
        return service.authorize(user, id, body);
    }

    @PostMapping("/api/repair-orders/{id}/start")
    public Map<String, Object> start(CurrentUser user, @PathVariable UUID id, @RequestBody VersionCmd body) {
        return service.start(user, id, body);
    }

    @PostMapping("/api/repair-orders/{id}/deliver")
    public Map<String, Object> deliver(CurrentUser user, @PathVariable UUID id, @RequestBody DeliverCmd body) {
        return service.deliver(user, id, body);
    }

    @PostMapping("/api/repair-orders/{id}/cancel")
    public Map<String, Object> cancel(CurrentUser user, @PathVariable UUID id, @RequestBody VersionCmd body, @RequestParam(required = false) String reason) {
        return service.cancel(user, id, body, reason);
    }

    @PostMapping("/api/repair-orders/{id}/corrections")
    public Map<String, Object> correct(CurrentUser user, @PathVariable UUID id, @RequestBody CorrectionCmd body) {
        return service.correct(user, id, body);
    }

    @PostMapping("/api/repair-orders/{id}/revoke-access")
    public Map<String, Object> revoke(CurrentUser user, @PathVariable UUID id) {
        return service.revokeAccess(user, id);
    }

    @PostMapping(value = "/api/repair-orders/{id}/receipts", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> upload(CurrentUser user, @PathVariable UUID id, @RequestPart("file") MultipartFile file, @RequestHeader("Idempotency-Key") String key) {
        if (file.getSize() > 2 * 1024 * 1024) throw ApiException.badRequest("REPAIR_IMAGE_SIZE", "Envie uma imagem de até 2 MB.");
        try {
            return service.uploadReceipt(user, id, file.getBytes(), key);
        } catch (IOException ex) {
            throw ApiException.badRequest("REPAIR_INVALID_IMAGE", "Não foi possível ler a imagem.");
        }
    }

    @GetMapping("/api/repair-receipts/{id}/content")
    public ResponseEntity<byte[]> download(CurrentUser user, @PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.IMAGE_PNG)
                .header("Content-Disposition", "attachment; filename=\"repair-receipt.png\"")
                .header("X-Content-Type-Options", "nosniff").body(service.downloadReceipt(user, id));
    }
}
