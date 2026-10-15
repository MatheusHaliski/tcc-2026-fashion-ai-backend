import { describe,it,expect } from 'vitest';
import { fashionPreset } from './aura-fashion';
import { resolveCardArt } from './card-art';
import { borderStyle } from './card-border';
const preset={id:'satin-ivory',name:'Cetim editorial',family:'COMMON',image:'/aura/fashion-curated/satin-ivory.webp',palette:['#dcc7a5','#faf1e1']};
describe('curated fashion assets',()=>{
 it('resolves saved studio art and coherent border',()=>{
  expect(fashionPreset(preset)).toEqual(preset);
  expect(resolveCardArt({compositionPreset:preset}).image).toBe(preset.image);
  expect(resolveCardArt({scheme:{compositionPreset:preset}}).image).toBe(preset.image);
  expect(borderStyle({compositionPreset:preset})).toHaveProperty('--card-border-glow',preset.palette[0]);
 });
 it('rejects external URLs, traversal, executable images and invalid palette',()=>{
  for(const image of ['https://example.com/x.png','/aura/fashion-curated/../x.webp','/aura/fashion-curated/satin-ivory.svg']) expect(fashionPreset({...preset,image})).toBeNull();
  expect(fashionPreset({...preset,palette:['red','blue']})).toBeNull();
 });
 it('keeps a manually uploaded artwork above the preset',()=>expect(resolveCardArt({compositionPreset:preset,uploadUrl:'/my-photo.png'}).kind).toBe('upload'));
});

it('aceita MP4 local com pôster e recusa vídeo externo',()=>{
 const animated={...preset,video:'/aura/fashion-curated/satin-ivory.mp4'};
 expect(resolveCardArt({compositionPreset:animated}).video).toMatchObject({src:animated.video,poster:preset.image});
 expect(fashionPreset({...animated,video:'https://example.com/a.mp4'})).toBeNull();
});
