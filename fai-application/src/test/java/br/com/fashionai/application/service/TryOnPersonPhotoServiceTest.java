package br.com.fashionai.application.service;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.*;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.Test;
import java.awt.image.BufferedImage;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
class TryOnPersonPhotoServiceTest {
 final MediaService media=mock(MediaService.class);final UserRepository users=mock(UserRepository.class);final Guard guard=mock(Guard.class);
 final TryOnPersonPhotoService service=new TryOnPersonPhotoService(media,users,guard);
 final CurrentUser user=new CurrentUser(UUID.randomUUID(),"test","USER",ProfileType.PESSOAL,true,AccountStatus.ACTIVE,null,null);
 @Test void rejectsSmallPhotoBeforeStorage(){byte[] image=ImageOps.png(new BufferedImage(32,32,BufferedImage.TYPE_INT_RGB));assertThatThrownBy(()->service.upload(user,image)).isInstanceOfSatisfying(ApiException.class,e->assertThat(e.code()).isEqualTo("VTON_IMAGE_SMALL"));verifyNoInteractions(media);}
 @Test void rejectsNonImageBeforeStorage(){assertThatThrownBy(()->service.upload(user,new byte[32])).isInstanceOf(ApiException.class);verifyNoInteractions(media);}
 @Test void storesOwnedOriginalAndBoundedDerivativeWithoutGpu(){var owner=new User();owner.assignId(user.id());when(users.findById(user.id())).thenReturn(Optional.of(owner));when(media.put(anyString(),any(),anyString())).thenAnswer(i->new MediaStoragePort.StoredObject(i.getArgument(0),"/media/"+i.getArgument(0),((byte[])i.getArgument(1)).length,i.getArgument(2)));byte[] image=ImageOps.png(new BufferedImage(300,600,BufferedImage.TYPE_INT_RGB));var result=service.upload(user,image);assertThat(result).containsEntry("width",300).containsEntry("height",600);assertThat(result.get("url").toString()).startsWith("/media/restricted/users/"+user.id()+"/tryon/person/");verify(media,times(2)).put(anyString(),any(),anyString());}
}
