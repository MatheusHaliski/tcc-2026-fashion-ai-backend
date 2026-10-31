package br.com.fashionai.application.imaging;

import br.com.fashionai.application.moderation.ImageSafetyPorts.ClassMap;

/**
 * RF4 · peças vestidas — quem é a pessoa no mapa de classes ({@link WornPieceRegions#detect}): o bloco conexo
 * (8 vizinhos) de pixels não-fundo com mais rosto, ou, sem rosto, com mais pele do corpo. Vitrines ao fundo ficam fora.
 */
final class WornPersonBlob {
    private WornPersonBlob() {
    }

    /** O bloco conexo (8 vizinhos) de pixels não-fundo com mais rosto — ou, sem rosto, com mais pele do corpo. */
    static boolean[] find(byte[] cls, int w, int h) {
        int size = w * h;
        int[] label = new int[size];
        int[] queue = new int[size];
        int labels = 0;
        long bestScore = -1;
        int bestLabel = -1;
        long headAll = 0, skinAll = 0;
        for (int i = 0; i < size; i++) {
            if (cls[i] == ClassMap.HAIR || cls[i] == ClassMap.FACE_SKIN) {
                headAll++;
            } else if (cls[i] == ClassMap.BODY_SKIN) {
                skinAll++;
            }
        }
        boolean useFace = headAll / (double) size >= WornPieceRegions.MIN_HEAD;
        if (!useFace && skinAll / (double) size < WornPieceRegions.MIN_SKIN) {
            return null;
        }
        for (int i = 0; i < size; i++) {
            if (label[i] != 0 || cls[i] == ClassMap.BACKGROUND) {
                continue;
            }
            int id = ++labels, head = 0, tail = 1;
            long faces = 0, skins = 0, clothes = 0;
            queue[0] = i;
            label[i] = id;
            while (head < tail) {
                int p = queue[head++], x = p % w, y = p / w;
                switch (cls[p]) {
                    case ClassMap.HAIR, ClassMap.FACE_SKIN -> faces++;
                    case ClassMap.BODY_SKIN -> skins++;
                    default -> clothes++;
                }
                for (int dy = -1; dy <= 1; dy++) {
                    for (int dx = -1; dx <= 1; dx++) {
                        int nx = x + dx, ny = y + dy;
                        if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
                            continue;
                        }
                        int q = ny * w + nx;
                        if (label[q] == 0 && cls[q] != ClassMap.BACKGROUND) {
                            label[q] = id;
                            queue[tail++] = q;
                        }
                    }
                }
            }
            // com mais de uma pessoa, a maior (mais roupa) e com rosto: quem está em primeiro plano
            long score = useFace ? faces * 8 + clothes : skins * 8 + clothes;
            if ((useFace ? faces : skins) > 0 && score > bestScore) {
                bestScore = score;
                bestLabel = id;
            }
        }
        if (bestLabel < 0) {
            return null;
        }
        boolean[] person = new boolean[size];
        for (int i = 0; i < size; i++) {
            person[i] = label[i] == bestLabel;
        }
        return person;
    }
}
