import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Plus, Minus, X, Send, LogIn, MessageSquare, Trash2, Tags,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect, type ReactNode } from 'react';
import type { CartItem, SelectedAddon } from '@/stores/cartStore';
import PromoCodeInput from '@/components/promotions/PromoCodeInput';
import TagSelector from '@/components/customization/TagSelector';
import LoyaltyWidget from '@/components/loyalty/LoyaltyWidget';
import LoyaltyBadge from '@/components/loyalty/LoyaltyBadge';
import { useActivePromotions, calculateDiscount, isHappyHourActive, type Promotion } from '@/hooks/usePromotions';

interface CartSheetProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  totalItems: number;
  totalAmount: number;
  format: (n: number) => string;
  user: any;
  submitting: boolean;
  onPlaceOrder: (promoId?: string, discount?: number, loyaltyPointsUsed?: number, loyaltyDiscount?: number) => void;
  onUpdateQuantity: (cartKey: string, qty: number) => void;
  onUpdateNotes: (cartKey: string, notes: string) => void;
  onUpdateTags: (cartKey: string, tags: string[]) => void;
  onClearCart?: () => void;
  onSignIn?: () => void; // shown when guest needs to sign in before placing order
  /** Optional delivery / pickup form rendered above the totals. */
  fulfillmentSlot?: ReactNode;
  /** Delivery charge added to the order total. */
  deliveryFee?: number;
  /** Disables the place-order button (e.g. incomplete delivery details). */
  placeDisabled?: boolean;
  placeLabel?: string;
}

