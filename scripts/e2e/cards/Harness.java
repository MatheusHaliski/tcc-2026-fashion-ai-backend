package br.com.fashionai.application.imaging;

import java.io.File;
import java.nio.file.Files;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;

/** Roda o pipeline de verdade (flat lay local → estúdio local → feed por template) sobre uploads e grava as saídas. */
public class Harness {
    public static void main(String[] a) throws Exception {
        File in = new File(a[0]), out = new File(a[1]);
        out.mkdirs();
        FlatLayPipeline flat = new FlatLayPipeline(List.of(), List.of());
        StudioPipeline studio = new StudioPipeline(List.of(), List.of());
        StringBuilder json = new StringBuilder("{");
        File[] files = in.listFiles((d, n) -> n.endsWith(".jpg") || (n.endsWith(".png") && !n.startsWith("_")));
        java.util.Arrays.sort(files);
        for (File f : files) {
            String name = f.getName().replaceAll("\\.[a-z]+$", "");
            String cat = name.startsWith("pants") ? "lower_piece" : "upper_piece";
            String sub = name.startsWith("pants") ? (name.contains("jeans") ? "jeans" : name.contains("cargo") ? "cargo_pants" : name.contains("jogger") ? "jogger_pants" : name.contains("alfaiataria") ? "tailored_pants" : "casual_pants")
                    : name.contains("polo") ? "polo_shirt" : "t_shirt";
            long t0 = System.currentTimeMillis();
            FlatLayPipeline.Result r = flat.run(Files.readAllBytes(f.toPath()), false);
            FeedFraming.Template tpl = FeedFraming.template(cat, sub, null);
            StudioPipeline.Result s = studio.run(r.studioSource(), "auto", false,
                    new StudioPipeline.Hints(cat.equals("lower_piece") ? "BOTTOM" : "TOP", r.truncated(), null, null, tpl));
            Files.write(new File(out, name + ".studio.jpg").toPath(), s.studioJpeg());
            Files.write(new File(out, name + ".thumb.jpg").toPath(), s.thumbJpeg());
            Files.write(new File(out, name + ".feed.jpg").toPath(), s.feedJpeg());
            Files.write(new File(out, name + ".cut.png").toPath(), r.processedPng());
            Files.write(new File(out, name + ".enhanced.png").toPath(), s.enhancedPng());
            if (s.detailJpeg() != null) {
                Files.write(new File(out, name + ".detail.jpg").toPath(), s.detailJpeg());
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("backgroundRemoved", r.backgroundRemoved());
            m.put("truncated", r.truncated());
            m.put("feed", s.feed());
            m.put("logo", s.logo());
            m.put("framing", s.framing());
            m.put("backdrop", s.backdrop().id());
            m.put("ms", System.currentTimeMillis() - t0);
            m.put("stages", s.stages().stream().map(x -> x.name() + ": " + x.note()).toList());
            json.append(json.length() > 1 ? "," : "").append("\n\"").append(name).append("\": ").append(br.com.fashionai.application.common.Json.write(m));
            System.out.println(name + " bg=" + r.backgroundRemoved() + " trunc=" + r.truncated() + " feed=" + s.feed().get("template") + " missing=" + s.feed().get("missing") + " lm=" + s.feed().get("landmarks") + " logo=" + s.logo());
        }
        Files.writeString(new File(out, "report.json").toPath(), json.append("\n}\n").toString());
    }
}
