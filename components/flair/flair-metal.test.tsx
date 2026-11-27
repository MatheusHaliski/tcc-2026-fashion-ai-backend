// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen } from "@/test-utils/render";
import { FlairGameCard, type FlairCollectionCard, type FlairTier } from "./flair-game-card";
const base: FlairCollectionCard = { id:'test',originType:'PIECE',originId:'p',season:'SPRING',tier:'BRONZE',ovr:62,rare:false,position:'SUP',name:'Camisa teste',priceVerified:true,state:'AVAILABLE',tradeable:true,acquiredVia:'GENERATED',stats:{EDGE:61,RANGE:47,CLOUT:39,GLOW:72,ART:54,SYNC:69},hype:{POP:12,ENG:47,HYP:39} };
afterEach(cleanup);
describe('carta de jogo com metal e LED', () => {
  it.each(['BRONZE','PRATA','OURO'] as FlairTier[])('mantém OVR e atributos em %s sem criar score Hype ausente', tier => {
    loggedAs();const { container } = renderApp(<FlairGameCard card={{...base,tier}} />);
    expect(container.querySelector(`.flair-piece-card.tier-${tier.toLowerCase()}`)).toBeTruthy();
    expect(container.querySelector('.fpc-art .fpc-art-light')).toBeTruthy();
    expect(container.querySelector('.fpc-ovr .led-number')?.textContent).toBe('62');
    expect(container.querySelector('.aura-hype')).toBeNull();
    // aba Hype (inicial): só o que o snapshot tem; o resto "—", nunca um score inventado
    const hype=[...container.querySelectorAll('.fashion-hype-cell')].map(el=>`${el.getAttribute('data-dimension')}=${el.querySelector('dd')?.textContent}`);
    expect(hype).toEqual(['POPULARITY=12','ENGAGEMENT=47','TREND=—','TREND_VELOCITY=—','ORIGINALITY=—','RARITY=—','LONGEVITY=—','NOVELTY=—']);
    fireEvent.click(screen.getByRole('tab',{name:/Info/}));
    expect(container.querySelectorAll('.fpc-stat b')).toHaveLength(6);
    const stats=[...container.querySelectorAll('.fpc-stat b')].map(el=>el.textContent);
    expect(stats).toEqual(['61','47','39','72','54','69']);
  });
});
