export interface Session { access_token: string; refresh_token: string; expires_at: number; expires_in?: number; token_type?: string }
export interface SecureSessionStorage { load(): Promise<Session | null>; save(session: Session): Promise<void>; clear(): Promise<void> }
export type Role = 'owner' | 'admin' | 'manager' | 'kitchen' | 'waiter' | 'server';
export interface RestaurantContext { restaurant: { id: string; name: string; slug: string }; role: Role; branch_ids: string[]; features: Record<string, boolean>; limits: Record<string, number | null>; is_active: boolean }
export interface ApiResult<T> { data: T; meta?: { limit?: number; offset?: number; total?: number; request_id?: string; next_cursor?: { since: string; after_id?: string }; has_more?: boolean; server_time?: string } }
export class MobileApiError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }

/** Framework-independent client. Use Keychain/Keystore storage in native apps. */
export class ServeOSMobileApi {
  private session: Session | null = null;
  private refreshing: Promise<void> | null = null;
  constructor(private baseUrl: string, private storage?: SecureSessionStorage, private fetcher: typeof fetch = fetch) { this.baseUrl = baseUrl.replace(/\/$/, ''); }
  async restore() { this.session = await this.storage?.load() ?? null; return this.session; }
  private async save(session: Session) { this.session = session; await this.storage?.save(session); }
  async login(email: string, password: string) { const result = await this.send<Session>('/auth/login', 'POST', { email, password }, false); await this.save(result.data); return result.data; }
  async refresh() {
    if (!this.session) throw new MobileApiError(401, 'UNAUTHORIZED', 'Sign in first.');
    if (!this.refreshing) this.refreshing = (async () => { const result = await this.send<Session>('/auth/refresh', 'POST', { refresh_token: this.session!.refresh_token }, false); await this.save(result.data); })().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }
  async logout() { try { if (this.session) await this.request('/auth/logout', 'POST', {}); } finally { this.session = null; await this.storage?.clear(); } }
  async changePassword(current_password: string, new_password: string) { const result = await this.request<Session>('/auth/password', 'POST', { current_password, new_password }); await this.save(result.data); }
  async request<T>(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}): Promise<ApiResult<T>> {
    if (this.session && this.session.expires_at * 1000 <= Date.now() + 30000) await this.refresh();
    // A 401 is safe to retry after refreshing because authentication failed before mutation.
    try { return await this.send<T>(path, method, body, true, headers); }
    catch (error) { if (!(error instanceof MobileApiError) || error.status !== 401 || !this.session) throw error; await this.refresh(); return this.send<T>(path, method, body, true, headers); }
  }
  async uploadImage(restaurant: string, kind: 'menu' | 'website' | 'floor-plan', file: Blob, filename = 'image.jpg') {
    if (this.session && this.session.expires_at * 1000 <= Date.now() + 30000) await this.refresh();
    const form = new FormData(); form.append('kind', kind); form.append('file', file, filename);
    const res = await this.fetcher(`${this.baseUrl}/restaurants/${restaurant}/uploads`, { method: 'POST', headers: this.session ? { Authorization: `Bearer ${this.session.access_token}` } : {}, body: form });
    const data = await res.json(); if (!res.ok) throw new MobileApiError(res.status, data.error?.code || 'UPLOAD_FAILED', data.error?.message || 'Upload failed.'); return data as ApiResult<{ bucket: string; path: string; url: string }>;
  }
  private async send<T>(path: string, method: string, body?: unknown, authenticated = true, extraHeaders: Record<string, string> = {}): Promise<ApiResult<T>> {
    const res = await this.fetcher(`${this.baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(authenticated && this.session ? { Authorization: `Bearer ${this.session.access_token}` } : {}), ...extraHeaders }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json(); if (!res.ok) throw new MobileApiError(res.status, data.error?.code || 'HTTP_ERROR', data.error?.message || 'Request failed.'); return data;
  }
  restaurants() { return this.request<RestaurantContext[]>('/restaurants'); }
  context(id: string) { return this.request<RestaurantContext>(`/restaurants/${id}`); }
  list<T>(id: string, resource: string, params: Record<string, string | number | boolean> = {}) { return this.request<T[]>(`/restaurants/${id}/${resource}?${new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]))}`); }
  get<T>(restaurant: string, resource: string, id?: string) { return this.request<T>(`/restaurants/${restaurant}/${resource}${id ? `/${id}` : ''}`); }
  create<T>(restaurant: string, resource: string, data: unknown) { return this.request<T>(`/restaurants/${restaurant}/${resource}`, 'POST', data); }
  update<T>(restaurant: string, resource: string, id: string | null, data: unknown) { return this.request<T>(`/restaurants/${restaurant}/${resource}${id ? `/${id}` : ''}`, 'PATCH', data); }
  remove(restaurant: string, resource: string, id: string) { return this.request(`/restaurants/${restaurant}/${resource}/${id}`, 'DELETE'); }
  createOrder<T>(restaurant: string, data: unknown, idempotencyKey: string) { return this.request<T>(`/restaurants/${restaurant}/orders`, 'POST', data, { 'Idempotency-Key': idempotencyKey }); }
  setOrderStatus<T>(restaurant: string, id: string, expected_status: string, status: string) { return this.request<T>(`/restaurants/${restaurant}/orders/${id}/status`, 'POST', { expected_status, status }); }
  editOrder<T>(restaurant: string, id: string, expected_updated_at: string, changes: { notes?: string | null; items?: unknown[] }) { return this.request<T>(`/restaurants/${restaurant}/orders/${id}`, 'PATCH', { ...changes, expected_updated_at }); }
  recordPayment<T>(restaurant: string, id: string, payment_method: string) { return this.request<T>(`/restaurants/${restaurant}/orders/${id}/payment`, 'POST', { payment_method }); }
  resolveWaiterCall(restaurant: string, id: string) { return this.request(`/restaurants/${restaurant}/waiter-calls/${id}/resolve`, 'POST', {}); }
  sendSupportMessage(restaurant: string, id: string, body: string) { return this.request(`/restaurants/${restaurant}/support/${id}/messages`, 'POST', { body }); }
}
