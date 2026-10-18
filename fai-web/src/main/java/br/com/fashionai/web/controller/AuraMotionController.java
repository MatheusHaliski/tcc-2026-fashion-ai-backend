package br.com.fashionai.web.controller;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.AuraMotionService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequestMapping("/api/me/aura-impersonation")
public class AuraMotionController {
 private final AuraMotionService service;
 public AuraMotionController(AuraMotionService service){this.service=service;}
 private static <T> ResponseEntity<T> response(T body){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);}
 @GetMapping("/capabilities") public ResponseEntity<Map<String,Object>> capabilities(CurrentUser user){return response(service.capabilities());}
 @PostMapping("/jobs") public ResponseEntity<AuraMotionService.View> create(CurrentUser user,@RequestBody AuraMotionService.Request request){return response(service.create(user,request));}
 @GetMapping("/jobs") public ResponseEntity<List<AuraMotionService.View>> list(CurrentUser user){return response(service.list(user));}
 @GetMapping("/jobs/{id}") public ResponseEntity<AuraMotionService.View> get(CurrentUser user,@PathVariable UUID id){return response(service.get(user,id));}
 @GetMapping("/jobs/{id}/media") public ResponseEntity<byte[]> media(CurrentUser user,@PathVariable UUID id){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.valueOf("video/mp4")).body(service.readMedia(user,id,false));}
 @GetMapping("/jobs/{id}/poster") public ResponseEntity<byte[]> poster(CurrentUser user,@PathVariable UUID id){byte[] bytes=service.readMedia(user,id,true);String mime=br.com.fashionai.application.imaging.ImageOps.detectMime(bytes);return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.valueOf(mime==null?"application/octet-stream":mime)).body(bytes);}
 @PostMapping("/jobs/{id}/cancel") public ResponseEntity<AuraMotionService.View> cancel(CurrentUser user,@PathVariable UUID id){return response(service.cancel(user,id));}
 public record Apply(boolean publishConsent){}
 @PostMapping("/jobs/{id}/apply") public ResponseEntity<AuraMotionService.View> apply(CurrentUser user,@PathVariable UUID id,@RequestBody Apply request){return response(service.apply(user,id,request!=null&&request.publishConsent()));}
}
