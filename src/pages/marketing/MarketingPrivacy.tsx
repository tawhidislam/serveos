import MarketingLayout from '@/components/marketing/MarketingLayout';
import { usePlatformBranding } from '@/hooks/usePlatformSettings';

export default function MarketingPrivacy() {
  const { siteName } = usePlatformBranding();
  const updated = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <MarketingLayout
      title={`Privacy Policy — ${siteName}`}
      description={`How ${siteName} collects, uses, stores, and protects personal data for restaurant owners, staff, and customers.`}
      canonical="/privacy"
    >
      <section className="max-w-3xl mx-auto px-6 lg:px-10 py-20">
        <header className="mb-12 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Legal</p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: {updated}</p>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed pt-2">
            This Privacy Policy explains how {siteName} (the &ldquo;Service&rdquo;) collects,
            uses, shares, and protects information when you use our website, dashboard, and
            related features. It applies to restaurant owners, staff, and end customers.
          </p>
        </header>

        <article className="space-y-10 text-foreground/90 leading-relaxed">
          <Section title="1. Who we are">
            {siteName} provides restaurant management software including QR ordering,
            kitchen displays, billing, and analytics. For data submitted by restaurants
            about their own customers and staff, the restaurant is the data controller and
            we act as the data processor.
          </Section>

          <Section title="2. Data we collect">
            <p>We collect the following categories of information:</p>
            <ul className="list-disc pl-6 space-y-1 marker:text-muted-foreground">
              <li>
                <strong>Account data:</strong> name, email, hashed password, role, and
                restaurant association.
              </li>
              <li>
                <strong>Restaurant data:</strong> restaurant name, branches, menu items,
                prices, images, branding, and operating settings.
              </li>
              <li>
                <strong>Order &amp; transaction data:</strong> orders, payment method,
                amounts, tips, refunds, and timestamps.
              </li>
              <li>
                <strong>Customer data (entered by restaurants):</strong> guest names,
                contact info, loyalty points, reservation details.
              </li>
              <li>
                <strong>Usage &amp; device data:</strong> IP address, browser, device type,
                pages visited, and basic interaction logs for security and analytics.
              </li>
              <li>
                <strong>Support &amp; contact data:</strong> messages submitted through the
                contact form or sent to our support channels.
              </li>
            </ul>
          </Section>

          <Section title="3. How we use data">
            <ul className="list-disc pl-6 space-y-1 marker:text-muted-foreground">
              <li>To operate the Service: authentication, ordering, billing, and analytics.</li>
              <li>To communicate about your account, billing, and important updates.</li>
              <li>To prevent fraud, abuse, and unauthorized access.</li>
              <li>To improve product features, performance, and reliability.</li>
              <li>To comply with legal obligations and enforce our Terms.</li>
            </ul>
            <p>
              We do <strong>not</strong> sell personal data, and we do not use customer data
              from one restaurant to benefit another.
            </p>
          </Section>

          <Section title="4. Legal bases">
            We process personal data on the following lawful bases (where applicable under
            GDPR or similar laws): performance of a contract (providing the Service),
            legitimate interests (security, product improvement), consent (optional
            features such as marketing), and legal obligation (tax and accounting records).
          </Section>

          <Section title="5. Cookies &amp; similar technologies">
            We use a small number of cookies and local storage entries strictly required to
            keep you signed in, remember your cart, and protect against abuse. We do not
            use third-party advertising cookies. You can clear cookies at any time from
            your browser settings; doing so may sign you out and reset preferences.
          </Section>

          <Section title="6. Sharing of data">
            <p>We share data only with:</p>
            <ul className="list-disc pl-6 space-y-1 marker:text-muted-foreground">
              <li>
                <strong>Infrastructure providers</strong> (hosting, database, file storage)
                under data-processing agreements.
              </li>
              <li>
                <strong>Payment and messaging providers</strong> when you use those
                features, limited to what is required to complete the transaction.
              </li>
              <li>
                <strong>Authorities</strong> when required by law, valid legal process, or
                to protect rights and safety.
              </li>
            </ul>
            <p>
              Restaurant staff with appropriate roles can access the data of their own
              restaurant. Platform admins have access only for support, security, and
              billing administration.
            </p>
          </Section>

          <Section title="7. Data retention">
            We retain account, restaurant, and transaction data for as long as your
            subscription is active and for a reasonable period afterwards to satisfy legal,
            accounting, or audit requirements. Contact-form submissions and security logs
            are retained for up to 24 months unless a longer period is required by law.
          </Section>

          <Section title="8. Security">
            We use industry-standard safeguards including encrypted connections (HTTPS),
            hashed passwords, role-based access control, and database row-level security to
            isolate restaurants from each other. No system is perfectly secure, so please
            keep your credentials confidential and notify us promptly of any suspected
            compromise.
          </Section>

          <Section title="9. Your rights">
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-1 marker:text-muted-foreground">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction or deletion of inaccurate or unnecessary data.</li>
              <li>Object to or restrict certain types of processing.</li>
              <li>Request a portable copy of your data.</li>
              <li>Withdraw consent for optional processing at any time.</li>
            </ul>
            <p>
              For data your restaurant uploaded about its own customers, please contact the
              restaurant directly — they are the controller of that data.
            </p>
          </Section>

          <Section title="10. International transfers">
            Your data may be processed in regions where our infrastructure providers
            operate. Where required, transfers are protected by standard contractual
            clauses or equivalent safeguards.
          </Section>

          <Section title="11. Children">
            The Service is not directed to children under 13 (or the equivalent minimum age
            in your jurisdiction). We do not knowingly collect personal data from children.
          </Section>

          <Section title="12. Changes to this policy">
            We may update this Privacy Policy from time to time. Material changes will be
            communicated via the Service or by email. The &ldquo;Last updated&rdquo; date
            above always reflects the current version.
          </Section>

          <Section title="13. Contact">
            Questions about this policy or your data? Reach us via the{' '}
            <a href="/contact" className="text-primary underline-offset-4 hover:underline">
              contact page
            </a>
            . See also our{' '}
            <a href="/terms" className="text-primary underline-offset-4 hover:underline">
              Terms &amp; Conditions
            </a>{' '}
            and{' '}
            <a href="/refund-policy" className="text-primary underline-offset-4 hover:underline">
              Refund Policy
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
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
