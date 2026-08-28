# oHRis – Différentiel cumulé

Extension navigateur qui calcule et affiche le différentiel horaire mensuel
cumulé sur la feuille de temps oHRis (`https://ohris.ut-capitole.fr/fr/time/sheet/*`),
avec un bandeau fixe, un code couleur par jour, et un calcul de l'heure de sortie
visant un différentiel cumulé à 0.

## Structure

```
chrome/                 # module prêt à charger dans Chrome / Edge / Brave
  manifest.json         #   Manifest V3, sans clé spécifique
  content.js
  styles.css
firefox/                # module prêt à charger dans Firefox (109+)
  manifest.json         #   idem + browser_specific_settings.gecko (id requis par Firefox)
  content.js            #   identique à chrome/content.js
  styles.css            #   identique à chrome/styles.css
scripts/sync.mjs        # recopie content.js + styles.css de chrome/ vers firefox/
dist/                   # zips générés pour les stores (non versionné)
```

`content.js` et `styles.css` sont **identiques** entre les deux modules : le
script de contenu n'utilise aucune API `chrome.*` / `browser.*` (uniquement le
DOM). Seul `manifest.json` diffère. Après toute modification du code partagé,
lancer `npm run sync` (ou copier manuellement chrome/ → firefox/).

## Installation manuelle (développement)

### Chrome / Edge / Brave

1. Ouvrir `chrome://extensions`
2. Activer le **Mode développeur**
3. **Charger l'extension non empaquetée** → sélectionner le dossier `chrome/`

### Firefox

1. Ouvrir `about:debugging#/runtime/this-firefox`
2. **Charger un module complémentaire temporaire…**
3. Sélectionner `firefox/manifest.json`

## Zips pour les stores

Déjà générés dans `dist/` :

- `dist/ohris-differentiel-cumule-chrome-1.0.0.zip` → Chrome Web Store
- `dist/ohris-differentiel-cumule-firefox-1.0.0.zip` → addons.mozilla.org

Pour les régénérer :

```bash
npm install          # une seule fois (installe web-ext)
npm run build        # sync + zip des deux modules dans dist/
```

Sans Node, sous PowerShell :

```powershell
Compress-Archive -Path chrome\*  -DestinationPath dist\ohris-differentiel-cumule-chrome-1.0.0.zip  -Force
Compress-Archive -Path firefox\* -DestinationPath dist\ohris-differentiel-cumule-firefox-1.0.0.zip -Force
```

## Autres scripts (nécessitent `npm install`)

```bash
npm run start:firefox   # lance Firefox avec l'extension + rechargement auto
npm run start:chrome    # idem avec Chromium
npm run lint:firefox    # validation du module firefox/
npm run lint:chrome     # validation du module chrome/
```
