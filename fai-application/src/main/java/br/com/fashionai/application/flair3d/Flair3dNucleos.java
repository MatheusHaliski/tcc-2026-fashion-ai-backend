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
    /** Passarela, Dress the Star, Boutique e Around the World terminam com a jogada de cena ({@link Flair3dJogadaDeCena}). */
    public static final List<Flair3dNucleo> TODOS = List.of(new Flair3dJogadaDeCena(new PassarelaNucleo()), new DressFighterNucleo(),
            new Flair3dJogadaDeCena(new DressTheStarNucleo()), new PersonagemFilmeNucleo(), new RoadToGloryNucleo(), new FashionDetectiveNucleo(),
            new Flair3dJogadaDeCena(new Boutique3dNucleo()), new ClubeCoracaoNucleo(), new FavoriteSingerNucleo(), new LabirintoNucleo(),
            new PilotoFavoritoNucleo(), new Flair3dJogadaDeCena(new AroundTheWorldNucleo()), new SuperHeroiNucleo(), new FashionSportsNucleo(),
            new BatalhaLooksNucleo());

    private Flair3dNucleos() {
    }

    public static Optional<Flair3dNucleo> porCodigo(String codigo) {
        String c = codigo == null ? "" : codigo.trim().toUpperCase(Locale.ROOT);
        return TODOS.stream().filter(n -> n.codigo().equals(c)).findFirst();
    }
}
