// A origem é configurada pelo servidor, nunca por X-Forwarded-* enviado pelo cliente.
export function hostingConfig(env = process.env) {
  const configured = env.PUBLIC_ORIGIN || env.RENDER_EXTERNAL_URL || '';
  let publicOrigin = '';
  if (configured) {
    try {
      const url = new URL(configured);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== '/'
      )
        throw new Error();
      publicOrigin = url.origin;
    } catch {
      throw new Error('PUBLIC_ORIGIN deve conter somente uma origem HTTP/HTTPS válida.');
    }
  }
  return {
    publicOrigin,
    secureCookies: publicOrigin.startsWith('https://'),
    temporarySaves: env.DIGLA_TEMPORARY_SAVES === '1',
  };
}
