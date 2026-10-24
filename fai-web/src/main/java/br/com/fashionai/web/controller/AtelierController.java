package br.com.fashionai.web.controller;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.AtelierRewardSystem;
import org.springframework.web.bind.annotation.*;
@RestController
public class AtelierController {
 private final AtelierRewardSystem atelier;
 public AtelierController(AtelierRewardSystem atelier){this.atelier=atelier;}
 @GetMapping("/api/me/atelier") public AtelierRewardSystem.Snapshot mine(CurrentUser user){return atelier.mine(user);}
}
