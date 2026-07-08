// Reads scene colors from the active game theme stylesheet so the canvas
// re-themes with the same CSS swap mechanism as the DOM.
const KEYS = {
  curve: '--tb-scene-curve',
  curveFillTop: '--tb-scene-curve-fill-top',
  curveFillBottom: '--tb-scene-curve-fill-bottom',
  ripple: '--tb-scene-ripple',
  silhouette: '--tb-scene-silhouette',
  silhouetteWindow: '--tb-scene-silhouette-window',
  dial: '--tb-scene-dial',
  dialText: '--tb-scene-dial-text',
  resultRipple: '--tb-scene-result-ripple',
};

export function readSceneTheme() {
  const style = getComputedStyle(document.documentElement);
  const theme = {};
  Object.entries(KEYS).forEach(([key, cssVar]) => {
    theme[key] = style.getPropertyValue(cssVar).trim() || '#c6f31d';
  });
  return theme;
}
