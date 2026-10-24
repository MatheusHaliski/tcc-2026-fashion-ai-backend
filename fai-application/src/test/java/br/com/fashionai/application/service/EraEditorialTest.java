package br.com.fashionai.application.service;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
class EraEditorialTest {
 @Test void ordersTimelineAndUsesOwnedPhotos(){
  var model=EraEditorial.normalize(Map.of("theme","GOLDEN_RNB","symbols",List.of("MIC","CROWN"),"timeline",List.of(Map.of("date","2026-06-01","title","Turnê"),Map.of("date","2026-01-01","title","Álbum")),"photos",List.of(Map.of("url","own-photo","alt","Palco"))),url->"validated-"+url);
  assertThat(model.get("timeline").toString()).containsSubsequence("2026-01-01","2026-06-01");assertThat(model.get("photos").toString()).contains("validated-own-photo");
 }
 @Test void rejectsUnknownThemeAndExecutablePayload(){
  assertThatThrownBy(()->EraEditorial.normalize(Map.of("theme","FAKE"),x->x)).isInstanceOf(RuntimeException.class);
  assertThatThrownBy(()->EraEditorial.normalize(Map.of("html","<script/>"),x->x)).isInstanceOf(RuntimeException.class);
 }
 @Test void rejectsInvalidDateAndMissingAlt(){
  assertThatThrownBy(()->EraEditorial.normalize(Map.of("timeline",List.of(Map.of("date","2026-99-01","title","A"))),x->x)).isInstanceOf(RuntimeException.class);
  assertThatThrownBy(()->EraEditorial.normalize(Map.of("photos",List.of(Map.of("url","x"))),x->x)).isInstanceOf(RuntimeException.class);
 }
}
