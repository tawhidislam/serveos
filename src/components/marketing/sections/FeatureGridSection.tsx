import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import FeatureCard from '@/components/marketing/FeatureCard';
import { Section } from '@/components/marketing/Section';
import { Button } from '@/components/ui/button';
import { getIcon } from '@/lib/icon-map';
import type { FeatureGridContent } from '@/lib/marketing-sections';

export default function FeatureGridSection({ content }: { content: FeatureGridContent }) {
  return (
    <Section className="!pt-0">
      {content.items?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {content.items.map((f, i) => (
            <FeatureCard
              key={f.title + i}
              icon={getIcon(f.icon)}
              title={f.title}
              description={f.description}
              delay={i * 0.05}
            />
          ))}
        </div>
      )}
      {content.ctaLabel && (
        <div className="mt-12 text-center">
          <Link to={content.ctaHref || '#'}>
            <Button variant="outline" className="gap-2">
              {content.ctaLabel} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}
    </Section>
  );
}
