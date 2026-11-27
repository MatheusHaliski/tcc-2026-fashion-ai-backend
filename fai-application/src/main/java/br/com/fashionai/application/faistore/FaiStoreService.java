package br.com.fashionai.application.faistore;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.AuraIssuerLicense;
import br.com.fashionai.domain.model.FaiPointsLedgerEntry;
import br.com.fashionai.domain.repository.AuraIssuerLicenseRepository;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Loja FAI Points: compra itens digitais só com FAI Points, sem pagamento externo e sem tabela nova. O lançamento de
 * débito no ledger ({@code ref_type = FAI_STORE}, chave única por pessoa e item) é a prova de posse; preset de Aura
 * também vira licença em {@code aura_issuer_licenses}, que o inventário da Metamorfose já reconhece.
 */
@Service
public class FaiStoreService {
    static final String REF_TYPE = "FAI_STORE";
    static final String ACTION = "FAI_STORE_PURCHASE";

    private final FaiStoreCatalog catalog;
    private final FaiPointsLedgerEntryRepository ledger;
    private final AuraIssuerLicenseRepository licenses;
    private final Guard guard;

    public FaiStoreService(FaiStoreCatalog catalog, FaiPointsLedgerEntryRepository ledger, AuraIssuerLicenseRepository licenses, Guard guard) {
        this.catalog = catalog;
        this.ledger = ledger;
        this.licenses = licenses;
        this.guard = guard;
    }

    /** Vitrine com saldo, o que a pessoa já tem e o que o saldo cobre. */
    @Transactional(readOnly = true)
    public Map<String, Object> store(CurrentUser user) {
        guard.requireSession(user);
        long balance = ledger.balance(user.id());
        Set<String> owned = ownedIds(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("balance", balance);
        out.put("types", FaiStoreItem.TYPES);
        out.put("items", catalog.all().stream().map(i -> i.view(owned.contains(i.id()), balance)).toList());
        return out;
    }

    /** Itens da pessoa, do mais recente ao mais antigo. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> mine(CurrentUser user) {
        guard.requireSession(user);
        return ownedIds(user.id()).stream().map(catalog::find).flatMap(Optional::stream).map(i -> i.view(true, 0)).toList();
    }

    /**
     * Compra atômica: trava a linha da dona do saldo, confere posse e saldo e grava o débito (e a licença, no preset de
     * Aura) na mesma transação. Comprar de novo o mesmo item é recusado; a chave única do ledger barra até a corrida.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Map<String, Object> purchase(CurrentUser user, String itemId) {
        guard.requireCanCreate(user);
        ledger.lockOwner(user.id()).orElseThrow(() -> ApiException.notFound(Msg.t("faiStore.item")));
        FaiStoreItem item = catalog.find(itemId).orElseThrow(() -> ApiException.notFound(Msg.t("faiStore.item")));
        if (owns(user.id(), item)) {
            throw ApiException.conflict("ITEM_JA_POSSUIDO", Msg.t("faiStore.ja_possui", item.name()));
        }
        long balance = ledger.balance(user.id());
        if (balance < item.pricePoints()) {
            throw new ApiException(409, "SALDO_INSUFICIENTE", Msg.t("faiStore.saldo_insuficiente", balance, item.pricePoints()),
                    Map.of("balance", balance, "price", item.pricePoints()));
        }
        FaiPointsLedgerEntry entry = new FaiPointsLedgerEntry();
        entry.setUserId(user.id());
        entry.setDelta(-item.pricePoints());
        entry.setActionCode(ACTION);
        entry.setRefType(REF_TYPE);
        entry.setRefId(item.id());
        entry.setIdempotencyKey(key(user.id(), item.id()));
        entry.setCountsLifetime(false);
        ledger.saveAndFlush(entry);
        if (item.auraCode() != null && licenses.findByOwnerIdAndPresetCode(user.id(), item.auraCode()).isEmpty()) {
            AuraIssuerLicense license = new AuraIssuerLicense();
            license.setOwnerId(user.id());
            license.setPresetCode(item.auraCode());
            license.setPricePaid(item.pricePoints());
            license.setPurchasedAt(Instant.now());
            licenses.save(license);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("itemId", item.id());
        out.put("owned", true);
        out.put("balance", balance - item.pricePoints());
        return out;
    }

    static String key(UUID userId, String itemId) {
        return userId + ":" + REF_TYPE + ":" + itemId;
    }

    private boolean owns(UUID userId, FaiStoreItem item) {
        return ledger.existsByIdempotencyKey(key(userId, item.id()))
                || item.auraCode() != null && licenses.findByOwnerIdAndPresetCode(userId, item.auraCode()).isPresent();
    }

    /** Compras desta loja e licenças de arte Aura já adquiridas (pela loja de artes, inclusive). */
    private Set<String> ownedIds(UUID userId) {
        Set<String> ids = new LinkedHashSet<>();
        ledger.findByUserIdAndRefTypeOrderByCreatedAtDesc(userId, REF_TYPE).forEach(e -> ids.add(e.getRefId()));
        licenses.findByOwnerIdOrderByPurchasedAtDesc(userId).forEach(l -> ids.add(FaiStoreCatalog.AURA_PREFIX + l.getPresetCode()));
        return ids;
    }
}
