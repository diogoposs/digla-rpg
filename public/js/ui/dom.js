export const $ = (id) => document.getElementById(id);

export function errorAt(id, message) {
  $(id).textContent = message;
  $(id).hidden = !message;
}
