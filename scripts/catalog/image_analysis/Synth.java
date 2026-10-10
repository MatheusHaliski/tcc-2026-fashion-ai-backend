import br.com.fashionai.application.catalog.image.*;
import java.awt.image.BufferedImage;
import java.lang.reflect.Method;
import java.nio.file.*;
import java.util.*;
public class Synth {
  public static void main(String[] a) throws Exception {
    Path S=Path.of(a[0]); Files.createDirectories(S.resolve("synth"));
    Class<?> cp=Class.forName("br.com.fashionai.application.catalog.image.CatalogPhotos");
    CatalogImagePipeline p=new CatalogImagePipeline(SemanticRegionRegistry.get(), null);
    Object[][] cases={{"packshot-camiseta","tee",new Class[]{int.class,int.class,double.class},new Object[]{200,200,1.0},"upper_piece","t_shirt"},
      {"peca-pequena-no-canto","tee",new Class[]{int.class,int.class,double.class},new Object[]{40,40,0.6},"upper_piece","t_shirt"},
      {"jeans","jeans",new Class[]{},new Object[]{},"lower_piece","jeans"},
      {"tenis","sneakers",new Class[]{},new Object[]{},"shoes_piece","casual_sneakers"},
      {"relogio","watch",new Class[]{},new Object[]{},"accessory_piece","watch"},
      {"cabide","teeOnHanger",new Class[]{},new Object[]{},"upper_piece","t_shirt"},
      {"aderecos-distrator","teeWithProp",new Class[]{},new Object[]{},"upper_piece","t_shirt"},
      {"pessoa-vestindo","teeOnPerson",new Class[]{},new Object[]{},"upper_piece","t_shirt"},
      {"cortada-na-origem","teeCutAtBottom",new Class[]{},new Object[]{},"upper_piece","t_shirt"}};
    Method jpeg=cp.getDeclaredMethod("jpeg",BufferedImage.class); jpeg.setAccessible(true);
    for (Object[] c: cases) {
      Method m=cp.getDeclaredMethod((String)c[1],(Class<?>[])c[2]); m.setAccessible(true);
      byte[] b=(byte[])jpeg.invoke(null, m.invoke(null,(Object[])c[3]));
      var an=p.run(new CatalogImagePipeline.Request(b,(String)c[4],(String)c[5],"PACKSHOT",false));
      System.out.println(c[0]+" "+an.outcome()+" "+an.reasons()+" foco="+an.focus().name()+" fill="+Math.round(an.crop().best().fill()*100)+"%");
      Run.viz(S.resolve("synth/"+c[0]+".png"), b, an);
      Files.writeString(S.resolve("synth/"+c[0]+".txt"), an.outcome()+" · "+String.join(", ",an.reasons())+" · foco "+an.focus().name());
    }
  }
}
