package br.com.fashionai.web.controller;

import br.com.fashionai.application.seal.SealPolicyBrandResolver;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.BrandRepository;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Exercício 13 — opções de marca para a política do selo. Somente leitura e igual para todo mundo: nome e slug
 * públicos das marcas do catálogo ({@code kind=CATALOG}) ou dos perfis de marca aprovados ({@code kind=PROFILE}).
 */
@RestController
public class SealPolicyReferenceController {
    private final SealPolicyBrandResolver brandReferences;

    public SealPolicyReferenceController(BrandRepository brands, BrandProfileRepository profiles) {
        this.brandReferences = new SealPolicyBrandResolver(() -> brands, profiles);
    }

    @GetMapping("/api/opcoes/marcas-politica")
    @Transactional(readOnly = true)
    @Operation(summary = "Marcas que uma regra da política do selo pode exigir (catálogo ou perfil de marca), por trecho do nome")
    public List<Views.ReferenceOptionView> marcasPolitica(@RequestParam(defaultValue = "CATALOG") String kind,
                                                          @RequestParam(defaultValue = "") String q) {
        return brandReferences.options(kind, q);
    }
}
