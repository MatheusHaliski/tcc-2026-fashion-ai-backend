package br.com.fashionai.application.imaging;

import br.com.fashionai.application.common.Json;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * RF16 — gerador 3D local (sem provedor externo): transforma o recorte sem fundo da peça num modelo glTF 2.0 binário
 * (.glb) em "relevo inflado". A silhueta vira uma malha frente/verso, a altura de cada ponto cresce com a distância
 * até a borda (perfil arredondado, como uma peça com volume) e a própria foto é a textura. Não substitui a
 * reconstrução por IA (Meshy/Stability), mas garante um modelo girável quando nenhum provedor está disponível (RNF8).
 */
public final class ReliefModelGenerator {
    /** Resolução da malha no lado maior (células). 128 dá ~40 mil triângulos (~1,5 MB com a textura): leve para celular. */
    public static final int GRID = 128;
    /** Passes de suavização do contorno (a grade deixaria a silhueta em degraus). */
    static final int CONTOUR_PASSES = 4;
    private static final int FLOAT = 5126, UINT = 5125, ARRAY = 34962, ELEMENTS = 34963;

    private ReliefModelGenerator() {
    }

    public record Model(byte[] glb, int vertices, int triangles, double widthM, double heightM, double depthM) {
    }

    /** @param cutout recorte ARGB (fundo transparente) · @param heightMeters altura real aproximada da peça */
    public static Model generate(BufferedImage cutout, double heightMeters) {
        ImageOps.Box box = ImageOps.alphaBounds(cutout);
        if (box.empty()) {
            throw new IllegalArgumentException("recorte sem silhueta: não há o que modelar");
        }
        BufferedImage img = ImageOps.crop(cutout, box);
        int iw = img.getWidth(), ih = img.getHeight();
        double cell = Math.max(iw, ih) / (double) GRID;
        int gw = Math.max(2, (int) Math.ceil(iw / cell)), gh = Math.max(2, (int) Math.ceil(ih / cell));

        // 1) máscara por célula (alfa médio da amostra central)
        boolean[][] in = new boolean[gh][gw];
        int inside = 0;
        for (int y = 0; y < gh; y++) {
            for (int x = 0; x < gw; x++) {
                int px = Math.min(iw - 1, (int) ((x + 0.5) * cell)), py = Math.min(ih - 1, (int) ((y + 0.5) * cell));
                in[y][x] = (img.getRGB(px, py) >>> 24) > 110;
                if (in[y][x]) {
                    inside++;
                }
            }
        }
        if (inside < 12) {
            throw new IllegalArgumentException("silhueta pequena demais para gerar volume");
        }
        // 2) distância até a borda (chanfro 3-4) → perfil arredondado
        double[][] d = distance(in, gw, gh);
        double max = 0;
        for (double[] row : d) {
            for (double v : row) {
                max = Math.max(max, v);
            }
        }
        double scale = heightMeters / (gh * 1.0);           // metros por célula
        double plateau = Math.max(2, max * 0.55);            // a partir daqui o volume estabiliza
        double thickness = Math.min(0.09, 0.22 * Math.max(gw, gh) * scale * 0.35);

        // 3) vértices frente (z+) e verso (z−) por célula ocupada
        int[][] front = new int[gh][gw], back = new int[gh][gw];
        List<float[]> pos = new ArrayList<>(), uv = new ArrayList<>();
        for (int y = 0; y < gh; y++) {
            for (int x = 0; x < gw; x++) {
                front[y][x] = back[y][x] = -1;
                if (!in[y][x]) {
                    continue;
                }
                double t = Math.min(1, d[y][x] / plateau);
                double h = thickness * Math.sqrt(1 - (1 - t) * (1 - t));   // quarto de círculo: borda arredondada
                float px = (float) ((x + 0.5 - gw / 2.0) * scale), py = (float) ((gh / 2.0 - y - 0.5) * scale);
                float u = (float) ((x + 0.5) * cell / iw), v = (float) ((y + 0.5) * cell / ih);
                front[y][x] = pos.size();
                pos.add(new float[]{px, py, (float) (h + 0.002)});
                uv.add(new float[]{u, v});
                back[y][x] = pos.size();
                pos.add(new float[]{px, py, (float) -(h * 0.75 + 0.002)});
                uv.add(new float[]{u, v});
            }
        }
        // 4) triângulos (2 por bloco 2×2 completo, 1 quando 3 células ocupadas) + paredes na borda
        List<int[]> tris = new ArrayList<>();
        Map<Long, Integer> edgeUse = new HashMap<>();
        List<int[]> frontTris = new ArrayList<>();
        for (int y = 0; y < gh - 1; y++) {
            for (int x = 0; x < gw - 1; x++) {
                int a = front[y][x], b = front[y][x + 1], c = front[y + 1][x], e = front[y + 1][x + 1];
                int n = (a >= 0 ? 1 : 0) + (b >= 0 ? 1 : 0) + (c >= 0 ? 1 : 0) + (e >= 0 ? 1 : 0);
                if (n == 4) {
                    frontTris.add(new int[]{a, c, b});
                    frontTris.add(new int[]{b, c, e});
                } else if (n == 3) {
                    int[] q = a < 0 ? new int[]{b, c, e} : b < 0 ? new int[]{a, c, e} : c < 0 ? new int[]{a, e, b} : new int[]{a, c, b};
                    frontTris.add(q);
                }
            }
        }
        Map<Integer, Integer> frontToBack = new HashMap<>();
        for (int y = 0; y < gh; y++) {
            for (int x = 0; x < gw; x++) {
                if (front[y][x] >= 0) {
                    frontToBack.put(front[y][x], back[y][x]);
                }
            }
        }
        for (int[] t : frontTris) {
            tris.add(t);
            tris.add(new int[]{frontToBack.get(t[0]), frontToBack.get(t[2]), frontToBack.get(t[1])});   // verso invertido
            for (int k = 0; k < 3; k++) {
                int p = t[k], q = t[(k + 1) % 3];
                edgeUse.merge(key(Math.min(p, q), Math.max(p, q)), 1, Integer::sum);
            }
        }
        Map<Integer, List<Integer>> ring = new HashMap<>();
        for (int[] t : frontTris) {
            for (int k = 0; k < 3; k++) {
                int p = t[k], q = t[(k + 1) % 3];
                if (edgeUse.get(key(Math.min(p, q), Math.max(p, q))) == 1) {       // aresta de borda → parede lateral
                    int bp = frontToBack.get(p), bq = frontToBack.get(q);
                    tris.add(new int[]{p, bp, q});
                    tris.add(new int[]{q, bp, bq});
                    ring.computeIfAbsent(p, k2 -> new ArrayList<>()).add(q);
                    ring.computeIfAbsent(q, k2 -> new ArrayList<>()).add(p);
                }
            }
        }
        // 4b) contorno suave: cada vértice da borda anda metade do caminho até a média dos dois vizinhos de borda
        // (junções com mais vizinhos ficam paradas); frente e verso andam juntos e a UV acompanha, então a foto não escorrega
        for (int pass = 0; pass < CONTOUR_PASSES; pass++) {
            Map<Integer, float[]> next = new HashMap<>();
            for (Map.Entry<Integer, List<Integer>> e : ring.entrySet()) {
                List<Integer> nb = e.getValue();
                if (nb.size() != 2) {
                    continue;
                }
                float[] p = pos.get(e.getKey()), a = pos.get(nb.get(0)), b = pos.get(nb.get(1));
                next.put(e.getKey(), new float[]{p[0] + 0.5f * ((a[0] + b[0]) / 2 - p[0]), p[1] + 0.5f * ((a[1] + b[1]) / 2 - p[1])});
            }
            for (Map.Entry<Integer, float[]> e : next.entrySet()) {
                float[] xy = e.getValue();
                float u = (float) ((xy[0] / scale + gw / 2.0) * cell / iw), v = (float) ((gh / 2.0 - xy[1] / scale) * cell / ih);
                for (int idx : new int[]{e.getKey(), frontToBack.get(e.getKey())}) {
                    pos.get(idx)[0] = xy[0];
                    pos.get(idx)[1] = xy[1];
                    uv.set(idx, new float[]{u, v});
                }
            }
        }
        float[][] normals = normals(pos, tris);

        // 5) textura: o recorte, no máximo 1024 px
        BufferedImage tex = iw > 1024 || ih > 1024 ? ImageOps.scaleToFit(img, 1024, 1024) : img;
        byte[] png = ImageOps.png(tex);
        byte[] glb = writeGlb(pos, normals, uv, tris, png);
        return new Model(glb, pos.size(), tris.size(), gw * scale, gh * scale, thickness * 1.75);
    }

