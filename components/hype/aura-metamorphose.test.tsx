// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, renderApp } from '@/test-utils/render';
import { AuraMetamorphose } from './aura-metamorphose';
afterEach(cleanup);
it.each(['PRISMA','CONSTELACAO','FIO_VIVO','HOLOGRAFIA'])('renderiza o modo %s sem substituir foto',mode=>{
 const {container}=renderApp(<div><img src="photo.jpg" alt="Peça"/><AuraMetamorphose mode={mode}/></div>);
 expect(container.querySelector('.aura-metamorphose')?.getAttribute('data-effect')).toBe(mode);
 expect(container.querySelector('img')?.getAttribute('src')).toBe('photo.jpg');
});
it.each(['OFF','invalid'])('não aplica %s',mode=>{
 const {container}=renderApp(<AuraMetamorphose mode={mode}/>);
 expect(container.querySelector('.aura-metamorphose')).toBeNull();
});
it.each([
 ['PRISMA','NIKE_ORANGE'],
 ['FIO_VIVO','ADIDAS_BLUE'],
 ['HOLOGRAFIA','ASICS_WHITE'],
])('aplica o preset visual %s sem alterar a fotografia', (mode,presetId)=>{
 const {container}=renderApp(<div><img src="photo.jpg" alt="Peça"/><AuraMetamorphose mode={mode} presetId={presetId}/></div>);
 expect(container.querySelector(`.aura-metamorphose[data-brand-preset="${presetId}"]`)).toBeTruthy();
 expect(container.querySelector('img')?.getAttribute('src')).toBe('photo.jpg');
});
