import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { colors } from '../theme';

/**
 * Persistent ambient layer: subtle radial amber glow that breathes,
 * dot-grid texture, and a faint vignette. Spans the entire video.
 */
export const PersistentBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const breathe = Math.sin((frame / durationInFrames) * Math.PI * 2) * 0.5 + 0.5;
  const glowOpacity = interpolate(breathe, [0, 1], [0.25, 0.45]);

  return (
    <AbsoluteFill style={{ background: colors.bg, overflow: 'hidden' }}>
      {/* dot grid */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          opacity: 0.7,
        }}
      />
      {/* breathing amber glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 55% at 50% 50%, ${colors.amber}33 0%, transparent 60%)`,
          opacity: glowOpacity,
          mixBlendMode: 'screen',
        }}
      />
      {/* vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 100% 80% at 50% 50%, transparent 50%, rgba(0,0,0,0.55) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
