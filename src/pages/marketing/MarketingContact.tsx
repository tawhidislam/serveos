import { useState } from 'react';
import { z } from 'zod';
import { Mail, Phone, MapPin, Clock, Send, Loader2, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import MarketingLayout from '@/components/marketing/MarketingLayout';
import { Section, SectionHeading } from '@/components/marketing/Section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useMarketingContact, CONTACT_DEFAULT, type ContactInfoEntry } from '@/hooks/useMarketingContact';
import { cn } from '@/lib/utils';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  mail: Mail,
  phone: Phone,
  map: MapPin,
  clock: Clock,
};

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name too long'),
  email: z.string().trim().email('Invalid email').max(200),
  company: z.string().trim().max(200).optional(),
  reason: z.string().trim().max(100).optional(),
  message: z.string().trim().min(10, 'Please write at least 10 characters').max(5000),
});

export default function MarketingContact() {
  const { data: settings } = useMarketingContact();
  const cfg = settings ?? { id: '', ...CONTACT_DEFAULT };

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contactSchema.safeParse({ name, email, company, reason, message });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('marketing_contact_submissions').insert({
        name: parsed.data.name,
        email: parsed.data.email,
        company: parsed.data.company || null,
        reason: parsed.data.reason || null,
        message: parsed.data.message,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
      });
      if (error) throw error;
      toast.success("Thanks — we'll reply by email. For a faster answer, use the chat button.");
      setName(''); setEmail(''); setCompany(''); setReason(''); setMessage('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MarketingLayout
      title="Contact — Talk to the ServeOS team"
      description="Get in touch with the ServeOS team. Sales, support, partnerships — we'd love to hear from you."
      canonical="/contact"
      keywords="contact ServeOS, restaurant software support, restaurant software sales"
    >
      <Section className="!pt-16">
        <SectionHeading
          eyebrow={cfg.eyebrow}
          title={cfg.title}
          description={cfg.description}
        />

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Contact info */}
          <div className="space-y-5">
            {cfg.contact_info.map((c: ContactInfoEntry, i: number) => {
              const Icon = ICONS[c.icon] ?? Mail;
              return (
                <div key={`${c.label}-${i}`} className="rounded-xl border border-border/60 bg-card p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-line">{c.value}</p>
                </div>
              );
            })}
            {cfg.response_time_text && (
              <p className="text-xs text-muted-foreground px-1">{cfg.response_time_text}</p>
            )}
          </div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            onSubmit={onSubmit}
            className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-7 space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cname">Name</Label>
                <Input id="cname" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" required maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cemail">Email</Label>
                <Input id="cemail" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@restaurant.com" required maxLength={200} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ccompany">Restaurant / Company <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="ccompany" value={company} onChange={e => setCompany(e.target.value)} placeholder="Your restaurant" maxLength={200} />
              </div>
              {cfg.reasons.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="creason">Reason</Label>
                  <div className="relative">
                    <select
                      id="creason"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      className={cn(
                        "flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm",
                        "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      )}
                    >
                      <option value="">Select…</option>
                      {cfg.reasons.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cmsg">Message</Label>
              <Textarea
                id="cmsg"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us about your restaurant and what you're looking for..."
                rows={6}
                required
                maxLength={5000}
              />
              <p className="text-xs text-muted-foreground">{message.length}/5000</p>
            </div>
            <Button type="submit" size="lg" className="gap-2" disabled={submitting}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
              ) : (
                <>Send message <Send className="h-4 w-4" /></>
              )}
            </Button>
          </motion.form>
        </div>
      </Section>
    </MarketingLayout>
  );
}
