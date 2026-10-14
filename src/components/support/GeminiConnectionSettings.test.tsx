import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GeminiConnectionSettings from './GeminiConnectionSettings';
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const mount = () => { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); render(<QueryClientProvider client={client}><GeminiConnectionSettings /></QueryClientProvider>); return client; };
const status = { configured: true, source: 'panel', model: 'gemini-test' };
describe('panel Gemini connection', () => {
  it('clears the key after save and caches only status', async () => {
    invoke.mockImplementation(async (_name, { body }) => ({ data: body.action === 'status' ? { ...status, configured: false, source: 'none' } : status, error: null }));
    const client = mount(); await screen.findByText('No Gemini API key configured');
    const input = screen.getByLabelText('New Gemini API key'); expect(input).toHaveAttribute('type', 'password');
    fireEvent.change(input, { target: { value: 'fake-key-123456789012345678901234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Gemini connection' }));
    await waitFor(() => expect(input).toHaveValue(''));
    expect(JSON.stringify(client.getQueryData(['support-ai-connection']))).not.toContain('fake-key');
    expect(screen.getByRole('button', { name: 'Test saved connection' })).toBeEnabled();
  });
  it('keeps the saved key when updating the model and tests explicitly', async () => {
    invoke.mockResolvedValue({ data: status, error: null }); mount(); await screen.findByText('API key saved securely');
    fireEvent.change(screen.getByLabelText('Gemini model'), { target: { value: 'gemini-new-model' } });
    expect(screen.getByRole('button', { name: 'Test saved connection' })).toBeDisabled();
    invoke.mockResolvedValue({ data: { ...status, model: 'gemini-new-model' }, error: null });
    fireEvent.click(screen.getByRole('button', { name: 'Save Gemini connection' }));
    await screen.findByText('Gemini connection saved. New replies use these settings immediately.');
    expect(invoke).toHaveBeenCalledWith('support-ai-config', { body: { action: 'save', api_key: '', model: 'gemini-new-model' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test saved connection' })); await screen.findByText('Gemini connection verified.');
    expect(invoke).toHaveBeenCalledWith('support-ai-config', { body: { action: 'test' } });
  });
  it('preserves unsaved input when the server rejects a save', async () => {
    invoke.mockResolvedValue({ data: status, error: null }); mount(); await screen.findByText('API key saved securely');
    fireEvent.change(screen.getByLabelText('New Gemini API key'), { target: { value: 'fake-unsaved-key' } });
    invoke.mockResolvedValue({ data: null, error: { message: 'Could not save connection.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Gemini connection' }));
    await screen.findByRole('alert'); expect(screen.getByLabelText('New Gemini API key')).toHaveValue('fake-unsaved-key');
  });
});
