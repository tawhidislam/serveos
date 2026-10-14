import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../theme';
import { fontDisplay, fontSans } from '../fonts';

/**
 * Scene 2 — BREAK (60 frames / 2s)
 * Single amber sweep wipes the chaos. Tagline lands.
 */
export const SceneBreak: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Sweep travels left-to-right between frames 0-25
  const sweepProgress = interpolate(frame, [0, 25], [-20, 120], {
    extrapolateRight: 'clamp',
  });

  const titleSpring = spring({
    frame: frame - 22,
    fps,
    config: { damping: 18, stiffness: 110 },
  });
  const titleY = interpolate(titleSpring, [0, 1], [40, 0]);
  const titleOpacity = interpolate(frame - 22, [0, 14], [0, 1], { extrapolateRight: 'clamp' });

  const subOpacity = interpolate(frame - 38, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
  const subY = interpolate(frame - 38, [0, 14], [16, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: fontSans }}>
      {/* Amber sweep */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(110deg, transparent 0%, transparent ${Math.max(
            0,
            sweepProgress - 8
          )}%, ${colors.amber} ${sweepProgress}%, transparent ${sweepProgress + 6}%, transparent 100%)`,
          mixBlendMode: 'screen',
          opacity: interpolate(frame, [0, 5, 20, 28], [0, 1, 1, 0], { extrapolateRight: 'clamp' }),
        }}
      />

      <div style={{ textAlign: 'center', maxWidth: 1400, padding: '0 80px' }}>
        <div
          style={{
            opacity: interpolate(frame - 18, [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
            color: colors.amber,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: 6,
            textTransform: 'uppercase',
            marginBottom: 36,
          }}
        >
          ◆ Introducing ServeOS
        </div>
        <div
          style={{
            transform: `translateY(${titleY}px)`,
            opacity: titleOpacity,
            fontFamily: fontDisplay,
            fontSize: 168,
            fontWeight: 600,
            color: colors.text,
            lineHeight: 0.95,
            letterSpacing: -4,
          }}
        >
          One system.
          <br />
          <span style={{ fontStyle: 'italic', color: colors.amber }}>Every</span> shift.
        </div>
        <div
          style={{
            marginTop: 40,
            opacity: subOpacity,
            transform: `translateY(${subY}px)`,
            color: colors.textMuted,
            fontSize: 26,
            fontWeight: 400,
            letterSpacing: 0.2,
          }}
        >
          The operating system for modern restaurants.
        </div>
      </div>
    </AbsoluteFill>
  );
};
