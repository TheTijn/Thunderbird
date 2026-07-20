// Reads scene colors from the active game theme stylesheet so the canvas
// re-themes with the same CSS swap mechanism as the DOM.
const KEYS = {
  curve: '--tb-scene-curve',
  curveFillTop: '--tb-scene-curve-fill-top',
  curveFillBottom: '--tb-scene-curve-fill-bottom',
};

export function readSceneTheme() {
  const style = getComputedStyle(document.documentElement);
  const theme = {};
  Object.entries(KEYS).forEach(([key, cssVar]) => {
    theme[key] = style.getPropertyValue(cssVar).trim() || '#c6f31d';
  });
  return theme;
}
