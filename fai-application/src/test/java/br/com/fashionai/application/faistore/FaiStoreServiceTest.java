package br.com.fashionai.application.faistore;

import br.com.fashionai.application.catalog.CatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.AuraArtOffer;
import br.com.fashionai.domain.model.AuraIssuerLicense;
import br.com.fashionai.domain.model.FaiPointsLedgerEntry;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.AuraArtOfferRepository;
import br.com.fashionai.domain.repository.AuraIssuerLicenseRepository;
import br.com.fashionai.domain.repository.CatalogProductRepository;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.data.domain.Page;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Compra da Loja FAI Points: débito atômico, saldo insuficiente, item já possuído e preset de Aura com licença. */
class FaiStoreServiceTest {
    static final String WARDROBE = "WARDROBE_NOGUEIRA_CLASSICO";   // 400 pontos no catálogo curado

    final CurrentUser user = new CurrentUser(UUID.randomUUID(), "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    AuraArtOfferRepository offers;
    AuraIssuerLicenseRepository licenses;
    FaiPointsLedgerEntryRepository ledger;
    FaiStoreService service;
    AuraArtOffer prisma;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void init() {
        offers = mock(AuraArtOfferRepository.class);
        licenses = mock(AuraIssuerLicenseRepository.class);
        ledger = mock(FaiPointsLedgerEntryRepository.class);
        CatalogProductRepository products = mock(CatalogProductRepository.class);
        when(products.browse(any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(Page.empty());
        prisma = new AuraArtOffer();
        prisma.setCode("META_PRISMA");
        prisma.setName("Prisma marfim");
        prisma.setFamily("METAMORPHOSE");
        prisma.setConfigJson("{\"auraMetamorphose\":\"PRISMA\"}");
        prisma.setPricePoints(150);
        prisma.setActive(true);
        when(offers.findByActiveTrueOrderByPricePointsAsc()).thenReturn(List.of(prisma));
        when(offers.findById("META_PRISMA")).thenReturn(Optional.of(prisma));
        when(ledger.lockOwner(user.id())).thenReturn(Optional.of(new User()));
        when(licenses.findByOwnerIdAndPresetCode(any(), anyString())).thenReturn(Optional.empty());
        FaiStoreCatalog catalog = new FaiStoreCatalog(offers, products, mock(CatalogService.class));
        service = new FaiStoreService(catalog, ledger, licenses, mock(Guard.class));
    }

    @Test
    void compraTravaOSaldoEDebitaUmaVezNaMesmaTransacao() {
        when(ledger.balance(user.id())).thenReturn(500L);
        Map<String, Object> result = service.purchase(user, WARDROBE);
        assertThat(result).containsEntry("itemId", WARDROBE).containsEntry("owned", true).containsEntry("balance", 100L);
        InOrder order = inOrder(ledger);
        order.verify(ledger).lockOwner(user.id());
        order.verify(ledger).existsByIdempotencyKey(FaiStoreService.key(user.id(), WARDROBE));
        order.verify(ledger).balance(user.id());
        order.verify(ledger).saveAndFlush(org.mockito.ArgumentMatchers.<FaiPointsLedgerEntry>argThat(e -> e.getDelta() == -400
                && "FAI_STORE".equals(e.getRefType()) && WARDROBE.equals(e.getRefId()) && !e.isCountsLifetime()
                && FaiStoreService.key(user.id(), WARDROBE).equals(e.getIdempotencyKey())));
        verify(licenses, never()).save(any());
    }

    @Test
    void saldoInsuficienteRecusaSemDebitar() {
        when(ledger.balance(user.id())).thenReturn(399L);
        assertThatThrownBy(() -> service.purchase(user, WARDROBE)).isInstanceOfSatisfying(ApiException.class, ex -> {
            assertThat(ex.status()).isEqualTo(409);
            assertThat(ex.code()).isEqualTo("SALDO_INSUFICIENTE");
        });
        verify(ledger, never()).saveAndFlush(any());
    }

    @Test
    void itemJaPossuidoNaoCobraDeNovo() {
        when(ledger.existsByIdempotencyKey(FaiStoreService.key(user.id(), WARDROBE))).thenReturn(true);
        when(ledger.balance(user.id())).thenReturn(5000L);
        assertThatThrownBy(() -> service.purchase(user, WARDROBE)).isInstanceOfSatisfying(ApiException.class,
                ex -> assertThat(ex.code()).isEqualTo("ITEM_JA_POSSUIDO"));
        verify(ledger, never()).saveAndFlush(any());
    }

    @Test
    void presetDeAuraViraLicencaEJaLicenciadoContaComoPossuido() {
        when(ledger.balance(user.id())).thenReturn(150L);
        service.purchase(user, "AURA_META_PRISMA");
        verify(licenses).save(org.mockito.ArgumentMatchers.<AuraIssuerLicense>argThat(l -> "META_PRISMA".equals(l.getPresetCode()) && l.getPricePaid() == 150));

        when(licenses.findByOwnerIdAndPresetCode(user.id(), "META_PRISMA")).thenReturn(Optional.of(new AuraIssuerLicense()));
        assertThatThrownBy(() -> service.purchase(user, "AURA_META_PRISMA")).isInstanceOfSatisfying(ApiException.class,
                ex -> assertThat(ex.code()).isEqualTo("ITEM_JA_POSSUIDO"));
    }

    @Test
    void itemInexistenteOuDesativadoNaoDebita() {
        prisma.setActive(false);
        when(ledger.balance(user.id())).thenReturn(9999L);
        assertThatThrownBy(() -> service.purchase(user, "AURA_META_PRISMA")).isInstanceOfSatisfying(ApiException.class,
                ex -> assertThat(ex.status()).isEqualTo(404));
        assertThatThrownBy(() -> service.purchase(user, "NAO_EXISTE")).isInstanceOf(ApiException.class);
        verify(ledger, never()).saveAndFlush(any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void vitrineMostraPosseESaldoNaOrdemDosFiltros() {
        when(ledger.balance(user.id())).thenReturn(420L);
        FaiPointsLedgerEntry bought = new FaiPointsLedgerEntry();
        bought.setRefId(WARDROBE);
        when(ledger.findByUserIdAndRefTypeOrderByCreatedAtDesc(user.id(), "FAI_STORE")).thenReturn(List.of(bought));
        Map<String, Object> store = service.store(user);
        List<Map<String, Object>> items = (List<Map<String, Object>>) store.get("items");
        assertThat(store).containsEntry("balance", 420L);
        assertThat(items.get(0)).containsEntry("id", "AURA_META_PRISMA").containsEntry("type", "AURA_PRESET");
        assertThat(items).filteredOn(i -> WARDROBE.equals(i.get("id"))).singleElement().satisfies(i -> assertThat(i).containsEntry("owned", true));
        assertThat(items).filteredOn(i -> "WARDROBE_DREAM_VIDRO_MARFIM".equals(i.get("id"))).singleElement()
                .satisfies(i -> assertThat(i).containsEntry("affordable", false).containsEntry("owned", false));
        assertThat(items).extracting(i -> i.get("type")).containsSubsequence("AURA_PRESET", "WARDROBE", "ACERVO_ITEM", "PIECE_CARD", "LOOK_CARD", "BRAND_AURA");
        assertThat(items).allSatisfy(i -> assertThat((String) i.get("name")).isNotBlank().doesNotStartWith("faiStore."));
    }
}
