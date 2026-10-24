// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,loggedAs,mockApi,renderApp,screen} from "@/test-utils/render";
import {nav} from "@/test-utils/setup";
import {PIECE,SCHEME} from "@/test-utils/fixtures";
import {SchemeCard,CardSealSummary} from "./scheme-card";
import SearchPage from "@/app/(site)/(app)/search/page";

// The catalogue card's visual rendering is independent of which search grid it enters.
vi.mock("@/components/catalog/catalog-search",()=>({CatalogResultCard:({product}:{product:{productName:string}})=><article>{product.productName}</article>}));

afterEach(()=>{cleanup();vi.unstubAllGlobals();nav.search=new URLSearchParams();document.cookie="fai_rt_h=; max-age=0; path=/";});

it.each([
 {compact:true,expanded:false,mode:"compact"},
 {compact:false,expanded:false,mode:"feed"},
 {compact:false,expanded:true,mode:"expanded"},
 {compact:true,expanded:true,mode:"expanded"},
])("keeps $mode scheme cards in their own sizing scope",({compact,expanded,mode})=>{
 mockApi({});const {container}=renderApp(<SchemeCard scheme={SCHEME} compact={compact} expanded={expanded} flip={false}/>);
 const card=container.querySelector("article.scheme-card")!;
 expect(card.getAttribute("data-card-mode")).toBe(mode);
 expect(card.classList.contains("scheme-card-social")).toBe(!expanded&&!compact);
 if(compact)expect(card.querySelector(".card-fashion-meta")).toBeNull();
});

it("announces only undisplayed awards in the overflow count",()=>{
 const seals=Array.from({length:5},(_,index)=>({label:`S${index}`,name:`Oficial ${index}`}));
 const {container}=renderApp(<CardSealSummary seals={seals}/>);
 const visible=container.querySelector('.seal-slot[role="img"]')!;
 const overflow=container.querySelector(".card-meta-more")!;
 expect(visible.getAttribute("aria-label")).toBe("selos: Oficial 0, Oficial 1, Oficial 2");
 expect(overflow.textContent).toBe("+2");
 expect(overflow.getAttribute("aria-label")).toBe("selos: Oficial 3, Oficial 4");
 expect(overflow.getAttribute("title")).toBe("Oficial 3 · Oficial 4");
});

it.each(["PECAS","LOOKS"])("opts %s results into the social post grid",async tab=>{
 nav.search=new URLSearchParams(`q=roupa&tab=${tab}`);
 loggedAs(undefined,{"GET /api/search":{results:tab==="PECAS"?[PIECE]:[SCHEME],nextCursor:null},"GET /api/pieces/seals":{items:{}}});
 renderApp(<SearchPage/>);
 const title=await screen.findByText(tab==="PECAS"?PIECE.name:SCHEME.title);
 expect(title.closest(".social-card-grid")).toBeTruthy();
});

it("keeps catalogue results in the shared catalogue grid without post width limits",async()=>{
 nav.search=new URLSearchParams("tab=ACERVO");
 loggedAs(undefined,{"GET /api/catalog/products":{items:[{id:"catalog-only",productName:"Produto do acervo"}],page:0,total:1,hasMore:false}});
 renderApp(<SearchPage/>);
 const title=await screen.findByText("Produto do acervo");
 expect(title.closest(".grid-cards.is-pieces")).toBeTruthy();
 expect(title.closest(".social-card-grid")).toBeNull();
});
