package br.com.fashionai.application.service;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class LevelProgressServiceTest {
 @Test void progressUsesLifetimeIntervalAndResetsAtNextTier(){var mid=LevelProgressService.of(600);assertThat(mid).containsEntry("level","STUDIO").containsEntry("percent",50);assertThat(LevelProgressService.of(900)).containsEntry("level","LOFT").containsEntry("percent",0);}
 @Test void maximumHasNoNextLevelAndNegativePointsAreClamped(){assertThat(LevelProgressService.of(12000)).containsEntry("percent",100).containsEntry("nextLevel",null);assertThat(LevelProgressService.of(-1)).containsEntry("lifetime",0L).containsEntry("percent",0);}
}
