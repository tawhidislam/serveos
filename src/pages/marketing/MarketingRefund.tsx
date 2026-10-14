import MarketingLayout from '@/components/marketing/MarketingLayout';
import { usePlatformBranding } from '@/hooks/usePlatformSettings';

export default function MarketingRefund() {
  const { siteName } = usePlatformBranding();
  const updated = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <MarketingLayout
      title={`Refund Policy — ${siteName}`}
      description={`Refund rules for ${siteName} subscriptions and add-ons: eligibility, timeframes, prorations, and how to request a refund.`}
      canonical="/refund-policy"
    >
      <section className="max-w-3xl mx-auto px-6 lg:px-10 py-20">
        <header className="mb-12 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Legal</p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
            Refund Policy
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: {updated}</p>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed pt-2">
            This policy explains when and how refunds are issued for {siteName} subscriptions
            and add-on purchases. By subscribing or purchasing, you agree to these terms in
            addition to our{' '}
            <a href="/terms" className="text-primary underline-offset-4 hover:underline">
              Terms &amp; Conditions
            </a>
            .
          </p>
        </header>

        <article className="space-y-10 text-foreground/90 leading-relaxed">
          <Section title="1. General principle">
            Subscription fees and add-on purchases are <strong>generally non-refundable</strong>.
            Because access to the Service is granted immediately upon successful payment (or
            upon admin approval for manual payments), we do not offer refunds for unused time,
            change of mind, or features that are available but not used.
          </Section>

          <Section title="2. Subscription refunds">
            <p>
              Monthly subscription fees are billed in advance for the upcoming billing
              period. You may cancel at any time from your billing settings; cancellation
              stops future renewals but does not refund the current period.
            </p>
            <p>Refunds for the current subscription period <em>may</em> be considered when:</p>
            <ul className="list-disc pl-6 space-y-1 marker:text-muted-foreground">
              <li>You were charged due to a verifiable billing error on our side.</li>
              <li>
                The Service experienced a sustained outage attributable to us that
                materially prevented use during the billing period.
              </li>
              <li>
                You were double-charged or charged after a confirmed cancellation.
              </li>
            </ul>
            <p>
              Approved subscription refunds are typically <strong>prorated</strong> from the
              date of the qualifying issue, not from the start of the billing period.
            </p>
          </Section>

          <Section title="3. Add-on refunds">
            <p>
              Add-ons unlock specific features and are billed either monthly or as a
              one-time purchase, as shown on the pricing page.
            </p>
            <ul className="list-disc pl-6 space-y-2 marker:text-muted-foreground">
              <li>
                <strong>Monthly add-ons:</strong> Treated like subscriptions — non-refundable
                for the current period; cancellation stops future renewals.
              </li>
              <li>
                <strong>One-time add-ons:</strong> Non-refundable once the feature has been
                activated on your account, regardless of usage. Refunds may be granted only
                if activation never occurred or the purchase was duplicated in error.
              </li>
              <li>
                <strong>Manual / mobile payments:</strong> If a manual payment was submitted
                but rejected by the platform admin, the original sender is responsible for
                reversal through their payment provider — we do not hold the funds.
              </li>
            </ul>
          </Section>

          <Section title="4. Refund window">
            Refund requests must be submitted within <strong>14 days</strong> of the disputed
            charge. Requests submitted after this window will not be considered except where
            required by applicable law.
          </Section>

          <Section title="5. Non-refundable situations">
            <p>The following are <strong>not</strong> eligible for refunds:</p>
            <ul className="list-disc pl-6 space-y-1 marker:text-muted-foreground">
              <li>Change of mind, business closure, or no longer needing the Service.</li>
              <li>
                Failure to cancel before a renewal date (please cancel from billing settings
                in advance).
              </li>
              <li>
                Partial-month usage of monthly subscriptions or add-ons after the period has
                started.
              </li>
              <li>
                Issues caused by your own infrastructure (devices, browsers, network) or
                third-party services outside our control.
              </li>
              <li>
                Accounts suspended or terminated for breach of our{' '}
                <a href="/terms" className="text-primary underline-offset-4 hover:underline">
                  Terms &amp; Conditions
                </a>
                .
              </li>
            </ul>
          </Section>

          <Section title="6. How to request a refund">
            <p>To request a refund, contact us with the following details:</p>
            <ul className="list-disc pl-6 space-y-1 marker:text-muted-foreground">
              <li>The email address on your {siteName} account.</li>
              <li>The restaurant or tenant name.</li>
              <li>The date and amount of the charge.</li>
              <li>The payment reference (or transaction ID, where available).</li>
              <li>A short description of the reason for the request.</li>
            </ul>
            <p>
              Submit your request through the{' '}
              <a href="/contact" className="text-primary underline-offset-4 hover:underline">
                contact page
              </a>
              . We aim to acknowledge requests within 2 business days and resolve them
              within 10 business days.
            </p>
          </Section>

          <Section title="7. How approved refunds are issued">
            Approved refunds are issued to the <strong>original payment method</strong>
            {' '}whenever possible. Depending on your payment provider, funds may take 5–14
            business days to appear. For manual or mobile payments, refunds are sent back to
            the originating account/number on file.
          </Section>

          <Section title="8. Chargebacks">
            Please contact us before initiating a chargeback with your bank or card issuer.
            Most issues can be resolved faster directly. Accounts with active or unresolved
            chargebacks may be suspended until the dispute is closed.
          </Section>

          <Section title="9. Changes to this policy">
            We may update this Refund Policy from time to time. Material changes will be
            communicated via the Service or by email. The “Last updated” date above always
            reflects the current version.
          </Section>

          <Section title="10. Contact">
            Questions about refunds? Reach us via the{' '}
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
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
