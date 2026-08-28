/**
 * Copie les fichiers partagés (content.js, styles.css) depuis chrome/ vers firefox/.
 *
 * Seul manifest.json diffère entre les deux navigateurs (Firefox exige la clé
 * browser_specific_settings). Le reste du code doit rester identique : ce script
 * est la source de vérité de cette égalité.
 *
 * Usage : node scripts/sync.mjs   (ou `npm run sync`)
 */
import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHARED_FILES = ["content.js", "styles.css"];

for (const file of SHARED_FILES) {
  copyFileSync(join(root, "chrome", file), join(root, "firefox", file));
  console.log(`synced chrome/${file} -> firefox/${file}`);
}
