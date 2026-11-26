package br.com.fashionai.web.controller;

import br.com.fashionai.application.acervo.AcervoIluminacaoService;
import br.com.fashionai.application.acervo.AcervoEstruturaService;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/** ACERVO — árvore do guarda-roupa e a estrutura dele (ambientes, móveis, compartimentos). Só a dona acessa. */
@RestController
@Tag(name = "Acervo — wardrobe as a navigable space (structure)")
public class AcervoController {
    private final AcervoEstruturaService estrutura;
    private final AcervoPecasService pecas;
    private final AcervoIluminacaoService luz;

    public AcervoController(AcervoEstruturaService estrutura, AcervoPecasService pecas, AcervoIluminacaoService luz) {
        this.estrutura = estrutura;
        this.pecas = pecas;
        this.luz = luz;
    }

    @GetMapping("/api/me/acervo")
    public Map<String, Object> arvore(CurrentUser user) {
        return pecas.arvore(user);
    }

    @PostMapping("/api/me/acervo/ambientes")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> criarAmbiente(CurrentUser user, @RequestBody AcervoEstruturaService.NomeForm body) {
        return estrutura.criarAmbiente(user, body);
    }

    @PutMapping("/api/me/acervo/ambientes/ordem")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void ordenarAmbientes(CurrentUser user, @RequestBody AcervoEstruturaService.OrdemForm body) {
        estrutura.ordenarAmbientes(user, body);
    }

    @PutMapping("/api/me/acervo/ambientes/{id}")
    public Map<String, Object> renomearAmbiente(CurrentUser user, @PathVariable UUID id, @RequestBody AcervoEstruturaService.NomeForm body) {
        return estrutura.renomearAmbiente(user, id, body);
    }

    /** Exercício 07: tipo de iluminação e temperatura (K) do ambiente; o dono vem do token, nunca do corpo. */
    @PutMapping("/api/me/acervo/ambientes/{id}/luz")
    public Map<String, Object> iluminarAmbiente(CurrentUser user, @PathVariable UUID id, @RequestBody AcervoIluminacaoService.LuzForm body) {
        return luz.iluminar(user, id, body);
    }

    @DeleteMapping("/api/me/acervo/ambientes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void apagarAmbiente(CurrentUser user, @PathVariable UUID id) {
        estrutura.apagarAmbiente(user, id);
    }

    @PostMapping("/api/me/acervo/ambientes/{id}/moveis")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> criarMovel(CurrentUser user, @PathVariable UUID id, @RequestBody AcervoEstruturaService.MovelForm body) {
        return estrutura.criarMovel(user, id, body);
    }

    @PutMapping("/api/me/acervo/ambientes/{id}/moveis/ordem")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void ordenarMoveis(CurrentUser user, @PathVariable UUID id, @RequestBody AcervoEstruturaService.OrdemForm body) {
        estrutura.ordenarMoveis(user, id, body);
    }

    @PutMapping("/api/me/acervo/moveis/{id}")
    public Map<String, Object> atualizarMovel(CurrentUser user, @PathVariable UUID id, @RequestBody AcervoEstruturaService.MovelForm body) {
        return estrutura.atualizarMovel(user, id, body);
    }

    @DeleteMapping("/api/me/acervo/moveis/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void apagarMovel(CurrentUser user, @PathVariable UUID id) {
        estrutura.apagarMovel(user, id);
    }

    @PostMapping("/api/me/acervo/moveis/{id}/compartimentos")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> criarCompartimento(CurrentUser user, @PathVariable UUID id,
                                                  @RequestBody AcervoEstruturaService.CompartimentoForm body) {
        return estrutura.criarCompartimento(user, id, body);
    }

    @PutMapping("/api/me/acervo/moveis/{id}/compartimentos/ordem")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void ordenarCompartimentos(CurrentUser user, @PathVariable UUID id, @RequestBody AcervoEstruturaService.OrdemForm body) {
        estrutura.ordenarCompartimentos(user, id, body);
    }

    @PutMapping("/api/me/acervo/compartimentos/{id}")
    public Map<String, Object> renomearCompartimento(CurrentUser user, @PathVariable UUID id,
                                                     @RequestBody AcervoEstruturaService.NomeForm body) {
        return estrutura.renomearCompartimento(user, id, body);
    }

    @DeleteMapping("/api/me/acervo/compartimentos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void apagarCompartimento(CurrentUser user, @PathVariable UUID id) {
        estrutura.apagarCompartimento(user, id);
    }
}
