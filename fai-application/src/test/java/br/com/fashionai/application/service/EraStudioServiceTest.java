package br.com.fashionai.application.service;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class EraStudioServiceTest {
 @Test void fallbackUsesPresetsWithoutInventingCareerEventsOrPhotos(){
  var draft=EraStudioService.local("Uma era R&B futurista dourada");
  assertThat(draft.get("theme")).isEqualTo("GOLDEN_RNB");
  assertThat((java.util.List<?>)draft.get("timeline")).isEmpty();
  assertThat((java.util.List<?>)draft.get("photos")).isEmpty();
 }
 @Test void rejectsEmptyDraftAndDatesAbsentFromPrompt(){
  assertThatThrownBy(()->EraStudioService.parseDraft("{}","Minha Era")).isInstanceOf(RuntimeException.class);
  assertThatThrownBy(()->EraStudioService.parseDraft("{\"theme\":\"STADIUM\",\"timeline\":[{\"date\":\"2026-01-01\",\"title\":\"Álbum\"}]}","Minha Era")).isInstanceOf(RuntimeException.class);
 }
}
