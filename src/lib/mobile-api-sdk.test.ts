import { describe, expect, it, vi } from 'vitest';
import { ServeOSMobileApi } from '../../sdk/serveos-mobile-api';
const json=(data:unknown,status=200)=>new Response(JSON.stringify({data}),{status});
describe('native API session client',()=>{
  it('stores rotated tokens once for concurrent requests',async()=>{
    const storage={load:async()=>({access_token:'old',refresh_token:'refresh',expires_at:1}),save:vi.fn(),clear:vi.fn()};
    const fetcher=vi.fn().mockImplementation(async(url:string)=>url.endsWith('/auth/refresh')?json({access_token:'new',refresh_token:'rotated',expires_at:Date.now()/1000+3600}):json([]));
    const api=new ServeOSMobileApi('https://example.test/v1',storage,fetcher);await api.restore();await Promise.all([api.restaurants(),api.restaurants()]);
    expect(fetcher.mock.calls.filter(call=>call[0].endsWith('/auth/refresh'))).toHaveLength(1);expect(storage.save).toHaveBeenCalledWith(expect.objectContaining({refresh_token:'rotated'}));
    expect(fetcher.mock.calls.find(call=>call[0].endsWith('/restaurants'))?.[1].headers.Authorization).toBe('Bearer new');
  });
  it('does not automatically replay mutations after an ambiguous server failure',async()=>{
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:'SERVER_ERROR',message:'Try later'}}),{status:500}));const api=new ServeOSMobileApi('https://example.test/v1',undefined,fetcher);
    await expect(api.createOrder('restaurant',{},'stable-key')).rejects.toThrow();expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][1].headers['Idempotency-Key']).toBe('stable-key');
  });
});
