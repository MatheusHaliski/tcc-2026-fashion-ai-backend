package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.FlairInviteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Partidas FLAIR — convite pela rede FAI: quem convida escolhe as pessoas numa busca, nunca digitando o @. */
@RestController
@Tag(name = "FLAIR — convites da rede FAI")
public class FlairInviteController {
    private final FlairInviteService invites;

    public FlairInviteController(FlairInviteService invites) {
        this.invites = invites;
    }

    /** {@code target}: placar a superar (desafio de placar nos modos contra a IA); null nos confrontos diretos. */
    public record InviteRequest(String mode, List<String> usernames, Integer target) {
    }

    @PostMapping("/api/flair/modes/invites")
    @Operation(summary = "FLAIR — convida até 5 pessoas da rede FAI para um modo (aviso com o link do modo e o rival escolhido)")
    public Map<String, Object> invite(CurrentUser user, @RequestBody InviteRequest body) {
        return invites.invite(user, body.mode(), body.usernames(), body.target());
    }
}
