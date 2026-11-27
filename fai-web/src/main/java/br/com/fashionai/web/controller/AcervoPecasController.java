package br.com.fashionai.web.controller;

import br.com.fashionai.application.acervo.AcervoConsultaService;
import br.com.fashionai.application.acervo.AcervoDesejoService;
import br.com.fashionai.application.acervo.AcervoPecasService;
import br.com.fashionai.application.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * ACERVO — peças no espaço (mover, medidas, modo arrumação), consultas (financeiro, busca espacial, mapa de uso, looks
 * vinculados) e lista de desejos. Só a dona acessa.
 */
@RestController
@Tag(name = "Acervo — pieces, queries and wishlist")
public class AcervoPecasController {
    private final AcervoPecasService pecas;
    private final AcervoConsultaService consulta;
    private final AcervoDesejoService desejos;

    public AcervoPecasController(AcervoPecasService pecas, AcervoConsultaService consulta, AcervoDesejoService desejos) {
        this.pecas = pecas;
        this.consulta = consulta;
        this.desejos = desejos;
    }

    @PostMapping("/api/me/acervo/pecas/mover")
    public Map<String, Object> mover(CurrentUser user, @RequestBody AcervoPecasService.MoverForm body) {
        return pecas.mover(user, body);
    }

    @PutMapping("/api/me/acervo/pecas/{id}/medidas")
    public Map<String, Object> medidas(CurrentUser user, @PathVariable UUID id, @RequestBody AcervoPecasService.MedidasForm body) {
        return pecas.medidas(user, id, body);
    }

    @GetMapping("/api/me/acervo/pecas/{id}/lugar")
    public Map<String, Object> lugar(CurrentUser user, @PathVariable UUID id) {
        return consulta.lugar(user, id);
    }

    @GetMapping("/api/me/acervo/pecas/{id}/looks")
    public List<Map<String, Object>> looks(CurrentUser user, @PathVariable UUID id) {
        return consulta.looks(user, id);
    }

    @PostMapping("/api/me/acervo/arrumacao/previa")
    public Map<String, Object> previa(CurrentUser user, @RequestBody(required = false) AcervoPecasService.PreviaForm body) {
        return pecas.previa(user, body);
    }

    @PostMapping("/api/me/acervo/arrumacao/confirmar")
    public Map<String, Object> confirmar(CurrentUser user, @RequestBody AcervoPecasService.ConfirmarForm body) {
        return pecas.confirmar(user, body);
    }

    @GetMapping("/api/me/acervo/financeiro")
    public Map<String, Object> financeiro(CurrentUser user, @RequestParam(required = false) List<UUID> pecas) {
        return consulta.financeiro(user, pecas);
    }

    @GetMapping("/api/me/acervo/busca")
    public Map<String, Object> busca(CurrentUser user, @RequestParam(name = "q", required = false) String texto) {
        return consulta.busca(user, texto);
    }

    @GetMapping("/api/me/acervo/uso")
    public Map<String, Object> uso(CurrentUser user, @RequestParam(required = false) Integer dias) {
        return consulta.uso(user, dias);
    }

    @GetMapping("/api/me/acervo/desejos")
    public List<Map<String, Object>> desejos(CurrentUser user) {
        return desejos.lista(user);
    }

    @PostMapping("/api/me/acervo/desejos")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> criarDesejo(CurrentUser user, @RequestBody AcervoDesejoService.DesejoForm body) {
        return desejos.criar(user, body);
    }

    @PutMapping("/api/me/acervo/desejos/{id}")
    public Map<String, Object> atualizarDesejo(CurrentUser user, @PathVariable UUID id, @RequestBody AcervoDesejoService.DesejoForm body) {
        return desejos.atualizar(user, id, body);
    }

    @DeleteMapping("/api/me/acervo/desejos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void apagarDesejo(CurrentUser user, @PathVariable UUID id) {
        desejos.apagar(user, id);
    }
}
