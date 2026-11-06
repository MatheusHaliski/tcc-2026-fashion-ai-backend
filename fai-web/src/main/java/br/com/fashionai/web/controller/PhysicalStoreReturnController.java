package br.com.fashionai.web.controller;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.PhysicalStoreReturnService;
import io.swagger.v3.oas.annotations.tags.Tag;
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

/** RF-PESQ-02 — troca/devolução de pedidos da loja física. */
@RestController
@Tag(name = "Physical store — returns and exchanges")
public class PhysicalStoreReturnController {
    private final PhysicalStoreReturnService service;

    public PhysicalStoreReturnController(PhysicalStoreReturnService service) {
        this.service = service;
    }

    @GetMapping("/api/me/physical-store/orders/{id}/return-eligibility")
    public Map<String, Object> eligibility(CurrentUser user, @PathVariable UUID id) {
        return service.eligibility(user, id);
    }

    @PostMapping("/api/me/physical-store/orders/{id}/returns")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> open(CurrentUser user, @PathVariable UUID id, @RequestBody PhysicalStoreReturnService.Request body,
                                    @RequestHeader("Idempotency-Key") String key) {
        return service.open(user, id, body, key);
    }

    @GetMapping("/api/me/physical-store/returns")
    public List<Map<String, Object>> mine(CurrentUser user) {
        return service.mine(user);
    }

    @GetMapping("/api/physical-store/returns/inbox")
    public List<Map<String, Object>> inbox(CurrentUser user) {
        return service.inbox(user);
    }

    @GetMapping("/api/physical-store/returns/{id}")
    public Map<String, Object> get(CurrentUser user, @PathVariable UUID id) {
        return service.get(user, id);
    }

    @PostMapping("/api/physical-store/returns/{id}/cancel")
    public Map<String, Object> cancel(CurrentUser user, @PathVariable UUID id, @RequestParam long expectedVersion) {
        return service.cancel(user, id, expectedVersion);
    }

    @PostMapping("/api/physical-store/returns/{id}/decision")
    public Map<String, Object> decide(CurrentUser user, @PathVariable UUID id, @RequestBody PhysicalStoreReturnService.Decision body) {
        return service.decide(user, id, body);
    }

    @PostMapping("/api/physical-store/returns/{id}/shipment")
    public Map<String, Object> ship(CurrentUser user, @PathVariable UUID id, @RequestBody PhysicalStoreReturnService.Shipment body) {
        return service.ship(user, id, body);
    }

    @PostMapping("/api/physical-store/returns/{id}/receipt")
    public Map<String, Object> receive(CurrentUser user, @PathVariable UUID id, @RequestParam long expectedVersion) {
        return service.receive(user, id, expectedVersion);
    }

    @PostMapping("/api/physical-store/returns/{id}/inspection")
    public Map<String, Object> inspect(CurrentUser user, @PathVariable UUID id, @RequestBody PhysicalStoreReturnService.Inspection body) {
        return service.inspect(user, id, body);
    }

    @PostMapping(value = "/api/physical-store/returns/{id}/evidence", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> upload(CurrentUser user, @PathVariable UUID id, @RequestPart("file") MultipartFile file,
                                      @RequestHeader("Idempotency-Key") String key) {
        if (file.getSize() > 2 * 1024 * 1024) throw ApiException.badRequest("RETURN_IMAGE_SIZE", "Envie uma imagem de até 2 MB.");
        try {
            return service.uploadEvidence(user, id, file.getBytes(), key);
        } catch (IOException ex) {
            throw ApiException.badRequest("RETURN_INVALID_IMAGE", "Não foi possível ler a imagem.");
        }
    }

    @GetMapping("/api/physical-store/return-evidence/{id}/content")
    public ResponseEntity<byte[]> download(CurrentUser user, @PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.IMAGE_PNG)
                .header("Content-Disposition", "attachment; filename=\"return-evidence.png\"")
                .header("X-Content-Type-Options", "nosniff").body(service.downloadEvidence(user, id));
    }
}
