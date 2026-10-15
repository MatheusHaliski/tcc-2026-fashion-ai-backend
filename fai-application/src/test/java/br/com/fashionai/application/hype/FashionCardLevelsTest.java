package br.com.fashionai.application.hype;
import br.com.fashionai.domain.model.enums.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class FashionCardLevelsTest {
 @Test void levelsReuseServerSignalsInsteadOfGlobalScore(){
  assertThat(FashionCardLevels.of(HypeSealsTest.row(99,HypeLevel.VIRAL,HypeMomentum.STABLE,10.,10.)).get("tier")).isEqualTo("COMMON");
  assertThat(FashionCardLevels.of(HypeSealsTest.row(65,HypeLevel.HOT,HypeMomentum.RISING,10.,10.)).get("tier")).isEqualTo("RARE");
  assertThat(FashionCardLevels.of(HypeSealsTest.row(60,HypeLevel.RELEVANT,HypeMomentum.STABLE,70.,75.)).get("tier")).isEqualTo("LEGENDARY");
 }
 @Test void unavailableScoreDoesNotInventCommonRarity(){assertThat(FashionCardLevels.of(null)).containsEntry("status","PENDING").doesNotContainKey("tier");}
}
