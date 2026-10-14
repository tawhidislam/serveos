import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AiReplyDraft from './AiReplyDraft';
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const show = (onUse = vi.fn(), enabled = true) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['support-settings'], { ai_enabled: enabled });
  render(<QueryClientProvider client={client}><AiReplyDraft conversationId="conversation-1" disabled={false} onUse={onUse} /></QueryClientProvider>);
  return onUse;
};
describe('reviewed AI drafts', () => {
  it('requires explicit use before inserting a suggestion', async () => {
    invoke.mockResolvedValue({ data: { draft: 'Suggested answer', conversation_id: 'conversation-1' }, error: null });
    const onUse = show(); fireEvent.click(screen.getByRole('button', { name: 'AI draft reply' }));
    await screen.findByText('Suggested answer'); expect(onUse).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use draft' })); expect(onUse).toHaveBeenCalledWith('Suggested answer');
    expect(invoke).toHaveBeenCalledTimes(1);
  });
  it('shows configuration errors and lets admins retry', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'AI is not connected yet.' } });
    show(); fireEvent.click(screen.getByRole('button', { name: 'AI draft reply' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('AI is not connected yet.'));
    expect(screen.getByRole('button', { name: 'AI draft reply' })).toBeEnabled();
  });
  it('ignores a result after the conversation panel is unmounted', async () => {
    let resolve!: (value: unknown) => void;
    invoke.mockReturnValue(new Promise(done => { resolve = done; }));
    const onUse = show(); fireEvent.click(screen.getByRole('button', { name: 'AI draft reply' })); cleanup();
    resolve({ data: { draft: 'Old conversation reply', conversation_id: 'conversation-1' }, error: null });
    await Promise.resolve(); expect(onUse).not.toHaveBeenCalled();
  });
  it('does not request drafts while disabled in settings', () => {
    show(vi.fn(), false); expect(screen.getByRole('button', { name: 'AI draft reply' })).toBeDisabled(); expect(invoke).not.toHaveBeenCalled();
  });
});
