// @vitest-environment jsdom
/** List/API contract tests. The card stub exposes forwarded approved badges;
 * the real medallion rendering is covered by cards/Lookbook tests and browser verification. */
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import { PIECE, PIECE_2, SCHEME, OWNER, page } from "@/test-utils/fixtures";
import type { PieceView } from "@/lib/api/types";
import type { SealBadge } from "@/components/scheme-card";
import SearchPage from "@/app/(site)/(app)/search/page";
import FeedPage from "@/app/(site)/(app)/feed/page";
import { LookbookTabs } from "@/components/lookbook-tabs";

vi.mock("@/components/piece-card",()=>({PieceCard:({piece,seals=[]}:{piece:PieceView;seals?:SealBadge[]})=><article aria-label={piece.name}>{piece.name}{seals.map((badge,i)=><span key={i}>{badge.name}</span>)}</article>}));
const pieces=[{...PIECE,seals:["SUSTAINABLE"]},PIECE_2];
const badges={items:{p1:[{tier:"PECA",owner:"marca",premium:false,name:"Marca aprovada",linkedPieceIds:["p1"]}],p2:[]}};
const base={"GET /api/pieces/seals":badges};
const overview={owner:OWNER,self:true,visible:true,institutional:false,tabs:[]};
afterEach(()=>{cleanup();vi.unstubAllGlobals();nav.search=new URLSearchParams();});
const verify=async(calls:{path:string}[])=>{
 expect(await screen.findByText("Marca aprovada")).toBeTruthy();
 expect(screen.queryByText("SUSTAINABLE")).toBeNull();
 await waitFor(()=>expect(calls.filter(c=>c.path.startsWith("/api/pieces/seals"))).toHaveLength(1));
 expect(calls.find(c=>c.path.startsWith("/api/pieces/seals"))!.path).toBe("/api/pieces/seals?ids=p1,p2");
};

it("search piece results forward approved batch badges, not garment sustainability tags",async()=>{
 nav.search=new URLSearchParams("q=roupa&tab=PECAS");
 const api=loggedAs(undefined,{...base,"GET /api/search":{results:pieces,nextCursor:null}});
 renderApp(<SearchPage/>);await verify(api.calls);
});

it("mixed feed posts load approved piece badges in one request",async()=>{
 const api=loggedAs(undefined,{...base,"GET /api/feed":{items:[],entries:pieces.map(piece=>({kind:"PIECE",id:piece.id,piece})),nextCursor:null}});
 renderApp(<FeedPage/>);await verify(api.calls);
});

it.each(["publications","favorites","saved"] as const)("profile %s forwards approved piece badges",async tab=>{
 const api=loggedAs(undefined,{...base,"GET /api/users/u1/lookbook":overview,
  "GET /api/users/u1/publications":page(pieces.map(piece=>({type:"PIECE",piece,at:piece.createdAt}))),
  "GET /api/users/u1/favorites":{pieces,looks:[]},
  "GET /api/me/saved-pieces":page(pieces.map(piece=>({piece}))),
 });
 renderApp(<LookbookTabs ownerId="u1" initialTab={tab} initialSaved="pieces"/>);await verify(api.calls);
});

it.each(["BENTO", "PASSARELA"] as const)("profile publications retain the social summary and official awards for %s looks", async layoutAnatomy => {
 const scheme={...SCHEME,layoutAnatomy,sealBadges:[{tier:"LOOK",owner:"marca",premium:false,name:"Look aprovado",design:{kind:"FASHIONAI" as const,mode:"TEMPLATE" as const,template:"fai/01"}}]};
 loggedAs(undefined,{"GET /api/users/u1/lookbook":overview,
  "GET /api/users/u1/publications":page([{type:"LOOK",scheme,at:scheme.createdAt}]),
  "GET /api/hype/summaries":{items:{}},
 });
 const {container}=renderApp(<LookbookTabs ownerId="u1" initialTab="publications"/>);
 await screen.findByText(scheme.title);
 const card=container.querySelector("article.scheme-card")!;
 expect(card.classList.contains("is-compact")).toBe(false);
 const meta=card.querySelector(".card-fashion-meta")!;
 expect([...meta.querySelectorAll("dt")].map(e=>e.textContent)).toEqual(["Marca","Cor","Ocasião","Estilo"]);
 expect(meta.textContent).toContain("Nike");expect(meta.textContent).toContain("Trabalho");
 expect(card.querySelector('.card-seals .seal-medallion[title="Look aprovado · @marca · LOOK"]')).toBeTruthy();
});
