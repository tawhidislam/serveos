import { expect, it } from 'vitest';
import { edgeFunctionError } from '@/lib/edge-function-error';

it('shows the server error and leaves the original response readable', async () => {
  const context = new Response(JSON.stringify({ error: 'Restaurant slug already exists' }), { status: 409 });
  const error = Object.assign(new Error('Edge Function returned a non-2xx status code'), { context });
  expect((await edgeFunctionError(error)).message).toBe('Restaurant slug already exists');
  expect(await context.json()).toEqual({ error: 'Restaurant slug already exists' });
});

it('retains network and non-JSON errors', async () => {
  const error = Object.assign(new Error('Network unavailable'), { context: new Response('Bad gateway', { status: 502 }) });
  expect(await edgeFunctionError(error)).toBe(error);
  expect((await edgeFunctionError(null)).message).toBe('Request failed');
});
