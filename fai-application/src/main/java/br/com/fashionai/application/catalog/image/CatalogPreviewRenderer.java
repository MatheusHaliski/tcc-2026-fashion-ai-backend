package br.com.fashionai.application.catalog.image;

import br.com.fashionai.application.imaging.ImageOps;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Two immutable display derivatives from one analysis. Does not run AI or segmentation again. */
public final class CatalogPreviewRenderer {
    public static final String VERSION = "CATALOG_PREVIEW_FRAMES_V2";
    private static final int MAX_WIDTH = 900;
    private static final double ASPECT = 3.0 / 4;

    private CatalogPreviewRenderer() { }

    public record Frames(BufferedImage fabric, BufferedImage whole, Map<String, Object> wholeMetadata,
                         String wholeUnavailableReason) { }

    static Frames render(BufferedImage source, ProductSegmenter.Segmentation seg, BufferedImage product,
                         ProductRuleFrame.Result frame, double sourceHuman, boolean detailView) {
        BufferedImage fabric = frame.ok() ? maskedFabric(source, product, frame.crop()) : null;
        if (detailView) return withoutWhole(fabric, "DETAIL_SOURCE");
        if (!frame.ok()) return withoutWhole(fabric, "INVALID_PRODUCT_FRAME");
        if (frame.model() || !Double.isFinite(sourceHuman) || sourceHuman >= ProductRuleFrame.MIN_PERSON_SKIN)
            return withoutWhole(fabric, "PERSON_IN_SOURCE");
        if (seg == null || product == null || seg.empty() || seg.confidence() < .45 || seg.edgeQuality() < .35)
            return withoutWhole(fabric, "UNVERIFIED_PRODUCT_MASK");
        NRect b = seg.productBox();
        if (!valid(b) || b.x() < 0 || b.y() < 0 || b.x2() > 1.001 || b.y2() > 1.001)
            return withoutWhole(fabric, "INVALID_PRODUCT_BOUNDS");
        int x0 = Math.max(0, (int) Math.floor(b.x() * product.getWidth()));
        int y0 = Math.max(0, (int) Math.floor(b.y() * product.getHeight()));
        int x1 = Math.min(product.getWidth(), (int) Math.ceil(b.x2() * product.getWidth()));
        int y1 = Math.min(product.getHeight(), (int) Math.ceil(b.y2() * product.getHeight()));
        int bw = x1 - x0, bh = y1 - y0;
        if (bw < 8 || bh < 8) return withoutWhole(fabric, "PRODUCT_TOO_SMALL");
        // Smaller sources produce smaller canvases; garment pixels are never enlarged.
        int width = Math.max(3, Math.min(MAX_WIDTH, 3 * (int) Math.ceil(Math.max(bw, bh * ASPECT) / .96 / 3)));
        int height = width / 3 * 4;
        double scale = Math.min(1, Math.min(width * .96 / bw, height * .96 / bh));
        int dw = Math.max(1, (int) Math.floor(bw * scale)), dh = Math.max(1, (int) Math.floor(bh * scale));
        int dx = (width - dw) / 2, dy = (height - dh) / 2;
        BufferedImage whole = canvas(width, height, BackgroundNormalizer.NEUTRAL);
        Graphics2D g = whole.createGraphics(); ImageOps.quality(g);
        g.drawImage(product, dx, dy, dx + dw, dy + dh, x0, y0, x1, y1, null); g.dispose();
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("box", new NRect(0, 0, 1, 1).toMap());
        metadata.put("productBox", new NRect(dx / (double) width, dy / (double) height, dw / (double) width, dh / (double) height).toMap());
        metadata.put("background", "#f4f3f1"); metadata.put("width", width); metadata.put("height", height);
        metadata.put("truncated", List.copyOf(seg.truncatedSides())); metadata.put("alpha", false);
        metadata.put("version", VERSION);
        return new Frames(fabric, whole, metadata, null);
    }

    private static Frames withoutWhole(BufferedImage fabric, String reason) {
        return new Frames(fabric, null, Map.of(), reason);
    }

    /** A crop without its segmentation mask is not proof of fabric coverage. */
    public static BufferedImage fabricFrom(byte[] source, Map<?, ?> productFrame) { return null; }

