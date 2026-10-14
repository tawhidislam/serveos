import {
  QrCode, ChefHat, ClipboardList, BarChart3, CreditCard, Users,
  Sparkles, Zap, Shield, Star, Check, TrendingUp, Smartphone, Receipt, Bell,
  Tag, Building2, Layers, Lock, ArrowRight, Clock,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  QrCode, ChefHat, ClipboardList, BarChart3, CreditCard, Users,
  Sparkles, Zap, Shield, Star, Check, TrendingUp, Smartphone, Receipt, Bell,
  Tag, Building2, Layers, Lock, ArrowRight, Clock,
};

export const ICON_OPTIONS = Object.keys(ICONS).sort();

export function getIcon(name: string | undefined): LucideIcon {
  if (!name) return Sparkles;
  return ICONS[name] ?? Sparkles;
}
