import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadWithProgress } from '@/lib/storage-upload';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), getPublicUrl: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: mocks.getSession },
    storage: { from: () => ({ getPublicUrl: mocks.getPublicUrl }) },
  },
}));

const requests: UploadRequest[] = [];
class UploadRequest {
  status = 200;
  responseText = '';
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  // Browsers need not dispatch an abort event before a request has been sent.
  abort = vi.fn();
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  upload = { onprogress: null as ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null };
  constructor() { requests.push(this); }
}

const options = () => ({ bucket: 'platform-apps', path: 'windows/app.exe', file: new File(['MZ'], 'app.exe') });

beforeEach(() => {
  requests.length = 0;
  mocks.getSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'test-session' } } });
  mocks.getPublicUrl.mockReset().mockReturnValue({ data: { publicUrl: 'https://downloads.example.com/app.exe' } });
  vi.stubGlobal('XMLHttpRequest', UploadRequest);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('upload cancellation and completion', () => {
  it('rejects an already cancelled upload without starting a request', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(uploadWithProgress({ ...options(), signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(requests).toHaveLength(0);
  });

  it('settles when cancellation happens while the session is being loaded', async () => {
    let finishSession: () => void;
    mocks.getSession.mockReturnValueOnce(new Promise(resolve => {
      finishSession = () => resolve({ data: { session: null } });
    }));
    const controller = new AbortController();
    const pending = uploadWithProgress({ ...options(), signal: controller.signal });
    controller.abort(); finishSession!();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(requests).toHaveLength(0);
  });

  it('settles cancellation even if XHR does not dispatch an abort event', async () => {
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
    const pending = uploadWithProgress({ ...options(), signal: controller.signal });
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(requests[0].abort).toHaveBeenCalledOnce();
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(mocks.getPublicUrl).not.toHaveBeenCalled();
  });

  it('reports completion and removes cancellation listeners after a successful upload', async () => {
    const controller = new AbortController(), progress = vi.fn();
    const pending = uploadWithProgress({ ...options(), signal: controller.signal, onProgress: progress });
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    requests[0].upload.onprogress?.({ lengthComputable: true, loaded: 2, total: 2 });
    expect(progress).toHaveBeenLastCalledWith(99);
    requests[0].onload?.();
    await expect(pending).resolves.toEqual({ path: 'windows/app.exe', publicUrl: 'https://downloads.example.com/app.exe' });
    expect(progress).toHaveBeenLastCalledWith(100);
    controller.abort();
    expect(requests[0].abort).not.toHaveBeenCalled();
  });

  it('returns server failures and releases cancellation listeners', async () => {
    const controller = new AbortController();
    const pending = uploadWithProgress({ ...options(), signal: controller.signal });
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    requests[0].status = 403; requests[0].responseText = JSON.stringify({ message: 'Upload permission denied' });
    requests[0].onload?.();
    await expect(pending).rejects.toThrow('Upload permission denied');
    controller.abort();
    expect(requests[0].abort).not.toHaveBeenCalled();
  });
});
