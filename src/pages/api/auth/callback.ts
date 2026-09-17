import type { APIRoute } from 'astro';
import { exchangeCode, me, userInstallationId } from '../../../lib/github';
import { sql } from '../../../lib/db';
import { setSession } from '../../../lib/session';
import { seal } from '../../../lib/crypto';
import { claim, adminLogin } from '../../../lib/outreach';
import { confirmMaker } from '../../../lib/db';
export const prerender = false;
// Retour de l'OAuth App « Public data only » : on apprend qui se connecte, c'est tout.
// Le jeton n'est gardé que pour l'admin (il sert de jeton serveur pour lire les repos publics). Pour les autres, rien n'est stocké.
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const lang = cookies.get('nac_lang')?.value === 'en' ? '/en' : '';
  if (!code || state !== cookies.get('nac_state')?.value) return redirect(`${lang}/?erreur=state`, 302);
  cookies.delete('nac_state', { path: '/' });
  try {
    const token = await exchangeCode(code);
    const u = await me(token);
    // A-t-il installé la GitHub App (repos privés) ? On le demande à l'app, pas à lui.
    const installationId = await userInstallationId(u.login).catch((e) => { console.error('installation', e); return null; });
    const [before] = (await sql.query(`select claimed from users where github_id = $1`, [u.id])) as { claimed: boolean }[];
    const stored = u.login === adminLogin() ? seal(token) : null;
    const [row] = (await sql.query(
      `insert into users (github_id, login, name, avatar_url, access_token, installation_id) values ($1,$2,$3,$4,$5,$6)
       on conflict (github_id) do update set login = excluded.login, name = excluded.name, avatar_url = excluded.avatar_url,
       access_token = excluded.access_token, installation_id = coalesce(excluded.installation_id, users.installation_id), claimed = true
       returning id`, [u.id, u.login, u.name, u.avatar_url, stored, installationId],
    )) as { id: number }[];
    await setSession(cookies, row.id);
    // Quelqu'un l'a ajouté comme co-maker d'une fiche : le lien devient visible maintenant qu'il est venu.
    await confirmMaker(u.login).catch((e) => console.error('co-maker', e));
    // Un compte « non réclamé » (fiche créée depuis le repo public) devient le sien à cette connexion.
    if (before && !before.claimed) {
      const slugs = await claim(row.id, u.id).catch((e) => { console.error('réclamation', e); return [] as string[]; });
      if (slugs.length) return redirect(`${lang}/app/${slugs[0]}/modifier?reclamee=1`, 302);
    }
    const back = cookies.get('nac_back')?.value ?? '';
    cookies.delete('nac_back', { path: '/' });
    return redirect(/^\/(?!\/)/.test(back) ? back : `${lang}/ajouter`, 302);
  } catch (e) {
    console.error(e);
    return redirect(`${lang}/?erreur=github`, 302);
  }
};
