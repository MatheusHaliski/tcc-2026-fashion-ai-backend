package br.com.fashionai.application.flair3d.esporte;

import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Flair3dErros;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * A mão da partida do FASHION_SPORTS: as cartas do deck que não estão no uniforme viram o baralho, embaralhado pela
 * semente; a pessoa segura até {@link #TAMANHO} cartas, e cada carta jogada vai para o descarte e é reposta do baralho.
 * Quando o baralho acaba, o descarte é embaralhado de novo (também pela semente) e volta: toda carta pode ser jogada
 * mais de uma vez na partida, mas só depois de as outras passarem pela mão.
 */
public final class EsporteMao {
    public static final int TAMANHO = 5;
    private final Contexto contexto;
    private final List<UUID> baralho;
    private final List<UUID> mao = new ArrayList<>();
    private final List<UUID> descarte = new ArrayList<>();
    private int voltas;

    public EsporteMao(Contexto contexto, Collection<UUID> noUniforme) {
        this.contexto = contexto;
        baralho = new ArrayList<>(contexto.deck().keySet().stream().filter(id -> !noUniforme.contains(id)).toList());
        baralho.sort(Comparator.comparing(UUID::toString));
        Collections.shuffle(baralho, contexto.sorteio("baralho"));
        while (mao.size() < TAMANHO && !baralho.isEmpty()) {
            mao.add(baralho.remove(0));
        }
    }

    /** Joga a carta da mão (422 CARTA_FORA_DA_MAO se ela não está lá) e repõe a mão. */
    public void jogar(UUID carta) {
        if (!mao.remove(carta)) {
            throw Flair3dErros.invalido("CARTA_FORA_DA_MAO", "carta_fora_da_mao");
        }
        descarte.add(carta);
        if (baralho.isEmpty()) {
            voltas++;
            baralho.addAll(descarte);
            descarte.clear();
            Collections.shuffle(baralho, contexto.sorteio("baralho" + voltas));
        }
        mao.add(baralho.remove(0));
    }

    public List<UUID> cartas() {
        return List.copyOf(mao);
    }

    /** Quantas cartas ainda estão no baralho, fora da mão. */
    public int noBaralho() {
        return baralho.size();
    }
}
