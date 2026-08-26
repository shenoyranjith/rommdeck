/** Safe access to the Electron preload bridge. */
export function getApi(): Window["rommdeck"] {
  const api = window.rommdeck;
  if (!api) {
    throw new Error(
      "RommDeck bridge missing (window.rommdeck). Run via Electron (npm run dev:gui), not a plain browser tab.",
    );
  }
  return api;
}
