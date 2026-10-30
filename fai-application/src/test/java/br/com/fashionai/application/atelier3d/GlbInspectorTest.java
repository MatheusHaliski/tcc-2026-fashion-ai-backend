package br.com.fashionai.application.atelier3d;
import br.com.fashionai.application.common.ApiException;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import static org.assertj.core.api.Assertions.*;
class GlbInspectorTest {
 static final ObjectMapper JSON=new ObjectMapper();
 static byte[] glb(String extra){
  String json="{\"asset\":{\"version\":\"2.0\"},\"scenes\":[{\"nodes\":[0]}],\"scene\":0,\"nodes\":[{\"mesh\":0}],\"meshes\":[{\"primitives\":[{\"attributes\":{\"POSITION\":0}}]}],\"buffers\":[{\"byteLength\":36}],\"bufferViews\":[{\"buffer\":0,\"byteLength\":36}],\"accessors\":[{\"bufferView\":0,\"componentType\":5126,\"count\":3,\"type\":\"VEC3\"}]"+extra+"}";
  byte[] j=json.getBytes(StandardCharsets.UTF_8);int padded=(j.length+3)&~3;var b=ByteBuffer.allocate(12+8+padded+8+36).order(ByteOrder.LITTLE_ENDIAN);b.putInt(0x46546c67).putInt(2).putInt(b.capacity()).putInt(padded).putInt(0x4e4f534a).put(j);while(b.position()<20+padded)b.put((byte)' ');b.putInt(36).putInt(0x004e4942);for(float f:new float[]{0,0,0,1,0,0,0,1,0})b.putFloat(f);return b.array();
 }
 @Test void inspectsEmbeddedTriangle(){var i=GlbInspector.inspect(glb(""),JSON);assertThat(i.vertices()).isEqualTo(3);assertThat(i.primitives()).containsEntry("n0.p0",3);assertThat(i.skinned()).isFalse();}
 @Test void rejectsMalformedAndExternalResources(){byte[] valid=glb("");valid[0]=0;assertThatThrownBy(()->GlbInspector.inspect(valid,JSON)).isInstanceOf(ApiException.class);assertThatThrownBy(()->GlbInspector.inspect(glb(",\"images\":[{\"uri\":\"https://example.test/private\"}]"),JSON)).isInstanceOf(ApiException.class);}
 @Test void rejectsUnsupportedExtensionsRatherThanDroppingThem(){assertThatThrownBy(()->GlbInspector.inspect(glb(",\"extensionsUsed\":[\"UNKNOWN_extension\"]"),JSON)).isInstanceOf(ApiException.class);}
}
