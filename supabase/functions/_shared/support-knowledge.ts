export interface KnowledgeArticle { id: string; title: string; category: string; body: string; is_active: boolean }

/** Bound reference material and rank it using the customer's latest question. */
export function selectSupportKnowledge(articles: KnowledgeArticle[], question: string, category: string) {
  const tokens = [...new Set(question.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])].filter(word => word.length >= 3 && !['the', 'and', 'how', 'can', 'for', 'with', 'this', 'that', 'have'].includes(word));
  const ranked = articles.filter(article => article.is_active).map(article => {
    const title = article.title.toLowerCase(), body = article.body.toLowerCase();
    const score = tokens.reduce((sum, token) => sum + (title.includes(token) ? 5 : body.includes(token) ? 1 : 0), article.category === category ? 1 : 0);
    return { article, score };
  }).sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title));
  const result: { id: string; title: string; body: string }[] = [];
  let remaining = 24000;
  for (const { article } of ranked.slice(0, 16)) {
    const body = article.body.slice(0, Math.min(6000, remaining));
    if (!body || body.length < article.body.length) continue;
    result.push({ id: article.id, title: article.title, body }); remaining -= body.length;
  }
  return result;
}
