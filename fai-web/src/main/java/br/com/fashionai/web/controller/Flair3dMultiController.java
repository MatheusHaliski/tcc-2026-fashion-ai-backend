package br.com.fashionai.web.controller;

import br.com.fashionai.application.flair3d.Flair3dNucleoService;
import br.com.fashionai.application.flair3d.multi.Flair3dAdversarios;
import br.com.fashionai.application.flair3d.multi.Flair3dConviteService;
import br.com.fashionai.application.flair3d.multi.Flair3dSalaAssincrona;
import br.com.fashionai.application.flair3d.multi.Flair3dSalaCaixa;
import br.com.fashionai.application.flair3d.multi.Flair3dSalaLeitura;
import br.com.fashionai.application.flair3d.multi.Flair3dSalaTurnos;
import br.com.fashionai.application.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * FLAIR 3D multiplayer (PLANO A1): busca de adversários na rede FAI, convites (criar, aceitar, recusar, cancelar,
 * revanche), caixa, sala (leitura com polling), partida da sala com a mesma semente, deck e lance por turnos e o
 * histórico contra uma pessoa. Todos logados; a sala só existe para as duas pessoas dela.
 */
@RestController
@Tag(name = "FLAIR 3D — multiplayer")
public class Flair3dMultiController {
    private final Flair3dAdversarios adversarios;
    private final Flair3dConviteService convites;
    private final Flair3dSalaCaixa caixa;
    private final Flair3dSalaLeitura leitura;
    private final Flair3dSalaAssincrona assincrona;
    private final Flair3dSalaTurnos turnos;

    public Flair3dMultiController(Flair3dAdversarios adversarios, Flair3dConviteService convites, Flair3dSalaCaixa caixa,
                                  Flair3dSalaLeitura leitura, Flair3dSalaAssincrona assincrona, Flair3dSalaTurnos turnos) {
        this.adversarios = adversarios;
        this.convites = convites;
        this.caixa = caixa;
        this.leitura = leitura;
        this.assincrona = assincrona;
        this.turnos = turnos;
    }

    public record DeckDaSala(List<UUID> deck) {
    }

    public record LookDaSala(UUID lookId) {
    }

    @GetMapping("/api/flair/3d/adversarios")
    @Operation(summary = "Busca de adversários na rede FAI com filtros (relação, nível, estilo, país, cidade, ativo, deck para o jogo)")
    public Map<String, Object> adversarios(CurrentUser user, @RequestParam(required = false) String q,
                                           @RequestParam(required = false) String relacao, @RequestParam(required = false) String nivel,
                                           @RequestParam(required = false) String estilo, @RequestParam(required = false) String pais,
                                           @RequestParam(required = false) String cidade, @RequestParam(required = false) Boolean ativo,
                                           @RequestParam(required = false) String jogo, @RequestParam(required = false) Boolean comDeck) {
        return adversarios.buscar(user, new Flair3dAdversarios.Filtros(q, relacao, nivel, estilo, pais, cidade, ativo, jogo, comDeck));
    }

    @PostMapping("/api/flair/3d/convites")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Convida a pessoa escolhida na busca para uma sala (jogo, modo, rodada); 403 conta privada, 409 convite pendente")
    public Map<String, Object> convidar(CurrentUser user, @RequestBody Flair3dConviteService.Convite body) {
        return convites.convidar(user, body);
    }

    @GetMapping("/api/flair/3d/convites")
    @Operation(summary = "Caixa do multiplayer: convites recebidos e enviados, salas em jogo e as últimas fechadas")
    public Map<String, Object> caixa(CurrentUser user) {
        return caixa.caixa(user);
    }

    @GetMapping("/api/flair/3d/salas/{id}")
    @Operation(summary = "A sala para quem está nela: resumo, partidas (mesma semente) ou turnos julgados; 404 para os outros")
    public Map<String, Object> sala(CurrentUser user, @PathVariable UUID id) {
        return leitura.ver(user, id);
    }

    @PostMapping("/api/flair/3d/salas/{id}/aceitar")
    @Operation(summary = "Aceita o convite (só quem foi convidada, dentro do prazo; 409 CONVITE_EXPIRADO)")
    public Map<String, Object> aceitar(CurrentUser user, @PathVariable UUID id) {
        return convites.aceitar(user, id);
    }

    @PostMapping("/api/flair/3d/salas/{id}/recusar")
    @Operation(summary = "Recusa o convite (só quem foi convidada)")
    public Map<String, Object> recusar(CurrentUser user, @PathVariable UUID id) {
        return convites.recusar(user, id);
    }

    @PostMapping("/api/flair/3d/salas/{id}/cancelar")
    @Operation(summary = "Cancela o convite ainda não aceito (só quem convidou)")
    public Map<String, Object> cancelar(CurrentUser user, @PathVariable UUID id) {
        return convites.cancelar(user, id);
    }

    @PostMapping("/api/flair/3d/salas/{id}/revanche")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Revanche de uma sala fechada: novo convite para o outro lado, com a semente seguinte")
    public Map<String, Object> revanche(CurrentUser user, @PathVariable UUID id) {
        return convites.revanche(user, id);
    }

    @PostMapping("/api/flair/3d/salas/{id}/partida")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Abre a partida do seu lado da sala com a semente e a rodada dela (409 se já abriu)")
    public Map<String, Object> partida(CurrentUser user, @PathVariable UUID id,
                                       @RequestBody(required = false) Flair3dNucleoService.AbrirPartida body) {
        return assincrona.abrir(user, id, body);
    }

    @PostMapping("/api/flair/3d/salas/{id}/look")
    @Operation(summary = "MAKE UP: registra na sala o look entregue no brief dela")
    public Map<String, Object> look(CurrentUser user, @PathVariable UUID id, @RequestBody LookDaSala body) {
        return assincrona.registrarLook(user, id, body == null ? null : body.lookId());
    }

    @PostMapping("/api/flair/3d/salas/{id}/deck")
    @Operation(summary = "Turnos: o deck do seu lado (regras do deck do jogo; só antes do primeiro lance)")
    public Map<String, Object> deck(CurrentUser user, @PathVariable UUID id, @RequestBody DeckDaSala body) {
        return turnos.escolherDeck(user, id, body == null ? null : body.deck());
    }

    @PostMapping("/api/flair/3d/salas/{id}/lance")
    @Operation(summary = "Turnos: o lance do turno da vez (selado até a outra pessoa lançar; o servidor julga o turno)")
    public Map<String, Object> lance(CurrentUser user, @PathVariable UUID id, @RequestBody Flair3dSalaTurnos.Lance body) {
        return turnos.lancar(user, id, body);
    }

    @GetMapping("/api/flair/3d/historico/{userId}")
    @Operation(summary = "Partidas fechadas contra a pessoa e o placar do confronto")
    public Map<String, Object> historico(CurrentUser user, @PathVariable UUID userId) {
        return caixa.historico(user, userId);
    }
}
