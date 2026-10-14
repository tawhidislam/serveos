import { motion } from 'framer-motion';
import { MapPin, Phone, Mail, Clock, Send, CalendarIcon, Users, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import WebsiteLayout from '@/components/website/WebsiteLayout';
import { useResolvedRestaurant } from '@/hooks/useResolvedRestaurant';
import { useHomepageContent } from '@/hooks/useHomepageContent';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const inputClass = "rounded-xl bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/30";

const timeSlots = [
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
  '1:00 PM', '1:30 PM', '2:00 PM', '5:00 PM',
  '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM',
  '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM',
];

export default function ContactPage() {
  const { restaurant, restaurantId } = useResolvedRestaurant();
  const { data: content } = useHomepageContent(restaurantId);
  const name = restaurant?.name || 'RestaurantOS';
  const [sending, setSending] = useState(false);
  const [booking, setBooking] = useState(false);
  const [reservationDate, setReservationDate] = useState<Date>();

  // Scroll to the reservation form when arriving from a `#reserve` CTA link.
  useEffect(() => {
    if (typeof window === 'undefined' || window.location.hash !== '#reserve') return;
    const t = window.setTimeout(() => {
      document.getElementById('reserve')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
    return () => window.clearTimeout(t);
  }, []);

  const c = (content as any)?.contact || {};

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast.success('Message sent! We\'ll get back to you soon.');
      (e.target as HTMLFormElement).reset();
    }, 1000);
  };

  const handleReservation = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!reservationDate) {
      toast.error('Please select a date');
      return;
    }
    if (!restaurantId) {
      toast.error('Restaurant context not found. Please reload.');
      return;
    }
    setBooking(true);
    const formData = new FormData(e.target as HTMLFormElement);
    try {
      const { error } = await supabase.from('reservations').insert({
        guest_name: formData.get('guest_name') as string,
        email: formData.get('email') as string,
        phone: (formData.get('phone') as string) || null,
        reservation_date: format(reservationDate, 'yyyy-MM-dd'),
        reservation_time: formData.get('time') as string,
        party_size: parseInt(formData.get('party_size') as string) || 2,
        notes: (formData.get('notes') as string) || null,
        restaurant_id: restaurantId,
      });
      if (error) throw error;
      toast.success('Reservation request submitted! We\'ll confirm shortly.');
      (e.target as HTMLFormElement).reset();
      setReservationDate(undefined);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit reservation');
    } finally {
      setBooking(false);
    }
  };

  const contactInfo = [
    { icon: MapPin, title: 'Address', lines: [c.address_line1 || '123 Culinary Street', c.address_line2 || 'Food District, FC 12345'] },
    { icon: Phone, title: 'Phone', lines: [c.phone || '+1 (555) 123-4567'] },
    { icon: Mail, title: 'Email', lines: [c.email || 'hello@restaurant.com'] },
    { icon: Clock, title: 'Hours', lines: [c.hours_weekday || 'Mon–Fri: 11am – 10pm', c.hours_weekend || 'Sat–Sun: 10am – 11pm'] },
  ];

  return (
    <WebsiteLayout>
      {/* Hero */}
      <section className="relative pt-[72px] overflow-hidden">
        <div className="bg-[#070707] py-16 sm:py-24 px-6 sm:px-10 lg:px-16 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/[0.04] rounded-full blur-3xl" />
          <div className="relative z-10 max-w-6xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Get in Touch</p>
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-display font-extrabold text-white leading-[0.95] tracking-tight mb-4">
                Contact Us
              </h1>
              <p className="text-white/40 max-w-md mx-auto text-lg leading-relaxed">
                Make a reservation or reach out for any inquiries.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Reservation */}
      <ReservationSection
        booking={booking}
        reservationDate={reservationDate}
        setReservationDate={setReservationDate}
        onSubmit={handleReservation}
      />

      {/* Contact Info + Message */}
      <ContactInfoSection
        contactInfo={contactInfo}
        sending={sending}
        onSubmit={handleSubmit}
      />
    </WebsiteLayout>
  );
}

