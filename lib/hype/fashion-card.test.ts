import {expect,it} from 'vitest';
import {fashionCardLevel,confirmedEdition,fashionMetric} from './fashion-card';
import type {HypeSummary} from './types';
it('uses confirmed server level without deriving it from global score',()=>{
 expect(fashionCardLevel({status:'AVAILABLE',score:99})).toBeNull();
 expect(fashionCardLevel({status:'AVAILABLE',fashionCard:{status:'CLASSIFIED',tier:'COMMON',ruleVersion:1,source:'HYPE_SIGNALS'}})).toBe('COMMON');
});
it('rejects unverified Collab and impossible print numbers',()=>{
 const s:HypeSummary={status:'AVAILABLE',fashionCard:{status:'CLASSIFIED',tier:'COLLAB_DROP',ruleVersion:1,source:'HYPE_SIGNALS',edition:{serial:42,total:100,confirmed:true}}};
 expect(fashionCardLevel(s)).toBeNull();expect(confirmedEdition(s)).toBeNull();s.fashionCard!.source='VERIFIED_DROP';expect(fashionCardLevel(s)).toBe('COLLAB_DROP');expect(confirmedEdition(s)).toBe('#042/100');s.fashionCard!.edition!.serial=101;expect(confirmedEdition(s)).toBeNull();
});
it('verified drop survives pending Hype, without inventing score or attributes',()=>{
 expect(fashionCardLevel({status:'NOT_CALCULATED',fashionCard:{status:'CLASSIFIED',tier:'COLLAB_DROP',ruleVersion:1,source:'VERIFIED_DROP'}})).toBe('COLLAB_DROP');
 expect(fashionMetric(undefined)).toBeNull();expect(fashionMetric(Number.NaN)).toBeNull();expect(fashionMetric(101)).toBeNull();expect(fashionMetric(82.3)).toBe(82);
});
