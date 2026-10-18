package br.com.fashionai.application.service;
import br.com.fashionai.application.ports.MediaStoragePort;
import org.junit.jupiter.api.Test;
import java.net.URI;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
class PrivateTryOnMediaScopeTest {
 @Test void privateScopeIsRestrictedToOwnersTryOnInputs(){
  var storage=mock(MediaStoragePort.class);var owner=UUID.randomUUID();
  when(storage.keyOf(anyString())).thenAnswer(i->Optional.of(i.getArgument(0,String.class)));
  when(storage.publicUrl(anyString())).thenAnswer(i->URI.create("/media/"+i.getArgument(0,String.class)));
  String key="restricted/users/"+owner+"/tryon/person/id/person.jpg";
  assertThat(MediaService.ownedMedia(storage,owner,key,Set.of(MediaService.MediaScope.PRIVATE_TRY_ON))).isPresent();
  assertThat(MediaService.ownedMedia(storage,UUID.randomUUID(),key,Set.of(MediaService.MediaScope.PRIVATE_TRY_ON))).isEmpty();
  assertThat(MediaService.ownedMedia(storage,owner,key,Set.of(MediaService.MediaScope.OWNER))).isEmpty();
  assertThat(MediaService.ownedMedia(storage,owner,"restricted/users/"+owner+"/avatar3d/face.jpg",Set.of(MediaService.MediaScope.PRIVATE_TRY_ON))).isEmpty();
 }
}
