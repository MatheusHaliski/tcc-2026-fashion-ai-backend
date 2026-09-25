package br.com.fashionai.web.controller;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.DnaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@Tag(name = "RF13 — DNA de Estilo")
public class DnaController {
    private final DnaService dna;

    public DnaController(DnaService dna) {
        this.dna = dna;
    }

    @GetMapping("/api/me/dna")
    @Operation(summary = "RF13 — Meu DNA: pré-requisitos, síntese, versões e card")
    public Map<String, Object> overview(CurrentUser user) {
        return dna.overview(user);
    }

    @GetMapping("/api/me/dna/social-proof")
    @Operation(summary = "DET-K06 — Prova social pelo DNA (grupos com 10 pessoas ou mais, sem identificar ninguém)")
    public Map<String, Object> socialProof(CurrentUser user) {
        return dna.socialProof(user);
    }

    @PostMapping("/api/me/dna")
    @Operation(summary = "RF13.CA02 — Gerar/regerar o DNA (com formulário de vida opcional)")
    public Map<String, Object> generate(CurrentUser user, @RequestBody(required = false) DnaService.LifeForm form) {
        return dna.generate(user, form == null ? new DnaService.LifeForm(Map.of(), List.of(), true) : form);
    }

    @PutMapping("/api/me/dna/life")
    @Operation(summary = "RF13.CA04 — Atualizar campos de vida (lugares, pessoas, animais, objetos)")
    public Map<String, Object> updateLife(CurrentUser user, @RequestBody DnaService.LifeForm form) {
        return dna.updateLife(user, form);
    }

    public record PrivateFields(List<String> privateFields) {
    }

    @PutMapping("/api/me/dna/private-fields")
    @Operation(summary = "RF13.CA05 — Marcar campos como privados (nunca aparecem no card)")
    public Map<String, Object> privateFields(CurrentUser user, @RequestBody PrivateFields body) {
        return dna.setPrivateFields(user, body.privateFields() == null ? List.of() : body.privateFields());
    }

    public record ColorSeason(@NotBlank String season) {
    }

    @PutMapping("/api/me/dna/color-season")
    @Operation(summary = "RF13 — Definir estação de cor (coloração pessoal)")
    public Map<String, Object> colorSeason(CurrentUser user, @RequestBody ColorSeason body) {
        return dna.setColorSeason(user, body.season());
    }

    @PostMapping("/api/me/dna/share-card")
    @Operation(summary = "RF13.CA09 — Gerar card PNG com marca d'água (válido 30 dias)")
    public Map<String, Object> shareCard(CurrentUser user) {
        return dna.shareCard(user);
    }

    @GetMapping("/api/dna-schemes/builder")
    @Operation(summary = "RF13 — Construtor do Esquema de DNA (mesmas etapas do RF5): esquemas do usuário, anatomias e narrativas")
    public Map<String, Object> builder(CurrentUser user) {
        return dna.builder(user);
    }

    @PostMapping("/api/dna-schemes/preview")
    @Operation(summary = "RF13 — Pré-visualizar o card do Esquema de DNA sem salvar")
    public Map<String, Object> preview(CurrentUser user, @RequestBody DnaService.DnaSchemeForm form) {
        return dna.preview(user, form);
    }

    @PostMapping("/api/dna-schemes/compositions")
    @Operation(summary = "RF13 — Modo IA: até 3 propostas de DNA a partir dos esquemas do usuário")
    public Map<String, Object> compositions(CurrentUser user, @RequestBody(required = false) DnaService.DnaComposeRequest req) {
        return dna.compositions(user, req);
    }

    @PostMapping("/api/dna-schemes")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "HU20 — Criar esquema de DNA (linha do tempo de looks)")
    public Map<String, Object> create(CurrentUser user, @RequestBody DnaService.DnaSchemeForm form) {
        return dna.createDnaScheme(user, form);
    }

    @PutMapping("/api/dna-schemes/{id}")
    @Operation(summary = "HU20 — Editar esquema de DNA")
    public Map<String, Object> update(CurrentUser user, @PathVariable UUID id, @RequestBody DnaService.DnaSchemeForm form) {
        return dna.updateDnaScheme(user, id, form);
    }

    @GetMapping("/api/dna-schemes/{id}")
    @Operation(summary = "HU20 — Abrir esquema de DNA (narrativas, layout, dados)")
    public Map<String, Object> get(CurrentUser viewer, @PathVariable UUID id) {
        return dna.getDnaScheme(viewer, id);
    }

    @GetMapping("/api/me/dna-schemes")
    @Operation(summary = "HU20 — Meus esquemas de DNA")
    public List<Map<String, Object>> mine(CurrentUser user) {
        return dna.myDnaSchemes(user);
    }

    @DeleteMapping("/api/dna-schemes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "HU20 — Excluir esquema de DNA")
    public void delete(CurrentUser user, @PathVariable UUID id) {
        dna.deleteDnaScheme(user, id);
    }
}
