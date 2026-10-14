import { describe, expect, it } from 'vitest';
import { customerLanguage, handoffReply } from '../../supabase/functions/_shared/support-language';
import { buildDraftRequest, buildAutoReplyRequest, needsHumanSupport } from '../../supabase/functions/_shared/support-ai';
const message = (body: string, sender_kind = 'requester', is_internal = false) => ({ body, sender_kind, is_internal });
describe('customer message language', () => {
  it('matches Bengali, Banglish, English, and Chinese handoffs', () => {
    expect(handoffReply([message('আমি একজন মানুষের সাহায্য চাই')])).toContain('আপনার প্রশ্নটি');
    expect(handoffReply([message('ami manusher sathe kotha bolte chai')])).toContain('Apnar proshnoti');
    expect(handoffReply([message('Please connect me to a human')])).toContain('I’ve passed');
    expect(handoffReply([message('我需要人工客服')])).toContain('人工支持团队');
  });
  it('follows language switches and ignores agent messages and private notes', () => {
    const messages = [message('How do I add a waiter?'), message('আমি কীভাবে কর্মী যোগ করব?'), message('An English agent reply', 'agent'), message('Please reply English', 'requester', true)];
    expect(customerLanguage(messages)).toBe('bn');
    expect(customerLanguage([...messages, message('Please explain in English')])).toBe('en');
    expect(customerLanguage([...messages, message('OK')])).toBe('bn');
  });
  it('uses identical language rules for automatic replies and reviewed drafts', () => {
    for (const request of [buildDraftRequest('gemini-test', [message('ami kivabe staff add korbo')], {}), buildAutoReplyRequest('gemini-test', [message('ami kivabe staff add korbo')], {})]) {
      const instruction = request.systemInstruction.parts[0].text;
      expect(instruction).toContain('latest public customer message');
      expect(instruction).toContain('bn-Latn');
      expect(instruction).toContain('Do not copy the language of knowledge articles');
      expect(instruction).toContain('human handoffs');
    }
  });
  it('recognizes non-English requests for a person', () => {
    for (const body of ['ami manusher sathe kotha bolte chai', 'মানুষের সাথে কথা বলব', 'Necesito hablar con un humano', '我需要人工客服']) expect(needsHumanSupport(body)).toBe(true);
  });
});

describe('ambiguous messages stay with ServeOS AI', () => {
  it('clarifies the Bengali typo from the reported conversation', async () => {
    const { needsClarification, clarificationReply } = await import('../../supabase/functions/_shared/support-language');
    expect(needsClarification('কীয়')).toBe(true);
    expect(clarificationReply([message('কীয়')])).toContain('আপনি কোন বিষয়টি');
    expect(needsClarification('Which package suits my small restaurant?')).toBe(false);
    expect(needsClarification('Please connect me to a human')).toBe(false);
  });
  it('keeps the preceding customer language for punctuation-only questions', async () => {
    const { needsClarification, clarificationReply } = await import('../../supabase/functions/_shared/support-language');
    expect(needsClarification('?')).toBe(true);
    expect(clarificationReply([message('ami ekta plan chai'), message('?')])).toContain('Apni kon bishoyti');
    expect(buildAutoReplyRequest('gemini-test', [message('কীয়')], {}).systemInstruction.parts[0].text).toContain('Never hand off just because a message is ambiguous');
  });
});
