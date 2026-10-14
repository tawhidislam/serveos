import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useWebsitePrefix } from '@/hooks/useWebsitePrefix';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { resolveContact } from '@/lib/contact-info';
import TenantLogo from '@/components/TenantLogo';

export default function WebsiteFooter() {
  const { data: settings, isLoading } = useSettings();
  const { data: restaurant } = useCurrentRestaurant();
  const { withPrefix } = useWebsitePrefix();
  const name = settings?.restaurant_name || 'RestaurantOS';
  const contact = resolveContact(
    { phone: settings?.contact_phone, address: settings?.address },
    { phone: restaurant?.phone, address: restaurant?.address },
  );


  return (
    <footer className="bg-[#070707] border-t border-white/[0.05]">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 py-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <TenantLogo
                sizeClassName="h-9 w-9"
                roundedClassName="rounded-lg"
                bgClassName="bg-amber-500"
                fallbackTextClassName="text-black text-sm font-bold"
                loading="lazy"
              />
              <span
                className={`text-sm font-bold text-white transition-opacity duration-150 ${
                  isLoading ? 'opacity-0' : 'opacity-100'
                }`}
              >
                {name}
              </span>
            </div>
            <p className="text-sm text-white/20 leading-relaxed">
              Experience culinary excellence in every bite. Crafted with passion, served with love.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-white/40 mb-4">Navigate</h4>
            <div className="space-y-2.5">
              {[
                { to: withPrefix('/'), label: 'Home' },
                { to: withPrefix('/about'), label: 'About Us' },
                { to: withPrefix('/menu'), label: 'Our Menu' },
                { to: withPrefix('/gallery'), label: 'Gallery' },
                { to: withPrefix('/contact'), label: 'Contact' },
              ].map(link => (
                <Link key={link.to} to={link.to} className="block text-sm text-white/25 hover:text-white/60 transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Hours */}
          <div>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-white/40 mb-4">Hours</h4>
            <div className="text-sm text-white/25 space-y-1.5">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 shrink-0 text-amber-500/30" strokeWidth={1.5} />
                <div>
                  <p>Mon – Fri: 11am – 10pm</p>
                  <p>Sat – Sun: 10am – 11pm</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-white/40 mb-4">Contact</h4>
            <div className="space-y-2.5 text-sm text-white/25">
              {contact.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-amber-500/30" strokeWidth={1.5} />
                  {contact.mapsHref ? (
                    <a
                      href={contact.mapsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white/60 transition-colors"
                    >
                      {contact.address}
                    </a>
                  ) : (
                    <span>{contact.address}</span>
                  )}
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-amber-500/30" strokeWidth={1.5} />
                  {contact.phoneHref ? (
                    <a href={contact.phoneHref} className="hover:text-white/60 transition-colors">{contact.phone}</a>
                  ) : (
                    <span>{contact.phone}</span>
                  )}
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-amber-500/30" strokeWidth={1.5} />
                  <a href={contact.emailHref} className="hover:text-white/60 transition-colors">{contact.email}</a>
                </div>
              )}
              {!contact.address && !contact.phone && !contact.email && (
                <p className="text-white/20">Contact details coming soon.</p>
              )}
            </div>
          </div>

        </div>

        <div className="mt-16 pt-6 border-t border-white/[0.05] text-center text-xs text-white/15">
          © {new Date().getFullYear()} {name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
