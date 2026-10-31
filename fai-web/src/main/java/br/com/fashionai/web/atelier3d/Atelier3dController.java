package br.com.fashionai.web.atelier3d;

import br.com.fashionai.application.atelier3d.*;
import br.com.fashionai.application.security.CurrentUser;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;

@RestController
public class Atelier3dController {
    private final Atelier3dService service;
    private final br.com.fashionai.application.catalog.CatalogService catalog;
    public Atelier3dController(Atelier3dService service,br.com.fashionai.application.catalog.CatalogService catalog){this.service=service;this.catalog=catalog;}
    @GetMapping("/api/atelier/projects/{id}/scene") public Atelier3dService.Scene scene(CurrentUser user,@PathVariable UUID id){return service.get(user,id);}
    @GetMapping("/api/atelier/projects/{id}/scene/versions/{version}") public Atelier3dService.Version version(CurrentUser user,@PathVariable UUID id,@PathVariable UUID version){return service.getVersion(user,id,version);}
    @GetMapping("/api/atelier/projects/{id}/scene/assets/{asset}/metadata") public Atelier3dService.Asset metadata(CurrentUser user,@PathVariable UUID id,@PathVariable UUID asset){return service.metadata(user,id,asset);}
    @PostMapping("/api/atelier/projects/{id}/scene/versions") public Atelier3dService.Version save(CurrentUser user,@PathVariable UUID id,@RequestBody Atelier3dService.Save body){return service.save(user,id,body);}
    @PostMapping(value="/api/atelier/projects/{id}/scene/assets",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public Atelier3dService.Asset upload(CurrentUser user,@PathVariable UUID id,@RequestPart("file") MultipartFile file)throws java.io.IOException {checkSize(file);return service.upload(user,id,file.getOriginalFilename(),file.getBytes());}
    @GetMapping("/api/atelier/projects/{id}/scene/assets/{asset}") public ResponseEntity<byte[]> content(CurrentUser user,@PathVariable UUID id,@PathVariable UUID asset){return binary(service.content(user,id,asset));}
    @GetMapping("/api/atelier/projects/{id}/scene/guests") public List<Atelier3dService.InviteView> invites(CurrentUser user,@PathVariable UUID id){return service.invites(user,id);}
    @PostMapping("/api/atelier/projects/{id}/scene/guests") public Atelier3dService.CreatedInvite invite(CurrentUser user,@PathVariable UUID id,@RequestBody Atelier3dService.InviteCommand body){return service.invite(user,id,body);}
    @DeleteMapping("/api/atelier/projects/{id}/scene/guests/{invite}") public void revoke(CurrentUser user,@PathVariable UUID id,@PathVariable UUID invite){service.revoke(user,id,invite);}
    @PostMapping("/api/atelier/projects/{id}/scene/gender-evidence") public CatalogGenderDecision.Evidence evidence(CurrentUser user,@PathVariable UUID id,@RequestBody List<UUID> ids){return service.evidence(user,id,ids);}

    @GetMapping("/api/atelier/guest/{invite}/catalog")
    public Map<String,Object> guestCatalog(@PathVariable UUID invite,@RequestHeader("X-Atelier-Guest") String token,@RequestParam String q){
        service.guestEvidence(invite,token,List.of());
        if(q.length()<2||q.length()>180)throw br.com.fashionai.application.common.ApiException.badRequest("ATELIER_SEARCH_INVALID","Busca de 2 a 180 caracteres.");
        return catalog.browse(new br.com.fashionai.application.catalog.CatalogService.BrowseRequest(null,null,null,q,0,8,null,null,null,null));
    }
    // These exact guest paths use a project-scoped capability, never an ordinary user session.
    @GetMapping("/api/atelier/guest/{invite}/scene") public Atelier3dService.Scene guest(@PathVariable UUID invite,@RequestHeader("X-Atelier-Guest") String token){return service.guestScene(invite,token);}
    @GetMapping("/api/atelier/guest/{invite}/versions/{version}") public Atelier3dService.Version guestVersion(@PathVariable UUID invite,@PathVariable UUID version,@RequestHeader("X-Atelier-Guest") String token){return service.guestVersion(invite,token,version);}
    @GetMapping("/api/atelier/guest/{invite}/assets/{asset}/metadata") public Atelier3dService.Asset guestMetadata(@PathVariable UUID invite,@PathVariable UUID asset,@RequestHeader("X-Atelier-Guest") String token){return service.guestMetadata(invite,token,asset);}
    @PostMapping("/api/atelier/guest/{invite}/versions") public Atelier3dService.Version guestSave(@PathVariable UUID invite,@RequestHeader("X-Atelier-Guest") String token,@RequestBody Atelier3dService.Save body){return service.guestSave(invite,token,body);}
    @PostMapping(value="/api/atelier/guest/{invite}/assets",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public Atelier3dService.Asset guestUpload(@PathVariable UUID invite,@RequestHeader("X-Atelier-Guest") String token,@RequestPart("file") MultipartFile file)throws java.io.IOException{checkSize(file);return service.guestUpload(invite,token,file.getOriginalFilename(),file.getBytes());}
    @GetMapping("/api/atelier/guest/{invite}/assets/{asset}") public ResponseEntity<byte[]> guestContent(@PathVariable UUID invite,@PathVariable UUID asset,@RequestHeader("X-Atelier-Guest") String token){return binary(service.guestContent(invite,token,asset));}
    @PostMapping("/api/atelier/guest/{invite}/gender-evidence") public CatalogGenderDecision.Evidence guestEvidence(@PathVariable UUID invite,@RequestHeader("X-Atelier-Guest") String token,@RequestBody List<UUID> ids){return service.guestEvidence(invite,token,ids);}
    private static void checkSize(MultipartFile file){if(file.getSize()>GlbInspector.MAX_BYTES)throw br.com.fashionai.application.common.ApiException.badRequest("ATELIER_GLB_INVALID","GLB deve ter até 8 MiB.");}
    private static ResponseEntity<byte[]> binary(byte[] bytes){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Content-Type-Options","nosniff").contentType(MediaType.parseMediaType("model/gltf-binary")).body(bytes);}
}
