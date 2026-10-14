import { DEFAULT_SUPPORT_MODEL } from './support-ai.ts';

type ReadCredentials = () => PromiseLike<{ data: unknown; error: unknown }>;
export async function resolveSupportCredentials(read: ReadCredentials, getEnv: (name: string) => string | undefined) {
  const { data, error } = await read();
  if (error) throw new Error('Could not load the Gemini connection.');
  const saved = data as { api_key?: string | null; model?: string | null } | null;
  return {
    apiKey: saved?.api_key || getEnv('GEMINI_API_KEY') || '',
    model: saved?.model || getEnv('GEMINI_SUPPORT_MODEL') || DEFAULT_SUPPORT_MODEL,
    source: saved?.api_key ? 'panel' : getEnv('GEMINI_API_KEY') ? 'server' : 'none',
  };
}
export function credentialStatus(credentials: Awaited<ReturnType<typeof resolveSupportCredentials>>) {
  return { configured: !!credentials.apiKey, model: credentials.model, source: credentials.source };
}
