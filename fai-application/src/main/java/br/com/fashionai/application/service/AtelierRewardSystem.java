package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.*;
import br.com.fashionai.domain.model.AtelierRewardGrant;
import br.com.fashionai.domain.model.AtelierRewardGrant.Category;
import br.com.fashionai.domain.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
public class AtelierRewardSystem {
 private final AtelierRewardGrantRepository rewards;
 private final FaiPointsLedgerEntryRepository owners;
 private final LevelProgressService levels;
 private final Guard guard;
 public AtelierRewardSystem(AtelierRewardGrantRepository rewards,FaiPointsLedgerEntryRepository owners,LevelProgressService levels,Guard guard){this.rewards=rewards;this.owners=owners;this.levels=levels;this.guard=guard;}
 public record RewardView(UUID id,Category category,String code,String title,String description,String sourceType,String sourceReference,String referenceId,Instant earnedAt,Instant expiresAt){}
 public record Snapshot(Map<Category,List<RewardView>> categories,Map<String,Object> levelProgress,int total){}
 public record Grant(UUID ownerId,Category category,String code,String title,String description,String sourceType,String sourceReference,String referenceId,Instant expiresAt){}
 @Transactional(readOnly=true) public Snapshot mine(CurrentUser user){
  guard.requireCanCreate(user);var categories=group(rewards.findByOwnerIdOrderByCreatedAtDesc(user.id()),Instant.now());
  return new Snapshot(categories,levels.progress(user.id()),categories.values().stream().mapToInt(List::size).sum());
 }
 static Map<Category,List<RewardView>> group(List<AtelierRewardGrant> rows,Instant now){
  Map<Category,List<RewardView>> result=new LinkedHashMap<>();for(var category:Category.values())result.put(category,new ArrayList<>());
  for(var r:rows)if(!r.isRevoked()&&(r.getExpiresAt()==null||r.getExpiresAt().isAfter(now)))result.get(r.getCategory()).add(new RewardView(r.getId(),r.getCategory(),r.getRewardCode(),r.getTitle(),r.getDescription(),r.getSourceType(),r.getSourceReference(),r.getReferenceId(),r.getCreatedAt(),r.getExpiresAt()));
  return result;
 }
 /** Internal integration port. No HTTP grant route or client-supplied reward acceptance. */
 @Transactional public AtelierRewardGrant grant(Grant grant){
  if(grant==null||grant.ownerId()==null||grant.category()==null||grant.code()==null||!grant.code().matches("[A-Z0-9_:-]{1,80}")||grant.title()==null||grant.title().isBlank()||grant.title().length()>140||grant.description()==null||grant.description().length()>1200||!Set.of("FLAIR","HYPE","ATELIER_PROJECT","SEAL","SEASON","TEAM").contains(Objects.toString(grant.sourceType(),""))||grant.sourceReference()==null||grant.sourceReference().isBlank()||grant.sourceReference().length()>160||grant.referenceId()!=null&&grant.referenceId().length()>160)throw ApiException.badRequest("ATELIER_REWARD_INVALID","Recompensa de Atelier inválida.");
  if(grant.expiresAt()!=null&&!grant.expiresAt().isAfter(Instant.now()))throw ApiException.badRequest("ATELIER_REWARD_EXPIRED","A recompensa já expirou.");
  owners.lockOwner(grant.ownerId()).orElseThrow(()->ApiException.notFound("Usuário"));
  var existing=rewards.findByOwnerIdAndCategoryAndRewardCodeAndSourceTypeAndSourceReference(grant.ownerId(),grant.category(),grant.code(),grant.sourceType(),grant.sourceReference());if(existing.isPresent())return existing.get();
  var row=new AtelierRewardGrant();row.setOwnerId(grant.ownerId());row.setCategory(grant.category());row.setRewardCode(grant.code());row.setTitle(grant.title());row.setDescription(grant.description());row.setSourceType(grant.sourceType());row.setSourceReference(grant.sourceReference());row.setReferenceId(grant.referenceId());row.setExpiresAt(grant.expiresAt());return rewards.save(row);
 }
}
