import { expect,it } from 'vitest';
import { ACERVO,acervoLook } from './acervo';
import { isBundledGarmentPhoto } from './reference-photo';
it('recognizes every packaged reference photograph by its exact loaded path',()=>{
 for(const p of ACERVO)expect(isBundledGarmentPhoto(acervoLook(p).imageUrl),p.subcategory).toBe(true);
});
it('never trusts a user upload, a remote fallback or an image-like id as a verified reference',()=>{
 for(const url of [null,undefined,'/media/person.png','https://other.example/_derived/pecas_thumb/02_parte_inferior_04_calca_cargo-640.webp','/_derived/pecas_thumb/unknown-640.webp','/fai-padrao-upper','/_derived/pecas_thumb/02_parte_inferior_04_calca_cargo-640.webp?user-photo=1'])expect(isBundledGarmentPhoto(url)).toBe(false);
});
