package br.com.fashionai.application.hype;
import br.com.fashionai.application.common.*;
import br.com.fashionai.application.security.*;
import br.com.fashionai.domain.model.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.util.*;
@Service
public class AuraHypeDropService {
 private final AuraHypeDropRepository drops;private final FaiPointsLedgerEntryRepository wallets;private final UserRepository users;private final WardrobeItemRepository pieces;private final SchemeRepository schemes;private final Guard guard;
 public AuraHypeDropService(AuraHypeDropRepository drops,FaiPointsLedgerEntryRepository wallets,UserRepository users,WardrobeItemRepository pieces,SchemeRepository schemes,Guard guard){this.drops=drops;this.wallets=wallets;this.users=users;this.pieces=pieces;this.schemes=schemes;this.guard=guard;}
 public record Form(HypeEntityType type,UUID entityId,UUID issuerId,String seriesCode,String label,Integer serial,Integer total,Boolean active){}
 @Transactional(isolation=Isolation.READ_COMMITTED)
 public Map<String,Object> confirm(CurrentUser actor,Form f){
  guard.requireAdmin(actor);
  if(f.type()==null||f.entityId()==null||f.issuerId()==null||f.seriesCode()==null||!f.seriesCode().matches("[A-Z0-9][A-Z0-9_-]{1,59}")||f.serial()==null||f.total()==null||f.serial()<1||f.total()<f.serial()||f.total()>1000000)throw ApiException.badRequest("DROP_INVALID","Confira a série, a carta e a tiragem.");
  wallets.lockOwner(f.issuerId()).orElseThrow(()->ApiException.notFound("Emissor"));
  User issuer=users.findById(f.issuerId()).orElseThrow(()->ApiException.notFound("Emissor"));
  guard.requireApprovedInstitutional(CurrentUser.of(issuer,actor.ip(),actor.userAgent()),"aura-hype:drop:issuer","O emissor deve ser marca ou celebridade aprovada.");
  if(f.type()==HypeEntityType.PIECE? !pieces.existsById(f.entityId()): !schemes.existsById(f.entityId()))throw ApiException.notFound("Carta");
  AuraHypeDrop row=drops.findByEntityTypeAndEntityId(f.type(),f.entityId()).orElseGet(AuraHypeDrop::new);
  if(row.getId()!=null&&(!row.getIssuerId().equals(f.issuerId())||!row.getSeriesCode().equals(f.seriesCode())||row.getSerial()!=f.serial()||row.getTotal()!=f.total()))throw ApiException.badRequest("DROP_IMMUTABLE","Série e numeração já confirmadas não podem ser reescritas. Desative o vínculo se necessário.");
  for(AuraHypeDrop other:drops.findByIssuerIdAndSeriesCode(f.issuerId(),f.seriesCode())){
   if(other.getTotal()!=f.total()||other.getSerial()==f.serial()&&!Objects.equals(other.getId(),row.getId()))throw ApiException.badRequest("DROP_SERIAL_CONFLICT","Tiragem inconsistente ou número já emitido nesta série.");
  }
  row.setEntityType(f.type());row.setEntityId(f.entityId());row.setIssuerId(f.issuerId());row.setSeriesCode(f.seriesCode());row.setLabel(InputSanitizer.required("label",f.label(),2,120));row.setSerial(f.serial());row.setTotal(f.total());row.setActive(!Boolean.FALSE.equals(f.active()));drops.save(row);return view(row);
 }
 @Transactional(readOnly=true) public List<Map<String,Object>> list(CurrentUser actor){guard.requireAdmin(actor);return drops.findAll().stream().map(AuraHypeDropService::view).toList();}
 @Transactional(readOnly=true) public Map<UUID,Map<String,Object>> classifications(HypeEntityType type,Collection<UUID> ids){
  if(ids.isEmpty())return Map.of();
  Map<UUID,Map<String,Object>> out=new HashMap<>();
  drops.findByEntityTypeAndEntityIdInAndActiveTrue(type,ids).forEach(row->out.put(row.getEntityId(),classification(row)));
  return out;
 }
 public static Map<String,Object> classification(AuraHypeDrop row){return Map.of("status","CLASSIFIED","tier","COLLAB_DROP","ruleVersion",1,"source","VERIFIED_DROP","edition",Map.of("serial",row.getSerial(),"total",row.getTotal(),"confirmed",true),"seriesCode",row.getSeriesCode());}
 private static Map<String,Object> view(AuraHypeDrop r){return Map.of("id",r.getId(),"type",r.getEntityType(),"entityId",r.getEntityId(),"issuerId",r.getIssuerId(),"seriesCode",r.getSeriesCode(),"label",r.getLabel(),"serial",r.getSerial(),"total",r.getTotal(),"active",r.isActive());}
}
