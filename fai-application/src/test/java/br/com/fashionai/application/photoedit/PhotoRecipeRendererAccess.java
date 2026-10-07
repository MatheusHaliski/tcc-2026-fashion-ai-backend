package br.com.fashionai.application.photoedit;

import br.com.fashionai.application.imaging.ImageOps;

import java.awt.image.BufferedImage;

final class PhotoRecipeRendererAccess {
    private PhotoRecipeRendererAccess() {
    }

    static BufferedImage argb(BufferedImage img) {
        return ImageOps.toArgb(img);
    }
}
