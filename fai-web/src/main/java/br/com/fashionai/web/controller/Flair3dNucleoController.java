package br.com.fashionai.web.controller;

import br.com.fashionai.application.flair3d.Acionamento;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dCampanha;
import br.com.fashionai.application.flair3d.Flair3dNucleoService;
import br.com.fashionai.application.flair3d.Flair3dProgresso;
import br.com.fashionai.application.flair3d.Flair3dRascunho;
import br.com.fashionai.application.flair3d.Flair3dRetomada;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * FLAIR 3D — os 15 núcleos (docs/flair/flair-3d/BASE_NUCLEOS.md): lista e definição públicas; deck, partida, prévia, entrega,
 * acionamento, progresso da campanha e rascunho do look logados.
 */
@RestController
@Tag(name = "FLAIR 3D — núcleos")
public class Flair3dNucleoController {
    private final Flair3dNucleoService service;
    private final Flair3dRetomada retomada;
    private final Flair3dProgresso progresso;
    private final Flair3dRascunho rascunho;

    public Flair3dNucleoController(Flair3dNucleoService service, Flair3dRetomada retomada, Flair3dProgresso progresso, Flair3dRascunho rascunho) {
        this.service = service;
        this.retomada = retomada;
        this.progresso = progresso;
        this.rascunho = rascunho;
    }

    @GetMapping("/api/flair/3d/nucleos")
    @Operation(summary = "Os 15 núcleos: código, número, recursos e ações (pública)")
    public Map<String, Object> lista() {
        return service.lista();
    }

    @GetMapping("/api/flair/3d/nucleos/{codigo}")
    @Operation(summary = "Definição do núcleo: objetivo e regras, recursos, vagas, zonas, áreas, opções, ações, deck e avatares (pública)")
    public Definicao definicao(@PathVariable String codigo) {
        return service.definicao(codigo);
    }

    @PostMapping("/api/flair/3d/nucleos/{codigo}/efeitos")
    @Operation(summary = "Efeito de cada carta da pessoa neste núcleo, para a tela do deck (422 com carta alheia)")
    public Map<String, Object> efeitos(CurrentUser user, @PathVariable String codigo,
                                       @RequestBody(required = false) Flair3dNucleoService.PedidoEfeitos body) {
        return service.efeitos(user, codigo, body);
    }

    @PostMapping("/api/flair/3d/nucleos/{codigo}/partidas")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Abre a partida solo com o deck (422 com o que falta; 422 RODADA_BLOQUEADA se a rodada ainda não abriu) "
            + "e devolve semente e participantes")
    public Map<String, Object> abrir(CurrentUser user, @PathVariable String codigo,
                                     @RequestBody(required = false) Flair3dNucleoService.AbrirPartida body) {
        progresso.conferirAberta(user, codigo, body == null ? null : body.rodada());
        return service.abrir(user, codigo, body);
    }

    @GetMapping("/api/flair/3d/nucleos/{codigo}/progresso")
    @Operation(summary = "A campanha da pessoa neste jogo: rodadas vencidas, estrelas de cada uma e do jogo, o que abre a seguir e o ponto da história")
    public Flair3dCampanha.Progresso progresso(CurrentUser user, @PathVariable String codigo) {
        return progresso.doJogo(user, codigo);
    }

    @PutMapping("/api/flair/3d/partidas/{id}/rascunho")
    @Operation(summary = "Guarda no servidor o look em montagem de uma partida aberta (só o dono, 403; partida aberta, 409; cartas do deck, 422)")
    public Map<String, Object> rascunho(CurrentUser user, @PathVariable UUID id, @RequestBody(required = false) Entrega body) {
        return rascunho.guardar(user, id, body);
    }

    @GetMapping("/api/flair/3d/nucleos/{codigo}/em-andamento")
    @Operation(summary = "A partida da pessoa que ainda não fechou neste núcleo, com o ponto em que parou (204 sem nenhuma)")
    public ResponseEntity<Map<String, Object>> emAndamento(CurrentUser user, @PathVariable String codigo) {
        return retomada.emAndamento(user, codigo).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping("/api/flair/3d/partidas/{id}/entrega")
    @Operation(summary = "Entrega e pontua a partida (só o dono, 403; partida aberta, 409; cartas do deck e da pessoa, 422); "
            + "nos núcleos em etapas devolve status EM_ACAO, e no LABIRINTO sem abrir, ABERTA")
    public Resultado entregar(CurrentUser user, @PathVariable UUID id, @RequestBody(required = false) Entrega body) {
        return service.entregar(user, id, body);
    }

    @PostMapping("/api/flair/3d/partidas/{id}/previa")
    @Operation(summary = "Prévia da entrega: pontos e regras de agora, sem fechar a partida (nos jogos automáticos, só os atributos)")
    public Resultado previa(CurrentUser user, @PathVariable UUID id, @RequestBody(required = false) Entrega body) {
        return service.previa(user, id, body);
    }

    @PostMapping("/api/flair/3d/partidas/{id}/acionar")
    @Operation(summary = "Avança a ação de uma partida EM_ACAO (409 fora dela) com a carta Especial ou a troca do intervalo (422 se não vale)")
    public Resultado acionar(CurrentUser user, @PathVariable UUID id, @RequestBody(required = false) Acionamento body) {
        return service.acionar(user, id, body);
    }
}
