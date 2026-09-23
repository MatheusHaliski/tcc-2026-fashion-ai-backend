package br.com.fashionai.application.room;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class RoomAddressTest {
    @Test
    void parsesEveryZoneOfTheRoomGrammar() {
        assertThat(RoomAddress.parse("door:2/hanger:5")).contains(new RoomAddress("door", 2, 5));
        assertThat(RoomAddress.parse("DRAWER:3")).contains(RoomAddress.of("drawer", 3));
        assertThat(RoomAddress.parse("shoe:4")).contains(RoomAddress.of("shoe", 4));
        assertThat(RoomAddress.parse("season:1")).contains(RoomAddress.of("season", 1));
    }

    @Test
    void rejectsDoorWithoutHangerAndGarbage() {
        assertThat(RoomAddress.parse("door:1")).isEmpty();
        assertThat(RoomAddress.parse("closet:1")).isEmpty();
        assertThat(RoomAddress.parse(null)).isEmpty();
        assertThat(RoomAddress.parse("")).isEmpty();
    }

    @Test
    void moduleIdAndLabelsFollowTheSpec() {
        assertThat(RoomAddress.door(1, 3).moduleId()).isEqualTo("door:1");
        assertThat(RoomAddress.of("shoe", 2).moduleId()).isEqualTo("shoe");
        assertThat(RoomAddress.door(1, 3).toString()).isEqualTo("door:1/hanger:3");
        assertThat(RoomAddress.of("drawer", 4).label(Map.of("4", "Jeans"))).isEqualTo("Gaveta 4 · Jeans");
        assertThat(RoomAddress.of("drawer", 4).label(Map.of())).isEqualTo("Gaveta 4");
        assertThat(RoomAddress.door(2, 1).label(null)).isEqualTo("Porta 2");
    }
}
