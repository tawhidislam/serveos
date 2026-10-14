import { describe, expect, it } from 'vitest';
import { credentialStatus, resolveSupportCredentials } from '../../supabase/functions/_shared/support-ai-credentials';

describe('server Gemini credentials', () => {
  it('prefers panel secrets and keeps key out of public status', async () => {
    const credentials = await resolveSupportCredentials(async () => ({ data: { api_key: 'fake-panel-secret', model: 'gemini-test' }, error: null }), () => 'fake-env-value');
    expect(credentials.apiKey).toBe('fake-panel-secret');
    expect(credentialStatus(credentials)).toEqual({ configured: true, model: 'gemini-test', source: 'panel' });
    expect(JSON.stringify(credentialStatus(credentials))).not.toContain('fake-panel-secret');
  });
  it('falls back to server config when no panel key is saved', async () => {
    const credentials = await resolveSupportCredentials(async () => ({ data: { model: 'gemini-saved-model' }, error: null }), name => name === 'GEMINI_API_KEY' ? 'fake-env-key' : undefined);
    expect(credentials.apiKey).toBe('fake-env-key'); expect(credentials.model).toBe('gemini-saved-model'); expect(credentials.source).toBe('server');
  });
  it('reports missing credentials and does not hide database errors', async () => {
    const credentials = await resolveSupportCredentials(async () => ({ data: {}, error: null }), () => undefined);
    expect(credentialStatus(credentials).configured).toBe(false);
    await expect(resolveSupportCredentials(async () => ({ data: null, error: { message: 'database detail' } }), () => 'fallback')).rejects.toThrow('Could not load');
  });
});
