import { motion } from 'framer-motion';

interface StatsStripProps {
  content?: {
    items?: { value: string; label: string; icon: string }[];
  };
}

const defaultStats = [
  { value: '4.9', label: 'Google Rating', icon: '★' },
  { value: '10K+', label: 'Happy Guests', icon: '♥' },
  { value: '2020', label: 'Established', icon: '◆' },
  { value: '50+', label: 'Signature Dishes', icon: '✦' },
];

export default function StatsStrip({ content }: StatsStripProps) {
  const stats = content?.items?.length ? content.items : defaultStats;

  return (
    <section className="py-16 bg-[#070707]">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <span className="text-amber-500 text-lg">{stat.icon}</span>
              </div>
              <div>
                <p className="text-white font-bold text-2xl tracking-tight">{stat.value}</p>
                <p className="text-white/30 text-xs uppercase tracking-wider mt-0.5">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
