import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from 'remotion';
import { colors } from '../theme';
import { fontSans } from '../fonts';

const stats = [
  { label: 'Revenue today', value: 3847, prefix: '$', delta: '+12%', glyph: '$' },
  { label: 'Active orders', value: 12, prefix: '', delta: '4 in kitchen', glyph: '◷' },
  { label: 'Tables seated', value: 18, prefix: '', suffix: '/24', delta: '75% capacity', glyph: '▦' },
  { label: 'Avg ticket', value: 42, prefix: '$', delta: '+$3 vs last wk', glyph: '↗' },
];
const bars = [40, 65, 50, 80, 60, 95, 70, 85, 55, 90, 75, 88, 62, 78];
const topItems = [
  { name: 'Pasta Carbonara', count: 32 },
  { name: 'Margherita', count: 24 },
  { name: 'Tiramisu', count: 16 },
];

/**
 * Scene 3 — PRODUCT REVEAL (180 frames / 6s)
 * Laptop-style dashboard glides up. Stats count up. Bar chart draws.
 * Toast notification slides in. Mirrors the live website hero.
 */
export const SceneReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const riseSpring = spring({ frame, fps, config: { damping: 22, stiffness: 80, mass: 1 } });
  const riseY = interpolate(riseSpring, [0, 1], [120, 0]);
  const riseOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: fontSans, padding: 100 }}>
      <div
        style={{
          width: '100%',
          maxWidth: 1500,
          transform: `translateY(${riseY}px)`,
          opacity: riseOpacity,
        }}
      >
        {/* browser-style frame */}
        <div
          style={{
            borderRadius: 18,
            overflow: 'hidden',
            background: colors.bgRaised,
            border: `1px solid ${colors.border}`,
            boxShadow: '0 80px 120px -30px rgba(0,0,0,0.7), 0 0 60px rgba(245,158,11,0.12)',
          }}
        >
          {/* title bar */}
          <div
            style={{
              height: 44,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 18px',
              borderBottom: `1px solid ${colors.border}`,
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} />
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  color: colors.textMuted,
                  background: 'rgba(255,255,255,0.05)',
                  padding: '4px 14px',
                  borderRadius: 6,
                  border: `1px solid ${colors.border}`,
                }}
              >
                app.serveos.com/admin
              </div>
            </div>
          </div>

          {/* dashboard body */}
          <div style={{ padding: 36, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 18 }}>
            {stats.map((s, i) => {
              const delay = 18 + i * 6;
              const cardSpring = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 140 } });
              const y = interpolate(cardSpring, [0, 1], [30, 0]);
              const op = interpolate(frame - delay, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
              const countProgress = interpolate(frame - delay - 8, [0, 30], [0, 1], {
                extrapolateRight: 'clamp',
                extrapolateLeft: 'clamp',
              });
              const animatedValue = Math.round(s.value * countProgress);
              return (
                <div
                  key={i}
                  style={{
                    gridColumn: 'span 3',
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 14,
                    padding: 22,
                    transform: `translateY(${y}px)`,
                    opacity: op,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: colors.amberSoft, color: colors.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>
                      {s.glyph}
                    </div>
                    <div style={{ fontSize: 11, color: colors.success, fontWeight: 600 }}>{s.delta}</div>
                  </div>
                  <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 36, fontWeight: 600, color: colors.text, letterSpacing: -1 }}>
                    {s.prefix}
                    {animatedValue.toLocaleString()}
                    {s.suffix ?? ''}
                  </div>
                </div>
              );
            })}

            {/* Revenue chart */}
            <div
              style={{
                gridColumn: 'span 8',
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 14,
                padding: 26,
                opacity: interpolate(frame - 60, [0, 18], [0, 1], { extrapolateRight: 'clamp' }),
                transform: `translateY(${interpolate(
                  spring({ frame: frame - 60, fps, config: { damping: 20, stiffness: 110 } }),
                  [0, 1],
                  [30, 0]
                )}px)`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 13, color: colors.textMuted }}>Revenue this week</div>
                  <div style={{ fontSize: 32, fontWeight: 600, color: colors.text, letterSpacing: -1 }}>$24,180</div>
                </div>
                <div style={{ display: 'flex', gap: 4, fontSize: 12, fontWeight: 600 }}>
                  <span style={{ padding: '6px 12px', borderRadius: 6, background: colors.amber, color: '#000' }}>7D</span>
                  <span style={{ padding: '6px 12px', color: colors.textMuted }}>30D</span>
                  <span style={{ padding: '6px 12px', color: colors.textMuted }}>90D</span>
                </div>
              </div>
              <div style={{ height: 140, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                {bars.map((h, i) => {
                  const barDelay = 78 + i * 3;
                  const barProgress = interpolate(frame - barDelay, [0, 18], [0, 1], {
                    extrapolateRight: 'clamp',
                    extrapolateLeft: 'clamp',
                  });
                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: `${h * barProgress}%`,
                        background: `linear-gradient(180deg, ${colors.amber} 0%, ${colors.amber}66 100%)`,
                        borderRadius: '4px 4px 0 0',
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Top items */}
            <div
              style={{
                gridColumn: 'span 4',
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 14,
                padding: 22,
                opacity: interpolate(frame - 72, [0, 18], [0, 1], { extrapolateRight: 'clamp' }),
                transform: `translateY(${interpolate(
                  spring({ frame: frame - 72, fps, config: { damping: 20, stiffness: 110 } }),
                  [0, 1],
                  [30, 0]
                )}px)`,
              }}
            >
              <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 18 }}>Top items today</div>
              {topItems.map((it, i) => {
                const d = 90 + i * 8;
                const w = interpolate(frame - d, [0, 24], [0, (it.count / 32) * 100], {
                  extrapolateRight: 'clamp',
                  extrapolateLeft: 'clamp',
                });
                return (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span style={{ color: colors.text, fontWeight: 500 }}>{it.name}</span>
                      <span style={{ color: colors.textMuted }}>{it.count}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${w}%`, background: colors.amber, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Floating toast notification */}
      <Sequence from={120}>
        <Toast />
      </Sequence>
    </AbsoluteFill>
  );
};

const Toast: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame, fps, config: { damping: 14, stiffness: 140 } });
  const x = interpolate(sp, [0, 1], [-200, 0]);
  const op = interpolate(frame, [0, 14, 50, 60], [0, 1, 1, 1], { extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        top: '78%',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 22px 14px 14px',
        background: colors.bgRaised,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
        transform: `translateX(${x}px)`,
        opacity: op,
        fontFamily: fontSans,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'rgba(16,185,129,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.success,
          fontSize: 22,
        }}
      >
        ●
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>New order · Table 7</div>
        <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>$48.00 · just now</div>
      </div>
    </div>
  );
};
