package br.com.fashionai.web.controller;

import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.repository.TipoLookRepository;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
public class TipoLookController {
    private final TipoLookRepository tipos;

    public TipoLookController(TipoLookRepository tipos) { this.tipos = tipos; }

    @GetMapping("/api/tipos-look")
    @Transactional(readOnly = true)
    @Operation(summary = "Defesa — Opções do campo Tipo de look, obtidas da tabela TipoLook")
    public List<Views.TipoLookView> tiposLook() {
        return tipos.findAllByOrderByNomeAsc().stream().map(Views::tipoLook).toList();
    }
}
