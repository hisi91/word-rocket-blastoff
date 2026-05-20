# 🚀 Word Rocket Blastoff

Jeu de prononciation multilingue (🇬🇧 anglais, 🇫🇷 français, 🇪🇸 espagnol) où le joueur détruit des objets qui tombent en **prononçant** ou **tapant** leur nom. La fusée décolle au démarrage de la partie, des icônes 3D style Pixar/Clay tombent du ciel, et le joueur doit les nommer avant qu'elles ne touchent le sol.

**Live :** https://word-rocket-blastoff.lovable.app

---

## ✨ Fonctionnalités

- 🎤 **Reconnaissance vocale Whisper** (Groq `whisper-large-v3`) — bien plus précise que Web Speech API, tolérante aux accents et aux enfants
- 🧠 **Scoring phonétique hybride** : Levenshtein brut + Levenshtein phonétique (ph→f, ch→sh/tsh, voyelles bucketées, h muet, doublons fondus) + bonus substring. Seuil d'acceptation à 72 % → "ouatère" valide "water"
- 🎙 **VAD automatique** (Silero via `@ricky0123/vad-web` chargé depuis CDN à la demande) — détection automatique de début/fin de parole, pas besoin de maintenir un bouton
- 🌍 **3 langues** avec switch par drapeau (🇬🇧 🇫🇷 🇪🇸)
- 🚀 **Fusée animée** (clay/Pixar style) qui décolle du sol au lancement puis flotte dans l'espace, avec flamme qui sort réellement du fuselage
- 🎨 **Thèmes dynamiques par niveau** (galaxie, nébuleuse, trou noir, cosmique, etc.)
- 🖼 **Icônes 3D générées** sur fond transparent, stockées dans Lovable Cloud (Supabase Storage), avec key-out du blanc résiduel côté client
- ⌨️ **Saisie clavier** alternative au micro
- 🔊 SFX procéduraux (Web Audio API) — synthèse pure, zéro asset audio

---

## 🏗 Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│  public/word-rocket.html  (jeu, single-file, Canvas 2D)      │
│  ├── Silero VAD (CDN)  → capture audio 16 kHz                │
│  ├── Encodage WAV       → POST /api/transcribe               │
│  └── Scoring hybride    → validation du mot                  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  src/routes/api/transcribe.ts  (TanStack server route)       │
│  └── Forward vers Groq Whisper-large-v3                      │
│      (langue + mot attendu en prompt pour booster précision) │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Lovable Cloud (Supabase)                                    │
│  ├── Table `levels` + `level_objects` (mots + icon paths)    │
│  └── Storage bucket `game-icons` (assets 3D transparents)    │
└──────────────────────────────────────────────────────────────┘
```

### Stack

- **Framework :** TanStack Start v1 (React 19, SSR, Vite 7)
- **Runtime :** Cloudflare Workers (`@cloudflare/vite-plugin`)
- **Backend :** Lovable Cloud (Supabase) — table niveaux + storage icônes
- **STT :** Groq Whisper-large-v3 (rapide, gratuit en tier dev)
- **VAD :** Silero (`@ricky0123/vad-web` via CDN)
- **UI :** Canvas 2D pur pour le jeu, Tailwind v4 + shadcn/ui disponibles côté React
- **Le jeu lui-même** vit dans `public/word-rocket.html` (single-file HTML/CSS/JS), embarqué dans une `<iframe>` depuis la route `/`

---

## 🎮 Comment jouer

1. Ouvre l'app → écran de démarrage
2. Clique sur **Démarrer** (ou barre espace)
3. Choisis la langue via le drapeau (🇬🇧 / 🇫🇷 / 🇪🇸) en bas à gauche
4. Active le micro 🎤 (autorise l'accès quand le navigateur le demande)
5. Prononce ou tape le nom de l'objet qui tombe
6. Détruis 5 objets sans en rater 3 pour passer au niveau suivant

Le score affiché après une tentative vocale (ex. `🎙 ouatère (84%)`) indique la similarité phonétique. ≥72 % valide.

---

## 🔧 Développement local

```bash
bun install
bun run dev          # vite dev sur http://localhost:8080
bun run build        # build prod (Cloudflare Worker)
bun run lint
```

### Variables d'environnement

| Variable | Où | Description |
|---|---|---|
| `GROQ_API_KEY` | Runtime (server) | Clé Groq pour Whisper. Gratuite sur [console.groq.com](https://console.groq.com) |
| `VITE_SUPABASE_URL` | Build + runtime | Auto-généré par Lovable Cloud |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Build + runtime | Auto-généré par Lovable Cloud |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime (server) | Auto-généré par Lovable Cloud |

Sur Lovable, ces secrets sont gérés via **Cloud → Settings**. En local, ajoute-les dans `.env`.

---

## 📁 Structure du projet

```text
public/
├── word-rocket.html         # 👈 Le jeu (tout est ici : canvas, audio, VAD, fuzzy)
└── ...                      # assets statiques

src/
├── routes/
│   ├── __root.tsx           # shell HTML + meta SEO
│   ├── index.tsx            # iframe vers /word-rocket.html
│   └── api/
│       └── transcribe.ts    # 👈 Proxy Whisper (Groq)
├── integrations/supabase/   # clients Supabase (auto-générés)
├── components/ui/           # shadcn/ui (non utilisé par le jeu, dispo pour extension)
├── lib/                     # utils, error capture, error page
├── router.tsx               # config TanStack Router
├── start.ts                 # config server (middleware)
├── server.ts                # entry Cloudflare Worker
└── styles.css               # Tailwind v4 + tokens

supabase/
├── config.toml              # config projet
└── migrations/              # historique migrations
```

---

## 🧪 Le scoring expliqué

Pour chaque mot prononcé, le système calcule deux distances de Levenshtein normalisées :

1. **Brute** sur les caractères normalisés (NFD, accents stripés)
2. **Phonétique** sur une représentation simplifiée :
   - `ph` → `f`, `qu` → `k`, `ck` → `k`, `x` → `ks`
   - `ch` → `sh` (FR) ou `tsh` (EN/ES)
   - `c` devant `e/i/y` → `s`, sinon → `k`
   - `z` → `s`, `y` → `i`, `h` muet
   - Doublons fondus (`bb` → `b`)
   - Voyelles bucketées (`aeiou` → `a`)

Le score retenu est `max(brut, phonétique)` + 15 % de bonus si l'un contient l'autre. Au-delà de **72 %**, le mot est validé.

Le mot attendu est aussi passé en `prompt` à Whisper — ce qui biaise (positivement) la transcription vers la bonne réponse, surtout sur les mots isolés.

---

## 🚢 Déploiement

- **Production :** publiée automatiquement par Lovable sur `*.lovable.app`
- **Custom domain :** configurable dans Lovable → Settings → Domain
- **Self-host :** code 100 % portable, déployable sur n'importe quel runtime supportant Cloudflare Workers ou Node.js (via adaptateur TanStack Start)

---

## 📜 Licence

Projet privé construit avec [Lovable](https://lovable.dev). Réutilisation libre du code, assets/icônes 3D générés à l'usage du projet.
