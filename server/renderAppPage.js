import escapeHtml from 'escape-html';

/**
 * Renders the base HTML document for the React dashboard application.
 *
 * @param {{
 *   title?: string;
 *   dashboardAssets?: { js?: string | null; css?: string[] } | null;
 *   session?: import('./types.js').RequestSession | null | undefined;
 * }} options
 */
export function renderAppPage({ title = 'Nodervisor', dashboardAssets = null, session = null } = {}) {
  const cssAssets = [...(dashboardAssets?.css ?? [])];

  const scriptAssets = dashboardAssets?.js ? [dashboardAssets.js] : [];
  const serializedState = serializeState({
    user: session?.user ?? null,
    auth: {
      session: '/api/auth/session',
      login: '/api/auth/login',
      logout: '/api/auth/logout',
      register: '/api/auth/register'
    }
  });

  const styles = cssAssets
    .filter(Boolean)
    .map((href) => `<link rel="stylesheet" href="${escapeAttribute(href)}">`)
    .join('\n        ');

  const scripts = scriptAssets
    .map((src) => `<script type="module" src="${escapeAttribute(src)}" defer></script>`)
    .join('\n        ');

  return `<!DOCTYPE html>
<html class="no-js">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
    <title>${escapeHtml(title)}</title>
    <meta name="viewport" content="initial-scale=0.5, width=device-width">
    ${styles}
  </head>
  <body>
    <div id="app-root"></div>
    <script id="app-state" type="application/json">${serializedState}</script>
    ${scripts}
  </body>
</html>`;
}

function serializeState(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function escapeAttribute(value) {
  return escapeHtml(value ?? '');
}
