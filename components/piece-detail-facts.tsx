"use client";
import type {ReactNode} from "react";
import type {PieceView} from '@/lib/api/types';
import {label,CATEGORY_LABEL,subcategoryLabel} from '@/lib/api/taxonomy';
import {Price} from "@/components/price";
import {useI18n} from '@/lib/i18n/i18n';
import {sizeLabel} from './piece-snapshot';
/** Shared factual block for the published expanded card and its unsaved editor preview. */
export function PieceDetailFacts({piece}:{piece:PieceView}){
 const {t}=useI18n();
 const rows=([
  [t('common.category'),[CATEGORY_LABEL[piece.category],subcategoryLabel(piece.subcategory)].filter(Boolean).join(' · ')],
  [t('common.color'),label(piece.color)], [t('common.size'),sizeLabel(piece.size)],
  [t('common.material'),piece.material?label(piece.material.toLowerCase()):null],
  [t('common.occasion'),(piece.occasion??[]).map(label).join(' · ')],
  [t('common.style'),(piece.style??[]).map(label).join(' · ')],
  [t('common.price'),piece.price!=null&&!piece.forSale?<Price value={piece.price}/>:null],
 ] as [string,ReactNode][]).filter(([,v])=>v);
 return <dl className="c-facts">{rows.map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>;
}
