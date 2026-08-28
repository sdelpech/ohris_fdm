# oHRis – Différentiel cumulé

Extension navigateur qui calcule et affiche le différentiel horaire mensuel
cumulé sur la feuille de temps oHRis (`https://ohris.ut-capitole.fr/fr/time/sheet/*`),
avec un bandeau fixe, un code couleur par jour, et un calcul de l'heure de sortie
visant un différentiel cumulé à 0.

## Compatibilité

Une seule source (`src/`) fonctionne sur **Chrome** (et dérivés Chromium : Edge,
Brave…) et sur **Firefox** (109+).

- Le manifeste est en **Manifest V3**, supporté par les deux navigateurs.
- La clé `browser_specific_settings.gecko` fournit l'identifiant requis par
  Firefox ; Chrome l'ignore.
- Le script de contenu n'utilise aucune API `chrome.*` / `browser.*`
  (uniquement le DOM), donc aucun polyfill n'est nécessaire.

## Structure

```
src/
  manifest.json   # manifeste universel Chrome + Firefox
  content.js      # script de contenu
  styles.css      # styles du bandeau et des cellules
package.json      # scripts de dev/build via web-ext
```

## Installation manuelle (développement)

### Chrome / Edge / Brave

1. Ouvrir `chrome://extensions`
2. Activer le **Mode développeur**
3. **Charger l'extension non empaquetée** → sélectionner le dossier `src/`

### Firefox

1. Ouvrir `about:debugging#/runtime/this-firefox`
2. **Charger un module complémentaire temporaire…**
3. Sélectionner `src/manifest.json`

(Un module temporaire est retiré à la fermeture de Firefox. Pour une
installation permanente, il faut un build signé — voir ci-dessous.)

## Développement avec web-ext (optionnel)

```bash
npm install

npm run start:firefox   # lance Firefox avec l'extension et rechargement auto
npm run start:chrome    # idem avec Chromium
npm run lint            # vérifie le manifeste et le code
npm run build           # génère un zip dans dist/
```

Le zip produit par `npm run build` est utilisable tel quel pour le
**Chrome Web Store** comme pour **addons.mozilla.org** (manifeste universel).
