package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

/** Only persisted ownership is equippable; a level or a public catalog entry never grants an art. */
@Service
public class MetamorphoseInventoryService {
 private final AuraArtOfferRepository offers;
 private final AuraIssuerLicenseRepository licenses;
 private final AtelierRewardGrantRepository rewards;
 private final Guard guard;
 public MetamorphoseInventoryService(AuraArtOfferRepository offers, AuraIssuerLicenseRepository licenses,
        AtelierRewardGrantRepository rewards, Guard guard) {
  this.offers=offers; this.licenses=licenses; this.rewards=rewards; this.guard=guard;
 }
 public record Art(String code, String name, Map<String,Object> config, String source, Instant expiresAt) {}
 @Transactional(readOnly=true) public List<Art> mine(CurrentUser user) {
  guard.requireCanCreate(user);
  Map<String,Art> owned=new LinkedHashMap<>();
  for (var license:licenses.findByOwnerIdOrderByPurchasedAtDesc(user.id()))
   add(owned,license.getPresetCode(),"STORE",null);
  Instant now=Instant.now();
  for (var reward:rewards.findByOwnerIdOrderByCreatedAtDesc(user.id())) {
   if (reward.isRevoked() || reward.getCategory()!=AtelierRewardGrant.Category.auraSignature
       || reward.getExpiresAt()!=null && !reward.getExpiresAt().isAfter(now)) continue;
   // Reward producers must reference an actual registered art, not an arbitrary generic VFX mode.
   add(owned,reward.getRewardCode(),reward.getSourceType(),reward.getExpiresAt());
  }
  return List.copyOf(owned.values());
 }
 private void add(Map<String,Art> owned,String code,String source,Instant expiresAt) {
  if (owned.containsKey(code)) return;
  offers.findById(code).filter(o->"METAMORPHOSE".equals(o.getFamily())).ifPresent(o->{
   Map<String,Object> config=Json.map(o.getConfigJson());
   BackgroundStudioService.validateArtwork(config);
   owned.put(code,new Art(code,o.getName(),config,source,expiresAt));
  });
 }
 @Transactional(readOnly=true) public void require(CurrentUser user,Map<?,?> config) {
  boolean active=config.get("auraMetamorphose") instanceof String m && !"OFF".equals(m);
  boolean composition=config.get("compositionPreset") instanceof Map<?,?> p && "METAMORPHOSE".equals(p.get("family"));
  Object code=config.get("auraEntitlementCode");
  if (!active && !composition && code == null) return;
  for (Art art:mine(user)) {
   if (!art.code().equals(code)) continue;
   boolean matches=true;
   // An offer owns every field it defines, including complete nested palettes/materials.
   // Also reject adding a different Metamorphose mode/composition absent from the offer.
   Set<String> keys=new HashSet<>(art.config().keySet());
   keys.addAll(List.of("auraMetamorphose","auraMetamorphosePreset","compositionPreset"));
   for (String key:keys) {
    if (art.config().containsKey(key) && !config.containsKey(key)
        || !Objects.equals(config.get(key),art.config().get(key))) matches=false;
   }
   if (matches) return;
  }
  throw new ApiException(403,"AURA_ART_REQUIRED","Esta Metamorfose exige uma arte adquirida na loja ou recebida como recompensa válida.");
 }
}
