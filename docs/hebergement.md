# Hebergement du jeu

## Etat actuel

Le Worker Cloudflare ne sert plus le placeholder `Your app will live here!`. L'URL racine repond maintenant avec le shell React du projet, qui charge le jeu dans une iframe:

```html
<iframe src="/word-rocket.html" title="Word Rocket">
```

Cela veut dire que le deploiement de base fonctionne.

## Ce qu'il faut verifier

### 1. Confirmer que le jeu charge

Ouvrir l'URL du Worker:

```txt
https://tanstack-start-app.digitalocean261.workers.dev/
```

Puis verifier que l'iframe charge bien le jeu.

Il faut aussi verifier directement:

```txt
https://tanstack-start-app.digitalocean261.workers.dev/word-rocket.html
```

Si le jeu s'affiche, c'est bon. Si une page vide, une erreur ou une boucle iframe apparait, il faudra corriger le chemin de l'iframe ou la configuration des assets statiques.

### 2. Ajouter les secrets et variables Cloudflare

Le workflow GitHub envoie actuellement seulement:

```txt
GROQ_API_KEY
```

Le code utilise aussi les variables suivantes:

```txt
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
```

`GROQ_API_KEY` est necessaire pour Whisper, TTS et le ping Groq.

Les variables Supabase sont necessaires pour `/auth`, `/upload` et l'integration Supabase cote app/SSR.

### 3. Garder le bon build command

Le projet utilise Bun avec `bun.lock`. Il ne faut donc pas utiliser `npm ci` sauf si un `package-lock.json` est ajoute.

Commande recommandee:

```bash
bun install && bunx vite build
```

### 4. Verifier Supabase

Cote Supabase, il faut que tout soit present en production:

```txt
tables: levels, level_objects, user_roles
storage bucket: game-icons
RLS policies: upload autorise pour admin
compte utilisateur: role admin
```

Le jeu peut tourner sans `/upload`, mais l'upload d'icones depuis l'interface depend de ces elements.

### 5. Verifier les APIs

Verifier rapidement les routes suivantes:

```txt
/api/transcribe
/api/tts
/api/ping-groq
/auth
/upload
```

Si `/api/ping-groq` echoue, c'est souvent `GROQ_API_KEY` qui manque.

Si `/auth` ou `/upload` echoue, c'est souvent lie aux variables Supabase ou aux policies RLS.

### 6. Ajouter un domaine final

Quand tout fonctionne sur l'URL `workers.dev`, ajouter un domaine personnalise dans Cloudflare, par exemple:

```txt
game.ton-domaine.com
```

Puis le pointer vers le Worker.

## Cloudflare ou autre hebergeur ?

Cloudflare sert bien a heberger des sites. Il propose notamment:

- Cloudflare Pages: adapte aux sites statiques/frontends avec fonctions.
- Cloudflare Workers: adapte aux applications full-stack/serverless, aux APIs, aux secrets et a l'execution edge.

Pour ce jeu, Cloudflare Workers est adapte parce que le projet a:

- un frontend HTML/React;
- des routes API `/api/transcribe`, `/api/tts`, `/api/ping-groq`;
- une cle Groq a garder cote serveur;
- Supabase cote client et serveur;
- un besoin de deploiement rapide avec domaine personnalise.

## Comparaison rapide

| Option | Adapte ? | Pourquoi |
| --- | --- | --- |
| Cloudflare Workers | Oui, recommande | Deja configure, bon pour APIs Groq, rapide, pas cher, domaine facile |
| Vercel | Oui aussi | Plus simple parfois pour React/TanStack, logs et interface confortables, mais migration a prevoir |
| Netlify | Possible | Bien pour sites front + functions, mais moins naturel avec la configuration actuelle |
| GitHub Pages | Non | Pas de backend securise pour `GROQ_API_KEY` |
| Supabase Hosting | Non | Supabase sert surtout DB/Auth/Storage/Edge Functions, pas ideal pour heberger toute l'app |
| Railway/Render/Fly.io | Possible mais trop lourd | Plutot pour serveurs Node classiques, pas necessaire ici |

## Recommandation

Continuer avec Cloudflare Workers.

Le probleme du placeholder est corrige. Le travail restant est surtout de finaliser la configuration: variables d'environnement, Supabase/RLS, domaine personnalise et verification des routes API.
