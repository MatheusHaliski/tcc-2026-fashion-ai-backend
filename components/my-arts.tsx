'use client';
import Link from 'next/link';
import {api} from '@/lib/api/client';
import {useApi} from '@/lib/hooks/use-api';
import {useI18n} from '@/lib/i18n/i18n';
import {EmptyState,ErrorState,Skeleton} from '@/components/ui';
interface License{id:string;presetCode:string;pricePaid:number;kind:'ISSUER_LICENSE';preset?:{name:string;family:string}}
export function MyArts(){
 const {t}=useI18n();const query=useApi<License[]>((signal)=>api.get('/api/me/arts',{signal}),[]);
 if(query.loading)return <Skeleton className="h-48"/>;
 if(query.error)return <ErrorState error={query.error} onRetry={query.reload}/>;
 return <section className="grid gap-4"><p className="type-body">{t('myArts.issuerHint')}</p><Link href="/arts-store" className="btn btn-primary">{t('myArts.store')}</Link>{!query.data?.length?<EmptyState title={t('myArts.empty')}/>:<div className="opt-grid">{query.data.map(license=><article key={license.id} className="surface p-4"><h3 className="type-heading">{license.preset?.name??license.presetCode}</h3><p className="type-caption">{t('myArts.issuerLicense')}</p><p className="type-body-sm">{license.pricePaid} {t("nav.points")}</p></article>)}</div>}</section>;
}
