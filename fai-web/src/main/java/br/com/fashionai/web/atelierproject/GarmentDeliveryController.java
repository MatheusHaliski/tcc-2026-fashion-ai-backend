package br.com.fashionai.web.atelierproject;

import br.com.fashionai.application.garmentdelivery.GarmentDeliveryService;
import br.com.fashionai.application.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

import static br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.*;

/**
 * FashionAI Garment Delivery — os 6 endpoints da encomenda à Fábrica FashionAI (fictícia): prévia e criação sob a
 * revisão do projeto; lista, detalhe, cancelamento e confirmação de recebimento só para a dona da encomenda.
 */
@RestController
public class GarmentDeliveryController {
    private final GarmentDeliveryService service;

    public GarmentDeliveryController(GarmentDeliveryService service) {
        this.service = service;
    }

    @GetMapping("/api/atelier/projects/{id}/revisions/{revisionId}/garment-orders/quote")
    @Operation(summary = "Prévia do checkout: tamanho, composição, cuidados, passaporte, prazo e preço fictícios")
    public Quote quote(CurrentUser user, @PathVariable UUID id, @PathVariable UUID revisionId,
                       @RequestParam(required = false) String size, @RequestParam(required = false) String cep,
                       @RequestParam(required = false) String speed) {
        return service.quote(user, id, revisionId, size, cep, speed);
    }

    @PostMapping("/api/atelier/projects/{id}/revisions/{revisionId}/garment-orders")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Encomenda a revisão à Fábrica FashionAI (simulação, sem cobrança; idempotente por requestId)")
    public OrderDetail create(CurrentUser user, @PathVariable UUID id, @PathVariable UUID revisionId, @RequestBody CreateCmd body) {
        return service.create(user, id, revisionId, body);
    }

    @GetMapping("/api/me/atelier/garment-orders")
    @Operation(summary = "Encomendas da pessoa")
    public List<OrderSummary> list(CurrentUser user) {
        return service.list(user);
    }

    @GetMapping("/api/atelier/garment-orders/{id}")
    @Operation(summary = "Detalhe da encomenda com a linha do tempo da fábrica")
    public OrderDetail detail(CurrentUser user, @PathVariable UUID id) {
        return service.detail(user, id);
    }

    @PostMapping("/api/atelier/garment-orders/{id}/cancel")
    @Operation(summary = "Cancela antes do corte (versão esperada)")
    public OrderDetail cancel(CurrentUser user, @PathVariable UUID id, @RequestBody VersionCmd body) {
        return service.cancel(user, id, body);
    }

    @PostMapping("/api/atelier/garment-orders/{id}/receive")
    @Operation(summary = "Confirma o recebimento: a peça entra no guarda-roupa com passaporte e etiqueta de cuidados")
    public OrderDetail receive(CurrentUser user, @PathVariable UUID id, @RequestBody VersionCmd body) {
        return service.receive(user, id, body);
    }
}
