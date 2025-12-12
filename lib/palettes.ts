export function palette(
  env: 'darkroom' | 'beach', 
  energy = 0.5, 
  valence = 0.5
) {
  if (env === 'beach') {
    return { 
      base: '#0a0214', 
      key: '#ffb347', 
      accent: '#b388ff', 
      intensity: 0.4 + energy * 0.6 
    };
  }
  return { 
    base: '#000000', 
    key: '#9a7cff', 
    accent: '#ffd166', 
    intensity: 0.3 + energy * 0.7 
  };
}




