package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;

import java.util.Collection;
import java.util.Set;

/**
 * Atributos de luta e de jogo que as peças somam (DRESS_FIGHTER, FASHION_DETECTIVE, FASHION_SPORTS): o OVR soma um
 * décimo a cada atributo; calçado tênis dá velocidade e salto tira; couro, denim e lã dão defesa; metal e couro dão
 * ataque. Técnica vem do OVR e da chuteira; resistência, dos tecidos leves.
 */
public record Flair3dAtributos(int velocidade, int ataque, int defesa, int tecnica, int resistencia) {
    public static final int BONUS = 20;
    public static final Set<String> DEFESA = Set.of("leather", "denim", "wool");
    public static final Set<String> ATAQUE = Set.of("metal", "leather");

    public static Flair3dAtributos daCarta(CbcRules.Card c) {
        int base = c.ovr() / 10;
        int velocidade = base + (Flair3dPecas.tenis(c) ? BONUS : 0) - (Flair3dPecas.salto(c) ? BONUS : 0);
        int ataque = base + (Flair3dPecas.temMaterial(c, ATAQUE) ? BONUS : 0);
        int defesa = base + (Flair3dPecas.temMaterial(c, DEFESA) ? BONUS : 0);
        int tecnica = base + (Flair3dPecas.tenis(c) ? BONUS / 3 : 0);
        int resistencia = base + (Flair3dPecas.leve(c) ? BONUS / 3 : 0);
        return new Flair3dAtributos(velocidade, ataque, defesa, tecnica, resistencia);
    }

    public static Flair3dAtributos soma(Collection<CbcRules.Card> pecas) {
        Flair3dAtributos t = new Flair3dAtributos(0, 0, 0, 0, 0);
        for (CbcRules.Card c : pecas) {
            Flair3dAtributos a = daCarta(c);
            t = new Flair3dAtributos(t.velocidade + a.velocidade, t.ataque + a.ataque, t.defesa + a.defesa,
                    t.tecnica + a.tecnica, t.resistencia + a.resistencia);
        }
        return t;
    }
}
