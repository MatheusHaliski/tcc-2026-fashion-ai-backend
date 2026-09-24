package br.com.fashionai.application.service;

import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;

import static org.assertj.core.api.Assertions.assertThat;

class SealDesignServiceTest {
    @Test
    void circularSealWithTransparentCornersIsDetected() {
        BufferedImage img = new BufferedImage(256, 256, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.ORANGE);
        g.fillOval(0, 0, 256, 256);
        g.dispose();
        assertThat(SealDesignService.cornersClear(img)).isTrue();
    }

    @Test
    void opaqueSquareIsNotCircular() {
        BufferedImage img = new BufferedImage(256, 256, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.ORANGE);
        g.fillRect(0, 0, 256, 256);
        g.dispose();
        assertThat(SealDesignService.cornersClear(img)).isFalse();
    }
}
