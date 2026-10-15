package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;

/** Shared manual/AI contract. No generated biography, remote URLs or executable markup. */
public final class EraEditorial {
 private EraEditorial() {}
 public static final Set<String> THEMES=Set.of("RETRO_DISCO","CYBER_NEON","ACOUSTIC","DARK_POP","STADIUM","GOLDEN_RNB");
 public static final Set<String> SYMBOLS=Set.of("MIC","STAGE","SPOTLIGHT","GUITAR","VINYL","STAR","HEART","CROWN","SPARK","BUTTERFLY","MOON","HORSE","SPEAKER");
 public static Map<String,Object> normalize(Map<String,Object> raw,Function<String,String> media){
  if(raw==null||raw.isEmpty())return Map.of();
  if(!Set.of("theme","symbols","timeline","photos","motion","headline").containsAll(raw.keySet()))throw invalid();
  String theme=Objects.toString(raw.getOrDefault("theme","STADIUM"));if(!THEMES.contains(theme))throw invalid();
  List<?> symbols=list(raw.get("symbols"),16);if(symbols.stream().anyMatch(s->!(s instanceof String)||!SYMBOLS.contains(s))||new HashSet<>(symbols).size()!=symbols.size())throw invalid();
  List<Map<String,Object>> timeline=new ArrayList<>();
  for(Object o:list(raw.get("timeline"),40)){
   if(!(o instanceof Map<?,?> e)||!Set.of("date","title","description").containsAll(e.keySet()))throw invalid();
   String date=text(e.get("date"),10);try{LocalDate.parse(date);}catch(Exception ex){throw invalid();}
   timeline.add(Map.of("date",date,"title",required(e.get("title"),120),"description",text(e.get("description"),500)));
  }
  timeline.sort(Comparator.comparing(e->(String)e.get("date")));
  List<Map<String,Object>> photos=new ArrayList<>();
  for(Object o:list(raw.get("photos"),24)){
   if(!(o instanceof Map<?,?> e)||!Set.of("url","caption","alt").containsAll(e.keySet()))throw invalid();
   String url=media.apply(required(e.get("url"),1024));if(url==null)throw invalid();
   photos.add(Map.of("url",url,"caption",text(e.get("caption"),240),"alt",required(e.get("alt"),240)));
  }
  Object motion=raw.getOrDefault("motion",true);if(!(motion instanceof Boolean))throw invalid();
  return Map.of("theme",theme,"symbols",List.copyOf(symbols),"timeline",timeline,"photos",photos,"motion",motion,"headline",text(raw.get("headline"),160));
 }
 private static List<?> list(Object o,int max){if(o==null)return List.of();if(!(o instanceof List<?> l)||l.size()>max)throw invalid();return l;}
 private static String required(Object o,int max){String s=text(o,max);if(s.isBlank())throw invalid();return s;}
 private static String text(Object o,int max){if(o==null)return "";if(!(o instanceof String s)||s.length()>max)throw invalid();return InputSanitizer.clean(s,max);}
 private static ApiException invalid(){return ApiException.badRequest("ERA_EDITORIAL_INVALID","Confira tema, símbolos, datas, textos e fotos da Era.");}
}
