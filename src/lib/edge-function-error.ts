/** Recover the server error hidden by Supabase's generic non-2xx message. */
export async function edgeFunctionError(error: unknown): Promise<Error> {
  if (typeof error === 'object' && error !== null && 'context' in error && error.context instanceof Response) {
    try {
      const body: unknown = await error.context.clone().json();
      if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
        return new Error(body.error);
      }
    } catch {
      // Non-JSON responses still retain the original SDK message.
    }
  }
  return error instanceof Error ? error : new Error('Request failed');
}
