import { digitalPassportApi, type SizeOptions } from '@/lib/passport/digital';
import type { FittingItem } from '@/lib/tryon/fitting-room';

/**
 * RF — tamanho CA9/CA10: ao reabrir uma prova salva, o tamanho escolhido é mantido; se a opção salva deixou de estar
 * disponível na loja, a peça volta sem tamanho e a pessoa é avisada para escolher de novo.
 */
export interface SizeCheck { items: FittingItem[]; unavailable: { name: string; size: string }[] }

export async function validateSavedSizes(items: FittingItem[], fetchOptions: (productId: string) => Promise<SizeOptions> = (id) => digitalPassportApi.productSizes(id)): Promise<SizeCheck> {
  const unavailable: { name: string; size: string }[] = [];
  const next = await Promise.all(items.map(async (item) => {
    if (!item.productId || !item.size) return item;
    try {
      const options = await fetchOptions(item.productId);
      const row = options.sizes.find((size) => size.label === item.size);
      if (row && row.availability === 'UNAVAILABLE') { unavailable.push({ name: item.name, size: item.size }); return { ...item, size: null }; }
    } catch { /* sem resposta da loja: mantém a escolha salva */ }
    return item;
  }));
  return { items: next, unavailable };
}
