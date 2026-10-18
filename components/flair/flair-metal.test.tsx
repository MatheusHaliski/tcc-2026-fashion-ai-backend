// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, loggedAs, renderApp } from "@/test-utils/render";
import { FlairGameCard, type FlairCollectionCard, type FlairTier } from "./flair-game-card";
const base: FlairCollectionCard = { id:'test',originType:'PIECE',originId:'p',season:'SPRING',tier:'BRONZE',ovr:62,rare:false,position:'SUP',name:'Camisa teste',priceVerified:true,state:'AVAILABLE',tradeable:true,acquiredVia:'GENERATED',stats:{EDGE:61,RANGE:47,CLOUT:39,GLOW:72,ART:54,SYNC:69},hype:{POP:12,ENG:47,HYP:39} };
afterEach(cleanup);
describe('carta de jogo com metal e LED', () => {
  it.each(['BRONZE','PRATA','OURO'] as FlairTier[])('mantém OVR e atributos em %s sem criar score Hype ausente', tier => {
    loggedAs();const { container } = renderApp(<FlairGameCard card={{...base,tier}} />);
    expect(container.querySelector(`.fgc.tier-${tier.toLowerCase()}`)).toBeTruthy();
    expect(container.querySelector('.fgc-metal-light')).toBeTruthy();
    expect(container.querySelector('.fgc-ovr .led-number')?.textContent).toBe('62');
    expect(container.querySelectorAll('.fgc-hype dd')).toHaveLength(6);
    expect(container.querySelector('.aura-hype')).toBeNull();
    const stats=[...container.querySelectorAll('.fgc-hype dd')].map(el=>el.textContent);
    expect(stats).toEqual(['61','47','39','72','54','69']);
  });
});
