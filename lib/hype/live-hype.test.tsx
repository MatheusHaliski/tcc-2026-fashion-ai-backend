// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { api } from '@/lib/api/client';
import { __resetHypeStore, primeHype, useHypeSummary } from './use-hype';
import type { HypeSummary } from './types';
const summary=(score:number)=>({status:'AVAILABLE',score,level:'HOT',stale:false}) as HypeSummary;
beforeEach(()=>{__resetHypeStore();vi.useFakeTimers();});
afterEach(()=>{cleanup();__resetHypeStore();vi.restoreAllMocks();vi.useRealTimers();});
it('agrupa atualizações ao vivo de dois cards em uma consulta e preserva o score anterior até a resposta',async()=>{
 primeHype('PIECE',{p1:summary(50),p2:summary(60)});
 const get=vi.spyOn(api,'get').mockResolvedValue({items:{p1:summary(55),p2:summary(61)}});
 const one=renderHook(()=>useHypeSummary('PIECE','p1',true,true));
 const two=renderHook(()=>useHypeSummary('PIECE','p2',true,true));
 expect(one.result.current.summary?.score).toBe(50);
 await act(async()=>{await vi.advanceTimersByTimeAsync(30_001);});
 expect(get).toHaveBeenCalledTimes(1);
 expect(String(get.mock.calls[0][0])).toContain('ids=p1,p2');
 expect(one.result.current.summary?.score).toBe(55);
 expect(two.result.current.summary?.score).toBe(61);
});
it('encerra o polling quando nenhum card ativo solicita atualização ao vivo',async()=>{
 primeHype('PIECE',{p1:summary(50)});
 const get=vi.spyOn(api,'get').mockResolvedValue({items:{}});
 const hook=renderHook(()=>useHypeSummary('PIECE','p1',true,true));
 hook.unmount();
 await act(async()=>{await vi.advanceTimersByTimeAsync(60_000);});
 expect(get).not.toHaveBeenCalled();
});
it('não troca o score por um snapshot mais antigo que chegou fora de ordem',()=>{
 primeHype('PIECE',{p1:{...summary(80),calculatedAt:'2026-10-14T12:00:00Z'}});
 const hook=renderHook(()=>useHypeSummary('PIECE','p1',false));
 act(()=>primeHype('PIECE',{p1:{...summary(50),calculatedAt:'2026-10-14T11:00:00Z'}}));
 expect(hook.result.current.summary?.score).toBe(80);
});
