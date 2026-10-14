import { describe, expect, it } from 'vitest';
import { selectSupportKnowledge } from '../../supabase/functions/_shared/support-knowledge';
import { buildDraftRequest, buildAutoReplyRequest } from '../../supabase/functions/_shared/support-ai';
const article = (id: string, title: string, body: string, is_active = true) => ({ id, title, body, is_active, category: 'technical' });
describe('platform knowledge', () => {
  it('ranks relevant guides first and excludes unpublished material', () => {
    const selected = selectSupportKnowledge([article('other', 'Custom domains', 'DNS setup guide'), article('staff', 'Add kitchen staff and waiters', 'Use /owner/staff.'), article('private', 'Kitchen staff', 'Unapproved draft answer', false)], 'How can I add kitchen staff?', 'technical');
    expect(selected[0].id).toBe('staff'); expect(selected.some(item => item.id === 'private')).toBe(false);
  });
  it('bounds the article count and text budget without cutting answers', () => {
    const selected = selectSupportKnowledge(Array.from({ length: 100 }, (_, n) => article(String(n), `Article ${n}`, 'a'.repeat(6000))), 'question', 'technical');
    expect(selected.length).toBeLessThanOrEqual(16); expect(selected.reduce((total, item) => total + item.body.length, 0)).toBeLessThanOrEqual(24000); expect(selected.every(item => item.body.length === 6000)).toBe(true);
  });
  it('supports questions in other languages and no matching keywords', () => {
    const selected = selectSupportKnowledge([article('staff', 'Staff accounts', 'Use /owner/staff.')], 'আমি কীভাবে কর্মী যোগ করব?', 'technical');
    expect(selected).toHaveLength(1);
  });
  it('grounds both reply modes while giving live catalogs precedence', () => {
    const context = { knowledge: selectSupportKnowledge([article('staff', 'Staff accounts', 'Owners add waiters at /owner/staff.')], 'waiter', 'technical'), packages: [{ name: 'Live package', price_monthly: 349 }] };
    for (const request of [buildDraftRequest('gemini-test', [], context), buildAutoReplyRequest('gemini-test', [], context)]) {
      expect(request.contents[0].parts[0].text).toContain('/owner/staff');
      expect(request.systemInstruction.parts[0].text).toContain('take priority over article claims');
      expect(request.systemInstruction.parts[0].text).toContain('never guess platform policy');
    }
  });
});
