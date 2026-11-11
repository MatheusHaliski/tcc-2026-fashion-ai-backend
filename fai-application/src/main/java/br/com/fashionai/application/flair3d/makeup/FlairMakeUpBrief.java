package br.com.fashionai.application.flair3d.makeup;

import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Resultado;

import java.util.List;

/**
 * FLAIR 3D MAKE UP — um brief (Strategy, docs/refactoring/gof/R90-flair3d-nucleos.md): o nível mínimo da carreira, as
 * regras (25 cada) e a pontuação de cartas vestidas e maquiagem. A nota nunca usa pele nem rosto.
 */
public interface FlairMakeUpBrief {
    double POR_REGRA = 25;

    String codigo();

    int nivelMin();

    List<Definicao.Regra> regras();

    Resultado pontuar(Entrega entrega, Contexto contexto);
}
