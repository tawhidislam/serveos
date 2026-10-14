import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChefHat, Leaf, Award, Users, MapPin, Phone, Mail, Clock, ArrowUpRight, Send } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import WebsiteLayout from '@/components/website/WebsiteLayout';
import { useResolvedRestaurant } from '@/hooks/useResolvedRestaurant';
import { useHomepageContent } from '@/hooks/useHomepageContent';
import { useTenantSeo } from '@/hooks/useTenantSeo';
import { useCurrency } from '@/lib/currency';
import aboutImg from '@/assets/about-chef.jpg';
import heroImg from '@/assets/hero-restaurant.jpg';

export default function AboutPage() {
  const { restaurant, restaurantId } = useResolvedRestaurant();
  const { data: content } = useHomepageContent(restaurantId);
  const { format } = useCurrency();
  const { slug } = useParams<{ slug?: string }>();
  const name = restaurant?.name || 'RestaurantOS';

  const seo = (content as any)?.seo || {};
  const story = (content as any)?.story || {};
  const seoTitle = seo.about_meta_title || `About ${name} — Our Story`;
  const seoDesc = seo.about_meta_description
    || story.paragraph1
    || `Discover the story, values, and signature dishes behind ${name}.`;
  const seoImage = seo.about_og_image_url
    || seo.og_image_url
    || (content as any)?.hero?.hero_image_url
    || story.story_image_url;
  const canonicalPath = slug
    ? `/r/${slug}/about`
    : restaurant?.slug ? `/r/${restaurant.slug}/about` : '/about';

  const contactPre = (content as any)?.contact || {};
  const canonicalUrl = typeof window !== 'undefined' ? `${window.location.origin}${canonicalPath}` : canonicalPath;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': canonicalUrl,
    name,
    description: typeof seoDesc === 'string' ? seoDesc.slice(0, 300) : undefined,
    url: canonicalUrl,
    image: seoImage ? [seoImage] : undefined,
    telephone: contactPre.phone || (restaurant as any)?.phone || undefined,
    email: contactPre.email || (restaurant as any)?.email || undefined,
    servesCuisine: (content as any)?.about?.cuisine || (restaurant as any)?.cuisine_type || undefined,
    priceRange: (content as any)?.about?.price_range || undefined,
    address: (contactPre.address || (restaurant as any)?.address) ? {
      '@type': 'PostalAddress',
      streetAddress: contactPre.address || (restaurant as any)?.address,
    } : undefined,
  };
  // Strip undefined keys for cleaner JSON-LD output
  Object.keys(jsonLd).forEach((k) => (jsonLd as any)[k] === undefined && delete (jsonLd as any)[k]);

  useTenantSeo({
    title: seoTitle,
    description: typeof seoDesc === 'string' ? seoDesc.slice(0, 160) : undefined,
    ogImage: seoImage,
    canonicalPath,
    jsonLd,
    jsonLdId: 'about-restaurant-jsonld',
  });

  const contact = (content as any)?.contact || {};
  const featuredConfig = (content as any)?.featured_menu;
  const featuredItemIds: string[] = featuredConfig?.item_ids || [];

  const heroImage = (content as any)?.hero?.hero_image_url || (content as any)?.hero?.image_url || aboutImg;
  const storyImage = story.story_image_url || story.image_url || heroImg;
  const para1 = story.paragraph1 || `${name} was born from a simple belief: that extraordinary food has the power to create unforgettable moments.`;
  const para2 = story.paragraph2 || 'Our head chef brings years of culinary experience. Every dish on our menu is a celebration of flavors, textures, and artistry.';
  const overline = story.overline || 'Our Story';
  const heading1 = story.heading_line1 || 'A Journey of';
  const heading2 = story.heading_line2 || 'Flavors & Passion';
  const badgeVal = story.badge_value || '5+';
  const badgeLbl = story.badge_label || 'Years';

  // Featured highlights — same logic as HomePage
  const { data: featuredItems } = useQuery({
    queryKey: ['about-featured-items', restaurantId, featuredItemIds],
    queryFn: async () => {
      if (!restaurantId) return [];
      if (featuredItemIds.length > 0) {
        const { data } = await supabase
          .from('menu_items')
          .select('*, categories(name)')
          .in('id', featuredItemIds)
          .eq('is_available', true)
          .eq('restaurant_id', restaurantId);
        return featuredItemIds.map(id => (data || []).find(i => i.id === id)).filter(Boolean);
      }
      const { data } = await supabase
        .from('menu_items')
        .select('*, categories(name)')
        .eq('is_available', true)
        .eq('restaurant_id', restaurantId)
        .order('sort_order')
        .limit(3);
      return data || [];
    },
    enabled: !!restaurantId,
  });

  const values = [
    { icon: Leaf, title: 'Fresh Ingredients', desc: 'Locally and seasonally sourced for natural flavor.' },
    { icon: ChefHat, title: 'Expert Craftsmanship', desc: 'World-class expertise and passion in every plate.' },
    { icon: Award, title: 'Award Winning', desc: 'Recognized for culinary excellence by guests and critics.' },
    { icon: Users, title: 'Community First', desc: 'Bringing people together through great food.' },
  ];

  const contactItems = [
    contact.address_line1 && { icon: MapPin, title: 'Visit Us', lines: [contact.address_line1, contact.address_line2].filter(Boolean) },
    contact.phone && { icon: Phone, title: 'Call', lines: [contact.phone] },
    contact.email && { icon: Mail, title: 'Email', lines: [contact.email] },
    (contact.hours_weekday || contact.hours_weekend) && { icon: Clock, title: 'Hours', lines: [contact.hours_weekday, contact.hours_weekend].filter(Boolean) },
  ].filter(Boolean) as { icon: any; title: string; lines: string[] }[];

  return (
    <WebsiteLayout>
      {/* Hero */}
      <section className="relative h-[60vh] min-h-[400px] flex items-end overflow-hidden">
        <img src={heroImage} alt={`${name} - About`} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-transparent to-black/30" />
        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 w-full pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">About {name}</p>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-display font-extrabold text-white leading-[0.95] tracking-tight">
              Our Story
            </h1>
          </motion.div>
        </div>
      </section>

      {/* Story */}
      <section className="py-24 bg-[#070707] overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="relative">
              <div className="rounded-2xl overflow-hidden border border-white/[0.06]">
                <img src={storyImage} alt={name} className="w-full aspect-[4/5] object-cover" />
              </div>
              <div className="absolute -bottom-4 -right-4 sm:bottom-6 sm:right-6 bg-primary rounded-xl px-5 py-4 shadow-lg">
                <p className="text-primary-foreground font-bold text-3xl">{badgeVal}</p>
                <p className="text-primary-foreground/70 text-xs uppercase tracking-wider font-semibold">{badgeLbl}</p>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
              <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">{overline}</p>
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-white leading-tight mb-6">
                {heading1}<br />{heading2}
              </h2>
              <div className="space-y-4 text-white/40 leading-relaxed">
                <p>{para1}</p>
                <p>{para2}</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="text-center mb-16">
            <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Our Values</p>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white">What We Stand For</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 text-center hover:border-primary/20 transition-all duration-500"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <v.icon className="h-6 w-6 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="font-semibold text-white mb-2">{v.title}</h3>
                <p className="text-sm text-white/30 leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Highlights */}
      {featuredItems && featuredItems.length > 0 && (
        <section className="py-24 bg-[#070707]">
          <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16">
            <div className="flex items-end justify-between mb-12">
              <div>
                <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-2">Signature Dishes</p>
                <h2 className="text-3xl sm:text-4xl font-display font-bold text-white">Tastes of {name}</h2>
              </div>
              <Link to="menu" className="hidden sm:inline-flex items-center gap-2 text-primary hover:text-primary/80 text-sm font-semibold uppercase tracking-wider transition-colors">
                View Menu <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {featuredItems.slice(0, 3).map((item: any, i: number) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.5 }}
                  className="group bg-white/[0.03] rounded-2xl overflow-hidden border border-white/[0.06] hover:border-primary/20 transition-all duration-500"
                >
                  <div className="aspect-[16/10] overflow-hidden">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white/[0.02]">
                        <ChefHat className="h-8 w-8 text-white/[0.08]" />
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <p className="text-primary/60 text-[11px] uppercase tracking-wider font-medium mb-1.5">
                      {item.categories?.name}
                    </p>
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-white font-semibold text-[15px]">{item.name}</h3>
                      <span className="text-primary font-bold text-base tabular-nums shrink-0">{format(item.price)}</span>
                    </div>
                    {item.description && (
                      <p className="text-white/25 text-[13px] mt-2 line-clamp-2 leading-relaxed">{item.description}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Visit / Contact info */}
      {contactItems.length > 0 && (
        <section className="py-24 bg-[#0a0a0a]">
          <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16">
            <div className="text-center mb-14">
              <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Visit Us</p>
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-white">Come Say Hello</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {contactItems.map((info, i) => (
                <motion.div
                  key={info.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:border-primary/20 transition-all duration-500"
                >
                  <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <info.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-semibold text-white text-sm mb-1.5">{info.title}</h3>
                  {info.lines.map(line => (
                    <p key={line} className="text-sm text-white/40 leading-relaxed">{line}</p>
                  ))}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact form */}
      <ContactFormSection restaurantId={restaurantId} restaurantName={name} />
    </WebsiteLayout>
  );
}

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  email: z.string().trim().email('Invalid email').max(200),
  subject: z.string().trim().max(200).optional().or(z.literal('')),
  message: z.string().trim().min(5, 'Message must be at least 5 characters').max(5000, 'Message is too long'),
});

function ContactFormSection({ restaurantId, restaurantName }: { restaurantId: string | null; restaurantName: string }) {
  const [sending, setSending] = useState(false);
  const inputClass = "rounded-xl bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/30";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!restaurantId) {
      toast.error('Restaurant context not loaded yet. Please reload.');
      return;
    }
    const fd = new FormData(e.target as HTMLFormElement);
    const parsed = contactSchema.safeParse({
      name: fd.get('name'),
      email: fd.get('email'),
      subject: fd.get('subject') || '',
      message: fd.get('message'),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Please check your input');
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.from('tenant_contact_submissions').insert({
        restaurant_id: restaurantId,
        name: parsed.data.name,
        email: parsed.data.email,
        subject: parsed.data.subject || null,
        message: parsed.data.message,
        user_agent: navigator.userAgent.slice(0, 500),
      });
      if (error) throw error;
      toast.success("Message sent! We'll get back to you soon.");
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="py-24 bg-[#070707]">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 sm:p-10 hover:border-primary/20 transition-all duration-500"
        >
          <div className="text-center mb-8">
            <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Get in Touch</p>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white">Send {restaurantName} a Message</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-white/50 mb-1.5 block">Name *</label>
                <Input required name="name" maxLength={120} placeholder="Your name" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-white/50 mb-1.5 block">Email *</label>
                <Input required name="email" type="email" maxLength={200} placeholder="your@email.com" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-white/50 mb-1.5 block">Subject</label>
              <Input name="subject" maxLength={200} placeholder="Reservation, feedback, or inquiry" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-white/50 mb-1.5 block">Message *</label>
              <Textarea required name="message" maxLength={5000} placeholder="Tell us more..." rows={5} className={cn(inputClass, "resize-none")} />
            </div>
            <button
              type="submit"
              disabled={sending || !restaurantId}
              className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm uppercase tracking-wider rounded-full flex items-center gap-2.5 transition-all duration-300 hover:shadow-[0_8px_30px_hsl(var(--primary)/0.3)] disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sending ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </motion.div>
      </div>
    </section>
  );
}
