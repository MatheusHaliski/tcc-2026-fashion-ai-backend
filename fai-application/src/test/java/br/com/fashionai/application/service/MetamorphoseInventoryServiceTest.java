package br.com.fashionai.application.service;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.*;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import org.junit.jupiter.api.*;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
class MetamorphoseInventoryServiceTest {
 AuraArtOfferRepository offers=mock(AuraArtOfferRepository.class);
 AuraIssuerLicenseRepository licenses=mock(AuraIssuerLicenseRepository.class);
 AtelierRewardGrantRepository rewards=mock(AtelierRewardGrantRepository.class);
 Guard guard=mock(Guard.class);
 MetamorphoseInventoryService service=new MetamorphoseInventoryService(offers,licenses,rewards,guard);
 CurrentUser user=new CurrentUser(UUID.randomUUID(),"ana","USER",ProfileType.PESSOAL,true,AccountStatus.ACTIVE,null,null);
 @BeforeEach void init(){
  AuraArtOffer offer=new AuraArtOffer();offer.setCode("CREATOR_PRISMA");offer.setName("Arte da marca");offer.setFamily("METAMORPHOSE");offer.setConfigJson("{\"auraMetamorphose\":\"PRISMA\"}");
  when(offers.findById("CREATOR_PRISMA")).thenReturn(Optional.of(offer));
  when(licenses.findByOwnerIdOrderByPurchasedAtDesc(user.id())).thenReturn(List.of());
  when(rewards.findByOwnerIdOrderByCreatedAtDesc(user.id())).thenReturn(List.of());
 }
 @Test void levelAloneNeverUnlocksAnArt(){assertThat(service.mine(user)).isEmpty();assertThatThrownBy(()->service.require(user,Map.of("auraMetamorphose","PRISMA"))).isInstanceOf(ApiException.class);}
 @Test void purchaseAllowsOnlyTheOwnedExactConfiguration(){
  var license=new AuraIssuerLicense();license.setOwnerId(user.id());license.setPresetCode("CREATOR_PRISMA");when(licenses.findByOwnerIdOrderByPurchasedAtDesc(user.id())).thenReturn(List.of(license));
  assertThat(service.mine(user)).extracting(MetamorphoseInventoryService.Art::code).containsExactly("CREATOR_PRISMA");
  service.require(user,Map.of("auraMetamorphose","PRISMA","auraEntitlementCode","CREATOR_PRISMA"));
  assertThatThrownBy(()->service.require(user,Map.of("auraMetamorphose","HOLOGRAFIA","auraEntitlementCode","CREATOR_PRISMA"))).isInstanceOf(ApiException.class);
 }
 @Test void expiredRevokedAndUnmappedRewardsNeverExposeGenericPresets(){
  var reward=new AtelierRewardGrant();reward.setCategory(AtelierRewardGrant.Category.auraSignature);reward.setRewardCode("CREATOR_PRISMA");reward.setSourceType("FLAIR");
  when(rewards.findByOwnerIdOrderByCreatedAtDesc(user.id())).thenReturn(List.of(reward));
  service.require(user,Map.of("auraMetamorphose","PRISMA","auraEntitlementCode","CREATOR_PRISMA"));
  reward.setExpiresAt(Instant.now().minusSeconds(1));assertThat(service.mine(user)).isEmpty();
  reward.setExpiresAt(null);reward.setRevoked(true);assertThat(service.mine(user)).isEmpty();
  reward.setRevoked(false);reward.setRewardCode("SYNERGY_UNKNOWN");assertThat(service.mine(user)).isEmpty();
 }
 @Test void publicCompositionCannotBypassOwnership(){assertThatThrownBy(()->service.require(user,Map.of("compositionPreset",Map.of("family","METAMORPHOSE","id","public-demo")))).isInstanceOf(ApiException.class);service.require(user,Map.of("auraMetamorphose","OFF"));}
}
