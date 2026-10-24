package br.com.fashionai.application.service;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class LevelProgressServiceTest {
 @Test void progressUsesLifetimeIntervalAndResetsAtNextTier(){var mid=LevelProgressService.of(600);assertThat(mid).containsEntry("level","STUDIO").containsEntry("percent",50);assertThat(LevelProgressService.of(900)).containsEntry("level","LOFT").containsEntry("percent",100).containsEntry("nextLevel",null);}
 @Test void onlyThreeLevelsBasicoStudioLoft(){assertThat(FaiPointsService.Level.values()).extracting(Enum::name).containsExactly("ESTREIA","STUDIO","LOFT");assertThat(LevelProgressService.of(0).get("futureLevels")).asList().hasSize(2);assertThat(FaiPointsService.Level.parse("maison")).isEqualTo(FaiPointsService.Level.LOFT);assertThat(FaiPointsService.Level.parse("CLOSET")).isEqualTo(FaiPointsService.Level.LOFT);assertThat(FaiPointsService.Level.parse(null)).isEqualTo(FaiPointsService.Level.ESTREIA);}
 @Test void maximumHasNoNextLevelAndNegativePointsAreClamped(){assertThat(LevelProgressService.of(12000)).containsEntry("percent",100).containsEntry("nextLevel",null);assertThat(LevelProgressService.of(-1)).containsEntry("lifetime",0L).containsEntry("percent",0);}
}
