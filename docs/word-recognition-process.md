# Processus de reconnaissance de mot

Ce document explique comment Word Rocket reconnait un mot prononce par le joueur, depuis le micro jusqu'a la validation de l'objet.

## Vue d'ensemble

Le jeu ne compare pas directement le son du micro avec le mot attendu.

Il suit plutot ce pipeline :

1. Le micro ecoute en continu.
2. Le VAD detecte le debut et la fin de la parole.
3. Le jeu extrait uniquement le morceau audio parle.
4. Le jeu coupe les silences, nettoie et normalise legerement l'audio.
5. Le navigateur envoie l'audio a `/api/transcribe`.
6. Le backend appelle Groq Whisper.
7. Groq renvoie un texte.
8. Le jeu compare ce texte avec le mot attendu.
9. Si le score est suffisant, l'objet est detruit.

## 1. Ecoute micro

Le micro est active par le joueur depuis l'ecran d'accueil.

Le jeu utilise Silero VAD via `vad-web`. Le VAD ne fait pas de transcription. Son role est seulement de detecter :

- quand le joueur commence a parler
- quand le joueur a fini de parler

Cela evite d'envoyer de l'audio en continu a Groq.

## 2. Detection de parole avec VAD

Quand le VAD detecte une phrase ou un mot, il attend la fin de la parole puis appelle :

```js
onSpeechEnd: (audio) => { handleUtterance(audio); }
```

Le parametre `audio` contient un `Float32Array` avec le morceau audio detecte.

Les reglages actuels rendent le micro plus tolerant aux environnements non silencieux :

```js
positiveSpeechThreshold: 0.45,
negativeSpeechThreshold: 0.25,
minSpeechFrames: 2,
preSpeechPadFrames: 6,
redemptionFrames: 3,
```

Ces valeurs sont maintenant optimisees pour un jeu de mots courts :

- le VAD detecte rapidement le debut de la voix
- il garde un petit contexte avant le mot
- il attend beaucoup moins de silence apres le mot avant d'envoyer l'audio

`redemptionFrames: 3` correspond approximativement a 90-100 ms de silence selon la taille des frames du VAD. L'objectif est d'envoyer l'audio juste apres la prononciation d'un mot, pour eviter que l'enfant repete le mot parce qu'il pense que le jeu n'a rien entendu.

## 3. Nettoyage leger de l'audio

Avant d'envoyer l'audio a Groq, le jeu applique un pretraitement leger :

- filtre passe-haut pour reduire les bruits graves
- normalisation douce du volume
- limitation du gain pour eviter la saturation
- suppression des silences au debut et a la fin du signal
- limitation de l'audio a environ 2 secondes

Le but est d'aider Whisper/Groq a recevoir une voix plus lisible sans transformer excessivement le signal.

Le padding audio autour du mot est volontairement court :

```js
SINGLE_WORD_AUDIO_PAD_SECONDS = 0.05
SINGLE_WORD_MAX_AUDIO_SECONDS = 2.0
```

Cela limite la quantite d'audio envoyee a Groq et reduit le risque de capturer deux repetitions du meme mot.

Le navigateur demande aussi ces options micro quand elles sont disponibles :

```js
echoCancellation: true,
noiseSuppression: true,
autoGainControl: true,
channelCount: 1,
```

Ces options dependent du navigateur et du materiel. Elles peuvent donc aider beaucoup sur certains appareils et moins sur d'autres.

## 4. Compression audio

Le VAD fournit l'audio sous forme de `Float32Array`.

Quand le navigateur le permet, le jeu enregistre en parallele la parole avec `MediaRecorder` et envoie un fichier WebM/Opus compresse :

```txt
speech.webm
```

Ce format est plus petit qu'un WAV brut, donc plus rapide a uploader.

Si WebM/Opus n'est pas disponible, le jeu utilise un fallback WAV local :

```js
const wav = pcmToWav(enhanceSpeechAudio(trimSpeechAudio(float32, 16000)), 16000);
```

Le fichier audio est ensuite envoye au backend avec un `FormData`.

## 5. Appel a `/api/transcribe`

Le navigateur appelle :

```txt
POST /api/transcribe
```

avec :

- le fichier audio
- la langue active (`en`, `fr`, `es`)
- le mot attendu comme prompt si un objet est en cours