    /** Largest exact 3:4 rectangle within the selected mask and category ROI, with no background padding. */
    static BufferedImage maskedFabric(BufferedImage source, BufferedImage product, NRect roi) {
        if (product == null || !valid(roi)) return null;
        int w=product.getWidth(), h=product.getHeight(), stride=w+1;
        int[] sum=new int[(w+1)*(h+1)];
        for(int y=0;y<h;y++) { int row=0; for(int x=0;x<w;x++) {
            boolean opaque=x>0 && y>0 && x+1<w && y+1<h;
            for(int dy=-1;opaque && dy<=1;dy++) for(int dx=-1;dx<=1;dx++) if((product.getRGB(x+dx,y+dy)>>>24)<248) {opaque=false;break;}
            if(opaque) row++; sum[(y+1)*stride+x+1]=sum[y*stride+x+1]+row;
        }}
        int x0=Math.max(0,(int)Math.ceil(roi.x()*w)), y0=Math.max(0,(int)Math.ceil(roi.y()*h));
        int x1=Math.min(w,(int)Math.floor(roi.x2()*w)), y1=Math.min(h,(int)Math.floor(roi.y2()*h));
        int lo=1,hi=Math.min((x1-x0)/3,(y1-y0)/4),bx=-1,by=-1,bunit=0;
        while(lo<=hi) { int unit=(lo+hi)/2,rw=unit*3,rh=unit*4,fx=-1,fy=-1;double best=Double.POSITIVE_INFINITY;
            for(int y=y0;y+rh<=y1;y++) for(int x=x0;x+rw<=x1;x++) {
                int area=sum[(y+rh)*stride+x+rw]-sum[y*stride+x+rw]-sum[(y+rh)*stride+x]+sum[y*stride+x];
                if(area!=rw*rh) continue;
                double d=Math.pow(x+rw/2.0-(x0+x1)/2.0,2)+Math.pow(y+rh/2.0-(y0+y1)/2.0,2);
                if(d<best) {best=d;fx=x;fy=y;}
            }
            if(fx>=0) {bx=fx;by=fy;bunit=unit;lo=unit+1;}else hi=unit-1;
        }
        if(bunit<8) return null;
        return renderFabric(source,new NRect(bx/(double)w,by/(double)h,bunit*3.0/w,bunit*4.0/h),null);
    }

    static BufferedImage renderFabric(BufferedImage source, NRect crop, String background) {
        if (!valid(crop) || crop.x()<0 || crop.y()<0 || crop.x2()>1.00001 || crop.y2()>1.00001 || Math.abs(crop.x()) > 4 || Math.abs(crop.y()) > 4 || crop.w() > 4 || crop.h() > 4) return null;
        int x0 = (int) Math.round(crop.x() * source.getWidth()), y0 = (int) Math.round(crop.y() * source.getHeight());
        int x1 = (int) Math.round(crop.x2() * source.getWidth()), y1 = (int) Math.round(crop.y2() * source.getHeight());
        if (x1 <= x0 || y1 <= y0) return null;
        double ratio = (x1 - x0) / (double) (y1 - y0);
        if (Math.abs(ratio - ASPECT) > .025) return null;
        int width = 3 * (int) Math.floor(Math.min(MAX_WIDTH, Math.min(x1 - x0, (y1 - y0) * ASPECT)) / 3);
        if (width < 3) return null;
        int height = width / 3 * 4;
        Color bg = background != null && background.matches("#[0-9a-fA-F]{6}") ? Color.decode(background) : BackgroundNormalizer.NEUTRAL;
        BufferedImage fabric = canvas(width, height, bg);
        Graphics2D g = fabric.createGraphics(); ImageOps.quality(g);
        g.drawImage(source, 0, 0, width, height, x0, y0, x1, y1, null); g.dispose();
        return fabric;
    }

    private static BufferedImage canvas(int w, int h, Color bg) {
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics(); g.setColor(bg); g.fillRect(0, 0, w, h); g.dispose(); return out;
    }
    private static boolean valid(NRect r) {
        return r != null && Double.isFinite(r.x()) && Double.isFinite(r.y()) && Double.isFinite(r.w()) && Double.isFinite(r.h()) && r.w() > 0 && r.h() > 0;
    }
    private static double number(Object value) { return value instanceof Number n ? n.doubleValue() : Double.NaN; }
}
