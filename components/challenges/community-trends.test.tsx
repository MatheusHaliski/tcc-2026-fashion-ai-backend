// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { CommunityTrends } from "./community-trends";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("shows community trends and filters one of several game types", async () => {
 const { calls }=loggedAs(undefined,{"GET /api/challenges/trends":{items:[{id:"t1",title:"Outono no bosque",description:"Reinterprete com tons terrosos",kind:"PASSA_O_LOOK",status:"PUBLISHED",author:{username:"marca",displayName:"Marca"}}],total:1}});
 renderApp(<CommunityTrends />); await screen.findByText("Outono no bosque");
 fireEvent.click(document.getElementById("trend-filter")!); fireEvent.click(screen.getByRole("option",{name:"Cor em comum"}));
 await waitFor(() => expect(calls.some(c=>c.path.includes("kind=COR_EM_COMUM"))).toBe(true));
 expect(screen.getByRole("link",{name:"Marca"}).getAttribute("href")).toBe("/u/marca");
});
it("creates a selected kind and publishes its saved draft", async () => {
 const {calls}=loggedAs(undefined,{"GET /api/challenges/trends":{items:[],total:0},"POST /api/challenges/trends":{id:"t2"},"POST /api/challenges/trends/t2/publish":{awardedPoints:20,pointsMessage:"20 Points"}});
 renderApp(<CommunityTrends />);fireEvent.click(screen.getByRole("button",{name:"Criar trend"}));
 fireEvent.click(document.getElementById("trend-kind")!); fireEvent.click(screen.getByRole("option",{name:"Reinterpretação"}));
 fireEvent.change(document.getElementById("trend-title")!,{target:{value:"Minha interpretação"}});
 fireEvent.change(document.getElementById("trend-description")!,{target:{value:"Use uma peça favorita"}});
 fireEvent.click(screen.getByRole("button",{name:"Publicar trend"}));
 await waitFor(()=>expect(calls.some(c=>c.path==="/api/challenges/trends/t2/publish")).toBe(true));
 expect(calls.find(c=>c.method==="POST" && c.path==="/api/challenges/trends")?.body).toMatchObject({kind:"REINTERPRETACAO",durationDays:7});
});
it("offers retry after list failure instead of showing a fake empty success",async()=>{
 loggedAs(undefined,{"GET /api/challenges/trends":new Response(JSON.stringify({status:503,message:"Offline"}),{status:503,headers:{"content-type":"application/json"}})}); renderApp(<CommunityTrends />); expect(await screen.findByRole("button",{name:/tentar de novo/i})).toBeTruthy();
});
