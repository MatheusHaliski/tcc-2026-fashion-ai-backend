package br.com.fashionai.application.flair3d.detetive;

import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Flair3dCores;
import br.com.fashionai.application.flair3d.Flair3dErros;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * A mão da investigação: as cartas do deck fora do look viram o baralho, embaralhado pela semente; a pessoa segura até
 * {@link #TAMANHO} cartas, cada carta jogada vai para o descarte e a mão é reposta (o descarte volta embaralhado quando o
 * baralho acaba). No balcão do mercado, a carta vermelha compra a próxima carta do baralho de uma cor pedida.
 */
public final class DetetiveMao {
    public static final int TAMANHO = 5;
    private final Contexto contexto;
    private final List<UUID> baralho;
    private final List<UUID> mao = new ArrayList<>();
    private final List<UUID> descarte = new ArrayList<>();
    private int voltas;

    public DetetiveMao(Contexto contexto, Collection<UUID> noLook) {
        this.contexto = contexto;
        baralho = new ArrayList<>(contexto.deck().keySet().stream().filter(id -> !noLook.contains(id)).toList());
        baralho.sort(Comparator.comparing(UUID::toString));
        Collections.shuffle(baralho, contexto.sorteio("detetive-baralho"));
        repor();
    }

    /** A ação da cor da carta (ABRIR, FURTIVIDADE, VIDA, DANO, PISTA, MOEDA) ou nula. */
    public String acao(UUID carta) {
        return Flair3dCores.acao(Flair3dCores.DETETIVE, contexto.deck().get(carta));
    }

    /** Joga a carta da mão (422 CARTA_FORA_DA_MAO se ela não está lá) e repõe a mão. */
    public void jogar(UUID carta) {
        if (!mao.remove(carta)) {
            throw Flair3dErros.invalido("CARTA_FORA_DA_MAO", "carta_fora_da_mao");
        }
        descarte.add(carta);
        repor();
    }

    /** Compra para a mão a primeira carta do baralho com a ação pedida (o descarte entra na busca); diz se achou. */
    public boolean comprar(String acaoPedida) {
        reciclar(true);
        for (UUID id : baralho) {
            if (acaoPedida.equals(acao(id))) {
                baralho.remove(id);
                mao.add(id);
                return true;
            }
        }
        return false;
    }

    private void repor() {
        while (mao.size() < TAMANHO) {
            reciclar(false);
            if (baralho.isEmpty()) {
                return;
            }
            mao.add(baralho.remove(0));
        }
    }

    private void reciclar(boolean sempre) {
        if ((baralho.isEmpty() || sempre) && !descarte.isEmpty()) {
            voltas++;
            baralho.addAll(descarte);
            descarte.clear();
            Collections.shuffle(baralho, contexto.sorteio("detetive-baralho" + voltas));
        }
    }

    public List<UUID> cartas() {
        return List.copyOf(mao);
    }

    public int noBaralho() {
        return baralho.size() + descarte.size();
    }
}
