# Formulaire de demande de protection fonctionnelle

## 📦 Upload dans Pandasuite

### Étape 1 : Créer le ZIP

```bash
cd ~/PF360-formulaire-appli
zip -r ../formulaire-pf-standalone.zip . -x "*.DS_Store" -x "*.git*"
```

### Étape 2 : Uploader dans Pandasuite

1. Aller dans votre projet Pandasuite
2. Ajouter une "Intégration Web"
3. Uploader `formulaire-pf-standalone.zip`
4. Pandasuite décompressera le ZIP et affichera `index.html`

### Étape 3 : Configurer l'iframe (si nécessaire)

Si Pandasuite permet de configurer l'iframe, assurez-vous que ces permissions sont activées :
- ✅ `allow-same-origin`
- ✅ `allow-scripts`
- ✅ `allow-forms`
- ✅ `allow-modals`
- ✅ `allow-popups` (pour mailto)
- ✅ `allow-top-navigation` (pour mailto)

---

## ✅ Vérifications

### Console développeur (F12)
- [ ] Aucune erreur CSP
- [ ] Aucun fichier 404
- [ ] Web Workers chargés (blob:)

### Fonctionnalités
- [ ] Formulaire s'affiche avec police Marianne
- [ ] Icônes visibles (warnings, close, info)
- [ ] Validation des champs
- [ ] Génération du mail
- [ ] Ouverture du client mail (mailto)
- [ ] Sauvegarde automatique (localStorage)

---

## 📁 Structure du package

```
formulaire-appli-pf/
├── index.html                    ← Formulaire principal ⭐
├── generateur-demande-pf.js      ← Logique métier
├── assets/
│   ├── css/                      ← DSFR + RemixIcon
│   ├── js/                       ← DSFR + CryptoJS
│   └── fonts/                    ← Marianne + Spectral + RemixIcon
├── icons/
│   └── system/                   ← Icônes SVG système
└── README.md                     ← Ce fichier
```

**Taille totale :** ~2.8 MB (compressé : 1.3 MB)
