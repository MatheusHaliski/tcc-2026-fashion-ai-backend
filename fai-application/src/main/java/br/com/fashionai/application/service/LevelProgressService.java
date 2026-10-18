package br.com.fashionai.application.service;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
@Service
public class LevelProgressService {
 private final FaiPointsLedgerEntryRepository ledger;
 public LevelProgressService(FaiPointsLedgerEntryRepository ledger){this.ledger=ledger;}
 @Transactional(readOnly=true) public Map<String,Object> progress(UUID id){return of(ledger.lifetime(id));}
 public static Map<String,Object> of(long points){
  long lifetime=Math.max(0,points);var level=FaiPointsService.Level.of(lifetime);var levels=FaiPointsService.Level.values();var next=level.ordinal()+1<levels.length?levels[level.ordinal()+1]:null;
  int percent=next==null?100:(int)Math.min(100,Math.floor(100d*(lifetime-level.threshold)/(next.threshold-level.threshold)));
  Map<String,Object> out=new LinkedHashMap<>();out.put("level",level.name());out.put("lifetime",lifetime);out.put("currentThreshold",level.threshold);out.put("percent",percent);
  out.put("nextLevel",next==null?null:Map.of("level",next.name(),"threshold",next.threshold,"missing",Math.max(0,next.threshold-lifetime)));
  List<Map<String,Object>> future=new ArrayList<>();for(var l:levels)if(l.ordinal()>level.ordinal())future.add(Map.of("level",l.name(),"threshold",l.threshold,"missing",Math.max(0,l.threshold-lifetime)));out.put("futureLevels",future);return out;
 }
}
