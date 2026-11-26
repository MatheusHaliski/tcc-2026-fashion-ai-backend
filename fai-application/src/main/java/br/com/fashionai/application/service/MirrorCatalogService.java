package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.CatalogProduct;
import br.com.fashionai.domain.model.MirrorState;
import br.com.fashionai.domain.repository.MirrorStateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Espelho (RF33) com o catálogo de marcas (RF47): vestir e tirar um produto do catálogo só para provar, ao lado das peças
 * do guarda-roupa. O id do produto é a única coisa que vem do cliente: existência, visibilidade e lugar no corpo saem do
 * catálogo ({@link MirrorCatalogPieces}); as regras do corpo são as mesmas das peças da pessoa ({@link MirrorCatalogSlots}).
 * A resposta é o estado do espelho de sempre ({@link MirrorService#render}). Nada disso vira esquema, Look do Dia nem
 * sinal de conquista: essas ações continuam só com as peças da pessoa.
 */
@Service
public class MirrorCatalogService {
    private final MirrorService mirror;
    private final MirrorStateRepository mirrors;
    private final MirrorCatalogPieces pieces;

    public MirrorCatalogService(MirrorService mirror, MirrorStateRepository mirrors, MirrorCatalogPieces pieces) {
        this.mirror = mirror;
        this.mirrors = mirrors;
        this.pieces = pieces;
    }

    @Transactional
    public Map<String, Object> wear(CurrentUser user, UUID productId) {
        CatalogProduct product = pieces.wearable(productId);
        MirrorState s = mirror.stateEntity(user.id());
        Map<String, Object> slots = mirror.slots(s);
        MirrorCatalogSlots.wear(slots, MirrorService.slotOf(product.getCategory(), product.getSubcategory()), product.getId());
        // a mesma origem da montagem manual: depois do Vista-me, o look passa a ser do espelho
        if ("vista_me".equals(slots.get("origin"))) {
            slots.put("origin", "smart_mirror");
        } else {
            slots.putIfAbsent("origin", "manual");
        }
        return save(user, s, slots, Map.of("placedProduct", product.getId()));
    }

    @Transactional
    public Map<String, Object> takeOff(CurrentUser user, UUID productId) {
        MirrorState s = mirror.stateEntity(user.id());
        Map<String, Object> slots = mirror.slots(s);
        MirrorCatalogSlots.remove(slots, productId);
        return save(user, s, slots, Map.of("removedProduct", productId));
    }

    private Map<String, Object> save(CurrentUser user, MirrorState s, Map<String, Object> slots, Map<String, Object> extra) {
        slots.put("updatedAt", Instant.now().toString());
        s.setSlotsJson(Json.write(slots));
        mirrors.save(s);
        return mirror.render(user, s, slots, extra);
    }
}
