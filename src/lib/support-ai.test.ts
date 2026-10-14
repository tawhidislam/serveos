import { describe, expect, it, vi } from 'vitest';
import { buildDraftRequest, generateSupportDraft, readDraftResponse } from '../../supabase/functions/_shared/support-ai';

describe('AI support drafts', () => {
  it('excludes private notes and system messages and bounds context', () => {
    const request = buildDraftRequest('gemini-test', [
      { sender_kind: 'agent', body: 'Secret team note', is_internal: true },
      { sender_kind: 'system', body: 'Private system detail', is_internal: false },
      ...Array.from({ length: 40 }, (_, n) => ({ sender_kind: 'requester', body: `Question ${n}`, is_internal: false })),
    ], { packages: [{ name: 'Quarterly', term: '3 months' }] });
    const input = JSON.parse(request.contents[0].parts[0].text);
    expect(input.conversation).toHaveLength(30);
    expect(input.conversation[0].text).toBe('Question 10');
    expect(request.contents[0].parts[0].text).not.toContain('Secret team note');
    expect(request.contents[0].parts[0].text).not.toContain('Private system detail');
    expect(request.systemInstruction.parts[0].text).toContain('untrusted data');
    expect(input.context.packages[0].term).toBe('3 months');
  });
  it('reads Gemini candidates and rejects blocked, incomplete or oversized drafts', () => {
    const output = (text: string) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] });
    expect(readDraftResponse(output(' Helpful reply '))).toBe('Helpful reply');
    expect(() => readDraftResponse({ candidates: [{ finishReason: 'MAX_TOKENS' }] })).toThrow();
    expect(() => readDraftResponse(output('x'.repeat(4001)))).toThrow();
    expect(() => readDraftResponse(output(''))).toThrow();
  });
  it('calls the provider without saving or sending customer messages', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Please check /owner/staff.' }] } }] }), { status: 200 }));
    const request = buildDraftRequest('gemini-test', [], {});
    expect(await generateSupportDraft('fake-test-key', request, fetcher)).toBe('Please check /owner/staff.');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    expect(fetcher.mock.calls[0][1].headers['x-goog-api-key']).toBe('fake-test-key');
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body).not.toHaveProperty('model');
    expect(body).not.toHaveProperty('store');
    expect(body.contents[0].role).toBe('user');
    expect(body.systemInstruction.parts[0].text).toContain('ServeOS');
  });
  it('returns safe provider errors without leaking response details', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('sensitive provider detail', { status: 401 }));
    await expect(generateSupportDraft('fake', buildDraftRequest('gemini-test', [], {}), fetcher)).rejects.toThrow('credentials or configuration need attention');
  });
});

describe('automatic AI handoff', () => {
  it('identifies human requests and sensitive account actions', async () => {
    const { needsHumanSupport } = await import('../../supabase/functions/_shared/support-ai');
    for (const text of ['Please get a human', 'I need a refund', 'reset my password', 'মানুষের সাথে কথা বলতে চাই', '人工客服']) expect(needsHumanSupport(text)).toBe(true);
    expect(needsHumanSupport('How do I add a waiter?')).toBe(false);
  });
  it('uses structured replies and preserves private-note filtering', async () => {
    const { buildAutoReplyRequest, readAutoReply } = await import('../../supabase/functions/_shared/support-ai');
    const request = buildAutoReplyRequest('gemini-test', [{ sender_kind: 'agent', is_internal: true, body: 'Private detail' }], {});
    expect(request.contents[0].parts[0].text).not.toContain('Private detail');
    expect(request.generationConfig.responseMimeType).toBe('application/json');
    expect(request.generationConfig.responseJsonSchema.required).toEqual(['reply', 'handoff']);
    expect(request.systemInstruction.parts[0].text).toContain('replying directly to a customer');
    expect(readAutoReply('{"reply":"Hello!","handoff":false}')).toEqual({ reply: 'Hello!', handoff: false });
    expect(() => readAutoReply('{"reply":"Hello!","handoff":"false"}')).toThrow();
    expect(() => readAutoReply('not json')).toThrow();
  });
});

describe('Gemini transport edge cases', () => {
  it('rejects safety blocks and never includes model thoughts in a reply', () => {
    expect(() => readDraftResponse({ promptFeedback: { blockReason: 'SAFETY' } })).toThrow('could not answer');
    expect(readDraftResponse({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Hidden thinking', thought: true }, { text: 'Customer reply' }] } }] })).toBe('Customer reply');
    expect(() => readDraftResponse({ candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: 'partial' }] } }] })).toThrow();
  });
  it('does not allow an arbitrary URL through the model setting', async () => {
    const fetcher = vi.fn();
    await expect(generateSupportDraft('fake', buildDraftRequest('../other-endpoint', [], {}), fetcher)).rejects.toThrow('Invalid Gemini support model');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('sends the automatic handoff schema to Gemini', async () => {
    const { buildAutoReplyRequest, readAutoReply } = await import('../../supabase/functions/_shared/support-ai');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"reply":"I can help with that.","handoff":false}' }] } }] }), { status: 200 }));
    const text = await generateSupportDraft('fake', buildAutoReplyRequest('gemini-test', [], {}), fetcher);
    expect(readAutoReply(text).handoff).toBe(false);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).generationConfig.responseJsonSchema.properties.handoff.type).toBe('boolean');
  });
  it('handles quota and missing-model failures without returning provider details', async () => {
    for (const [status, message] of [[429, 'usage limit'], [404, 'model is unavailable']] as const) {
      const fetcher = vi.fn().mockResolvedValue(new Response('sensitive upstream response', { status }));
      await expect(generateSupportDraft('fake', buildDraftRequest('gemini-test', [], {}), fetcher)).rejects.toThrow(message);
    }
  });
});

describe('Gemini temporary availability', () => {
  it('retries overload errors and recovers without changing the model', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Recovered reply' }] } }] }), { status: 200 }));
    expect(await generateSupportDraft('fake', buildDraftRequest('gemini-test', [], {}), fetcher)).toBe('Recovered reply');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1].signal).toBe(fetcher.mock.calls[1][1].signal);
  });
  it('limits retries and shows an actionable overload error', async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response('', { status: 503 }));
    await expect(generateSupportDraft('fake', buildDraftRequest('gemini-test', [], {}), fetcher)).rejects.toThrow('temporarily overloaded or unavailable (HTTP 503)');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('does not retry invalid credentials or quota exhaustion', async () => {
    for (const status of [403, 429]) {
      const fetcher = vi.fn().mockResolvedValue(new Response('', { status }));
      await expect(generateSupportDraft('fake', buildDraftRequest('gemini-test', [], {}), fetcher)).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
});
