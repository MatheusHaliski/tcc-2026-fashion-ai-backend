// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { usePieceSeals } from "./use-piece-seals";

const state=vi.hoisted(()=>({user:{id:"viewer-a"} as {id:string}|null,get:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({useAuth:()=>({user:state.user}),useAuthReady:()=>true}));
vi.mock("@/lib/api/client",async original=>({...await original<typeof import("@/lib/api/client")>(),api:{get:state.get}}));
const seal=(name:string)=>({tier:"PECA",owner:"marca",premium:false,name});
beforeEach(()=>{state.user={id:"viewer-a"};state.get.mockReset();state.get.mockImplementation(async(path:string)=>({items:Object.fromEntries(new URL(path,"http://test").searchParams.get("ids")!.split(",").map(id=>[id,[seal(id)]]))}));});
afterEach(()=>{cleanup();vi.restoreAllMocks();});

it("loads more than sixty pieces in bounded batches and appending a page does not refetch completed ids",async()=>{
 const pieces=Array.from({length:65},(_,i)=>({id:`p${i}`}));
 const {result,rerender}=renderHook(({rows})=>usePieceSeals(rows),{initialProps:{rows:pieces.slice(0,60)}});
 await waitFor(()=>expect(result.current("p59")[0]?.name).toBe("p59"));
 rerender({rows:[...pieces,pieces[0]]});
 await waitFor(()=>expect(result.current("p64")[0]?.name).toBe("p64"));
 expect(state.get).toHaveBeenCalledTimes(2);
 const batches=state.get.mock.calls.map(([path])=>new URL(path,"http://test").searchParams.get("ids")!.split(","));
 expect(batches.map(ids=>ids.length)).toEqual([60,5]);expect(new Set(batches.flat()).size).toBe(65);
 rerender({rows:[...pieces]});await act(async()=>{});expect(state.get).toHaveBeenCalledTimes(2);
});

it("never retains badges from the previous viewer while the next viewer request is pending",async()=>{
 const {result,rerender}=renderHook(()=>usePieceSeals([{id:"p1"}]));
 await waitFor(()=>expect(result.current("p1")[0]?.name).toBe("p1"));
 let resolve:(value:unknown)=>void=()=>{};state.get.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 state.user={id:"viewer-b"};rerender();expect(result.current("p1")).toEqual([]);
 await act(async()=>resolve({items:{p1:[]}}));expect(result.current("p1")).toEqual([]);expect(state.get).toHaveBeenCalledTimes(2);
});

it("anonymous requests use public visibility and only returned approved ids gain badges",async()=>{
 state.get.mockResolvedValue({items:{p1:[seal("Marca autorizada")]}});
 const {result}=renderHook(()=>usePieceSeals([{id:"p1"},{id:"hidden"}],{anonymous:true}));
 await waitFor(()=>expect(result.current("p1")[0]?.name).toBe("Marca autorizada"));
 expect(state.get.mock.calls[0][1]).toMatchObject({anonymous:true});expect(result.current("hidden")).toEqual([]);expect(result.current("not-requested")).toEqual([]);
});

it("refreshes expired approved badges when the list regains focus",async()=>{
 const real=Date.now();vi.spyOn(Date,"now").mockReturnValue(real);
 const {result}=renderHook(()=>usePieceSeals([{id:"p1"}]));
 await waitFor(()=>expect(result.current("p1")[0]?.name).toBe("p1"));
 state.get.mockResolvedValue({items:{p1:[]}});vi.mocked(Date.now).mockReturnValue(real+60_001);
 await act(async()=>{window.dispatchEvent(new Event("focus"));});
 await waitFor(()=>expect(result.current("p1")).toEqual([]));expect(state.get).toHaveBeenCalledTimes(2);
});
