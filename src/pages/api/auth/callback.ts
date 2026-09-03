import type { APIRoute } from 'astro';
import { exchangeCode, me, userInstallations, appSlug } from '../../../lib/github';
import { sql } from '../../../lib/db';
import { setSession } from '../../../lib/session';
import { seal } from '../../../lib/crypto';
export const prerender = false;
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const lang = cookies.get('nac_lang')?.value === 'en' ? '/en' : '';
  // Après une installation, GitHub renvoie installation_id et parfois un nouveau code sans notre state.
  const fromInstall = url.searchParams.get('installation_id');
  if (!code || (!fromInstall && state !== cookies.get('nac_state')?.value)) return redirect(`${lang}/?erreur=state`, 302);
  cookies.delete('nac_state', { path: '/' });
  try {
    const token = await exchangeCode(code);
    const u = await me(token);
    const installs = await userInstallations(token);
    const installationId = installs[0]?.id ?? (fromInstall ? Number(fromInstall) : null);
    const [row] = (await sql.query(
      `insert into users (github_id, login, name, avatar_url, access_token, installation_id) values ($1,$2,$3,$4,$5,$6)
       on conflict (github_id) do update set login = excluded.login, name = excluded.name, avatar_url = excluded.avatar_url,
       access_token = excluded.access_token, installation_id = coalesce(excluded.installation_id, users.installation_id)
       returning id`, [u.id, u.login, u.name, u.avatar_url, seal(token), installationId],
    )) as { id: number }[];
    await setSession(cookies, row.id);
    if (!installationId) return redirect(`https://github.com/apps/${appSlug()}/installations/new`, 302);
    return redirect(`${lang}/ajouter`, 302);
  } catch (e) {
    console.error(e);
    return redirect(`${lang}/?erreur=github`, 302);
  }
};
