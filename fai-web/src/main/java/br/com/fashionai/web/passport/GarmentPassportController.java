package br.com.fashionai.web.passport;

import br.com.fashionai.application.passport.GarmentPassportService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.common.ApiException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;
import java.io.IOException;
import java.time.Duration;
import java.nio.charset.StandardCharsets;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.web.support.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;

/** Separate, explicit private/public DTOs; the evidence endpoint never returns a storage URL. */
@RestController
public class GarmentPassportController {
    private final GarmentPassportService service;
    private final RateLimitPort limits;
    private final ClientIpResolver clientIp;
    public GarmentPassportController(GarmentPassportService service, RateLimitPort limits, ClientIpResolver clientIp) {
        this.service=service; this.limits=limits; this.clientIp=clientIp;
    }

    @GetMapping("/api/pieces/{pieceId}/passport")
    public GarmentPassportService.PrivateView get(CurrentUser user,@PathVariable UUID pieceId) { return service.get(user,pieceId); }
    @PostMapping("/api/pieces/{pieceId}/passport")
    public GarmentPassportService.PrivateView create(CurrentUser user,@PathVariable UUID pieceId,@RequestHeader("Idempotency-Key") String key) { return service.create(user,pieceId,key); }
    @PutMapping("/api/passports/{id}")
    public GarmentPassportService.PrivateView update(CurrentUser user,@PathVariable UUID id,@RequestBody GarmentPassportService.Declaration body) { return service.update(user,id,body); }
    @PostMapping("/api/passports/{id}/events")
    public GarmentPassportService.EventView event(CurrentUser user,@PathVariable UUID id,@RequestBody GarmentPassportService.EventCommand body,@RequestHeader("Idempotency-Key") String key) { return service.addEvent(user,id,body,key); }
    @PostMapping("/api/passports/{id}/shares")
    public GarmentPassportService.ShareCreated share(CurrentUser user,@PathVariable UUID id,@RequestBody GarmentPassportService.ShareCommand body) { return service.share(user,id,body); }
    @DeleteMapping("/api/passports/{id}/shares/{shareId}")
    public void revoke(CurrentUser user,@PathVariable UUID id,@PathVariable UUID shareId) { service.revoke(user,id,shareId); }
    @GetMapping("/api/passport-shares/{token}")
    public ResponseEntity<Map<String,Object>> publicView(@PathVariable String token, HttpServletRequest request) {
        UUID bucket=UUID.nameUUIDFromBytes(("passport-ip:"+clientIp.resolve(request)).getBytes(StandardCharsets.UTF_8));
        if(!limits.tryAcquire(bucket,"passport-public-read",120,Duration.ofMinutes(10)))
            throw ApiException.tooMany("Muitas consultas de passaporte. Tente novamente mais tarde.",Map.of());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("Referrer-Policy","no-referrer")
                .header("X-Robots-Tag","noindex, nofollow, noarchive").body(service.publicView(token));
    }
    @GetMapping("/api/passports/{id}/resale-draft")
    public Map<String,Object> resale(CurrentUser user,@PathVariable UUID id) { return service.resale(user,id); }
    @PostMapping("/api/passports/{id}/transfers")
    public GarmentPassportService.TransferCreated offer(CurrentUser user,@PathVariable UUID id,@RequestBody GarmentPassportService.TransferCommand body,@RequestHeader("Idempotency-Key") String key) { return service.offerTransfer(user,id,body,key); }
    @DeleteMapping("/api/passports/{id}/transfers/{transferId}")
    public GarmentPassportService.TransferView cancel(CurrentUser user,@PathVariable UUID id,@PathVariable UUID transferId) { return service.cancelTransfer(user,id,transferId); }
    @GetMapping("/api/me/passport-transfers")
    public List<GarmentPassportService.TransferView> incoming(CurrentUser user) { return service.incoming(user); }
    @PostMapping("/api/passport-transfers/{id}/accept")
    public GarmentPassportService.TransferView accept(CurrentUser user,@PathVariable UUID id,@RequestBody GarmentPassportService.AcceptCommand body,@RequestHeader("Idempotency-Key") String key) { return service.accept(user,id,body,key); }
    @PostMapping(value="/api/passports/{id}/evidence",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public GarmentPassportService.EvidenceView upload(CurrentUser user,@PathVariable UUID id,@RequestParam String kind,@RequestPart("file") MultipartFile file,@RequestHeader("Idempotency-Key") String key) {
        if(file.getSize()>2*1024*1024) throw ApiException.badRequest("PASSPORT_IMAGE_SIZE","Envie uma imagem de até 2 MB.");
        try { return service.uploadEvidence(user,id,kind,file.getBytes(),key); }
        catch(IOException ex) { throw ApiException.badRequest("PASSPORT_INVALID_IMAGE","Não foi possível ler a imagem."); }
    }
    @GetMapping("/api/passports/{id}/my-evidence")
    public List<GarmentPassportService.EvidenceView> evidence(CurrentUser user,@PathVariable UUID id) { return service.myEvidence(user,id); }
    @GetMapping("/api/passport-evidence/{id}/content")
    public ResponseEntity<byte[]> download(CurrentUser user,@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.IMAGE_PNG)
                .header("Content-Disposition","attachment; filename=\"passport-evidence.png\"")
                .header("X-Content-Type-Options","nosniff").body(service.downloadEvidence(user,id));
    }
    @DeleteMapping("/api/passport-evidence/{id}")
    public void delete(CurrentUser user,@PathVariable UUID id) { service.deleteEvidence(user,id); }
}
