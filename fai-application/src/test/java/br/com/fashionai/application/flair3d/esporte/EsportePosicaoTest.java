package br.com.fashionai.application.flair3d.esporte;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** A posição da capitã entra no duelo: infiltrar com a bola e recompor sem ela somam; o contrário tira. */
class EsportePosicaoTest {
    @Test
    void comABolaInfiltrarSomaERecuarTira() {
        assertThat(EsportePosicao.ajuste("POSICAO:8,2", true)).isEqualTo(EsportePosicao.BOM);
        assertThat(EsportePosicao.ajuste("POSICAO:-8,0", true)).isEqualTo(-EsportePosicao.RUIM);
        assertThat(EsportePosicao.ajuste("POSICAO:1,6", true)).isZero();
    }

    @Test
    void semABolaRecomporSoma() {
        assertThat(EsportePosicao.ajuste("POSICAO:-6,0", false)).isEqualTo(EsportePosicao.BOM);
        assertThat(EsportePosicao.ajuste("POSICAO:6,0", false)).isEqualTo(-EsportePosicao.RUIM);
    }

    @Test
    void semPosicaoForaDoRaioOuInvalidaNaoMuda() {
        assertThat(EsportePosicao.ajuste(null, true)).isZero();
        assertThat(EsportePosicao.ajuste("IR:meio", true)).isZero();
        assertThat(EsportePosicao.ajuste("POSICAO:30,0", true)).isZero();
        assertThat(EsportePosicao.ajuste("POSICAO:x,y", true)).isZero();
        assertThat(EsportePosicao.ajuste("POSICAO:NaN,0", true)).isZero();
    }
}
