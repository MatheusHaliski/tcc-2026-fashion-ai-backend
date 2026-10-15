package br.com.fashionai.application.service;

import br.com.fashionai.application.common.*;
import br.com.fashionai.application.flair.AfterpartyEngine;
import br.com.fashionai.application.flair.AfterpartyEngine.*;
import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.hype.AuraHypeDropService;
import br.com.fashionai.application.security.*;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.util.*;

@Service
public class FlairAdventureService {
 private final FlairAdventureSessionRepository sessions;private final FlairService flair;private final Guard guard;private final FaiPointsLedgerEntryRepository users;private final SchemeRepository schemes;private final AuraHypeDropService drops;
 public FlairAdventureService(FlairAdventureSessionRepository sessions,FlairService flair,Guard guard,FaiPointsLedgerEntryRepository users,SchemeRepository schemes,AuraHypeDropService drops){this.sessions=sessions;this.flair=flair;this.guard=guard;this.users=users;this.schemes=schemes;this.drops=drops;}
 @Transactional(readOnly=true) public Map<String,Object> active(CurrentUser user){guard.requireCanCreate(user);return sessions.findFirstByOwnerIdAndStatusOrderByCreatedAtDesc(user.id(),"ACTIVE").map(s->view(s,read(s),System.currentTimeMillis())).orElse(null);}
 @Transactional(isolation=Isolation.READ_COMMITTED) public Map<String,Object> start(CurrentUser user,List<UUID> selected){
  guard.requireCanCreate(user);if(selected==null||selected.isEmpty()||selected.size()>7||new HashSet<>(selected).size()!=selected.size())throw ApiException.badRequest("DECK_INVALID","Selecione de um a sete looks diferentes.");
  users.lockOwner(user.id()).orElseThrow(()->ApiException.notFound("Usuário"));
  Optional<FlairAdventureSession> active=sessions.findFirstByOwnerIdAndStatusOrderByCreatedAtDesc(user.id(),"ACTIVE");if(active.isPresent())return state(user,active.get().getId());
  Map<String,FlairEngine.Deck> owned=new HashMap<>();flair.decks(user).forEach(d->owned.put(d.schemeId(),d));
  if(selected.stream().anyMatch(id->!owned.containsKey(id.toString())))throw ApiException.badRequest("DECK_INVALID","Use somente looks seus, com peças disponíveis.");
  var grants=drops.classifications(HypeEntityType.SCHEME,selected);List<Loadout> loadouts=new ArrayList<>();
  for(UUID id:selected){var deck=owned.get(id.toString());loadouts.add(loadout(deck,grants.get(id)));}
  long now=System.currentTimeMillis();State state=AfterpartyEngine.start(loadouts,now);FlairAdventureSession session=new FlairAdventureSession();session.setOwnerId(user.id());session.setStateJson(Json.write(state));sessions.save(session);return view(session,state,now);
 }
 static Loadout loadout(FlairEngine.Deck deck,Map<String,Object> grant){
  int quality=deck.cards().stream().mapToInt(c->switch(c.rarity()){case "RARE"->2;case "PREMIUM","LIMITED"->1;default->0;}).min().orElse(0);
  Set<String> styles=new HashSet<>();deck.cards().forEach(c->c.styles().forEach(s->styles.add(s.toLowerCase(Locale.ROOT))));
  boolean high=styles.stream().anyMatch(Set.of("high_fashion","formal","elegant","classic","tailored","luxury")::contains);
  boolean tech=styles.stream().anyMatch(s->s.contains("techwear")||s.contains("sport")||s.contains("athleisure"));
  boolean event=grant!=null&&"VERIFIED_DROP".equals(grant.get("source"))&&String.valueOf(grant.get("seriesCode")).startsWith("AFTERPARTY_");
  String tier=event?"COLLAB_DROP":quality==2?"LEGENDARY":quality==1?"RARE":"COMMON";
  String role=event?"EVENT_VIP":quality==2&&high?"VIP":quality>=1?"GUEST":"STAFF";
  String color=deck.cards().stream().map(FlairEngine.Card::colorHex).filter(c->c!=null&&c.matches("#[0-9A-Fa-f]{6}")).findFirst().orElse("#6487a5");
  return new Loadout(deck.schemeId(),deck.title(),tier,role,color,tech,deck.cards().get(0).imageUrl(),event?30:quality==2?35:quality==1?20:10,event?12000:quality==2?14000:quality==1?9000:6000);
 }
 @Transactional public Map<String,Object> state(CurrentUser user,UUID id){guard.requireCanCreate(user);var row=owned(user,id);var s=read(row);long now=System.currentTimeMillis();AfterpartyEngine.tick(s,now);save(row,s);return view(row,s,now);}
 @Transactional public Map<String,Object> action(CurrentUser user,UUID id,Action action){
  guard.requireCanCreate(user);var row=owned(user,id);var s=read(row);long now=System.currentTimeMillis();
  if(action!=null&&"ACTIVATE".equals(action.type())){UUID deckId;try{deckId=UUID.fromString(action.deckId());}catch(Exception ex){throw ApiException.badRequest("DECK_INVALID","Look inválido.");}Scheme look=schemes.findById(deckId).orElseThrow(()->ApiException.notFound("Look"));if(!look.getUser().getId().equals(user.id())||look.getStatus()==SchemeStatus.ARCHIVED)throw ApiException.badRequest("DECK_INVALID","Este look não pode ser equipado.");}
  if(action!=null&&"ABANDON".equals(action.type())){if("ACTIVE".equals(s.status)){s.status="ABANDONED";s.feedback="ABANDONED";}}else AfterpartyEngine.apply(s,action,now);
  save(row,s);return view(row,s,now);
 }
 private FlairAdventureSession owned(CurrentUser u,UUID id){return sessions.lockOwned(id,u.id()).orElseThrow(()->ApiException.notFound("Missão"));}
 private static State read(FlairAdventureSession row){try{return Json.MAPPER.readValue(row.getStateJson(),State.class);}catch(Exception e){throw new IllegalStateException("Estado da missão inválido",e);}}
 private static void save(FlairAdventureSession row,State s){row.setStateJson(Json.write(s));row.setStatus(s.status);}
 private static Map<String,Object> view(FlairAdventureSession row,State s,long now){return Map.of("id",row.getId(),"serverTime",now,"state",s);}
}
