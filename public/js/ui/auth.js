import { api } from '../api.js';
import { $, errorAt } from './dom.js';
import { createOutfitPicker } from './outfit.js';

// Formulários de entrada/cadastro. Senhas nunca são gravadas pelo navegador.
export function createAuth({ onEnter }) {
  let mode = 'login',
    pendingCredentials = null;
  const picker = createOutfitPicker({
    onBack() {
      pendingCredentials = null;
      $('username').focus();
    },
    async onConfirm(outfit) {
      if (!pendingCredentials) return;
      openWorld(await api('register', { ...pendingCredentials, outfit }));
    },
  });

  function setMode(next) {
    mode = next;
    errorAt('auth-error', '');
    for (const name of ['login', 'register']) {
      $(name + '-tab').classList.toggle('active', name === mode);
      $(name + '-tab').setAttribute('aria-selected', name === mode);
    }
    $('auth-submit').firstElementChild.textContent =
      mode === 'login' ? 'Entrar no mundo' : 'Escolher meu personagem';
    $('password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    $('password-hint').hidden = mode !== 'register';
    $('auth-note').textContent =
      mode === 'login'
        ? 'Seu mundo está esperando por você.'
        : 'Sem e-mail. Só um nome, uma senha e uma nova história.';
  }

  function openWorld(account) {
    pendingCredentials = null;
    $('username').value = account.username;
    $('password').value = '';
    $('password').type = 'password';
    $('toggle-password').setAttribute('aria-label', 'Mostrar senha');
    picker.hide();
    onEnter(account);
  }

  $('login-tab').onclick = () => setMode('login');
  $('register-tab').onclick = () => setMode('register');
  $('toggle-password').onclick = () => {
    const show = $('password').type === 'password';
    $('password').type = show ? 'text' : 'password';
    $('toggle-password').setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    $('toggle-password').title = show ? 'Ocultar senha' : 'Mostrar senha';
  };
  document.querySelectorAll('[role="tab"]').forEach((tab) =>
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      setMode(mode === 'login' ? 'register' : 'login');
      $(mode + '-tab').focus();
    }),
  );
  $('account-form').onsubmit = async (event) => {
    event.preventDefault();
    errorAt('auth-error', '');
    const username = $('username').value.trim(),
      password = $('password').value;
    if (!/^[\p{L}\p{N}_ -]{3,20}$/u.test(username)) {
      errorAt('auth-error', 'Use de 3 a 20 letras, números, espaços, hífen ou sublinhado.');
      $('username').focus();
      return;
    }
    if (mode === 'register') {
      pendingCredentials = { username, password };
      picker.show(username);
      return;
    }
    $('auth-submit').disabled = true;
    $('auth-submit').firstElementChild.textContent = 'Entrando…';
    try {
      openWorld(await api('login', { username, password }));
    } catch (error) {
      errorAt('auth-error', error.message);
    } finally {
      $('auth-submit').disabled = false;
      $('auth-submit').firstElementChild.textContent = 'Entrar no mundo';
    }
  };

  return {
    openWorld,
    showLogin(message = '') {
      picker.hide();
      setMode('login');
      errorAt('auth-error', message);
      $('username').focus();
    },
  };
}
