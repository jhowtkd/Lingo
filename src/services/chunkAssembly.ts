/**
 * Remontagem PURA de coleções chunked do Firestore. Módulo sem imports de
 * firebase para ser testável em Node (tests/chunkAssembly.test.ts).
 */

export interface ChunkDocEntry {
  id: string;
  data: { items?: unknown[]; updatedAt?: string; chunkIndex?: number; totalChunks?: number };
}

export interface ReassembledCollection {
  items: unknown[] | null;
  updatedAt?: string;
}

// Sufixo numérico de um chunk (`{colecao}_{i}`), ex.: id "nodes_12" -> 12.
const NUMERIC_SUFFIX_RE = /^\d+$/;

/**
 * Remonta uma coleção chunked a partir dos docs lidos, considerando apenas a
 * geração mais recente (todos os chunks de uma escrita compartilham o mesmo
 * updatedAt). Chunks de gerações antigas — órfãos deixados por outro
 * dispositivo com contagem desatualizada — são ignorados.
 * Retorna items null quando não há nenhum chunk da coleção.
 */
export function reassembleChunkedCollection(
  name: string,
  entries: ChunkDocEntry[]
): ReassembledCollection {
  // Seleciona apenas os docs que pertencem a esta coleção (`${name}_${i}`).
  const matching: Array<{ index: number; stamp: string; items: unknown[] }> = [];
  const prefix = `${name}_`;

  for (const entry of entries) {
    if (!entry.id.startsWith(prefix)) continue;
    const suffix = entry.id.slice(prefix.length);
    if (!NUMERIC_SUFFIX_RE.test(suffix)) continue;

    const stamp = typeof entry.data.updatedAt === 'string' ? entry.data.updatedAt : '';
    matching.push({
      index: Number(suffix),
      stamp,
      items: Array.isArray(entry.data.items) ? entry.data.items : [],
    });
  }

  if (matching.length === 0) return { items: null };

  // Carimbo mais recente da coleção (strings ISO comparam lexicograficamente).
  let maxStamp = '';
  for (const m of matching) {
    if (m.stamp > maxStamp) maxStamp = m.stamp;
  }

  // Mantém SÓ os chunks da geração mais recente: misturar gerações propagaria
  // itens obsoletos como se fossem atuais (corrupção auto-replicante no sync).
  const currentGeneration = matching.filter((m) => m.stamp === maxStamp);
  currentGeneration.sort((a, b) => a.index - b.index);

  return {
    items: currentGeneration.flatMap((m) => m.items),
    updatedAt: maxStamp || undefined,
  };
}