    private static long key(int a, int b) {
        return ((long) a << 32) | (b & 0xffffffffL);
    }

    static double[][] distance(boolean[][] in, int w, int h) {
        double inf = 1e9;
        double[][] d = new double[h][w];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                boolean edge = !in[y][x] || x == 0 || y == 0 || x == w - 1 || y == h - 1;
                d[y][x] = !in[y][x] ? 0 : edge ? 1 : inf;
            }
        }
        for (int y = 1; y < h; y++) {
            for (int x = 1; x < w - 1; x++) {
                if (d[y][x] > 0) {
                    d[y][x] = Math.min(d[y][x], Math.min(Math.min(d[y - 1][x] + 1, d[y][x - 1] + 1), Math.min(d[y - 1][x - 1] + 1.414, d[y - 1][x + 1] + 1.414)));
                }
            }
        }
        for (int y = h - 2; y >= 0; y--) {
            for (int x = w - 2; x >= 1; x--) {
                if (d[y][x] > 0) {
                    d[y][x] = Math.min(d[y][x], Math.min(Math.min(d[y + 1][x] + 1, d[y][x + 1] + 1), Math.min(d[y + 1][x + 1] + 1.414, d[y + 1][x - 1] + 1.414)));
                }
            }
        }
        return d;
    }

    static float[][] normals(List<float[]> pos, List<int[]> tris) {
        float[][] n = new float[pos.size()][3];
        for (int[] t : tris) {
            float[] a = pos.get(t[0]), b = pos.get(t[1]), c = pos.get(t[2]);
            float ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
            float nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
            for (int i : t) {
                n[i][0] += nx;
                n[i][1] += ny;
                n[i][2] += nz;
            }
        }
        for (float[] v : n) {
            float len = (float) Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
            if (len > 1e-9) {
                v[0] /= len;
                v[1] /= len;
                v[2] /= len;
            } else {
                v[2] = 1;
            }
        }
        return n;
    }

    /** glTF 2.0 binário: um nó, uma malha, material PBR com a foto como baseColorTexture (alpha MASK, dupla face). */
    static byte[] writeGlb(List<float[]> pos, float[][] normals, List<float[]> uv, List<int[]> tris, byte[] png) {
        int nv = pos.size(), ni = tris.size() * 3;
        int posLen = nv * 12, nrmLen = nv * 12, uvLen = nv * 8, idxLen = ni * 4, imgLen = png.length;
        int posOff = 0, nrmOff = posOff + posLen, uvOff = nrmOff + nrmLen, idxOff = uvOff + uvLen, imgOff = idxOff + idxLen;
        int binLen = pad4(imgOff + imgLen);
        ByteBuffer bin = ByteBuffer.allocate(binLen).order(ByteOrder.LITTLE_ENDIAN);
        float[] min = {Float.MAX_VALUE, Float.MAX_VALUE, Float.MAX_VALUE}, maxv = {-Float.MAX_VALUE, -Float.MAX_VALUE, -Float.MAX_VALUE};
        for (float[] p : pos) {
            for (int k = 0; k < 3; k++) {
                bin.putFloat(p[k]);
                min[k] = Math.min(min[k], p[k]);
                maxv[k] = Math.max(maxv[k], p[k]);
            }
        }
        for (float[] n : normals) {
            bin.putFloat(n[0]).putFloat(n[1]).putFloat(n[2]);
        }
        for (float[] t : uv) {
            bin.putFloat(t[0]).putFloat(t[1]);
        }
        for (int[] t : tris) {
            bin.putInt(t[0]).putInt(t[1]).putInt(t[2]);
        }
        bin.put(png);

        Map<String, Object> gltf = new LinkedHashMap<>();
        gltf.put("asset", Map.of("version", "2.0", "generator", "Fashion AI · RF16 relevo local"));
        gltf.put("scene", 0);
        gltf.put("scenes", List.of(Map.of("nodes", List.of(0))));
        gltf.put("nodes", List.of(Map.of("mesh", 0, "name", "peca")));
        gltf.put("meshes", List.of(Map.of("name", "peca", "primitives", List.of(Map.of(
                "attributes", Map.of("POSITION", 0, "NORMAL", 1, "TEXCOORD_0", 2), "indices", 3, "material", 0)))));
        gltf.put("materials", List.of(Map.of("name", "foto-da-peca", "doubleSided", true, "alphaMode", "MASK", "alphaCutoff", 0.4,
                "pbrMetallicRoughness", Map.of("baseColorTexture", Map.of("index", 0), "metallicFactor", 0.0, "roughnessFactor", 0.82))));
        gltf.put("textures", List.of(Map.of("source", 0, "sampler", 0)));
        gltf.put("samplers", List.of(Map.of("magFilter", 9729, "minFilter", 9987, "wrapS", 33071, "wrapT", 33071)));
        gltf.put("images", List.of(Map.of("bufferView", 4, "mimeType", "image/png")));
        gltf.put("buffers", List.of(Map.of("byteLength", binLen)));
        gltf.put("bufferViews", List.of(
                Map.of("buffer", 0, "byteOffset", posOff, "byteLength", posLen, "target", ARRAY),
                Map.of("buffer", 0, "byteOffset", nrmOff, "byteLength", nrmLen, "target", ARRAY),
                Map.of("buffer", 0, "byteOffset", uvOff, "byteLength", uvLen, "target", ARRAY),
                Map.of("buffer", 0, "byteOffset", idxOff, "byteLength", idxLen, "target", ELEMENTS),
                Map.of("buffer", 0, "byteOffset", imgOff, "byteLength", imgLen)));
        gltf.put("accessors", List.of(
                Map.of("bufferView", 0, "componentType", FLOAT, "count", nv, "type", "VEC3",
                        "min", List.of(min[0], min[1], min[2]), "max", List.of(maxv[0], maxv[1], maxv[2])),
                Map.of("bufferView", 1, "componentType", FLOAT, "count", nv, "type", "VEC3"),
                Map.of("bufferView", 2, "componentType", FLOAT, "count", nv, "type", "VEC2"),
                Map.of("bufferView", 3, "componentType", UINT, "count", ni, "type", "SCALAR")));
        byte[] json = Json.write(gltf).getBytes(StandardCharsets.UTF_8);
        int jsonLen = pad4(json.length);
        ByteBuffer out = ByteBuffer.allocate(12 + 8 + jsonLen + 8 + binLen).order(ByteOrder.LITTLE_ENDIAN);
        out.putInt(0x46546C67).putInt(2).putInt(12 + 8 + jsonLen + 8 + binLen);
        out.putInt(jsonLen).putInt(0x4E4F534A).put(json);
        for (int i = json.length; i < jsonLen; i++) {
            out.put((byte) ' ');
        }
        out.putInt(binLen).putInt(0x004E4942).put(bin.array());
        return out.array();
    }

    private static int pad4(int n) {
        return (n + 3) & ~3;
    }

    /** Leitura mínima do cabeçalho GLB (validação de arquivos de provedores externos). */
    public static boolean isGlb(byte[] bytes) {
        if (bytes == null || bytes.length < 20) {
            return false;
        }
        ByteBuffer b = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
        return b.getInt(0) == 0x46546C67 && b.getInt(4) == 2 && b.getInt(8) <= bytes.length;
    }

    static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        for (byte[] p : parts) {
            o.writeBytes(p);
        }
        return o.toByteArray();
    }
}
