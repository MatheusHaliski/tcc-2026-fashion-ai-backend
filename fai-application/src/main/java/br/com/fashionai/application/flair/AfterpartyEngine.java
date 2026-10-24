package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.ApiException;
import java.util.*;

/** Authoritative, deterministic stealth simulation. Energy is local to the match, never FAI Points. */
public final class AfterpartyEngine {
 private AfterpartyEngine(){}
 public record Loadout(String id,String title,String tier,String role,String color,boolean techwear,String imageUrl,int cost,int cooldownMs){}
 public record Action(String type,String deckId,double dx,double dz,boolean running,String requestId){}
 public static class State {
  public double x=0,z=5,energy=100,suspicion=0;
  public String status="ACTIVE",phase="ACQUIRE",activeDeckId=null,role="NONE",color="#406b91",feedback="STARTED";
  public boolean badge=false,item=false,running=false;
  public long lastTickAt,lastMoveAt,activeUntil=0,distractionUntilLeft=0,distractionUntilRight=0,distractionReadyAt=0;
  public List<Loadout> loadouts=new ArrayList<>();
  public Map<String,Long> cooldowns=new HashMap<>();
  public List<String> requests=new ArrayList<>();
 }
 public static State start(List<Loadout> loadouts,long now){State s=new State();s.loadouts=new ArrayList<>(loadouts);s.lastTickAt=now;s.lastMoveAt=now;return s;}
 public static boolean effectActive(State s,long now){return s.activeDeckId!=null&&s.activeUntil>now;}
 public static boolean vipAccess(State s,long now){return s.badge||effectActive(s,now)&&Set.of("VIP","EVENT_VIP").contains(s.role)||s.distractionUntilLeft>now&&s.distractionUntilRight>now;}
 public static boolean mainAccess(State s,long now){return vipAccess(s,now)||effectActive(s,now)&&s.role.equals("GUEST");}
 public static void tick(State s,long now){
  if(!s.status.equals("ACTIVE"))return;
  double dt=Math.max(0,Math.min(2,(now-s.lastTickAt)/1000d));s.lastTickAt=Math.max(now,s.lastTickAt);
  s.energy=Math.min(100,s.energy+dt*3);
  if(!effectActive(s,now)){s.role="NONE";s.color="#406b91";s.activeDeckId=null;}
  boolean visible=Math.abs(s.x)<2.4&&s.z>-.7&&s.z<3.4&&(s.distractionUntilLeft<=now||s.distractionUntilRight<=now);
  double rate=visible?(s.running?23:effectActive(s,now)?-5:18):-7;
  if(s.z< -3&&!vipAccess(s,now))rate=30;
  s.suspicion=Math.max(0,Math.min(100,s.suspicion+dt*rate));
  if(s.suspicion>=100){s.status="FAILED";s.feedback="DETECTED";}
 }
 public static void apply(State s,Action a,long now){
  if(a==null||a.requestId()==null||!a.requestId().matches("[A-Za-z0-9_-]{8,80}"))throw ApiException.badRequest("ACTION_INVALID","Identificador de ação inválido.");
  if(s.requests.contains(a.requestId()))return;
  if(!s.status.equals("ACTIVE"))return;
  tick(s,now);if(!s.status.equals("ACTIVE"))return;
  switch(Objects.toString(a.type(),"")){
   case "MOVE" -> move(s,a,now);
   case "ACTIVATE" -> activate(s,a.deckId(),now);
   case "DISTRACT" -> distract(s,now);
   case "INTERACT" -> interact(s,now);
   case "WAIT" -> {s.running=false;s.feedback="WAITING";}
   default -> throw ApiException.badRequest("ACTION_INVALID","Ação desconhecida.");
  }
  s.requests.add(a.requestId());if(s.requests.size()>32)s.requests.remove(0);
 }
 private static void activate(State s,String id,long now){
  Loadout card=s.loadouts.stream().filter(c->c.id().equals(id)).findFirst().orElseThrow(()->ApiException.badRequest("DECK_INVALID","O look não pertence ao deck da missão."));
  if(s.cooldowns.getOrDefault(id,0L)>now){s.feedback="COOLDOWN";return;}
  if(s.energy<card.cost()){s.feedback="ENERGY_LOW";return;}
  s.energy-=card.cost();s.activeDeckId=id;s.role=card.role();s.color=card.color();s.activeUntil=now+18000;s.cooldowns.put(id,now+card.cooldownMs());s.running=false;s.feedback="TRANSFORMED";
 }
 private static void move(State s,Action a,long now){
  if(!Double.isFinite(a.dx())||!Double.isFinite(a.dz())||Math.abs(a.dx())>1||Math.abs(a.dz())>1)throw ApiException.badRequest("MOVE_INVALID","Direção inválida.");
  double dt=Math.max(0,Math.min(.4,(now-s.lastMoveAt)/1000d));s.lastMoveAt=Math.max(now,s.lastMoveAt);double len=Math.hypot(a.dx(),a.dz());if(len==0){s.running=false;return;}
  boolean tech=effectActive(s,now)&&s.loadouts.stream().anyMatch(c->c.id().equals(s.activeDeckId)&&c.techwear());
  double speed=a.running()?(tech?3.8:3):2;double x=Math.max(-5,Math.min(5,s.x+a.dx()/Math.max(1,len)*dt*speed));double z=Math.max(-7,Math.min(7,s.z+a.dz()/Math.max(1,len)*dt*speed));
  // Portaria spans the roof; only a staff disguise can use the side service entrance.
  boolean crossesGate=s.z>=0&&z<0||s.z<0&&z>=0;
  if(crossesGate&&!mainAccess(s,now)&&!(Math.abs(x)>3.2&&effectActive(s,now)&&s.role.equals("STAFF"))){s.feedback="GATE_BLOCKED";s.running=false;return;}
  if(s.z>=-3&&z< -3&&!vipAccess(s,now)){s.feedback="VIP_BLOCKED";s.running=false;return;}
  s.x=x;s.z=z;s.running=a.running();s.feedback="MOVING";
 }
 private static void distract(State s,long now){
  if(Math.abs(s.x)>3.5||s.z<-.5||s.z>3.5){s.feedback="TOO_FAR";return;}
  if(!effectActive(s,now)||!Set.of("GUEST","VIP","EVENT_VIP").contains(s.role)){s.feedback="DISGUISE_REQUIRED";return;}
  if(now<s.distractionReadyAt){s.feedback="COOLDOWN";return;}if(s.energy<15){s.feedback="ENERGY_LOW";return;}
  s.energy-=15;s.distractionReadyAt=now+6000;if(s.x<=0)s.distractionUntilLeft=now+12000;else s.distractionUntilRight=now+12000;s.feedback="DISTRACTED";
 }
 private static void interact(State s,long now){
  if(Math.hypot(s.x-4,s.z+2)<1.2){if(effectActive(s,now)&&s.role.equals("STAFF")){s.badge=true;s.feedback="BADGE_FOUND";}else s.feedback="STAFF_REQUIRED";return;}
  if(Math.hypot(s.x,s.z+5.5)<1.3){if(vipAccess(s,now)){s.item=true;s.phase="ESCAPE";s.suspicion=Math.min(99,s.suspicion+20);s.feedback="ITEM_FOUND";}else s.feedback="VIP_BLOCKED";return;}
  if(s.z>4.4&&s.item){s.status="COMPLETED";s.feedback="COMPLETED";return;}s.feedback="TOO_FAR";
 }
}
