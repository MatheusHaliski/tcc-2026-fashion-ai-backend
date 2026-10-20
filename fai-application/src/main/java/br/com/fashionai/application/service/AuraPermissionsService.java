package br.com.fashionai.application.service;
import br.com.fashionai.application.common.*;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
@Service
public class AuraPermissionsService {
 public enum AuraType {AURA_BASIC,AURA_DYNAMIC,AURA_METAMORPHOSE,AURA_IMPERSONATION}
 public static final Map<AuraType,FaiPointsService.Level> AuraGatingConfig=Map.of(AuraType.AURA_BASIC,FaiPointsService.Level.ESTREIA,AuraType.AURA_DYNAMIC,FaiPointsService.Level.STUDIO,AuraType.AURA_METAMORPHOSE,FaiPointsService.Level.LOFT,AuraType.AURA_IMPERSONATION,FaiPointsService.Level.LOFT);
 private final FaiPointsLedgerEntryRepository ledger;
 public AuraPermissionsService(FaiPointsLedgerEntryRepository ledger){this.ledger=ledger;}
 @Transactional(readOnly=true) public boolean canUserEquipAura(UUID userId,AuraType type){return userId!=null&&type!=null&&FaiPointsService.Level.of(ledger.lifetime(userId)).atLeast(AuraGatingConfig.get(type));}
 public static final Map<String,FaiPointsService.Level> HYPE_FINISH_TIERS=Map.of("COMMON",FaiPointsService.Level.ESTREIA,"RARE",FaiPointsService.Level.STUDIO,"LEGENDARY",FaiPointsService.Level.LOFT,"COLLAB_DROP",FaiPointsService.Level.LOFT);
 @Transactional(readOnly=true) public void requireHypeFinish(UUID userId,String finish){
  var required=HYPE_FINISH_TIERS.get(finish);
  if(required==null)throw ApiException.badRequest("AURA_HYPE_INVALID","AURA Hype inválida.");
  if(userId==null||!FaiPointsService.Level.of(ledger.lifetime(userId)).atLeast(required))throw new ApiException(403,"AURA_LEVEL_REQUIRED",Msg.t("auraHype.finishLocked",required.name()),Map.of("requiredTier",required.name()));
 }
 public String getLockedAuraMessage(AuraType type){return Msg.t("auraGate.locked."+type.name());}
 @Transactional(readOnly=true) public void require(UUID userId,AuraType type){if(!canUserEquipAura(userId,type))throw new ApiException(403,"AURA_LEVEL_REQUIRED",getLockedAuraMessage(type),Map.of("requiredTier",AuraGatingConfig.get(type).name()));}
 @Transactional(readOnly=true) public Map<String,Object> permissions(UUID userId){
  var tier=FaiPointsService.Level.of(ledger.lifetime(userId));Map<String,Object> allowed=new LinkedHashMap<>();
  AuraGatingConfig.forEach((type,required)->allowed.put(type.name(),Map.of("allowed",tier.atLeast(required),"requiredTier",required.name(),"message",getLockedAuraMessage(type))));
  return Map.of("currentTier",tier.name(),"auras",allowed,"configVersion",1);
 }
}
