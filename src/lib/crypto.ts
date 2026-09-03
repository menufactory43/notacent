import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
// Chiffre les jetons GitHub au repos : AES-256-GCM, clé TOKEN_KEY (32 octets en hex).
const key = () => {
  const hex = (import.meta.env.TOKEN_KEY ?? process.env.TOKEN_KEY ?? '') as string;
  if (hex.length !== 64) throw new Error('TOKEN_KEY absente ou invalide');
  return Buffer.from(hex, 'hex');
};
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64url')}.${ct.toString('base64url')}.${c.getAuthTag().toString('base64url')}`;
}
export function open(stored: string | null): string | null {
  if (!stored) return null;
  if (!stored.startsWith('v1.')) return stored; // ancienne valeur en clair, rechiffrée à la prochaine connexion
  const [, iv, ct, tag] = stored.split('.');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
}
