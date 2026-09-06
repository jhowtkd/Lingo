import { beforeEach, describe, expect, it } from 'vitest';
import { generateWithFallback, resetModelCooldownForTests } from '../server/ai/generateWithFallback';

/**
 * Cliente Gemini falso: despacha por nome de modelo e registra cada modelo
 * tentado em `calls`, permitindo afirmar que modelos em cooldown não são
 * sequer tentados.
 */
function fakeClient(behavior: Record<string, () => Promise<any>>, calls: string[] = []) {
  return {
    models: {
      generateContent: async (params: { model: string }) => {
        calls.push(params.model);
        const fn = behavior[params.model];
        if (!fn) throw new Error(`modelo inesperado ${params.model}`);
        return fn();
      },
    },
  } as any;
}

const err503 = () => Promise.reject(new Error('503 UNAVAILABLE: high demand'));

describe('generateWithFallback', () => {
  // O mapa de cooldown é estado de módulo (persiste entre chamadas e testes
  // no mesmo processo — é exatamente esse comportamento que está sob teste).
  // O reset por teste isola os cenários entre si.
  beforeEach(() => {
    resetModelCooldownForTests();
  });

  it('cai para o fallback em 503 e registra degraded', async () => {
    const calls: string[] = [];
    const client = fakeClient({ 'modelo-a': err503, 'modelo-b': async () => ({ ok: true }) }, calls);
    const res = await generateWithFallback({
      client,
      params: { model: 'modelo-a', contents: 'oi' },
      route: 'word-context',
      fallbackModels: ['modelo-b'],
    });
    expect(res).toEqual({ ok: true });
    // O modelo preferido falhou e o fallback respondeu.
    expect(calls).toEqual(['modelo-a', 'modelo-b']);
  });

  it('pula modelo em cooldown recente de 503', async () => {
    const calls: string[] = [];
    const client = fakeClient(
      { 'modelo-a': err503, 'modelo-b': async () => ({ ok: 'b1' }) },
      calls
    );
    // Primeira chamada: 'modelo-a' falha com 503 e entra em cooldown de 30s.
    await generateWithFallback({
      client,
      params: { model: 'modelo-a' },
      route: 'x',
      fallbackModels: ['modelo-b'],
    });
    expect(calls).toEqual(['modelo-a', 'modelo-b']);

    // Segunda chamada (mesmo processo, mapa de cooldown é estado de módulo):
    // 'modelo-a' está em cooldown e nem deve ser tentado.
    const calls2: string[] = [];
    const client2 = fakeClient(
      {
        'modelo-a': async () => {
          throw new Error('não deveria ser chamado');
        },
        'modelo-b': async () => ({ ok: 'b2' }),
      },
      calls2
    );
    const res = await generateWithFallback({
      client: client2,
      params: { model: 'modelo-a' },
      route: 'x',
      fallbackModels: ['modelo-b'],
    });
    expect(res).toEqual({ ok: 'b2' });
    expect(calls2).toEqual(['modelo-b']);
  });

  it('erro não-transitório não aciona cooldown e propaga o último erro', async () => {
    const client = fakeClient({ 'modelo-a': () => Promise.reject(new Error('API key inválida')) });
    await expect(
      generateWithFallback({ client, params: { model: 'modelo-a' }, route: 'x', fallbackModels: [] })
    ).rejects.toThrow('API key inválida');

    // Sem cooldown registrado: na chamada seguinte 'modelo-a' volta a ser o
    // primeiro tentado (em vez de ser pulado por resfriamento inexistente).
    const calls2: string[] = [];
    const client2 = fakeClient({ 'modelo-a': async () => ({ ok: 'a2' }) }, calls2);
    const res = await generateWithFallback({
      client: client2,
      params: { model: 'modelo-a' },
      route: 'x',
      fallbackModels: ['modelo-b'],
    });
    expect(res).toEqual({ ok: 'a2' });
    expect(calls2[0]).toBe('modelo-a');
  });
});
