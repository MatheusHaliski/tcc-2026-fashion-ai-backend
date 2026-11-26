package br.com.fashionai.web.controller;

import br.com.fashionai.application.view.PieceReferenceViews;
import br.com.fashionai.application.view.Views.ReferenceOptionView;
import br.com.fashionai.domain.repository.OrigemRepository;
import org.springframework.beans.factory.annotation.Autowired;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class OrigemReferenceController {
    @Autowired
    private OrigemRepository origemRepository;

    @GetMapping("/origens")
    public List<ReferenceOptionView> getAllOrigens() {
        return origemRepository.findAllByOrderByCodigoAsc().stream()
                .map(PieceReferenceViews::origem)
                .toList();
    }
}