function ReservationSection({ booking, reservationDate, setReservationDate, onSubmit }: {
  booking: boolean;
  reservationDate?: Date;
  setReservationDate: (d: Date | undefined) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section id="reserve" className="py-20 bg-[#070707] scroll-mt-24">
      <div className="max-w-4xl mx-auto px-6 sm:px-10 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 sm:p-8 hover:border-primary/20 transition-all duration-500">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <CalendarIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-white">Make a Reservation</h2>
                <p className="text-white/30 text-sm">Book your table in advance</p>
              </div>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-white/50 mb-1.5 block">Full Name *</label>
                  <Input required name="guest_name" placeholder="Your name" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-white/50 mb-1.5 block">Email *</label>
                  <Input required name="email" type="email" placeholder="your@email.com" className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-white/50 mb-1.5 block">Phone</label>
                  <Input name="phone" type="tel" placeholder="+1 (555) 000-0000" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-white/50 mb-1.5 block">Date *</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex h-10 w-full items-center justify-between rounded-xl border px-3 py-2 text-sm",
                          "bg-white/[0.04] border-white/[0.08] text-white",
                          !reservationDate && "text-white/20"
                        )}
                      >
                        {reservationDate ? format(reservationDate, 'MMM d, yyyy') : 'Pick a date'}
                        <CalendarIcon className="h-4 w-4 text-white/30" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={reservationDate}
                        onSelect={setReservationDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-sm font-medium text-white/50 mb-1.5 block">Time *</label>
                  <div className="relative">
                    <select
                      required
                      name="time"
                      defaultValue=""
                      className={cn(
                        "flex h-10 w-full rounded-xl border px-3 py-2 text-sm appearance-none",
                        "bg-white/[0.04] border-white/[0.08] text-white"
                      )}
                    >
                      <option value="" disabled className="bg-neutral-900 text-white/40">Select time</option>
                      {timeSlots.map(t => (
                        <option key={t} value={t} className="bg-neutral-900 text-white">{t}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-white/50 mb-1.5 block">Party Size *</label>
                  <div className="relative">
                    <select
                      required
                      name="party_size"
                      defaultValue="2"
                      className={cn(
                        "flex h-10 w-full rounded-xl border px-3 py-2 text-sm appearance-none",
                        "bg-white/[0.04] border-white/[0.08] text-white"
                      )}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(n => (
                        <option key={n} value={n} className="bg-neutral-900 text-white">
                          {n} {n === 1 ? 'Guest' : 'Guests'}
                        </option>
                      ))}
                    </select>
                    <Users className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-white/50 mb-1.5 block">Special Requests</label>
                  <Input name="notes" placeholder="Allergies, celebrations, etc." className={inputClass} />
                </div>
              </div>
              <button
                type="submit"
                disabled={booking}
                className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm uppercase tracking-wider rounded-full flex items-center gap-2.5 transition-all duration-300 hover:shadow-[0_8px_30px_hsl(var(--primary)/0.3)] disabled:opacity-50"
              >
                <CalendarIcon className="h-4 w-4" />
                {booking ? 'Submitting...' : 'Reserve a Table'}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ContactInfoSection({ contactInfo, sending, onSubmit }: {
  contactInfo: { icon: any; title: string; lines: string[] }[];
  sending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="py-20 bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Info */}
          <div className="lg:col-span-2 space-y-8">
            {contactInfo.map((info, i) => (
              <motion.div
                key={info.title}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="flex items-start gap-4"
              >
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <info.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">{info.title}</h3>
                  {info.lines.map(line => (
                    <p key={line} className="text-sm text-white/30">{line}</p>
                  ))}
                </div>
              </motion.div>
            ))}

            <div className="rounded-2xl overflow-hidden h-48 bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mt-8">
              <div className="text-center">
                <MapPin className="h-8 w-8 mx-auto mb-2 text-white/[0.08]" />
                <p className="text-sm text-white/20">Map view</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-3"
          >
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 sm:p-8 hover:border-primary/20 transition-all duration-500">
              <h2 className="text-xl font-display font-bold text-white mb-6">
                Send us a Message
              </h2>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-white/50 mb-1.5 block">Name</label>
                    <Input required placeholder="Your name" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-white/50 mb-1.5 block">Email</label>
                    <Input required type="email" placeholder="your@email.com" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-white/50 mb-1.5 block">Subject</label>
                  <Input required placeholder="Reservation, Feedback, or Inquiry" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-white/50 mb-1.5 block">Message</label>
                  <Textarea required placeholder="Tell us more..." rows={5} className={cn(inputClass, "resize-none")} />
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm uppercase tracking-wider rounded-full flex items-center gap-2.5 transition-all duration-300 hover:shadow-[0_8px_30px_hsl(var(--primary)/0.3)] disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
