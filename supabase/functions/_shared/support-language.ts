export interface LanguageMessage { sender_kind: string; body: string; is_internal: boolean }

export const CUSTOMER_LANGUAGE_RULE = `Reply in the language of the latest public customer message. Re-evaluate it on every turn, so a customer can switch languages. Do not copy the language of knowledge articles, package names, earlier agent messages, or administrator guidance. For Bengali script, reply in natural Bengali script. For Banglish (Bengali written in Latin letters), reply in Banglish using Latin letters. For mixed-language messages, match the customer's dominant language and writing style. The assistant name is ServeOS AI; never translate or rename it. Preserve names, URLs, product labels, and technical terms where translation would confuse the customer. For a short ambiguous message such as OK, use the customer's most recent clear language. This rule applies to answers, clarifying questions, and human handoffs. If the customer explicitly asks for a particular language, follow that preference.`;

/** Known-language hints make provider-independent handoffs useful during outages. */
export function languageHint(text: string): string | null {
  if (/[\u0980-\u09FF]/u.test(text)) return 'bn';
  if (/[\u0900-\u097F]/u.test(text)) return 'hi';
  if (/[\u0600-\u06FF]/u.test(text)) return 'ar';
  if (/[\u3040-\u30FF]/u.test(text)) return 'ja';
  if (/[\uAC00-\uD7AF]/u.test(text)) return 'ko';
  if (/[\u4E00-\u9FFF]/u.test(text)) return 'zh';
  if (/\b(ami|amar|amake|apni|apnar|kivabe|kibhabe|kothay|chai|chaitesi|korbo|korte|korben|manush|manusher|shathe|sathe|dorkar|resturant er)\b/i.test(text)) return 'bn-Latn';
  if (/\b(hola|necesito|ayuda|quiero|gracias|humano|persona|cómo|puedo|hablar)\b/i.test(text)) return 'es';
  if (/\b(bonjour|besoin|aide|merci|humain|parler|voudrais)\b/i.test(text)) return 'fr';
  if (/\b(hallo|hilfe|bitte|danke|mensch|sprechen|möchte)\b/i.test(text)) return 'de';
  if (/\b(olá|preciso|ajuda|obrigado|quero|falar)\b/i.test(text)) return 'pt';
  if (/\b(hello|please|need|help|how|where|what|human|waiter|staff|thanks)\b/i.test(text)) return 'en';
  return null;
}

export function customerLanguage(messages: LanguageMessage[]): string {
  const customer = messages.filter(message => message.sender_kind === 'requester' && !message.is_internal);
  for (const message of [...customer].reverse()) {
    const hint = languageHint(message.body); if (hint) return hint;
  }
  return 'auto';
}

const HANDOFFS: Record<string, string> = {
  en: 'I’m ServeOS AI. I’ve passed your question to the support team for human review. They can continue helping you here.',
  bn: 'আমি ServeOS AI। আপনার প্রশ্নটি মানুষের সহায়তার জন্য সাপোর্ট টিমের কাছে পাঠিয়েছি। তারা এই চ্যাটেই আপনাকে সাহায্য করতে পারবেন।',
  'bn-Latn': 'Ami ServeOS AI. Apnar proshnoti human support-er jonno support team-er kache pathiyechi. Tara ei chat-ei apnake shahajjo korte parben.',
  hi: 'मैं ServeOS AI हूँ। मैंने आपका सवाल सहायता टीम को भेज दिया है। टीम इसी चैट में आपकी मदद कर सकती है।',
  ar: 'أنا ServeOS AI. أحلت سؤالك إلى فريق الدعم البشري، ويمكنهم مساعدتك هنا في هذه المحادثة.',
  zh: '我是 ServeOS AI。我已将您的问题转交给人工支持团队，他们可以在此聊天中继续帮助您。',
  ja: 'ServeOS AIです。ご質問を有人サポートチームに引き継ぎました。このチャットで引き続き対応できます。',
  ko: '저는 ServeOS AI입니다. 문의를 지원팀에 전달했습니다. 담당자가 이 채팅에서 계속 도와드릴 수 있습니다.',
  es: 'Soy ServeOS AI. He enviado tu consulta al equipo de soporte humano. Pueden ayudarte aquí en este chat.',
  fr: 'Je suis ServeOS AI. J’ai transmis votre question à notre équipe. Elle pourra vous aider ici dans cette conversation.',
  de: 'Ich bin ServeOS AI. Ich habe Ihre Frage an das Supportteam weitergeleitet. Das Team kann Ihnen hier im Chat weiterhelfen.',
  pt: 'Sou o ServeOS AI. Encaminhei sua pergunta à equipe de suporte humano. Ela poderá ajudar você aqui no chat.',
};

export function handoffReply(messages: LanguageMessage[]): string {
  return HANDOFFS[customerLanguage(messages)] || HANDOFFS.en;
}

export function needsClarification(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/[?!।.,\s]+$/gu, '');
  return normalized === '' || ['কি', 'কী', 'কীয়', 'কিয়', 'কিয়', 'what', 'huh'].includes(normalized);
}

export function clarificationReply(messages: LanguageMessage[]): string {
  const replies: Record<string, string> = {
    en: 'Could you clarify what you would like help with? I can explain plans, prices, or how to use the platform.',
    bn: 'আপনি কোন বিষয়টি জানতে চান, একটু বিস্তারিত বলবেন? প্যাকেজ, দাম বা প্ল্যাটফর্ম ব্যবহার সম্পর্কে সাহায্য করতে পারি।',
    'bn-Latn': 'Apni kon bishoyti jante chan, ektu bistarito bolben? Plan, dam ba platform use kora niye shahajjo korte pari.',
    hi: 'आप किस बारे में मदद चाहते हैं? मैं योजनाओं, कीमतों या प्लेटफ़ॉर्म के उपयोग के बारे में बता सकता हूँ।',
    ar: 'هل يمكنك توضيح ما الذي تحتاج المساعدة فيه؟ يمكنني شرح الخطط والأسعار وكيفية استخدام المنصة.',
    zh: '您想了解哪方面的内容？我可以解释套餐、价格或平台的使用方法。',
    ja: 'どのようなことでお困りですか？プラン、料金、プラットフォームの使い方をご案内できます。',
    ko: '어떤 도움이 필요하신지 자세히 알려주시겠어요? 요금제, 가격 또는 플랫폼 사용 방법을 설명해 드릴 수 있습니다.',
    es: '¿Puedes aclarar en qué necesitas ayuda? Puedo explicar los planes, precios o cómo usar la plataforma.',
    fr: 'Pouvez-vous préciser votre question ? Je peux expliquer les offres, les prix ou l’utilisation de la plateforme.',
    de: 'Können Sie Ihre Frage näher erklären? Ich kann Tarife, Preise oder die Nutzung der Plattform erläutern.',
    pt: 'Pode esclarecer com o que precisa de ajuda? Posso explicar os planos, preços ou como usar a plataforma.',
  };
  return replies[customerLanguage(messages)] || replies.en;
}
