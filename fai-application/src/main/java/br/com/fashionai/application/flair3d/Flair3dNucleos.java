package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair3d.nucleos.AroundTheWorldNucleo;
import br.com.fashionai.application.flair3d.nucleos.BatalhaLooksNucleo;
import br.com.fashionai.application.flair3d.nucleos.Boutique3dNucleo;
import br.com.fashionai.application.flair3d.nucleos.ClubeCoracaoNucleo;
import br.com.fashionai.application.flair3d.nucleos.DressFighterNucleo;
import br.com.fashionai.application.flair3d.nucleos.DressTheStarNucleo;
import br.com.fashionai.application.flair3d.nucleos.FashionDetectiveNucleo;
import br.com.fashionai.application.flair3d.nucleos.FashionSportsNucleo;
import br.com.fashionai.application.flair3d.nucleos.FavoriteSingerNucleo;
import br.com.fashionai.application.flair3d.nucleos.LabirintoNucleo;
import br.com.fashionai.application.flair3d.nucleos.PassarelaNucleo;
import br.com.fashionai.application.flair3d.nucleos.PersonagemFilmeNucleo;
import br.com.fashionai.application.flair3d.nucleos.PilotoFavoritoNucleo;
import br.com.fashionai.application.flair3d.nucleos.RoadToGloryNucleo;
import br.com.fashionai.application.flair3d.nucleos.SuperHeroiNucleo;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/** Os 15 núcleos do FLAIR 3D, por número (o conjunto de estratégias que o {@link Flair3dNucleoService} escolhe pelo código). */
public final class Flair3dNucleos {
    /**
     * Passarela, Dress the Star, Boutique e Around the World terminam com a jogada de cena ({@link Flair3dJogadaDeCena});
     * os doze jogos de ação jogável, com a execução no percurso ({@link Flair3dExecucao}). Dress Fighter, Fashion
     * Detective e Fashion Sports têm a habilidade dentro do próprio motor.
     */
    public static final List<Flair3dNucleo> TODOS = List.of(exec(new Flair3dJogadaDeCena(new PassarelaNucleo())), new DressFighterNucleo(),
            exec(new Flair3dJogadaDeCena(new DressTheStarNucleo())), exec(new PersonagemFilmeNucleo()), exec(new RoadToGloryNucleo()),
            new FashionDetectiveNucleo(), exec(new Flair3dJogadaDeCena(new Boutique3dNucleo())), exec(new ClubeCoracaoNucleo()),
            exec(new FavoriteSingerNucleo()), exec(new LabirintoNucleo()), exec(new PilotoFavoritoNucleo()),
            exec(new Flair3dJogadaDeCena(new AroundTheWorldNucleo())), exec(new SuperHeroiNucleo()), new FashionSportsNucleo(),
            exec(new BatalhaLooksNucleo()));

    private static Flair3dNucleo exec(Flair3dNucleo jogo) {
        return new Flair3dExecucao(jogo);
    }

    private Flair3dNucleos() {
    }

    public static Optional<Flair3dNucleo> porCodigo(String codigo) {
        String c = codigo == null ? "" : codigo.trim().toUpperCase(Locale.ROOT);
        return TODOS.stream().filter(n -> n.codigo().equals(c)).findFirst();
    }
}
