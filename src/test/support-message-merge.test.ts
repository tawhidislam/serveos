import { expect, it } from 'vitest';
import { mergeSupportMessages, type SupportMessage } from '@/lib/support';
const message = (id: string, created_at: string): SupportMessage => ({ id, created_at, conversation_id: 'test-conversation', sender_kind: 'requester', sender_user_id: null, body: id, is_internal: false, attachments: [] });
it('keeps a newly delivered message when an older snapshot arrives later', () => {
  const first = message('first', '2026-10-11T01:00:00Z'), latest = message('latest', '2026-10-11T01:01:00Z');
  expect(mergeSupportMessages([latest], [first])).toEqual([first, latest]);
});
it('deduplicates messages delivered by both the HTTP response and realtime', () => {
  const item = message('same', '2026-10-11T01:00:00Z');
  expect(mergeSupportMessages([item], [item])).toEqual([item]);
});
