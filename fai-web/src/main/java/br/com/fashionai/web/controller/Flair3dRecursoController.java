package br.com.fashionai.web.controller;

import br.com.fashionai.application.flair3d.recurso.Flair3dRecursoUso;
import br.com.fashionai.application.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * FLAIR 3D — a peça usada como recurso numa partida (regra peça-recurso): vida, energia, foco e moedas da partida, e o
 * uso de uma peça do deck. Logado; só o dono da partida.
 */
@RestController
@Tag(name = "FLAIR 3D — recursos")
public class Flair3dRecursoController {
    private final Flair3dRecursoUso uso;

    public Flair3dRecursoController(Flair3dRecursoUso uso) {
        this.uso = uso;
    }

    @GetMapping("/api/flair/3d/partidas/{id}/recursos")
    @Operation(summary = "Os recursos da partida (vida, energia, foco, moedas) e quantas vezes cada carta do deck já foi usada")
    public Map<String, Object> recursos(CurrentUser user, @PathVariable UUID id) {
        return uso.estado(user, id);
    }

    @PostMapping("/api/flair/3d/partidas/{id}/usar")
    @Operation(summary = "Usa uma peça do deck como recurso (só o dono, 403; partida fechada, 409; fora do deck ou sem usos, 422; "
            + "pedido repetido devolve a mesma resposta)")
    public Map<String, Object> usar(CurrentUser user, @PathVariable UUID id, @RequestBody(required = false) Flair3dRecursoUso.PedidoDeUso body) {
        return uso.usar(user, id, body);
    }
}
