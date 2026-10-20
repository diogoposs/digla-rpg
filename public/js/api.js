// Todo contato do navegador com o servidor passa por esta função.
import { GAME_VERSION } from './config.js';
export async function api(route, data) {
  let response;
  try {
    response = await fetch('/api/' + route, {
      method: data === undefined ? 'GET' : 'POST',
      headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch {
    throw new Error('O servidor está indisponível. Verifique a conexão e se ele está aberto.');
  }
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || 'Não foi possível concluir.');
    error.status = response.status;
    error.data = result;
    throw error;
  }
  if (['session', 'login', 'register'].includes(route) && result.gameVersion !== GAME_VERSION) {
    throw new Error(
      'O servidor está desatualizado. No terminal do jogo, use Ctrl+C e execute npm.cmd run dev. Depois atualize esta página.',
    );
  }
  return result;
}
