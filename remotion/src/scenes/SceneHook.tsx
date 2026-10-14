import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from 'remotion';
import { colors } from '../theme';
import { fontSans } from '../fonts';

const tickets = [
  { text: 'Table 7 still waiting…', x: 8, y: 18, rot: -6, delay: 0 },
  { text: '86 the carbonara', x: 62, y: 12, rot: 4, delay: 4 },
  { text: 'Where is ticket #12?', x: 14, y: 58, rot: 3, delay: 8 },
  { text: 'Reprint receipt — table 4', x: 55, y: 64, rot: -3, delay: 12 },
  { text: 'No-show 7:30 booking', x: 30, y: 38, rot: -2, delay: 16 },
  { text: 'Card reader frozen', x: 70, y: 42, rot: 5, delay: 20 },
  { text: 'Server down — POS lagging', x: 20, y: 78, rot: -4, delay: 24 },
  { text: 'Missing modifier on #19', x: 60, y: 80, rot: 2, delay: 28 },
];

/**
 * Scene 1 — HOOK (90 frames / 3s)
 * Restaurant chaos: order tickets crash in from edges, pile up,
 * a faint kitchen rumble visualized as a vignette pulse.
 */
export const SceneHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ fontFamily: fontSans }}>
      {/* edge red pulse signaling overload */}
      <AbsoluteFill
        style={{
          boxShadow: `inset 0 0 220px rgba(220, 38, 38, ${interpolate(
            Math.sin((frame / fps) * 6),
            [-1, 1],
            [0.05, 0.25]
          )})`,
        }}
      />
      {tickets.map((t, i) => {
        const enter = spring({
          frame: frame - t.delay,
          fps,
          config: { damping: 12, stiffness: 180, mass: 0.8 },
        });
        const opacity = interpolate(frame - t.delay, [0, 5], [0, 1], {
          extrapolateRight: 'clamp',
          extrapolateLeft: 'clamp',
        });
        const dirX = i % 2 === 0 ? -1 : 1;
        const dirY = i % 3 === 0 ? -1 : 1;
        const tx = interpolate(enter, [0, 1], [dirX * 400, 0]);
        const ty = interpolate(enter, [0, 1], [dirY * 200, 0]);
        const scale = interpolate(enter, [0, 1], [0.6, 1]);

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${t.x}%`,
              top: `${t.y}%`,
              transform: `translate(${tx}px, ${ty}px) rotate(${t.rot}deg) scale(${scale})`,
              opacity,
              padding: '18px 26px',
              background: '#FAFAF9',
              color: '#1A1A1A',
              fontSize: 22,
              fontWeight: 500,
              fontFamily: 'monospace',
              boxShadow: '0 20px 50px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.4)',
              borderLeft: `4px solid ${colors.amber}`,
              maxWidth: 360,
              letterSpacing: -0.2,
            }}
          >
            <div style={{ fontSize: 11, color: colors.amber, fontWeight: 700, letterSpacing: 1.5, marginBottom: 4 }}>
              ORDER · {String(i + 1).padStart(3, '0')}
            </div>
            {t.text}
          </div>
        );
      })}

      {/* fading caption hint */}
      <Sequence from={45}>
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 100 }}>
          <div
            style={{
              color: colors.textFaint,
              fontSize: 18,
              letterSpacing: 4,
              textTransform: 'uppercase',
              opacity: interpolate(frame - 45, [0, 15, 35, 45], [0, 1, 1, 0], {
                extrapolateRight: 'clamp',
                extrapolateLeft: 'clamp',
              }),
            }}
          >
            Every shift. Every restaurant.
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
