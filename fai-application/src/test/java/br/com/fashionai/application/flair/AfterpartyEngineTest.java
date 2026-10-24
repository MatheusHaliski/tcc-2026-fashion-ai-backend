package br.com.fashionai.application.flair;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
class AfterpartyEngineTest {
 private AfterpartyEngine.State game(){return AfterpartyEngine.start(List.of(new AfterpartyEngine.Loadout("staff","Staff","COMMON","STAFF","#123456",false,null,10,6000),new AfterpartyEngine.Loadout("vip","VIP","LEGENDARY","VIP","#ffd700",false,null,35,14000)),1000);}
 private void action(AfterpartyEngine.State s,String type,String deck,long now){AfterpartyEngine.apply(s,new AfterpartyEngine.Action(type,deck,0,0,false,"request_"+now),now);}
 @Test void activationIsIdempotentAndRespectsCooldownAndEnergy(){var s=game();action(s,"ACTIVATE","vip",1000);assertThat(s.energy).isEqualTo(65);action(s,"ACTIVATE","vip",1000);assertThat(s.energy).isEqualTo(65);action(s,"ACTIVATE","vip",1001);assertThat(s.feedback).isEqualTo("COOLDOWN");s.energy=0;action(s,"ACTIVATE","staff",1002);assertThat(s.feedback).isEqualTo("ENERGY_LOW");assertThat(s.activeDeckId).isEqualTo("vip");}
 @Test void commonStaffCanCompleteTheMissionWithServiceBadge(){var s=game();action(s,"ACTIVATE","staff",1000);s.x=4;s.z=-2;action(s,"INTERACT",null,1100);assertThat(s.badge).isTrue();AfterpartyEngine.tick(s,20000);assertThat(s.activeDeckId).isNull();assertThat(AfterpartyEngine.vipAccess(s,20000)).isTrue();s.x=0;s.z=-5.5;action(s,"INTERACT",null,20001);assertThat(s.item).isTrue();assertThat(s.phase).isEqualTo("ESCAPE");s.z=5;action(s,"INTERACT",null,20100);assertThat(s.status).isEqualTo("COMPLETED");}
 @Test void legendaryDoesNotPreventDetectionWhenRunning(){var s=game();action(s,"ACTIVATE","vip",1000);s.x=0;s.z=2;s.running=true;AfterpartyEngine.tick(s,3000);assertThat(s.suspicion).isEqualTo(46);AfterpartyEngine.tick(s,5000);AfterpartyEngine.tick(s,7000);assertThat(s.status).isEqualTo("FAILED");}
 @Test void movementCannotCrossLockedVipGateOrTeleport(){var s=game();s.z=-2.9;AfterpartyEngine.apply(s,new AfterpartyEngine.Action("MOVE",null,0,-1,false,"move_0001"),1400);assertThat(s.z).isEqualTo(-2.9);assertThat(s.feedback).isEqualTo("VIP_BLOCKED");assertThatThrownBy(()->AfterpartyEngine.apply(s,new AfterpartyEngine.Action("MOVE",null,99,0,false,"move_0002"),1500)).hasMessageContaining("Direção");}
 @Test void changingLoadoutDoesNotClearOtherCooldowns(){var s=game();action(s,"ACTIVATE","vip",1000);action(s,"ACTIVATE","staff",1100);assertThat(s.cooldowns).containsKeys("vip","staff");action(s,"ACTIVATE","vip",1200);assertThat(s.activeDeckId).isEqualTo("staff");}
}
