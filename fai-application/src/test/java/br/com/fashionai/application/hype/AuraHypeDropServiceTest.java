package br.com.fashionai.application.hype;
import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.application.security.*;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import org.junit.jupiter.api.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
class AuraHypeDropServiceTest {
 AuraHypeDropRepository drops=mock(AuraHypeDropRepository.class);FaiPointsLedgerEntryRepository wallets=mock(FaiPointsLedgerEntryRepository.class);UserRepository users=mock(UserRepository.class);WardrobeItemRepository pieces=mock(WardrobeItemRepository.class);SchemeRepository schemes=mock(SchemeRepository.class);
 Guard guard=new Guard(mock(AuditService.class),mock(FollowRepository.class));
 AuraHypeDropService service=new AuraHypeDropService(drops,wallets,users,pieces,schemes,guard);
 UUID issuer=UUID.randomUUID(),piece=UUID.randomUUID();CurrentUser admin=new CurrentUser(UUID.randomUUID(),"admin","ADMIN",ProfileType.PESSOAL,true,AccountStatus.ACTIVE,null,null);
 AuraHypeDropService.Form form(){return new AuraHypeDropService.Form(HypeEntityType.PIECE,piece,issuer,"DROP_2026","Drop oficial",42,100,true);}
 @BeforeEach void setup(){User u=new User();u.assignId(issuer);u.setUsername("artista");u.setRole("USER");u.setStatus(AccountStatus.ACTIVE);u.setEmailVerified(true);u.setProfileType(ProfileType.CELEBRIDADE);when(wallets.lockOwner(issuer)).thenReturn(Optional.of(u));when(users.findById(issuer)).thenReturn(Optional.of(u));when(pieces.existsById(piece)).thenReturn(true);when(drops.save(any())).thenAnswer(inv->{AuraHypeDrop d=inv.getArgument(0);d.assignId(UUID.randomUUID());return d;});}
 @Test void onlyAdminCanConfirmDrop(){CurrentUser ordinary=new CurrentUser(UUID.randomUUID(),"user","USER",ProfileType.PESSOAL,true,AccountStatus.ACTIVE,null,null);assertThatThrownBy(()->service.confirm(ordinary,form())).isInstanceOf(RuntimeException.class);verifyNoInteractions(drops,wallets);}
 @Test void registeredDropContainsConfirmedEditionWithoutChangingHypeOrPoints(){var result=service.confirm(admin,form());assertThat(result).containsEntry("serial",42).containsEntry("total",100);verify(drops).save(argThat(d->d.getEntityId().equals(piece)&&d.isActive()));verify(wallets,never()).save(any());}
 @Test void serialCannotBeUsedTwiceOrChangeThePrintRun(){AuraHypeDrop other=new AuraHypeDrop();other.assignId(UUID.randomUUID());other.setEntityId(UUID.randomUUID());other.setSerial(42);other.setTotal(100);when(drops.findByIssuerIdAndSeriesCode(issuer,"DROP_2026")).thenReturn(List.of(other));assertThatThrownBy(()->service.confirm(admin,form())).isInstanceOf(RuntimeException.class);verify(drops,never()).save(any());other.setSerial(41);other.setTotal(200);assertThatThrownBy(()->service.confirm(admin,form())).isInstanceOf(RuntimeException.class);}
 @Test void classificationBatchReadsOnlyRequestedActiveGrants(){AuraHypeDrop drop=new AuraHypeDrop();drop.setEntityId(piece);drop.setSerial(42);drop.setTotal(100);drop.setSeriesCode("DROP_2026");when(drops.findByEntityTypeAndEntityIdInAndActiveTrue(HypeEntityType.PIECE,List.of(piece))).thenReturn(List.of(drop));var values=service.classifications(HypeEntityType.PIECE,List.of(piece));assertThat(values.get(piece)).containsEntry("tier","COLLAB_DROP").containsEntry("source","VERIFIED_DROP");verify(drops,times(1)).findByEntityTypeAndEntityIdInAndActiveTrue(HypeEntityType.PIECE,List.of(piece));}
}
