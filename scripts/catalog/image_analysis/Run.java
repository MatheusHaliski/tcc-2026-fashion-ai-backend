import br.com.fashionai.application.catalog.image.*;
import br.com.fashionai.application.common.Json;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.nio.file.*;
import java.util.*;
import java.util.List;
import javax.imageio.ImageIO;

public class Run {
  static Color BLUE=new Color(37,99,235), RED=new Color(220,38,38), GREEN=new Color(22,163,74), ORANGE=new Color(234,88,12);
  public static void main(String[] a) throws Exception {
    Path S=Path.of(a[0]);
    List<Map<String,Object>> sample=Json.list(Files.readString(S.resolve("sample.json")));
    CatalogImagePipeline p=new CatalogImagePipeline(SemanticRegionRegistry.get(), null);
    List<Map<String,Object>> out=new ArrayList<>();
    Files.createDirectories(S.resolve("viz"));
    for (Map<String,Object> s: sample) {
      int id=((Number)s.get("id")).intValue();
      Path f=S.resolve(String.format("img/%03d.bin",id));
      Map<String,Object> r=new LinkedHashMap<>(s);
      if (!Files.exists(f)) { r.put("outcome","DOWNLOAD_FAILED"); out.add(r); continue; }
      byte[] b=Files.readAllBytes(f);
      long t=System.nanoTime();
      CatalogImagePipeline.Analysis an;
      try { an=p.run(new CatalogImagePipeline.Request(b,(String)s.get("category"),(String)s.get("subcategory"),(String)s.get("type"),false)); }
      catch (Throwable e) { r.put("outcome","EXCEPTION"); r.put("error",e.toString()); out.add(r); continue; }
      r.put("ms",(System.nanoTime()-t)/1_000_000);
      r.put("outcome",an.outcome().name()); r.put("reasons",an.reasons()); r.put("quality",an.qualityScore());
      r.put("mime",an.mime()); r.put("w",an.width()); r.put("h",an.height()); r.put("metrics",an.metrics());
      if (an.crop()!=null) { r.put("fill",an.crop().best().fill()); r.put("padding",an.crop().best().padding()); r.put("focus",an.focus().name()+"/"+an.focus().source());
        r.put("product",an.productBox().toMap()); r.put("bg",an.background()); r.put("stages",an.stages().stream().map(CatalogImagePipeline.Stage::toMap).toList()); r.put("debug",an.debug());
        viz(S.resolve(String.format("viz/%03d.png",id)), b, an); }
      out.add(r);
      System.out.println(id+" "+an.outcome()+" "+an.reasons()+" q="+an.qualityScore()+" "+r.get("ms")+"ms");
    }
    Files.writeString(S.resolve("results.json"), Json.write(out));
  }
  static void box(Graphics2D g, NRect r, int W, int H, Color c, float w, boolean dash) {
    g.setColor(c); g.setStroke(dash? new BasicStroke(w,BasicStroke.CAP_BUTT,BasicStroke.JOIN_MITER,10,new float[]{8,6},0): new BasicStroke(w));
    g.drawRect((int)(r.x()*W),(int)(r.y()*H),(int)(r.w()*W),(int)(r.h()*H));
  }
  /** Antes (foto + caixa da peça, distratores, foco, regiões críticas, recorte final) | Depois (card 4:5 com padding na cor do fundo). */
  static void viz(Path out, byte[] bytes, CatalogImagePipeline.Analysis an) throws Exception {
    BufferedImage src=br.com.fashionai.application.imaging.ImageOps.decode(bytes);
    double sc=Math.min(1, 520.0/Math.max(src.getWidth(),src.getHeight()));
    int W=(int)(src.getWidth()*sc), H=(int)(src.getHeight()*sc);
    int cardW=416, cardH=520;
    BufferedImage canvas=new BufferedImage(W+cardW+30, Math.max(H,cardH)+20, BufferedImage.TYPE_INT_RGB);
    Graphics2D g=canvas.createGraphics(); g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BILINEAR);
    g.setColor(Color.WHITE); g.fillRect(0,0,canvas.getWidth(),canvas.getHeight());
    g.translate(10,10);
    g.drawImage(src,0,0,W,H,null);
    box(g,an.productBox(),W,H,BLUE,3,false);
    for (Object d: (List<?>)an.debug().get("distractors")) { Map<?,?> m=(Map<?,?>)d; box(g,new NRect(n(m,"x"),n(m,"y"),n(m,"w"),n(m,"h")),W,H,RED,3,false); }
    for (var c: an.focus().critical()) box(g,c.rect(),W,H,ORANGE,2,true);
    box(g,an.focus().rect(),W,H,GREEN,3,false);
    box(g,an.crop().best().crop(),W,H,Color.BLACK,4,false);
    // depois: o recorte 4:5 aplicado à foto original, padding com a cor do fundo
    g.translate(W+10,0);
    Color bg=Color.decode(an.background()); g.setColor(bg); g.fillRect(0,0,cardW,cardH);
    NRect c=an.crop().best().crop();
    double s2=cardW/(c.w()*src.getWidth());
    int dx=(int)(-c.x()*src.getWidth()*s2), dy=(int)(-c.y()*src.getHeight()*s2);
    Shape clip=g.getClip(); g.setClip(0,0,cardW,cardH);
    g.drawImage(src,dx,dy,(int)(src.getWidth()*s2),(int)(src.getHeight()*s2),null);
    g.setClip(clip);
    g.setColor(new Color(0,0,0,40)); g.drawRect(0,0,cardW-1,cardH-1);
    g.dispose();
    ImageIO.write(canvas,"png",out.toFile());
  }
  static double n(Map<?,?> m,String k){ return ((Number)m.get(k)).doubleValue(); }
}
