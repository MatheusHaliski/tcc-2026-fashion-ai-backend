// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { CardBorder,HYPE_BORDER_PULSE_MS } from './card-border';
import { borderStyle } from '@/lib/card-border';
import { __resetHypeMemory } from '@/lib/hype/hype-memory';
import { __resetHypeSignals } from '@/lib/hype/hype-signal-store';
import { __resetHypeAnnouncer } from '@/lib/hype/hype-announcer';
// opção AURA Hype + permissão AURA_DYNAMIC já resolvidas (useAuraLive); a chave vem do entityId
const live={scope:'u1',key:'',enabled:true};
const score=(value:number)=>({kind:'available' as const,score:value,level:'HOT' as const,direction:'UP' as const,stale:false});
afterEach(()=>{cleanup();vi.useRealTimers();__resetHypeMemory();__resetHypeSignals();__resetHypeAnnouncer();localStorage.clear();});
describe('borda e atualização real de Hype',()=>{
 it('não pulsa no primeiro carregamento, mesmo com tendência antiga; ganha e perde temporariamente',()=>{
  vi.useFakeTimers();const {container,rerender}=render(<CardBorder background={{auraMetamorphose:"PRISMA"}} entityId="p1" auraHype live={live} hype={score(50)}/>);
  const pulse=()=>container.querySelector('.card-border')?.getAttribute('data-pulse');
  expect(pulse()).toBeNull();
  rerender(<CardBorder background={{auraMetamorphose:"PRISMA"}} entityId="p1" auraHype live={live} hype={score(55)}/>);expect(pulse()).toBe('up');
  expect(container.querySelector('.card-border-arrow')?.textContent).toBe('▲');
  act(()=>vi.advanceTimersByTime(HYPE_BORDER_PULSE_MS));expect(pulse()).toBeNull();
  rerender(<CardBorder background={{auraMetamorphose:"PRISMA"}} entityId="p1" auraHype live={live} hype={score(52)}/>);expect(pulse()).toBe('down');
  expect(container.querySelector('.card-border-arrow')?.textContent).toBe('▼');
  act(()=>vi.advanceTimersByTime(HYPE_BORDER_PULSE_MS));expect(pulse()).toBeNull();
 });
 it('não trata troca de peça, ativação de AURA ou score ausente como ganho de pontos',()=>{
  const {container,rerender}=render(<CardBorder background={{auraMetamorphose:"PRISMA"}} entityId="p1" hype={score(50)}/>);
  rerender(<CardBorder background={{auraMetamorphose:"PRISMA"}} entityId="p1" auraHype live={live} hype={score(60)}/>);
  expect(container.querySelector('[data-pulse]')).toBeNull();
  rerender(<CardBorder background={{auraMetamorphose:"PRISMA"}} entityId="p2" auraHype live={live} hype={score(90)}/>);
  expect(container.querySelector('[data-pulse]')).toBeNull();
  rerender(<CardBorder background={{auraMetamorphose:"PRISMA"}} entityId="p2" auraHype live={live} hype={{kind:'not_calculated'}}/>);
  rerender(<CardBorder background={{auraMetamorphose:"PRISMA"}} entityId="p2" auraHype live={live} hype={score(95)}/>);
  expect(container.querySelector('[data-pulse]')).toBeNull();
 });
 it('sem a opção ou sem a permissão AURA_DYNAMIC, nada pulsa',()=>{
  const off={...live,enabled:false};
  const {container,rerender}=render(<CardBorder entityId="p3" auraHype live={off} hype={score(40)}/>);
  rerender(<CardBorder entityId="p3" auraHype live={off} hype={score(70)}/>);
  expect(container.querySelector('[data-pulse]')).toBeNull();
 });
 it('preserva gradiente manual e usa a paleta de Metamorfose no modo automático',()=>{
  expect(borderStyle({border:{mode:'GRADIENT',from:'#123456',to:'#abcdef'}})).toMatchObject({'--card-border-paint':'linear-gradient(135deg,#123456,#abcdef)'});
  expect(borderStyle({auraHype:'XRAY'},true)).toMatchObject({'--card-border-paint':'linear-gradient(135deg,#b69bff,#81d5f3)'});
  expect(borderStyle({auraMetamorphose:'CONSTELACAO'})).toMatchObject({'--card-border-paint':'linear-gradient(135deg,#b5a6ff,#f1d5ff)'});
  expect(borderStyle({auraMetamorphose:'PRISMA',auraMetamorphosePreset:'NIKE_ORANGE'})).toMatchObject({'--card-border-paint':'linear-gradient(135deg,#f97316,#ffd08a)'});
 });
});
