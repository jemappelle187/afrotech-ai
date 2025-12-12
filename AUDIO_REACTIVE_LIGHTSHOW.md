# Audio-Reactive Lightshow Implementation

## Overview
Enhanced `components/Scene.tsx` with a real-time audio-reactive lightshow that responds to beat, snare, and ambient audio levels tracked by the Scene component.

## Changes Made

### 1. Enhanced Light Modulation (lines 906-958)

#### Kick-Driven Effects (rectKey light)
- **Intensity Pulsing**: Base intensity of 8, with +10 boost on kick hits
- **Color Shifting**: Subtle blue→white gradient based on kick strength
  - White (#ffffff) at rest
  - Cool blue (#aac5ff) on kick hits
  - Blend factor: kickRef * 0.4
- **Positional Jitter**: Subtle shake synchronized to kick
  - X-axis: 0.8 + sin(t*8) * kickRef * 0.05
  - Y-axis: 1.95 + cos(t*6) * kickRef * 0.05

#### Snare-Driven Effects (backSpot light)
- **Rapid Flash**: Intensity 6 + 6 * snareRef (doubles on snare hits)
- **Color Flash**: Dynamic blue→warm transition
  - Cool blue (#86a7ff) at rest
  - Warm accent (#ff8650) on snare
  - Blend factor: snareRef * 0.6

#### Ambient-Driven Effects (fillPoint light)
- **Intensity Modulation**: 1.3 + 0.8 * ambientRef
- **Hue Rotation**: Smooth color cycling based on energy
  - HSL hue: (t * 0.08 + ambientRef * 0.3) % 1.0
  - Saturation: 0.2, Lightness: 0.85

### 2. Audio-Reactive Visual Elements (lines 1042-1077)

#### Beam Cones (3 cones)
1. **Left Kick Beam** (position: [-1.2, 2.0, -1.5])
   - Color: #8fb7ff (cool blue)
   - Opacity: 0.08 + 0.25 * kickRef
   
2. **Right Snare Beam** (position: [1.2, 2.0, -1.5])
   - Color: #ff8650 (warm orange)
   - Opacity: 0.08 + 0.25 * snareRef
   
3. **Center Ambient Beam** (position: [0, 2.5, -2.0])
   - Color: #ffffff (white)
   - Opacity: 0.06 + 0.2 * ambientRef

#### Laser Bars (2 horizontal bars)
1. **Top Snare Bar** (y: 1.5, z: -3.2)
   - From: [-1.6, 1.5, -3.2]
   - To: [1.6, 1.5, -3.2]
   - Opacity: 0.1 + 0.35 * snareRef
   
2. **Lower Kick Bar** (y: 1.8, z: -3.5)
   - From: [-1.4, 1.8, -3.5]
   - To: [1.4, 1.8, -3.5]
   - Opacity: 0.08 + 0.3 * kickRef

#### Atmospheric Haze
- **Strength**: 0.6 + 0.6 * ambientRef (doubles with high energy)
- **Color**: #4a5a7f (deep blue-gray)
- **Position**: [0, 1.5, -3]
- **Scale**: [6, 3]

## Audio Bands

The lightshow reacts to three audio bands tracked by Scene.tsx:

1. **kickRef** (0-1): Strong beat pulses, quick decay (0.85)
2. **snareRef** (0-1): Off-beat/snare hits, moderate decay (0.9)
3. **ambientRef** (0-1): Slow-moving track energy, gentle smoothing (0.05)

## Performance Optimizations

- All effects run in a single `useFrame` callback
- Color objects created once per frame, not per assignment
- Positional jitter uses small multipliers (±0.05 max)
- Opacity ranges kept subtle (0.06-0.43 range) for efficiency

## Visual Result

When music plays:
- **Kick drum**: Front key light flashes white/blue, left beam cone pulses, lower laser bar brightens
- **Snare/hi-hat**: Back spotlight flashes blue→orange, right beam cone pulses, top laser bar brightens
- **Sustained energy**: Fill light slowly cycles through hues, center beam glows, atmospheric haze intensifies

## Testing

To see the lightshow in action:
1. Start the dev server: `npm run dev`
2. Navigate to `/darkroom`
3. Connect Spotify and select a playlist
4. Start music playback
5. Watch the lights react to the beat in real-time

## Notes

- All components (BeamCone, LaserBar, AtmosphericHaze) already existed in Scene.tsx
- No new dependencies added
- No linter errors introduced
- Maintains TV-safe, projection-safe visual quality (no seizure-inducing strobing)




