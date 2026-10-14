import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { wipe } from '@remotion/transitions/wipe';
import { PersistentBackground } from './components/PersistentBackground';
import { SceneHook } from './scenes/SceneHook';
import { SceneBreak } from './scenes/SceneBreak';
import { SceneReveal } from './scenes/SceneReveal';
import { SceneMontage } from './scenes/SceneMontage';
import { SceneClose } from './scenes/SceneClose';

/**
 * ServeOS — 18s promo
 * 5 scenes wired with TransitionSeries. Persistent ambient bg behind everything.
 *
 * Timing (30fps):
 *   Hook 90f (3s) → wipe 15f → Break 60f (2s) → fade 15f → Reveal 180f (6s)
 *   → fade 15f → Montage 180f (6s) → fade 15f → Close 90f (3s)
 *   total = 600 - 60 = 540 frames = 18s
 */
export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <PersistentBackground />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={90}>
          <SceneHook />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: 'from-left' })}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={60}>
          <SceneBreak />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={180}>
          <SceneReveal />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={180}>
          <SceneMontage />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={90}>
          <SceneClose />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
