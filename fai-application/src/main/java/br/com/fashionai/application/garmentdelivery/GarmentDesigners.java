package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.atelierproject.AtelierAccountDataCleanup;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.garmentdelivery.GarmentDeliveryViews.Designer;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.atelierproject.DesignProject;
import br.com.fashionai.domain.model.atelierproject.DesignProjectMember;
import br.com.fashionai.domain.model.atelierproject.DesignRevision;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.atelierproject.DesignProjectMemberRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Créditos de design da encomenda: dona do projeto, editores aceitos e autor da revisão, com o nome de cada conta. */
final class GarmentDesigners {
    private final DesignProjectMemberRepository members;
    private final UserRepository users;

    GarmentDesigners(DesignProjectMemberRepository members, UserRepository users) {
        this.members = members;
        this.users = users;
    }

    List<Designer> of(DesignProject project, DesignRevision revision) {
        List<Designer> out = new ArrayList<>();
        out.add(new Designer(project.getOwnerId(), null, "OWNER"));
        for (DesignProjectMember m : members.findByProjectIdOrderByCreatedAtAsc(project.getId())) {
            if (m.getStatus() == DesignProjectMember.Status.ACCEPTED && m.getRole() == DesignProjectMember.Role.EDITOR) {
                out.add(new Designer(m.getUserId(), null, "EDITOR"));
            }
        }
        UUID author = revision.getAuthorId();
        if (!AtelierAccountDataCleanup.ANONYMOUS_AUTHOR.equals(author) && out.stream().noneMatch(d -> d.userId().equals(author))) {
            out.add(new Designer(author, null, "REVISION_AUTHOR"));
        }
        return out;
    }

    String username(UUID id) {
        return users.findById(id).filter(u -> u.getStatus() != AccountStatus.DELETED).map(User::getUsername)
                .orElse(Msg.t("account.conta_excluida"));
    }
}