Le prompt aide Whisper a mieux comprendre le contexte.

## 6. Transcription par Groq Whisper

La route serveur `/api/transcribe` appelle :

```txt
https://api.groq.com/openai/v1/audio/transcriptions
```

avec le modele prioritaire :

```txt
whisper-large-v3-turbo
```

Si ce modele n'est pas disponible ou renvoie une erreur, la route retombe automatiquement sur :

```txt
whisper-large-v3
```

La cle `GROQ_API_KEY` reste cote serveur. Elle n'est jamais envoyee au navigateur.

Groq renvoie ensuite le texte reconnu, par exemple :

```txt
apple
```

## 7. Comparaison avec le mot attendu

Le jeu ne demande pas une egalite parfaite entre le texte reconnu et le mot attendu.

Il calcule un score de similarite avec :

- une comparaison texte classique
- une comparaison pseudo-phonetique
- un bonus si le mot attendu est contenu dans le texte reconnu, ou inversement

Le seuil actuel est :

```js
const ACCEPT_THRESHOLD = 68;
```

Si le score est superieur ou egal a `68%`, le jeu considere que le mot est correct.

## 8. Gestion des repetitions rapides

Les enfants peuvent repeter le mot plusieurs fois si la reponse n'est pas instantanee, par exemple :

```txt
apple apple
```

Pour reduire ce probleme, le jeu applique maintenant trois protections.

### Capture envoyee plus vite

Le silence final attendu par le VAD est reduit avec :

```js
redemptionFrames: 3
```

Cela permet de fermer la capture audio peu apres la fin du mot.

### Micro verrouille pendant l'analyse

Des que le VAD a capture un mot, le jeu affiche :

```txt
Analyse...
```

Pendant cette phase, le jeu met le VAD en pause et ignore les nouvelles captures. Le micro est relance seulement quand l'analyse Groq est terminee.

Cela evite d'envoyer plusieurs fois le meme mot pendant que la premiere reponse est encore en cours.

### Nettoyage des repetitions identiques

Si Groq renvoie une repetition consecutive du meme mot, le jeu la simplifie avant le scoring.

Exemples :

| Transcription Groq | Texte utilise pour le score |
| --- | --- |
| `apple` | `apple` |
| `apple apple` | `apple` |
| `apple apple apple` | `apple` |
| `apple banana` | `apple banana` |

Le jeu ne garde pas automatiquement le premier mot si les mots sont differents, pour eviter de valider une mauvaise phrase par erreur.

## 9. Validation ou correction

Si le score est suffisant :

- le jeu valide le mot
- l'objet est detruit
- le joueur marque des points

Si le score est trop bas :

- le jeu affiche le mot attendu
- le jeu prononce le mot pour aider le joueur
- l'objet continue sa chute

## Temps attendu

Le temps est mesure apres que le joueur a fini de parler.

Dans de bonnes conditions, le temps attendu est environ :

| Etape | Temps typique |
| --- | --- |
| Detection fin de parole VAD | 90 a 250 ms |
| Upload vers le backend | 30 a 250 ms |
| Transcription Groq Whisper | 500 a 1500 ms |
| Comparaison locale | quasi instantane |

Donc le temps total normal est souvent autour de :

```txt
0.8 a 2 secondes
```

En reseau lent ou si Groq repond plus lentement, cela peut monter a :

```txt
3 a 5 secondes
```

Si la reconnaissance depasse regulierement 5 secondes, il faut investiguer.

## Causes possibles de lenteur

Les causes les plus probables sont :

- le VAD capture un audio trop long
- le bruit de fond empeche le VAD de detecter clairement la fin de parole
- l'appel Groq est lent
- le reseau est lent
- le backend met du temps a recevoir ou renvoyer la reponse

L'indicateur Groq API aide a diagnostiquer la partie reseau/API. S'il devient jaune, rouge ou gris, la reconnaissance peut etre lente meme si le micro fonctionne correctement.

## Ameliorations possibles pour reduire la latence

La latence vient du chemin complet :

```txt
voix -> VAD -> WAV -> upload -> backend -> Groq Whisper -> retour texte -> matching
```

Il faut donc optimiser a la fois l'audio envoye, l'appel API et la perception utilisateur.

### 1. Envoyer moins d'audio a Groq

C'est souvent le meilleur gain.

