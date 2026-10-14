import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { colors } from '../theme';
import { fontDisplay, fontSans } from '../fonts';

/**
 * Scene 5 — CLOSE (90 frames / 3s)
 * Brand mark fades in. Tagline lands. Amber underline draws beneath.
 */
export const SceneClose: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSp = spring({ frame, fps, config: { damping: 20, stiffness: 90 } });
  const logoOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  const logoY = interpolate(logoSp, [0, 1], [30, 0]);

  const lineW = interpolate(frame - 24, [0, 24], [0, 100], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  const taglineOp = interpolate(frame - 36, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const taglineY = interpolate(frame - 36, [0, 16], [12, 0], { extrapolateRight: 'clamp' });

  const urlOp = interpolate(frame - 56, [0, 14], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: fontSans }}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            transform: `translateY(${logoY}px)`,
            opacity: logoOp,
            fontFamily: fontDisplay,
            fontSize: 184,
            fontWeight: 600,
            color: colors.text,
            letterSpacing: -6,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          ServeOS
          <span style={{ color: colors.amber, fontSize: 60, transform: 'translateY(-30px)' }}>◆</span>
        </div>

        <div
          style={{
            margin: '28px auto 0',
            height: 3,
            width: 460,
            background: `linear-gradient(90deg, transparent 0%, ${colors.amber} ${lineW / 2}%, transparent ${lineW}%)`,
            opacity: 0.9,
          }}
        />

        <div
          style={{
            marginTop: 36,
            transform: `translateY(${taglineY}px)`,
            opacity: taglineOp,
            color: colors.textMuted,
            fontSize: 28,
            fontWeight: 400,
            letterSpacing: 0.4,
          }}
        >
          The operating system for modern restaurants.
        </div>

        <div
          style={{
            marginTop: 56,
            opacity: urlOp,
            color: colors.amber,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 6,
            textTransform: 'uppercase',
            fontFamily: 'monospace',
          }}
        >
          serveos.com
        </div>
      </div>
    </AbsoluteFill>
  );
};
