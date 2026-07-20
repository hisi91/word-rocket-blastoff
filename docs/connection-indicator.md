# Indicateur de connexion Groq API

Ce document explique le fonctionnement du petit indicateur de connexion ajoute au jeu Word Rocket.

## Objectif

Le jeu utilise Groq API pour certaines fonctionnalites IA, notamment les appels serveur lies a la parole et a la validation. Si la connexion avec Groq API devient lente ou indisponible, le joueur peut avoir l'impression que le jeu ne repond plus.

L'indicateur sert donc a montrer, pendant la partie, si la validation IA est fluide ou lente.

Il est visible uniquement pendant :

- `LEVEL_INTRO`
- `PLAYING`

Il est cache sur :

- l'ecran d'accueil
- le select level
- l'ecran de fin de niveau
- la pause

## Fichiers principaux

- `src/components/ConnectionIndicator.tsx`
  Contient toute la logique cote client : ping, calcul de latence, affichage HUD, tooltip et toast.

- `src/routes/api/ping-groq.ts`
  Route serveur appelee par le client. Elle contacte Groq API avec un prompt minimal.

- `src/routes/index.tsx`
  Monte l'iframe du jeu et affiche l'indicateur au-dessus du canvas quand l'etat du jeu le permet.

- `public/word-rocket.html`
  Envoie l'etat courant du jeu au parent React via `postMessage`.

## Flux global

1. Le jeu HTML change d'ecran, par exemple `LEVEL_INTRO` ou `PLAYING`.
2. `public/word-rocket.html` envoie un message au parent React :

```js
window.parent.postMessage({
  type: "word-rocket-state",
  screen: state.screen,
  paused: state.paused,
}, "*");
```

3. `src/routes/index.tsx` recoit ce message et stocke :

- `gameScreen`
- `gamePaused`

4. Si le jeu est en `LEVEL_INTRO` ou `PLAYING`, et qu'il n'est pas en pause, React affiche :

```tsx
<ConnectionIndicator visible={showConnectionIndicator} />
```

5. Quand `ConnectionIndicator` est visible, il lance un ping toutes les 5 secondes vers :

```txt
/api/ping-groq
```

6. La route `/api/ping-groq` contacte Groq API cote serveur, avec la cle API gardee cote serveur.

7. Le client mesure le temps total entre le debut du fetch et la reponse. Cette valeur est le dernier ping brut.

8. Le composant conserve les 3 derniers pings et affiche une moyenne glissante.

## Pourquoi passer par `/api/ping-groq`

La cle `GROQ_API_KEY` ne doit jamais etre exposee dans le navigateur.

Le navigateur appelle donc uniquement une route interne :

```txt
GET /api/ping-groq
```

La route serveur lit ensuite :

- `GROQ_API_KEY`
- `GROQ_PING_URL` si defini
- `GROQ_PING_MODEL` si defini

Puis elle envoie un prompt minimal :

```txt
ok
```

avec `max_tokens: 1`.

Cela limite le cout tout en testant que l'appel Groq repond vraiment.

## Calcul de la latence

Chaque ping mesure le round-trip cote client :

```ts
const startedAt = performance.now();
await fetch("/api/ping-groq");
const rawLatencyMs = performance.now() - startedAt;
```

Le composant ne se base pas uniquement sur ce ping brut pour l'affichage principal. Il garde les 3 derniers pings :

```ts
const pingHistory = [...current.pingHistory, rawLatencyMs].slice(-3);
```

Puis il calcule la moyenne :

```ts
latencyMs = moyenne(pingHistory);
```

Cela evite que l'interface change trop brutalement a cause d'un seul ping exceptionnellement lent ou rapide.

## Statuts affiches

Le statut est deduit de la moyenne glissante :

| Statut | Condition | Affichage |
| --- | --- | --- |
| `good` | moyenne < 1000 ms | `latency-good.webp` |
| `degraded` | moyenne < 3000 ms | `latency-medium.webp` |
| `poor` | moyenne >= 3000 ms | `latency-bad.png` |
| `offline` | erreur fetch, timeout ou route indisponible | `latency-off.webp` |

## Timeout et economie de credits

Chaque ping a un timeout de 4500 ms.

Si le navigateur met l'onglet en arriere-plan, le composant stoppe le polling grace a `document.visibilitychange`.

Il stoppe aussi le polling quand l'indicateur n'est pas visible, donc quand le joueur n'est pas en intro ou en partie.

Cela evite de consommer des credits Groq sur les menus ou quand l'utilisateur ne joue pas.

## HUD et tooltip

La vue compacte affiche uniquement une icone de qualite, sans chiffre en millisecondes.

L'indicateur est place sous les 3 boutons en haut a gauche du jeu.

Au survol ou au tap, le tooltip affiche :

- le label `Groq API`
- le statut lisible : `Bon`, `Degrade`, `Mauvais`, `Hors ligne`
- une courte description de ce qui est mesure

L'icone pulse pendant qu'un ping est en cours.

## Toast de connexion degradee

Pendant le gameplay, si le statut devient `poor` ou `offline`, le jeu affiche un toast :

```txt
Connexion degradee — la validation des mots peut etre lente
```

Le toast :

- ne bloque pas le joueur
- ne met pas le jeu en pause
- disparait automatiquement apres 4 secondes
- peut etre ferme manuellement

Pour eviter le spam, le toast n'apparait pas au premier ping degrade.

Il faut que le meme statut problematique tienne pendant 2 checks consecutifs :

- `good -> poor` une seule fois : pas de toast
- `good -> poor -> poor` : toast
- `poor -> poor -> poor` : pas de nouveau toast
- `poor -> good -> poor -> poor` : nouveau toast possible

## Version simplifiee

La premiere implementation avait un service separe avec un store reactif et des tests dedies.

La version actuelle est volontairement plus simple :

- pas de Zustand
- pas de React context
- pas de service global
- toute la logique client est dans `ConnectionIndicator.tsx`

C'est plus facile a lire et suffisant pour ce besoin, car l'etat de connexion n'est utilise que par un seul composant.
