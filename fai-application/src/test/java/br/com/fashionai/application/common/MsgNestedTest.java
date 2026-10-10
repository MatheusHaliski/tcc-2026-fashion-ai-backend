package br.com.fashionai.application.common;

import org.junit.jupiter.api.Test;

import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * RF23 — marcador adiado como argumento de outro marcador ({@code Msg.k("a", Msg.k("b"))}). Antes, o regex casava o
 * marcador de fora até o primeiro {@code §} (a abertura do de dentro) e a resposta saía com lixo
 * ("… i18n:coupon.seu_look_ganhou_o_selo§§"); além disso, {@code k()} trocava os separadores do marcador de dentro por
 * espaço e os argumentos dele se perdiam. Agora a resolução é de dentro para fora e o idioma continua sendo o de quem lê.
 */
class MsgNestedTest {
    private static final Locale PT = Msg.PT_BR;
    private static final Locale EN = Locale.ENGLISH;

    @Test
    void marcadorSemArgumentoDentroDeOutro() {
        // CouponService: o motivo do cupom é outro marcador
        String deferred = Msg.k("coupon.deseja_resgatar_o_cupom_de", "Cupom 10%", "Loja Ana", Msg.k("coupon.seu_look_ganhou_o_selo"));
        assertThat(Msg.resolve(PT, deferred))
                .isEqualTo("Deseja resgatar o CUPOM \"Cupom 10%\" de Loja Ana? Seu look ganhou o selo que libera esta promoção.");
        // apóstrofo escapado ('') do catálogo em inglês continua certo dentro do argumento
        String deck = Msg.k("coupon.deseja_resgatar_o_cupom_de", "10% off", "Ana's", Msg.k("coupon.seu_deck_completou_o_jogo"));
        assertThat(Msg.resolve(EN, deck))
                .isEqualTo("Do you want to redeem the \"10% off\" COUPON from Ana's? Your deck completed the store's FLAIR game.");
        assertThat(Msg.resolve(EN, deck)).doesNotContain("§").doesNotContain("i18n:");
    }

    @Test
    void marcadorComArgumentosDentroDeOutroETresNiveis() {
        // IssuerReviewService: o tipo (marca/celebridade) é marcador; aqui ainda dentro de um terceiro nível
        String inner = Msg.k("issuerReview.notif_admin_titulo", Msg.k("issuerReview.tipo_marca"), "Nike");
        assertThat(Msg.resolve(PT, inner)).isEqualTo("Novo pedido de verificação: Nike (marca)");
        assertThat(Msg.resolve(EN, inner)).isEqualTo("New verification request: Nike (brand)");
        String outer = Msg.k("seal.vinculo_2", inner);
        assertThat(Msg.resolve(PT, outer)).isEqualTo("Vínculo Novo pedido de verificação: Nike (marca)");
        assertThat(Msg.resolve(EN, outer)).isEqualTo("Link New verification request: Nike (brand)");
    }

    @Test
    void irmaosTextoLivreEMarcadorMalformado() {
        String two = Msg.k("seal.vinculo_2", Msg.k("seal.nao_aprovado")) + " · " + Msg.k("issuerReview.tipo_celebridade");
        assertThat(Msg.resolve(PT, two)).isEqualTo("Vínculo não aprovado · celebridade");
        assertThat(Msg.resolve(EN, two)).isEqualTo("Link not approved · celebrity");
        // marcador quebrado (sem fechamento ou com chave inválida) fica como está, sem laço infinito
        assertThat(Msg.resolve(PT, "§i18n:seal.nao_aprovado")).isEqualTo("§i18n:seal.nao_aprovado");
        assertThat(Msg.resolve(PT, "x §i18n:chave inválida§ " + Msg.k("seal.nao_aprovado"))).isEqualTo("x §i18n:chave inválida§ não aprovado");
        // texto comum com o separador continua sem quebrar o marcador (vira espaço)
        assertThat(Msg.resolve(PT, Msg.k("seal.vinculo_2", "a\u001Fb"))).isEqualTo("Vínculo a b");
        // chave desconhecida volta a própria chave, também aninhada
        assertThat(Msg.resolve(PT, Msg.k("seal.vinculo_2", Msg.k("nao.existe")))).isEqualTo("Vínculo nao.existe");
    }
}
