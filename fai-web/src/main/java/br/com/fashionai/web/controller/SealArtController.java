package br.com.fashionai.web.controller;

import br.com.fashionai.application.seal.SealArtService;
import br.com.fashionai.domain.model.enums.SealTier;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/** Leitura pública da arte dos selos de emissores aprovados (o mesmo que a página do emissor já mostra a visitantes). */
@RestController
public class SealArtController {
    private final SealArtService art;

    public SealArtController(SealArtService art) {
        this.art = art;
    }

    @GetMapping("/api/seals/art")
    @Operation(summary = "Arte (medalhão) dos selos escolhidos num card: keys=BRAND:Nome,CELEBRITY:Nome (até 40)")
    public Map<String, Object> art(@RequestParam(value = "keys", required = false) List<String> keys,
                                   @RequestParam(value = "tier", defaultValue = "PECA") String tier) {
        List<String> list = keys == null ? List.of() : keys;
        SealTier wanted = Arrays.stream(SealTier.values()).filter(t -> t.name().equals(tier)).findFirst().orElse(SealTier.PECA);
        return art.art(list, wanted);
    }
}
