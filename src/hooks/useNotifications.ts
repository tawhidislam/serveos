import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

// Shared AudioContext — reused across all beeps to avoid leaking contexts
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/** Play a beep with given frequency, duration, volume, and optional waveform */
function playBeep(frequency: number, duration: number, volume = 0.3, type: OscillatorType = 'sine') {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

/** Play a two-tone chime */
function playChime(freq1: number, freq2: number, duration: number, volume: number) {
  const ctx = getAudioContext();
  if (!ctx) return;
  // First tone
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.type = 'sine';
  osc1.frequency.value = freq1;
  gain1.gain.value = volume;
  gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration * 0.5);
  osc1.start(ctx.currentTime);
  osc1.stop(ctx.currentTime + duration * 0.5);
  // Second tone
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.type = 'sine';
  osc2.frequency.value = freq2;
  gain2.gain.value = volume;
  gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  osc2.start(ctx.currentTime + duration * 0.35);
  osc2.stop(ctx.currentTime + duration);
}

// ── Sound presets ──────────────────────────────────────────
export type SoundPreset = 'classic' | 'chime' | 'urgent' | 'soft' | 'double';

export const SOUND_PRESETS: { id: SoundPreset; label: string; description: string }[] = [
  { id: 'classic', label: 'Classic Beep', description: 'Standard single-tone alert' },
  { id: 'chime', label: 'Chime', description: 'Pleasant two-tone chime' },
  { id: 'urgent', label: 'Urgent', description: 'High-pitched square wave' },
  { id: 'soft', label: 'Soft', description: 'Gentle low-frequency tone' },
  { id: 'double', label: 'Double Beep', description: 'Two quick beeps' },
];

function getVolume(): number {
  try {
    const v = parseFloat(localStorage.getItem('notification-volume') ?? '');
    if (!isNaN(v) && v >= 0 && v <= 1) return v;
  } catch {}
  return 0.7;
}

const VOLUME_KEY = 'notification-volume';

export function getStoredVolume(): number { return getVolume(); }

export function setStoredVolume(v: number) {
  try { localStorage.setItem(VOLUME_KEY, String(Math.max(0, Math.min(1, v)))); } catch {}
}

const presetPlayers: Record<SoundPreset, () => void> = {
  classic: () => { const v = getVolume(); playBeep(880, 0.3, v * 0.57); },
  chime: () => { const v = getVolume(); playChime(660, 880, 0.5, v * 0.5); },
  urgent: () => { const v = getVolume(); playBeep(1200, 0.25, v * 0.64, 'square'); },
  soft: () => { const v = getVolume(); playBeep(440, 0.4, v * 0.36); },
  double: () => { const v = getVolume(); playBeep(880, 0.15, v * 0.5); setTimeout(() => playBeep(880, 0.15, v * 0.5), 200); },
};

/** Play a specific sound preset */
export function playSoundPreset(preset: SoundPreset) {
  presetPlayers[preset]?.();
}

// ── Per-event sound preferences ──
export type SoundEvent = 'newOrder' | 'orderReady' | 'waiterCall' | 'generic';

export const SOUND_EVENTS: { id: SoundEvent; label: string; description: string; defaultPreset: SoundPreset }[] = [
  { id: 'newOrder', label: 'New Order', description: 'When a new order is placed', defaultPreset: 'classic' },
  { id: 'orderReady', label: 'Order Ready', description: 'When an order is ready for pickup', defaultPreset: 'chime' },
  { id: 'waiterCall', label: 'Waiter Call', description: 'When a guest requests a waiter', defaultPreset: 'urgent' },
];

const EVENT_STORAGE_PREFIX = 'notification-sound-event-';

export function getEventSoundPreset(event: SoundEvent): SoundPreset {
  try {
    const v = localStorage.getItem(EVENT_STORAGE_PREFIX + event);
    if (v && presetPlayers[v as SoundPreset]) return v as SoundPreset;
  } catch {}
  const meta = SOUND_EVENTS.find(e => e.id === event);
  return meta?.defaultPreset ?? 'classic';
}

export function setEventSoundPreset(event: SoundEvent, preset: SoundPreset) {
  try { localStorage.setItem(EVENT_STORAGE_PREFIX + event, preset); } catch {}
}

// Legacy global preset (still used as fallback for 'generic')
const STORAGE_KEY = 'notification-sound-preset';

export function getStoredSoundPreset(): SoundPreset {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && presetPlayers[v as SoundPreset]) return v as SoundPreset;
  } catch {}
  return 'classic';
}

export function setStoredSoundPreset(preset: SoundPreset) {
  try { localStorage.setItem(STORAGE_KEY, preset); } catch {}
}

function playForType(soundType: SoundEvent) {
  const preset = getEventSoundPreset(soundType);
  playSoundPreset(preset);
}

/**
 * Hook that tracks order IDs and fires alerts when new ones appear.
 */
export function useOrderNotification(options: {
  soundType?: SoundEvent;
  enabled?: boolean;
  label?: string;
} = {}) {
  const { soundType = 'generic', enabled = true, label = 'New update' } = options;
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const checkForNew = useCallback((currentIds: string[]) => {
    if (!enabled) return;

    if (!initializedRef.current) {
      knownIdsRef.current = new Set(currentIds);
      initializedRef.current = true;
      return;
    }

    const newIds = currentIds.filter(id => !knownIdsRef.current.has(id));
    if (newIds.length > 0) {
      playForType(soundType);
      toast.info(
        newIds.length === 1 ? `${label}` : `${newIds.length} ${label.toLowerCase()}s`,
        { duration: 4000 }
      );

      if (Notification.permission === 'granted') {
        new Notification(label, {
          body: newIds.length === 1 ? 'Tap to view' : `${newIds.length} new items`,
          icon: '/favicon.ico',
        });
      }
    }

    knownIdsRef.current = new Set(currentIds);
  }, [enabled, soundType, label]);

  const requestPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  return { checkForNew, requestPermission };
}

/**
 * Hook to detect when specific orders transition to a target status.
 */
export function useStatusChangeNotification(options: {
  targetStatus: string;
  soundType?: SoundEvent;
  enabled?: boolean;
  label?: string;
}) {
  const { targetStatus, soundType = 'orderReady', enabled = true, label = 'Order ready' } = options;
  const prevStatusMapRef = useRef<Map<string, string>>(new Map());
  const initializedRef = useRef(false);

  const checkStatusChanges = useCallback(
    (orders: { id: string; status: string }[]) => {
      if (!enabled) return;

      if (!initializedRef.current) {
        for (const o of orders) prevStatusMapRef.current.set(o.id, o.status);
        initializedRef.current = true;
        return;
      }

      const changed: string[] = [];
      for (const o of orders) {
        const prev = prevStatusMapRef.current.get(o.id);
        if (prev && prev !== o.status && o.status === targetStatus) {
          changed.push(o.id);
        }
        prevStatusMapRef.current.set(o.id, o.status);
      }

      if (changed.length > 0) {
        playForType(soundType);
        toast.info(
          changed.length === 1 ? label : `${changed.length} orders — ${label.toLowerCase()}`,
          { duration: 5000 }
        );

        if (Notification.permission === 'granted') {
          new Notification(label, {
            body: `${changed.length} order${changed.length > 1 ? 's' : ''}`,
            icon: '/favicon.ico',
          });
        }
      }
    },
    [enabled, targetStatus, soundType, label],
  );

  return { checkStatusChanges };
}
