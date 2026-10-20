// Small, scalable illustrations shared by the four lightning skill buttons.
const BOLT =
  '<path d="m37 9-20 27h14l-5 20 23-31H35l8-16Z" fill="#fff4aa" stroke="#e3ac39" stroke-width="2"/>';
const ART = {
  q: `<circle cx="32" cy="34" r="23" fill="#377caf" opacity=".35"/><path d="m12 17 7 3M49 44l6 5M9 43l8-3" stroke="#9beeff" stroke-width="2"/>${BOLT}`,
  w: '<path d="M32 7C25 20 14 29 14 41a18 18 0 0 0 36 0C50 29 39 20 32 7Z" fill="#7663ba" stroke="#b8a0fa" stroke-width="2"/><path d="m35 19-15 22h11l-2 13 16-23H34l5-12Z" fill="#fff190"/><circle cx="11" cy="19" r="3" fill="#d7c3ff"/><circle cx="54" cy="28" r="2" fill="#fff5b6"/>',
  e: '<path d="m8 44 24-12 24 12-24 13Z" fill="#29486e" stroke="#71d9f4"/><path d="m20 38 24 12m-24 0 24-12M8 44h48" fill="none" stroke="#71d9f4" opacity=".6"/><path d="M12 20a9 9 0 0 1 12-9 12 12 0 0 1 23 5 7 7 0 0 1 4 14H15a6 6 0 0 1-3-10Z" fill="#65759c" stroke="#aac8ed"/><path d="m24 25-8 14h7l-3 8 13-17h-8l4-5m15 0-8 14h7l-3 8 13-17h-8l4-5" fill="#fff09a"/>',
  r: '<ellipse cx="32" cy="42" rx="28" ry="15" fill="none" stroke="#69dffb" stroke-width="2"/><ellipse cx="32" cy="42" rx="20" ry="10" fill="none" stroke="#fff3a0" stroke-width="3"/><path d="m6 32 7 2-4 7m46-12-7 4 6 6M25 55l6-4 6 4" fill="none" stroke="#fff3a0" stroke-width="2"/><path d="m36 7-16 24h12l-4 16 18-24H34l7-16Z" fill="#fff6bc" stroke="#d9a737"/>',
};
export const abilityIcon = (key) =>
  `<svg class="ability-icon" viewBox="0 0 64 64" aria-hidden="true">${ART[key] || ''}</svg>`;
