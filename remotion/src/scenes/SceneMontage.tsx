import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Series } from 'remotion';
import { colors } from '../theme';
import { fontSans, fontDisplay } from '../fonts';

/**
 * Scene 4 — CAPABILITY MONTAGE (180 frames / 6s)
 * Four 45-frame vignettes, each highlighting one ServeOS capability.
 */
export const SceneMontage: React.FC = () => {
  return (
    <AbsoluteFill>
      <Series>
        <Series.Sequence durationInFrames={45}>
          <Vignette label="QR ORDERING" title="Scan. Order. Done." Visual={QRVisual} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={45}>
          <Vignette label="KITCHEN DISPLAY" title="From sent to ready." Visual={KitchenVisual} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={45}>
          <Vignette label="POS & BILLING" title="Settle in seconds." Visual={ReceiptVisual} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={45}>
          <Vignette label="ANALYTICS" title="Know what works." Visual={ChartVisual} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

const Vignette: React.FC<{ label: string; title: string; Visual: React.FC }> = ({ label, title, Visual }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame, fps, config: { damping: 18, stiffness: 130 } });
  const labelY = interpolate(sp, [0, 1], [20, 0]);
  const labelOp = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const titleSp = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 110 } });
  const titleY = interpolate(titleSp, [0, 1], [30, 0]);
  const titleOp = interpolate(frame - 5, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
  // Whole-vignette fade out on last 10 frames
  const exit = interpolate(frame, [35, 45], [1, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill style={{ fontFamily: fontSans, opacity: exit }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          alignItems: 'center',
          padding: '0 120px',
          gap: 80,
        }}
      >
        <div>
          <div
            style={{
              transform: `translateY(${labelY}px)`,
              opacity: labelOp,
              color: colors.amber,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 5,
              marginBottom: 28,
            }}
          >
            ◆ {label}
          </div>
          <div
            style={{
              transform: `translateY(${titleY}px)`,
              opacity: titleOp,
              fontFamily: fontDisplay,
              fontSize: 96,
              fontWeight: 600,
              color: colors.text,
              lineHeight: 1,
              letterSpacing: -3,
            }}
          >
            {title}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Visual />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const card: React.CSSProperties = {
  background: colors.bgRaised,
  border: `1px solid ${colors.border}`,
  borderRadius: 20,
  boxShadow: '0 50px 100px -20px rgba(0,0,0,0.7), 0 0 50px rgba(245,158,11,0.1)',
};

const QRVisual: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: frame - 8, fps, config: { damping: 16, stiffness: 110 } });
  const scale = interpolate(sp, [0, 1], [0.85, 1]);
  return (
    <div style={{ ...card, padding: 50, transform: `scale(${scale})` }}>
      <div
        style={{
          width: 280,
          height: 280,
          background: '#FAFAF9',
          borderRadius: 14,
          padding: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(11, 1fr)',
          gap: 3,
        }}
      >
        {Array.from({ length: 121 }).map((_, i) => {
          // pseudo-QR pattern
          const seed = (i * 9301 + 49297) % 233280;
          const on = (seed / 233280) > 0.45 || [0, 10, 110, 120, 1, 11, 100].includes(i);
          return (
            <div
              key={i}
              style={{
                background: on ? '#0A0A0A' : 'transparent',
                borderRadius: 2,
              }}
            />
          );
        })}
      </div>
      <div style={{ marginTop: 20, textAlign: 'center', color: colors.amber, fontSize: 14, fontWeight: 700, letterSpacing: 4 }}>
        TABLE 12
      </div>
    </div>
  );
};

