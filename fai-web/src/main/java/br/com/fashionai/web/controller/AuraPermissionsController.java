package br.com.fashionai.web.controller;
import br.com.fashionai.application.service.AuraPermissionsService;
import br.com.fashionai.application.security.*;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController
public class AuraPermissionsController {
 private final AuraPermissionsService permissions;private final Guard guard;
 public AuraPermissionsController(AuraPermissionsService permissions,Guard guard){this.permissions=permissions;this.guard=guard;}
 /** Só leitura do próprio nível: e-mail pendente também vê o que tem liberado (gravar continua exigindo e-mail confirmado). */
 @GetMapping("/api/me/aura-permissions") public Map<String,Object> mine(CurrentUser user){guard.requireSession(user);return permissions.permissions(user.id());}
}
