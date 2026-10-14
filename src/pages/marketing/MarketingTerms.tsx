import MarketingLayout from '@/components/marketing/MarketingLayout';
import { usePlatformBranding } from '@/hooks/usePlatformSettings';

export default function MarketingTerms() {
  const { siteName } = usePlatformBranding();
  const updated = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <MarketingLayout
      title={`Terms & Conditions — ${siteName}`}
      description={`Read the terms and conditions for using ${siteName}, including subscriptions, add-ons, acceptable use, and account responsibilities.`}
      canonical="/terms"
    >
      <section className="max-w-3xl mx-auto px-6 lg:px-10 py-20">
        <header className="mb-12 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Legal</p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
            Terms &amp; Conditions
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: {updated}</p>
        </header>

        <article className="prose-styles space-y-10 text-foreground/90 leading-relaxed">
          <Section title="1. Acceptance of terms">
            By accessing or using {siteName} (the &ldquo;Service&rdquo;), you agree to be
            bound by these Terms &amp; Conditions. If you do not agree, you may not use the
            Service. These terms apply to all visitors, restaurant owners, staff members,
            and customers who interact with the Service.
          </Section>

          <Section title="2. Accounts &amp; eligibility">
            You must provide accurate information when creating an account and keep your
            credentials confidential. You are responsible for all activity under your
            account. Restaurant owner accounts may invite staff members and are
            responsible for managing their access.
          </Section>

          <Section title="3. Subscriptions &amp; add-ons">
            <p>
              The Service is offered on a subscription basis with optional add-on services.
              Subscriptions and add-ons may be billed monthly or as one-time purchases as
              shown on the pricing page.
            </p>
            <p>
              Manual payments (e.g. mobile payment platforms) require platform admin
              approval before features are activated. Add-ons unlock specific features for
              the duration of the subscription or the lifetime of a one-time purchase.
              Plan benefits and add-on grants are additive — either may unlock a feature.
            </p>
          </Section>

          <Section title="4. Refunds">
            Subscription fees and add-on purchases are generally non-refundable. Refund
            requests are reviewed case-by-case and may be granted at our sole discretion
            for service outages or billing errors. For full details on eligibility,
            timeframes, and how to submit a request, see our{' '}
            <a href="/refund-policy" className="text-primary underline-offset-4 hover:underline">
              Refund Policy
            </a>
            .
          </Section>

          <Section title="5. Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1 marker:text-muted-foreground">
              <li>Use the Service for unlawful, harmful, or fraudulent activity.</li>
              <li>Attempt to access data belonging to other restaurants or users.</li>
              <li>Reverse-engineer, copy, or resell the Service or its components.</li>
              <li>Upload malicious code, spam, or content that violates third-party rights.</li>
            </ul>
          </Section>

          <Section title="6. Customer data &amp; privacy">
            Restaurants own the data they upload (menu, orders, customer details). We
            process this data on their behalf to operate the Service. See our{' '}
            <a href="/privacy" className="text-primary underline-offset-4 hover:underline">
              Privacy Policy
            </a>{' '}
            for details on how personal data is handled.
          </Section>

          <Section title="7. Service availability">
            We strive for high availability but do not guarantee uninterrupted access.
            Scheduled maintenance, third-party outages, or force-majeure events may cause
            temporary unavailability. We are not liable for losses arising from such
            interruptions.
          </Section>

          <Section title="8. Intellectual property">
            All software, design, and branding of the Service remain our property.
            Restaurants retain ownership of their own content (menu items, photos,
            branding) and grant us a limited license to host and display it as needed to
            operate the Service.
          </Section>

          <Section title="9. Termination">
            We may suspend or terminate accounts that violate these terms, fail to pay, or
            misuse the Service. You may cancel your subscription at any time from your
            billing settings; access continues until the end of the paid period.
          </Section>

          <Section title="10. Limitation of liability">
            To the fullest extent permitted by law, {siteName} is not liable for indirect,
            incidental, or consequential damages, lost profits, or data loss arising from
            use of the Service. Our total liability is limited to the amount paid by you
            in the twelve months preceding the claim.
          </Section>

          <Section title="11. Changes to these terms">
            We may update these terms from time to time. Material changes will be
            communicated via the Service or by email. Continued use after changes take
            effect constitutes acceptance.
          </Section>

          <Section title="12. Contact">
            Questions about these terms? Reach us via the{' '}
            <a href="/contact" className="text-primary underline-offset-4 hover:underline">
              contact page
            </a>
            .
          </Section>
        </article>
      </section>
    </MarketingLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight" dangerouslySetInnerHTML={{ __html: title }} />
      <div className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