const KitchenVisual: React.FC = () => {
  const frame = useCurrentFrame();
  const tickets = [
    { name: 'Carbonara', table: 7, status: 'preparing' },
    { name: 'Margherita ×2', table: 4, status: 'ready' },
    { name: 'Tiramisu', table: 12, status: 'preparing' },
  ];
  return (
    <div style={{ ...card, padding: 28, width: 480 }}>
      <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 600, letterSpacing: 2, marginBottom: 16 }}>
        KITCHEN · LIVE
      </div>
      {tickets.map((t, i) => {
        const delay = 12 + i * 6;
        const op = interpolate(frame - delay, [0, 12], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
        const x = interpolate(frame - delay, [0, 12], [40, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
        const isReady = t.status === 'ready';
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 18px',
              marginBottom: 10,
              borderRadius: 10,
              background: isReady ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isReady ? 'rgba(16,185,129,0.3)' : colors.border}`,
              opacity: op,
              transform: `translateX(${x}px)`,
            }}
          >
            <div>
              <div style={{ fontSize: 17, color: colors.text, fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Table {t.table}</div>
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.5,
                padding: '5px 10px',
                borderRadius: 5,
                background: isReady ? colors.success : colors.amber,
                color: '#000',
              }}
            >
              {t.status.toUpperCase()}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ReceiptVisual: React.FC = () => {
  const frame = useCurrentFrame();
  const lines = [
    { name: 'Carbonara', price: '18.00' },
    { name: 'Margherita', price: '14.00' },
    { name: 'Tiramisu', price: '9.50' },
    { name: 'Espresso ×2', price: '6.00' },
  ];
  return (
    <div
      style={{
        background: '#FAFAF9',
        color: '#0A0A0A',
        padding: 36,
        width: 360,
        fontFamily: 'monospace',
        boxShadow: '0 50px 100px rgba(0,0,0,0.7)',
      }}
    >
      <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, letterSpacing: 3, marginBottom: 22 }}>SERVEOS</div>
      <div style={{ borderTop: '1px dashed #999', borderBottom: '1px dashed #999', padding: '14px 0', marginBottom: 14 }}>
        {lines.map((l, i) => {
          const op = interpolate(frame - (10 + i * 4), [0, 8], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0', opacity: op }}>
              <span>{l.name}</span>
              <span>${l.price}</span>
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 18,
          fontWeight: 700,
          opacity: interpolate(frame - 30, [0, 8], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }),
        }}
      >
        <span>TOTAL</span>
        <span>$47.50</span>
      </div>
      <div
        style={{
          marginTop: 14,
          textAlign: 'center',
          fontSize: 12,
          color: colors.success,
          fontWeight: 700,
          letterSpacing: 2,
          opacity: interpolate(frame - 36, [0, 8], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }),
        }}
      >
        ✓ PAID
      </div>
    </div>
  );
};

const ChartVisual: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const points = [60, 45, 70, 55, 80, 75, 95, 88, 110, 105, 130, 145];
  const max = 150;
  const w = 480;
  const h = 280;
  const drawProgress = interpolate(frame - 6, [0, 30], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const visiblePoints = Math.ceil(points.length * drawProgress);
  const path = points
    .slice(0, Math.max(2, visiblePoints))
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - (p / max) * h;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const sp = spring({ frame, fps, config: { damping: 18, stiffness: 110 } });
  const scale = interpolate(sp, [0, 1], [0.92, 1]);

  return (
    <div style={{ ...card, padding: 36, transform: `scale(${scale})` }}>
      <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 600, letterSpacing: 2, marginBottom: 6 }}>
        REVENUE · 30D
      </div>
      <div style={{ fontSize: 36, color: colors.text, fontWeight: 600, letterSpacing: -1, marginBottom: 24 }}>
        $124,580 <span style={{ fontSize: 16, color: colors.success }}>+18.4%</span>
      </div>
      <svg width={w} height={h}>
        <defs>
          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.amber} stopOpacity="0.4" />
            <stop offset="100%" stopColor={colors.amber} stopOpacity="0" />
          </linearGradient>
        </defs>
        {visiblePoints > 1 && (
          <>
            <path
              d={`${path} L ${((visiblePoints - 1) / (points.length - 1)) * w} ${h} L 0 ${h} Z`}
              fill="url(#fill)"
            />
            <path d={path} fill="none" stroke={colors.amber} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </svg>
    </div>
  );
};
