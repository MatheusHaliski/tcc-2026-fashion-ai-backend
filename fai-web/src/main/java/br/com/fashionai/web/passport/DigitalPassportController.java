package br.com.fashionai.web.passport;

import br.com.fashionai.application.fit.SizeOptionsService;
import br.com.fashionai.application.passport.DigitalPassportService;
import br.com.fashionai.application.security.CurrentUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/** Passaporte digital da peça (ficha agregada) e opções de tamanho por produto. */
@RestController
public class DigitalPassportController {
    private final DigitalPassportService passport;
    private final SizeOptionsService sizes;

    public DigitalPassportController(DigitalPassportService passport, SizeOptionsService sizes) {
        this.passport = passport;
        this.sizes = sizes;
    }

    @GetMapping("/api/pieces/{id}/digital-passport")
    public Map<String, Object> sheet(CurrentUser user, @PathVariable UUID id) {
        return passport.sheet(user, id);
    }

    @GetMapping("/api/catalog/products/{id}/size-options")
    public Map<String, Object> productSizes(@PathVariable UUID id) {
        return sizes.forProduct(id);
    }
}
