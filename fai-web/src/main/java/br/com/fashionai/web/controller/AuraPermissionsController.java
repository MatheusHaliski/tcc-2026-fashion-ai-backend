package br.com.fashionai.web.controller;
import br.com.fashionai.application.service.AuraPermissionsService;
import br.com.fashionai.application.security.*;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController
public class AuraPermissionsController {
 private final AuraPermissionsService permissions;private final Guard guard;
 public AuraPermissionsController(AuraPermissionsService permissions,Guard guard){this.permissions=permissions;this.guard=guard;}
 @GetMapping("/api/me/aura-permissions") public Map<String,Object> mine(CurrentUser user){guard.requireCanCreate(user);return permissions.permissions(user.id());}
}