Si le VAD garde trop de silence avant ou apres le mot, Groq recoit un fichier plus long. Plus le fichier est long, plus l'upload et la transcription peuvent prendre du temps.

Actions possibles :

- couper le silence au debut et a la fin avant `pcmToWav`
- limiter la duree maximale d'un utterance
- ignorer les audios trop faibles ou trop longs
- ajuster `redemptionFrames` si la fin de parole est detectee trop tard

Etat actuel :

- une coupe de silence existe deja dans le fallback WAV
- le silence final VAD est reduit pour les mots courts
- le padding audio est reduit a 0.05 seconde
- l'audio fallback est limite a 2 secondes
- la version WebM/Opus s'appuie surtout sur les bornes du VAD

Gain attendu : fort, surtout si le VAD capture parfois plusieurs secondes au lieu d'un mot court.

### 2. Afficher un etat "analyse"

Meme si la latence reelle reste autour de 1 a 2 secondes, l'experience peut sembler lente si rien ne se passe apres la parole.

Actions possibles :

- afficher `Analyse...` juste apres la fin de parole
- faire pulser l'objet courant pendant la transcription
- afficher un petit loader pres du mot reconnu
- indiquer clairement que le jeu a entendu quelque chose

Etat actuel : le jeu affiche `Je t'ecoute...` des le debut de voix, puis `Analyse...` pendant l'appel a Groq.

Cela ne reduit pas la latence technique, mais reduit fortement la latence percue.

### 3. Tester un modele Whisper plus rapide

Le modele actuel est :

```txt
whisper-large-v3
```

Il est precis, mais il peut etre plus lent qu'un modele optimise pour la vitesse.

Action possible :

Etat actuel : la route essaie `whisper-large-v3-turbo`, puis retombe sur `whisper-large-v3` si necessaire.

Gain attendu : fort si le modele turbo est disponible et garde une precision suffisante pour des mots courts.

### 4. Compresser l'audio avant upload

Le fallback WAV reste simple et fiable, mais plus lourd qu'un format compresse.

Etat actuel :

- le jeu encode en WebM/Opus avec `MediaRecorder` quand le navigateur le permet
- sinon il retombe sur WAV

Avantage :

- fichier plus petit
- upload plus rapide, surtout sur mobile ou reseau moyen

Inconvenient :

- implementation plus complexe
- il faut verifier que la route `/api/transcribe` et Groq acceptent bien le format envoye dans tous les navigateurs cibles

Gain attendu : moyen a fort selon le reseau.

### 5. Rechauffer Groq au debut du niveau

Le premier appel a une API peut parfois etre plus lent que les suivants.

Action possible :

- envoyer un mini ping ou une mini transcription au debut du niveau
- utiliser ce warmup sans bloquer le joueur

Gain attendu : utile surtout pour le premier mot d'un niveau.

### 6. Adapter le gameplay pendant la transcription

Si un objet continue de tomber normalement pendant que le jeu attend Groq, le joueur peut ressentir une injustice.

Actions possibles :

- ralentir legerement la chute pendant `busy`
- figer l'objet courant pendant quelques centaines de millisecondes apres la parole
- donner un petit bonus de temps si une transcription est en cours

Cela ne rend pas Groq plus rapide, mais rend le gameplay plus juste.

### Priorite recommandee

Pour Word Rocket, le meilleur ordre d'implementation serait :

1. Couper le silence avant et apres l'audio envoye a Groq.
2. Ajouter un feedback visuel `Analyse...` apres la parole.
3. Tester `whisper-large-v3-turbo`.
4. Ralentir ou figer legerement l'objet pendant la transcription.
5. Passer a WebM/Opus seulement si l'upload reste trop lent.

Le meilleur compromis rapide est :

```txt
trim silence + modele plus rapide + feedback visuel
```

## Limite importante

Le jeu reconnait le texte transcrit par Groq, pas directement la prononciation acoustique.

Cela veut dire que :

- si Groq transcrit le bon mot, le jeu valide souvent
- si Groq entend un autre mot, le score peut echouer
- si l'environnement est bruyant, Groq peut recevoir un signal moins clair

Le pretraitement audio et les seuils VAD ameliorent la situation, mais ils ne remplacent pas totalement un micro correct et une distance raisonnable entre le joueur et l'appareil.
