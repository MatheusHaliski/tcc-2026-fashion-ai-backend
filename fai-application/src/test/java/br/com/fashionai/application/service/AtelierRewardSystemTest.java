package br.com.fashionai.application.service;
import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.application.security.*;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import org.junit.jupiter.api.*;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
class AtelierRewardSystemTest {
 AtelierRewardGrantRepository rewards=mock(AtelierRewardGrantRepository.class);
 FaiPointsLedgerEntryRepository owners=mock(FaiPointsLedgerEntryRepository.class);
 LevelProgressService levels=mock(LevelProgressService.class);
 Guard guard=new Guard(mock(AuditService.class),mock(FollowRepository.class));
 AtelierRewardSystem service=new AtelierRewardSystem(rewards,owners,levels,guard);
 UUID id=UUID.randomUUID();CurrentUser user=new CurrentUser(id,"ana","USER",ProfileType.PESSOAL,true,AccountStatus.ACTIVE,null,null);
 AtelierRewardGrant reward(){var r=new AtelierRewardGrant();r.assignId(UUID.randomUUID());r.setOwnerId(id);r.setCategory(AtelierRewardGrant.Category.garmentMemory);r.setRewardCode("DUET_1");r.setTitle("Dueto");r.setDescription("Primeiro dueto confirmado");r.setSourceType("FLAIR");r.setSourceReference("match-1");r.markCreatedAt(Instant.parse("2026-10-01T00:00:00Z"));return r;}
 @Test void exposesAllSixCategoriesButOnlyActiveUnexpiredGrants(){var valid=reward();var expired=reward();expired.setExpiresAt(Instant.parse("2026-01-01T00:00:00Z"));var revoked=reward();revoked.setRevoked(true);when(rewards.findByOwnerIdOrderByCreatedAtDesc(id)).thenReturn(List.of(valid,expired,revoked));when(levels.progress(id)).thenReturn(Map.of("level","LOFT","percent",12));var result=service.mine(user);assertThat(result.categories()).hasSize(6);assertThat(result.total()).isEqualTo(1);assertThat(result.categories().get(AtelierRewardGrant.Category.garmentMemory)).extracting(AtelierRewardSystem.RewardView::id).containsExactly(valid.getId());assertThat(result.levelProgress()).containsEntry("level","LOFT");verify(rewards).findByOwnerIdOrderByCreatedAtDesc(id);}
 @Test void unauthenticatedCannotReadRewards(){assertThatThrownBy(()->service.mine(null)).isInstanceOf(RuntimeException.class);verifyNoInteractions(rewards,levels,owners);}
 @Test void repeatedSourceDoesNotGrantTwiceOrCreditPoints(){var r=reward();when(owners.lockOwner(id)).thenReturn(Optional.of(new User()));when(rewards.findByOwnerIdAndCategoryAndRewardCodeAndSourceTypeAndSourceReference(id,r.getCategory(),"DUET_1","FLAIR","match-1")).thenReturn(Optional.of(r));var grant=new AtelierRewardSystem.Grant(id,r.getCategory(),"DUET_1","Dueto","Descrição","FLAIR","match-1","piece-id",null);assertThat(service.grant(grant)).isSameAs(r);verify(rewards,never()).save(any());verify(owners,never()).save(any());}
 @Test void invalidOrExpiredGrantDoesNotReachPersistence(){var bad=new AtelierRewardSystem.Grant(id,AtelierRewardGrant.Category.auraSignature,"AURA_1","Aura","Teste","CLIENT","untrusted",null,null);assertThatThrownBy(()->service.grant(bad)).isInstanceOf(RuntimeException.class);var expired=new AtelierRewardSystem.Grant(id,AtelierRewardGrant.Category.seasonPasses,"SEASON","Convite","Teste","SEASON","season-1",null,Instant.EPOCH);assertThatThrownBy(()->service.grant(expired)).isInstanceOf(RuntimeException.class);verifyNoInteractions(rewards,owners);}
 @Test void recordsSourceAndPersonalReferenceWithoutFinancialMutation(){when(owners.lockOwner(id)).thenReturn(Optional.of(new User()));when(rewards.save(any())).thenAnswer(inv->inv.getArgument(0));var grant=new AtelierRewardSystem.Grant(id,AtelierRewardGrant.Category.habitableTrofeus,"MIRROR","Espelho","Descrição","ATELIER_PROJECT","project-1","inventory-id",null);var result=service.grant(grant);assertThat(result.getOwnerId()).isEqualTo(id);assertThat(result.getReferenceId()).isEqualTo("inventory-id");verify(owners,never()).save(any());}
}
