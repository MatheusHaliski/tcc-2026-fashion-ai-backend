package br.com.fashionai.web.atelierproject;
import br.com.fashionai.application.atelierproject.*;
import br.com.fashionai.application.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import static br.com.fashionai.application.atelierproject.AtelierProjectViews.*;

@RestController @RequestMapping("/api/atelier/projects")
public class AtelierProjectController {
    private final AtelierProjectService service;
    public AtelierProjectController(AtelierProjectService service){this.service=service;}
    @GetMapping public Page<Summary> list(CurrentUser user,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="24") int size){return service.list(user,page,size);}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public Detail create(CurrentUser user,@Valid @RequestBody Create body){return service.create(user,body);}
    @GetMapping("/invitations/me") public List<Invitation> invitations(CurrentUser user){return service.invitations(user);}
    @GetMapping("/{id}") public Detail get(CurrentUser user,@PathVariable UUID id){return service.get(user,id);}
    @PutMapping("/{id}") public Detail update(CurrentUser user,@PathVariable UUID id,@Valid @RequestBody Update body){return service.update(user,id,body);}
    @PostMapping("/{id}/archive") public Detail archive(CurrentUser user,@PathVariable UUID id,@Valid @RequestBody Version body){return service.archive(user,id,body);}
    @GetMapping("/{id}/revisions") public Page<Revision> revisions(CurrentUser user,@PathVariable UUID id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.revisions(user,id,page,size);}
    @PostMapping("/{id}/revisions") public Detail publish(CurrentUser user,@PathVariable UUID id,@Valid @RequestBody Publish body){return service.publish(user,id,body);}
    @PostMapping("/{id}/invites") public Detail invite(CurrentUser user,@PathVariable UUID id,@Valid @RequestBody Invite body){return service.invite(user,id,body);}
    @PostMapping("/{id}/invites/{memberId}/accept") public Detail accept(CurrentUser user,@PathVariable UUID id,@PathVariable UUID memberId){return service.accept(user,id,memberId);}
    @DeleteMapping("/{id}/members/{memberId}") public Detail revoke(CurrentUser user,@PathVariable UUID id,@PathVariable UUID memberId,@RequestParam long expectedVersion){return service.revoke(user,id,memberId,new Version(expectedVersion));}
    @PostMapping("/{id}/comments") public Detail comment(CurrentUser user,@PathVariable UUID id,@Valid @RequestBody Comment body){return service.comment(user,id,body);}
    @PostMapping("/{id}/reviews") public Detail review(CurrentUser user,@PathVariable UUID id,@Valid @RequestBody Review body){return service.review(user,id,body);}
    @PutMapping("/{id}/votes/me") public VoteResult vote(CurrentUser user,@PathVariable UUID id,@Valid @RequestBody Vote body){return service.vote(user,id,body);}
    @GetMapping("/{id}/revisions/{revisionId}/tech-pack") public ResponseEntity<TechPack> export(CurrentUser user,@PathVariable UUID id,@PathVariable UUID revisionId){
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\"fai-tech-pack-"+revisionId+".json\"")
            .cacheControl(CacheControl.noStore()).body(service.techPack(user,id,revisionId));
    }
}