export default function CartSheet({
  open, onClose, items, totalItems, totalAmount, format,
  user, submitting, onPlaceOrder, onUpdateQuantity, onUpdateNotes, onUpdateTags, onClearCart, onSignIn,
  fulfillmentSlot, deliveryFee = 0, placeDisabled = false, placeLabel = 'Place Order',
}: CartSheetProps) {
  const [noteCartKey, setNoteCartKey] = useState<string | null>(null);
  const [tagCartKey, setTagCartKey] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [loyaltyRedeemedPoints, setLoyaltyRedeemedPoints] = useState(0);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const { data: activePromos = [] } = useActivePromotions();

  // Auto-apply best available promo (non-code promos)
  useEffect(() => {
    if (appliedPromo?.promo_code) return; // user applied a code, don't override
    const autoPromos = activePromos.filter(p => !p.promo_code && isHappyHourActive(p) && (!p.max_uses || p.used_count < p.max_uses));
    let bestPromo: Promotion | null = null;
    let bestDiscount = 0;
    for (const p of autoPromos) {
      const d = calculateDiscount(p, totalAmount);
      if (d > bestDiscount) { bestDiscount = d; bestPromo = p; }
    }
    if (bestPromo && bestDiscount > 0) {
      setAppliedPromo(bestPromo);
      setDiscountAmount(bestDiscount);
    } else if (!appliedPromo?.promo_code) {
      setAppliedPromo(null);
      setDiscountAmount(0);
    }
  }, [activePromos, totalAmount]);

  // Recalculate discount when total changes
  useEffect(() => {
    if (appliedPromo) {
      setDiscountAmount(calculateDiscount(appliedPromo, totalAmount));
    }
  }, [totalAmount, appliedPromo]);

  const openNote = (cartKey: string) => {
    setNoteCartKey(cartKey);
    setNoteText(items.find(i => i.cartKey === cartKey)?.notes ?? '');
  };

  const saveNote = () => {
    if (noteCartKey) {
      onUpdateNotes(noteCartKey, noteText);
      setNoteCartKey(null);
    }
  };

  const finalTotal = Math.max(0, totalAmount - discountAmount - loyaltyDiscount) + (deliveryFee || 0);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/25 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl max-h-[85dvh] flex flex-col shadow-elevated"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            <div className="px-5 pb-3 pt-1 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-display font-bold text-card-foreground">Your Order</h2>
                <p className="text-xs text-muted-foreground">{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-1">
                {onClearCart && totalItems > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm('Clear all items from your cart?')) {
                        onClearCart();
                      }
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded-md hover:bg-destructive/10 transition-colors flex items-center gap-1"
                    aria-label="Clear cart"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Clear
                  </button>
                )}
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-secondary transition-colors">
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-5 pb-4">
              <div className="space-y-4">
                {items.map(item => {
                  const addonTotal = item.selectedAddons?.reduce((s, a) => s + a.priceModifier, 0) ?? 0;
                  const linePrice = (item.price + addonTotal) * item.quantity;
                  return (
                    <div key={item.cartKey} className="flex items-start gap-3 bg-secondary/50 rounded-xl p-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-card-foreground text-sm">{item.name}</p>
                        {item.selectedAddons && item.selectedAddons.length > 0 && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {item.selectedAddons.map(a => a.optionName).join(', ')}
                          </p>
                        )}
                        <p className="text-sm text-primary font-bold tabular-nums mt-0.5">{format(linePrice)}</p>
                        {/* Selected tags */}
                        {item.selectedTags && item.selectedTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.selectedTags.map(tag => (
                              <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-accent/10 text-[10px] font-medium text-accent-foreground">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic bg-background/50 rounded-lg px-2 py-1">"{item.notes}"</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <button
                            onClick={() => openNote(item.cartKey)}
                            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                          >
                            <MessageSquare className="h-3 w-3" strokeWidth={1.5} />
                            {item.notes ? 'Edit note' : 'Add note'}
                          </button>
                          <button
                            onClick={() => setTagCartKey(tagCartKey === item.cartKey ? null : item.cartKey)}
                            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                          >
                            <Tags className="h-3 w-3" strokeWidth={1.5} />
                            {item.selectedTags?.length ? 'Edit prefs' : 'Add prefs'}
                          </button>
                        </div>
                        {/* Inline tag selector */}
                        <AnimatePresence>
                          {tagCartKey === item.cartKey && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden mt-2"
                            >
                              <TagSelector
                                menuItemId={item.menuItemId}
                                selectedTags={item.selectedTags || []}
                                onToggle={(tagName) => {
                                  const current = item.selectedTags || [];
                                  const next = current.includes(tagName)
                                    ? current.filter(t => t !== tagName)
                                    : [...current, tagName];
                                  onUpdateTags(item.cartKey, next);
                                }}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="flex items-center gap-0.5 bg-card rounded-full p-0.5 ring-subtle shrink-0">
                        <button onClick={() => onUpdateQuantity(item.cartKey, item.quantity - 1)}
                          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-secondary transition-colors active:scale-95">
                          {item.quantity === 1 ? <Trash2 className="h-3 w-3 text-destructive" strokeWidth={2} /> : <Minus className="h-3.5 w-3.5" strokeWidth={2} />}
                        </button>
                        <span className="text-sm font-bold tabular-nums w-5 text-center">{item.quantity}</span>
                        <button onClick={() => onUpdateQuantity(item.cartKey, item.quantity + 1)}
                          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-secondary transition-colors active:scale-95">
                          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-5 border-t border-border/50 bg-card space-y-3">
              {/* Promo code input */}
              <PromoCodeInput
                orderTotal={totalAmount}
                appliedPromo={appliedPromo}
                onApply={(promo, discount) => { setAppliedPromo(promo); setDiscountAmount(discount); }}
                onRemove={() => { setAppliedPromo(null); setDiscountAmount(0); }}
                format={format}
              />

              {/* Loyalty points widget */}
              <LoyaltyWidget
                userId={user?.id}
                orderTotal={Math.max(0, totalAmount - discountAmount)}
                format={format}
                onRedeem={(pts, disc) => { setLoyaltyRedeemedPoints(pts); setLoyaltyDiscount(disc); }}
                onClearRedemption={() => { setLoyaltyRedeemedPoints(0); setLoyaltyDiscount(0); }}
                redeemedPoints={loyaltyRedeemedPoints}
              />

              {fulfillmentSlot}

              {/* Totals */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-card-foreground tabular-nums">{format(totalAmount)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-success">Discount</span>
                    <span className="text-success font-medium tabular-nums">-{format(discountAmount)}</span>
                  </div>
                )}
                {loyaltyDiscount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-primary">Points Reward</span>
                    <span className="text-primary font-medium tabular-nums">-{format(loyaltyDiscount)}</span>
                  </div>
                )}
                {deliveryFee > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Delivery fee</span>
                    <span className="text-card-foreground tabular-nums">{format(deliveryFee)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-medium text-card-foreground">Total</span>
                  <span className="text-2xl font-display font-bold tabular-nums text-card-foreground">{format(finalTotal)}</span>
                </div>
                <LoyaltyBadge userId={user?.id} orderTotal={finalTotal} variant="earn-preview" />
              </div>

              {!user && onSignIn ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground text-center">
                    Sign in to place your order — your cart will be waiting for you.
                  </p>
                  <Button
                    onClick={onSignIn}
                    className="w-full gap-2 h-12 rounded-xl text-base font-semibold"
                    size="lg"
                  >
                    <LogIn className="h-4 w-4" strokeWidth={1.5} /> Sign in to continue
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => onPlaceOrder(appliedPromo?.id, discountAmount, loyaltyRedeemedPoints, loyaltyDiscount)}
                  disabled={submitting || placeDisabled}
                  className="w-full gap-2 h-12 rounded-xl text-base font-semibold"
                  size="lg"
                >
                  {submitting ? (
                    <>Placing Order...</>
                  ) : (
                    <><Send className="h-4 w-4" strokeWidth={1.5} /> {placeLabel}</>
                  )}
                </Button>
              )}
            </div>
          </motion.div>

          {/* Note modal */}
          <AnimatePresence>
            {noteCartKey && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-[60]"
                  onClick={saveNote}
                />
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 40 }}
                  className="fixed bottom-0 left-0 right-0 z-[60] bg-card rounded-t-3xl p-5"
                >
                  <h3 className="text-sm font-semibold text-card-foreground mb-2">Special instructions</h3>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="e.g., No onions, extra sauce..."
                    autoFocus
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    maxLength={200}
                  />
                  <div className="flex gap-2 mt-3">
                    <Button variant="ghost" onClick={() => setNoteCartKey(null)} className="flex-1">Cancel</Button>
                    <Button onClick={saveNote} className="flex-1">Save Note</Button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
