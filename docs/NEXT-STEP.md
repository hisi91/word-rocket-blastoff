# 🚀 Word Rocket — Next Steps

Ce document récapitule les réponses aux 3 dernières questions stratégiques sur l'évolution du jeu, à utiliser comme feuille de route post-lancement.

---

## 1. 📱 Publier sur Android (Play Store) et iOS (App Store)

Oui, c'est tout à fait possible en gardant **la même base Supabase, le même bucket d'icônes et la même API Groq** pour le son et la voix.

### Option recommandée : Capacitor ⭐

[Capacitor](https://capacitorjs.com) (de Ionic) emballe l'app web existante dans une coque native iOS/Android.

**Avantages :**
- ✅ Réutilise **100 % du code existant** (`word-rocket.html`, scoring, VAD, canvas)
- ✅ Garde la **même base Supabase** (table `levels`, `level_objects`)
- ✅ Garde le **même bucket** `game-icons`
- ✅ Garde la **même API Groq Whisper** (via la route `/api/transcribe`)
- ✅ Une seule codebase pour web + iOS + Android

**Limites :**
- ⚠️ Le micro doit utiliser le plugin natif Capacitor (`@capacitor-community/speech-recognition` ou capture audio native) car le VAD web (Silero WASM) peut être moins fiable sur WebView mobile
- ⚠️ Build APK/IPA à faire **en local** (Android Studio / Xcode) ou via un CI (EAS Build, Codemagic) — Lovable ne compile pas les binaires

### Autres options
- **PWA installable** (gratuit, immédiat, mais pas dans les stores)
- **React Native / Flutter** (réécriture complète — déconseillé)
- **TWA Android** (Trusted Web Activity — Play Store seulement, gratuit)

### Étapes Capacitor
1. `bun add @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`
2. `npx cap init` puis `npx cap add ios android`
3. Pointer `webDir` vers le build et `server.url` vers l'API Groq déployée
4. Builds locaux sur Mac (iOS) et Android Studio (APK / AAB)
5. Publication : Apple Developer (99 $/an) + Google Play (25 $ unique)

---

## 2. 🧭 Sur quel volet travailler une fois le jeu publié ?

Ordre logique des chantiers post-build, du plus urgent au plus stratégique :

### Priorité 1 — SEO (avant la publication large) ⭐
Fondation indispensable pour Google et les partages sociaux.
- Titles + meta descriptions uniques par page
- Open Graph (image de partage pour WhatsApp / Facebook / X)
- `robots.txt` + `sitemap.xml`
- JSON-LD (`Game` ou `WebApplication`)
- Favicon + manifest PWA
- → Lancer le **scan SEO Lovable** (gratuit, 1 min)

### Priorité 2 — Analytics
Comprendre comment les gens jouent avant de marketer.
- **Plausible** (RGPD-friendly, simple) ou **GA4** (gratuit, plus complet)
- Events custom : `level_started`, `level_completed`, `word_failed`, `mic_used` vs `keyboard_used`, langue choisie
- → Identifie les niveaux trop durs, le taux d'abandon

### Priorité 3 — Viralité & partage
Quick wins pour la croissance organique.
- Bouton "Partager mon score" (Web Share API)
- Image générée du score (canvas → PNG) attachée au partage
- Mode "défi un ami" avec lien direct vers un niveau

### Priorité 4 — Marketing
À faire **après** avoir validé le produit avec les analytics.
- Page Product Hunt
- Posts LinkedIn / Twitter / TikTok (vidéos courtes de gameplay)
- Reddit (`r/languagelearning`, `r/webgames`)
- SEO de contenu (blog : "10 jeux pour apprendre l'anglais aux enfants")

### Priorité 5 — Mobile stores
Capacitor + soumission stores (après validation web).

**Recommandation immédiate :**
1. Scan SEO
2. Plausible / GA4
3. Bouton de partage
4. Ensuite Capacitor

---

## 3. 🎮 Évolutions pour rendre le jeu plus attractif

Classées par impact / effort.

### 🚀 Quick wins (gros impact, peu d'effort)

#### Système de score & étoiles ⭐⭐⭐
- 1 à 3 étoiles par niveau (temps / précision / mots du 1er coup)
- Score total cumulé visible
- → Donne envie de **rejouer** les niveaux pour les perfectionner

#### Partage social du score
- Bouton "J'ai fini le niveau X 🚀" → Web Share API
- Image PNG du score générée via canvas

#### Confettis + son de victoire
- Animation de confettis à chaque niveau réussi
- SFX de victoire procédural (déjà en Web Audio API)

#### Streak quotidien
- Compteur "X jours d'affilée"
- Notification push (PWA) pour entretenir l'habitude

### 🎯 Moyen terme (rétention)

#### Profil joueur + badges
- "100 mots prononcés", "5 jours d'affilée", "Niveau 50 complété"
- Avatar / pseudo (peut rester local ou Supabase)

#### Mode time attack
- Le plus de mots possible en 60 secondes
- Leaderboard global (table Supabase)

#### Mode multi-joueurs / défi ami
- Lien partageable : "Bats mon score sur le niveau 12"
- Comparaison côte-à-côte

#### Statistiques personnelles
- Mots ratés le plus souvent → exercice ciblé
- Progression par langue

### 🌍 Long terme (croissance)

#### Multilingue côté UI
- Anglais d'abord (le jeu lui-même est déjà multilingue)
- Puis allemand, italien, portugais

#### PWA installable
- Manifest + service worker
- Marche offline (icônes déjà en cache)

#### Mode parents / enseignants
- Tableau de bord des progrès d'un enfant
- Création de niveaux personnalisés (mots de vocabulaire de la semaine)

#### Niveaux thématiques
- "Animaux", "Cuisine", "Sport"…
- Pack saisonniers (Halloween, Noël)

#### Monétisation (optionnelle)
- Gratuit jusqu'au niveau 20, premium ensuite
- Ou freemium : packs thématiques à 2-5 €
- Pas de pub si cible enfants

### 📅 Roadmap suggérée

**Phase 1 — Polish & viralité (1 semaine)**
1. Système d'étoiles ⭐
2. Confettis + son de victoire
3. Bouton partage avec image du score

**Phase 2 — Rétention (semaine 2)**
4. Profil joueur + badges
5. Mode time attack

**Phase 3 — Croissance**
6. PWA installable
7. Multilingue UI (anglais)
8. Capacitor → stores
