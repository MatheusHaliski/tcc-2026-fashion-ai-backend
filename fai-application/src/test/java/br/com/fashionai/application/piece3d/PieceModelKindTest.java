package br.com.fashionai.application.piece3d;

import br.com.fashionai.application.imaging.ReliefModelGenerator;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.ports.WebFetchPort;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** Origem do modelo 3D lida do GLB: só o GLB do motor de peças é editável; o relevo da foto nunca. */
class PieceModelKindTest {
    static byte[] glb(String json) {
        byte[] text = json.getBytes(StandardCharsets.UTF_8);
        int size = (text.length + 3) & ~3;
        ByteBuffer b = ByteBuffer.allocate(20 + size).order(ByteOrder.LITTLE_ENDIAN);
        b.putInt(0x46546c67).putInt(2).putInt(20 + size).putInt(size).putInt(0x4e4f534a).put(text);
        while (b.hasRemaining()) {
            b.put((byte) ' ');
        }
        return b.array();
    }

    static final String ENGINE = "{\"asset\":{\"version\":\"2.0\",\"generator\":\"Khronos glTF Blender I/O v4.2.57\"},\"meshes\":[{}],"
            + "\"materials\":[{\"name\":\"corpo\"},{\"name\":\"linha\"},{\"name\":\"dentes\"},{\"name\":\"estampa_0\"}]}";
    static final String RELIEF = "{\"asset\":{\"version\":\"2.0\",\"generator\":\"Fashion AI · RF16 relevo local\"},\"meshes\":[{}],"
            + "\"materials\":[{\"name\":\"foto-da-peca\"}]}";
    static final String RELIEF_EN = "{\"asset\":{\"version\":\"2.0\",\"generator\":\"Fashion AI · RF16 local relief\"},\"meshes\":[{}],\"materials\":[{\"name\":\"x\"}]}";
    static final String FOREIGN = "{\"asset\":{\"version\":\"2.0\",\"generator\":\"provider\"},\"meshes\":[{}],\"materials\":[{\"name\":\"Material_0\"}]}";

    @Test void classifiesByWhatTheGeneratorWroteInTheFile() {
        assertThat(PieceModelKind.of(glb(ENGINE))).isEqualTo(PieceModelKind.PROPRIO);
        assertThat(PieceModelKind.of(glb(RELIEF))).isEqualTo(PieceModelKind.RELEVO_FOTO);
        assertThat(PieceModelKind.of(glb(RELIEF_EN))).isEqualTo(PieceModelKind.RELEVO_FOTO);
        assertThat(PieceModelKind.of(glb(FOREIGN))).isEqualTo(PieceModelKind.EXTERNO);
        assertThat(PieceModelKind.of(new byte[]{1, 2, 3})).isEqualTo(PieceModelKind.DESCONHECIDO);
        assertThat(PieceModelKind.of(null)).isEqualTo(PieceModelKind.DESCONHECIDO);
        assertThat(PieceModelKind.PROPRIO.editable()).isTrue();
        assertThat(PieceModelKind.RELEVO_FOTO.editable()).isFalse();
        assertThat(PieceModelKind.RELEVO_FOTO.blockedCode()).isEqualTo("CUSTOMIZATION_PHOTO_RELIEF");
        assertThat(PieceModelKind.EXTERNO.blockedCode()).isEqualTo("CUSTOMIZATION_NOT_OWN_MODEL");
        assertThat(PieceModelKind.PROPRIO.blockedCode()).isNull();
    }

    @Test void theReliefTheServerItselfGeneratesFromAPhotoIsRecognised() {
        BufferedImage cutout = new BufferedImage(90, 110, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = cutout.createGraphics();
        g.setColor(new Color(30, 60, 160));
        g.fillRect(15, 10, 60, 90);
        g.dispose();
        assertThat(PieceModelKind.of(ReliefModelGenerator.generate(cutout, 0.7).glb())).isEqualTo(PieceModelKind.RELEVO_FOTO);
    }

    @Test void readsStoredModelOnceAndNeverCachesAFailedRead() {
        MediaStoragePort media = mock(MediaStoragePort.class);
        WebFetchPort web = mock(WebFetchPort.class);
        when(media.keyOf("/media/a.glb")).thenReturn(Optional.of("a.glb"));
        when(media.get("a.glb")).thenReturn(glb(ENGINE));
        when(media.keyOf("/media/broken.glb")).thenReturn(Optional.of("broken.glb"));
        when(media.get("broken.glb")).thenThrow(new IllegalStateException("offline"));
        when(media.keyOf(anyString())).thenAnswer(inv -> switch ((String) inv.getArgument(0)) {
            case "/media/a.glb" -> Optional.of("a.glb");
            case "/media/broken.glb" -> Optional.of("broken.glb");
            default -> Optional.empty();
        });
        when(web.get(eq("https://cdn.example/r.glb"), anyInt(), isNull())).thenReturn(Optional.of(new WebFetchPort.Fetched("https://cdn.example/r.glb", "model/gltf-binary", glb(RELIEF))));
        var kinds = new PieceModelKinds(media, web);
        assertThat(kinds.of("/media/a.glb")).isEqualTo(PieceModelKind.PROPRIO);
        assertThat(kinds.of("/media/a.glb")).isEqualTo(PieceModelKind.PROPRIO);
        verify(media, times(1)).get("a.glb");
        assertThat(kinds.of("https://cdn.example/r.glb")).isEqualTo(PieceModelKind.RELEVO_FOTO);
        assertThat(kinds.of("/media/broken.glb")).isEqualTo(PieceModelKind.DESCONHECIDO);
        assertThat(kinds.of("/media/broken.glb")).isEqualTo(PieceModelKind.DESCONHECIDO);
        verify(media, times(2)).get("broken.glb");
        assertThat(kinds.of(null)).isEqualTo(PieceModelKind.DESCONHECIDO);
    }
}
