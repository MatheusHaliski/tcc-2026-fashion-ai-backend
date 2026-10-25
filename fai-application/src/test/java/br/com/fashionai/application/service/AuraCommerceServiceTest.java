package br.com.fashionai.application.service;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.*;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import org.junit.jupiter.api.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
class AuraCommerceServiceTest {
 AuraArtOfferRepository offers;AuraIssuerLicenseRepository licenses;FaiPointsLedgerEntryRepository ledger;Guard guard;AuraCommerceService service;
 CurrentUser user=new CurrentUser(UUID.randomUUID(),"marca","USER",ProfileType.MARCA,true,AccountStatus.ACTIVE,null,null);
 AuraArtOffer offer;
 @BeforeEach void init(){offers=mock(AuraArtOfferRepository.class);licenses=mock(AuraIssuerLicenseRepository.class);ledger=mock(FaiPointsLedgerEntryRepository.class);guard=mock(Guard.class);service=new AuraCommerceService(offers,licenses,ledger,guard);
  offer=new AuraArtOffer();offer.setCode("META_PRISMA_IVORY");offer.setName("Prisma marfim");offer.setFamily("METAMORPHOSE");offer.setConfigJson("{\"auraMetamorphose\":\"PRISMA\"}");offer.setPricePoints(150);offer.setActive(true);
  when(offers.lockByCode(offer.getCode())).thenReturn(Optional.of(offer));when(offers.findById(offer.getCode())).thenReturn(Optional.of(offer));when(ledger.lockOwner(user.id())).thenReturn(Optional.of(new User()));when(ledger.balance(user.id())).thenReturn(200L);
 }
 @Test void purchaseDebitsOnceAndAppearsAsIssuerLicense(){
  when(licenses.findByOwnerIdAndPresetCode(user.id(),offer.getCode())).thenReturn(Optional.empty());
  doAnswer(inv->{AuraIssuerLicense license=inv.getArgument(0);license.assignId(UUID.randomUUID());when(licenses.findByOwnerIdAndPresetCode(user.id(),offer.getCode())).thenReturn(Optional.of(license));return license;}).when(licenses).save(any());
  Map<String,Object> result=service.purchase(user,offer.getCode());assertThat(result).containsEntry("kind","ISSUER_LICENSE").containsEntry("pricePaid",150);
  service.purchase(user,offer.getCode());verify(ledger,times(1)).save(argThat(e->e.getDelta()==-150&&!e.isCountsLifetime()));verify(licenses,times(1)).save(any());verify(ledger,times(2)).lockOwner(user.id());
 }
 @Test void insufficientFundsNeverCreatesLicense(){when(ledger.balance(user.id())).thenReturn(149L);assertThatThrownBy(()->service.purchase(user,offer.getCode())).isInstanceOf(ApiException.class);verify(ledger,never()).save(any());verify(licenses,never()).save(any());}
 @Test void inactiveOfferNeverDebits(){offer.setActive(false);assertThatThrownBy(()->service.purchase(user,offer.getCode())).isInstanceOf(ApiException.class);verify(ledger,never()).save(any());}
 @Test void adminRegistrationValidatesFamilyModeAndPermission(){
  AuraCommerceService.OfferForm good=new AuraCommerceService.OfferForm("HYPE_SCAN_GRAPHITE","Scanner", "HYPE",50,true,Map.of("auraHype","SCAN_GRAPHITE"));when(offers.lockByCode(good.code())).thenReturn(Optional.empty());
  service.save(user,good);verify(guard).requireAdmin(user);verify(offers).save(argThat(o->o.getPricePoints()==50&&o.isActive()));
  assertThatThrownBy(()->service.save(user,new AuraCommerceService.OfferForm("BAD","bad",null,0,true,Map.of()))).isInstanceOf(ApiException.class);
  assertThatThrownBy(()->service.save(user,new AuraCommerceService.OfferForm("BAD","bad","METAMORPHOSE",0,true,Map.of("auraMetamorphose","OFF")))).isInstanceOf(ApiException.class);
 }
 @Test void licensedArtConfigIsFrozen(){
  when(licenses.existsByPresetCode(offer.getCode())).thenReturn(true);
  var changed=new AuraCommerceService.OfferForm(offer.getCode(),"Prisma marfim","METAMORPHOSE",150,true,Map.of("auraMetamorphose","CONSTELACAO"));
  assertThatThrownBy(()->service.save(user,changed)).isInstanceOf(ApiException.class).hasFieldOrPropertyWithValue("code","AURA_OFFER_LOCKED");
  service.save(user,new AuraCommerceService.OfferForm(offer.getCode(),"Prisma · Marfim","METAMORPHOSE",120,false,Map.of("auraMetamorphose","PRISMA")));
  verify(offers).save(argThat(o->o.getPricePoints()==120&&!o.isActive()&&"Prisma · Marfim".equals(o.getName())));
 }
}
