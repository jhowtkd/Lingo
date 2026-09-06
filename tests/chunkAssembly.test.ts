import { describe, expect, it } from 'vitest';
import { reassembleChunkedCollection, type ChunkDocEntry } from '../src/services/chunkAssembly';

function chunk(
  id: string,
  items: unknown[],
  updatedAt: string,
  extras: Partial<ChunkDocEntry['data']> = {}
): ChunkDocEntry {
  return {
    id,
    data: { items, updatedAt, ...extras },
  };
}

describe('reassembleChunkedCollection', () => {
  it('ignora chunks órfãos de geração antiga e mantém só a geração mais recente', () => {
    // Reprodução do bug: device B gravou 3 chunks (750 itens) numa geração
    // antiga; device A, com contagem de chunks desatualizada, reescreveu só
    // nodes_0 (100 itens, geração nova) sem poder apagar os órfãos
    // nodes_1/nodes_2. A remontagem NÃO pode misturar as gerações.
    const entries = [
      chunk('nodes_0', Array.from({ length: 100 }, (_, i) => `n${i}`), '2026-02-02T00:00:00.000Z', {
        chunkIndex: 0,
        totalChunks: 1,
      }),
      chunk('nodes_1', Array.from({ length: 250 }, (_, i) => `stale${i}`), '2026-01-01T00:00:00.000Z', {
        chunkIndex: 1,
        totalChunks: 3,
      }),
      chunk('nodes_2', Array.from({ length: 250 }, (_, i) => `stale${i}`), '2026-01-01T00:00:00.000Z', {
        chunkIndex: 2,
        totalChunks: 3,
      }),
    ];

    const result = reassembleChunkedCollection('nodes', entries);

    expect(result.items).toHaveLength(100);
    expect(result.items).toEqual(Array.from({ length: 100 }, (_, i) => `n${i}`));
    expect(result.updatedAt).toBe('2026-02-02T00:00:00.000Z');
  });

  it('concatena chunks da mesma geração em ordem de índice', () => {
    // Chunks chegam em qualquer ordem (getDocs não garante ordenação).
    const entries = [
      chunk('materials_1', ['d', 'e', 'f'], '2026-03-01T00:00:00.000Z', { chunkIndex: 1, totalChunks: 2 }),
      chunk('materials_0', ['a', 'b', 'c'], '2026-03-01T00:00:00.000Z', { chunkIndex: 0, totalChunks: 2 }),
    ];

    const result = reassembleChunkedCollection('materials', entries);

    expect(result.items).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(result.updatedAt).toBe('2026-03-01T00:00:00.000Z');
  });

  it('retorna items null quando não há chunk da coleção', () => {
    const entries: ChunkDocEntry[] = [
      chunk('nodes_0', ['x'], '2026-01-01T00:00:00.000Z', { chunkIndex: 0, totalChunks: 1 }),
      // Doc legado da mesma coleção sem chunks: não casa com o prefixo.
      { id: 'relations', data: { items: ['legado'], updatedAt: '2026-01-01T00:00:00.000Z' } },
    ];

    expect(reassembleChunkedCollection('relations', entries)).toEqual({ items: null });
    expect(reassembleChunkedCollection('relations', [])).toEqual({ items: null });
  });

  it('quando uma geração de 1 chunk antiga convive com uma de 2 chunks mais nova, só a nova sobrevive', () => {
    // Geração antiga de 1 chunk (leitura defasada/snapshot antigo) e geração
    // nova de 2 chunks sobre o mesmo id base: o filtro de carimbo máximo
    // elimina a geração antiga inteira, sem duplicar itens.
    const entries = [
      chunk('conversations_0', ['antiga1', 'antiga2'], '2026-01-10T00:00:00.000Z', {
        chunkIndex: 0,
        totalChunks: 1,
      }),
      chunk('conversations_0', ['nova1', 'nova2'], '2026-02-05T00:00:00.000Z', {
        chunkIndex: 0,
        totalChunks: 2,
      }),
      chunk('conversations_1', ['nova3'], '2026-02-05T00:00:00.000Z', {
        chunkIndex: 1,
        totalChunks: 2,
      }),
    ];

    const result = reassembleChunkedCollection('conversations', entries);

    expect(result.items).toEqual(['nova1', 'nova2', 'nova3']);
    expect(result.updatedAt).toBe('2026-02-05T00:00:00.000Z');
  });

  it('trata chunk sem items como lista vazia da geração atual', () => {
    const entries: ChunkDocEntry[] = [
      chunk('corrections_0', ['a'], '2026-02-01T00:00:00.000Z', { chunkIndex: 0, totalChunks: 2 }),
      { id: 'corrections_1', data: { chunkIndex: 1, totalChunks: 2, updatedAt: '2026-02-01T00:00:00.000Z' } },
    ];

    const result = reassembleChunkedCollection('corrections', entries);

    expect(result.items).toEqual(['a']);
    expect(result.updatedAt).toBe('2026-02-01T00:00:00.000Z');
  });
});
