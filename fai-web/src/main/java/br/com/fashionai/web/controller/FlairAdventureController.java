package br.com.fashionai.web.controller;
import br.com.fashionai.application.service.FlairAdventureService;
import br.com.fashionai.application.flair.AfterpartyEngine;
import br.com.fashionai.application.security.CurrentUser;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
public class FlairAdventureController {
 private final FlairAdventureService adventure;
 public FlairAdventureController(FlairAdventureService adventure){this.adventure=adventure;}
 public record Start(List<UUID> deckIds){}
 @GetMapping("/api/flair/adventure/active") public Map<String,Object> active(CurrentUser user){return adventure.active(user);}
 @PostMapping("/api/flair/adventure/sessions") public Map<String,Object> start(CurrentUser user,@RequestBody Start form){return adventure.start(user,form.deckIds());}
 @GetMapping("/api/flair/adventure/sessions/{id}") public Map<String,Object> state(CurrentUser user,@PathVariable UUID id){return adventure.state(user,id);}
 @PostMapping("/api/flair/adventure/sessions/{id}/actions") public Map<String,Object> action(CurrentUser user,@PathVariable UUID id,@RequestBody AfterpartyEngine.Action action){return adventure.action(user,id,action);}
}
