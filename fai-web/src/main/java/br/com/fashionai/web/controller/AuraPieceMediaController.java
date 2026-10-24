package br.com.fashionai.web.controller;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.AuraMotionService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
/** Always rechecks the piece/profile visibility and currently equipped job; no public storage copy. */
@RestController
public class AuraPieceMediaController {
 private final AuraMotionService service;
 public AuraPieceMediaController(AuraMotionService service){this.service=service;}
 @GetMapping("/api/pieces/{pieceId}/aura-media/{jobId}")
 public ResponseEntity<byte[]> media(CurrentUser viewer,@PathVariable UUID pieceId,@PathVariable UUID jobId){
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.valueOf("video/mp4")).body(service.readAppliedMedia(viewer,pieceId,jobId));
 }
}
