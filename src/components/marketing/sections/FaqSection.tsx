import { Section, SectionHeading } from '@/components/marketing/Section';
import type { FaqContent } from '@/lib/marketing-sections';

export default function FaqSection({ content }: { content: FaqContent }) {
  const items = (content.items ?? []).filter((i) => i.question?.trim());
  if (items.length === 0) return null;
  return (
    <Section className="py-14 sm:py-24 bg-muted/20">
      <div className="max-w-3xl mx-auto">
        <SectionHeading eyebrow={content.eyebrow} title={content.title} />
        <div className="mt-10 sm:mt-12 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {items.map((f) => (
            <details key={f.question} className="group [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 text-[15px] font-medium text-foreground hover:bg-muted/30 transition-colors">
                {f.question}
                <span className="shrink-0 text-lg leading-none text-primary transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="px-5 sm:px-6 pb-5 -mt-1 text-sm leading-relaxed text-muted-foreground">{f.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
