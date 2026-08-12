# Spécification — Date du jour + Horaires de prière (3alamates)

**Date :** 2026-08-12 · **Statut :** validé par Said (design Option B, API Habous, hébergement Vercel)

## 1. Contexte

PWA mobile « 3alamates » (signets de versets coraniques), statique, React via `React.createElement` (sans JSX), UI arabe RTL, largeur max 430px, déployée sur **Vercel**. L'utilisateur consulte l'app sur son iPhone.

Deux fonctionnalités demandées :
1. **Date du jour** lue depuis l'appareil (aucun serveur), grégorienne + hijri.
2. **Horaires de prière** officiels + **décompte des minutes** restantes avant la prochaine prière.

## 2. Décisions validées

| Sujet | Décision |
|---|---|
| Layout | **Option B** : date dans le header (sous le titre), bandeau horaires compact 2 lignes en dessous |
| Ville | **Rabat**, fixe mais configurable (localStorage) |
| Source prières | API officielle **Ministère des Habous** : `https://www.habous.gov.ma/prieres/horaire-api.php` |
| Hébergement | **Vercel** → fonction serverless proxy (CORS) |
| Hors ligne | 3 couches : cache officiel → calcul local PrayTimes → toujours des horaires |

## 3. Architecture

### 3.1 Fichiers

| Fichier | Rôle | Nouveau/Modifié |
|---|---|---|
| `api/horaires.mjs` | Fonction serverless Vercel : fetch Habous, parse HTML → JSON | **Nouveau** |
| `hijri.js` | Conversion grégorien → hijri (calendrier tabulaire civil) | **Nouveau** |
| `praytimes.js` | Algorithme de calcul astronomique (fallback local) | **Nouveau** |
| `app.js` | Date, bandeau horaires, countdown, état, ville | **Modifié** |
| `index.html` | Charger `hijri.js` + `praytimes.js`, styles bandeau | **Modifié** |
| `service-worker.js` | Pré-cache des nouveaux fichiers | **Modifié** |
| `scripts/build.mjs` | Copier les nouveaux fichiers vers `dist/` | **Modifié** |

Les modules `hijri.js` et `praytimes.js` exposent des globaux (`window.Hijri`, `window.PrayTimes`), comme React — cohérent avec l'absence de bundler.

### 3.2 Persistance (localStorage)

- `3alamates.city` — `{ id: "1", name: "الرباط" }` (défaut Rabat)
- `3alamates.prayerCache` — `{ date: "2026-08-12", cityId: "1", source: "api"|"calc", fetchedAt: <ts>, times: { fajr, shuruq, dhuhr, asr, maghrib, isha } }`

## 4. Fonction serverless `api/horaires.mjs`

```
GET /api/horaires?ville=1
```

- Fetch serveur → `https://www.habous.gov.ma/prieres/horaire-api.php?ville=1` (pas de CORS côté serveur).
- Parse le HTML → JSON :
```json
{ "cityId": "1", "date": "2026-08-12", "times": { "fajr": "05:08", "shuruq": "06:44", "dhuhr": "13:37", "asr": "17:15", "maghrib": "20:22", "isha": "21:44" } }
```
- Timeout fetch 15 s. En cas d'échec : HTTP 502 `{ "error": "..." }` → le client retombe sur cache/calcul local.
- Pas de cache serveur (le client a déjà son cache localStorage ; MVP sans KV).

### 4.1 Parsing du HTML Habous

Structure renvoyée (ville=1, Rabat, horaires du jour) :
```html
<td>الفجر : </td><td>05:08</td>
<td>الشروق : </td><td>06:44</td>
<td>الظهر : </td><td>13:37</td>
<td>العصر : </td><td>17:15</td>
<td>المغرب : </td><td>20:22</td>
<td>العشاء : </td><td>21:44</td>
```

Regex (6 prières, ordre fixe) :
```js
const re = /<td[^>]*>\s*(الفجر|الشروق|الظهر|العصر|المغرب|العشاء)\s*:\s*<\/td>\s*<td[^>]*>\s*(\d{1,2}:\d{2})\s*<\/td>/g;
```
Échec de parse (structure change, 0 match) → 502.

## 5. Fallback local — `praytimes.js`

- Intégrer l'algorithme **PrayTimes** (open source, ~230 lignes) en global `window.PrayTimes`.
- **Méthode Maroc** : Fajr 19°, Isha 17°.
- Coordonnées **Rabat** : lat 34.02, lng −6.84.
- Timezone : `-new Date().getTimezoneOffset() / 60` (offset du device — l'iPhone de l'utilisateur est réglé sur l'heure marocaine). Limite connue : voyage avec un autre fuseau → horaires approximatifs (acceptable, ville fixe Rabat).
- Sortie : mêmes 6 clés que l'API (`fajr`, `shuruq`, `dhuhr`, `asr`, `maghrib`, `isha`).

## 6. Date du jour + Hijri

- **Grégorien** : `Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" })` → ex. « 12 août 2026 » (affiché à droite du `·`).
- **Hijri** : `hijri.js`, algorithme tabulaire civil (calendrier islamique calculé, époque 1 Muharram 1 AH = JDN 1948440). Exposé `window.Hijri.gregorianToHijri(date)` → `{ year, month, day }`.
  - Mois hijri en arabe (12) : محرم، صفر، ربيع الأول، ربيع الآخر، جمادى الأولى، جمادى الآخرة، رجب، شعبان، رمضان، شوال، ذو القعدة، ذو الحجة.
  - Jour de la semaine en arabe (7) : الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس، الجمعة، السبت.
  - Changement de jour à **minuit** (simple), pas au coucher du soleil (plus correct, hors MVP).
- **Vérification attendue** (algorithme tabulaire) : 2026-08-12 → **27 صفر 1448**. (La date officielle marocaine, basée sur l'observation lunaire, peut varier de ±1 jour — c'est accepté pour le MVP.)

## 7. UI

### 7.1 Header (Option B)

```
[🕌] علامات                    [🕐 12][⋯]
الأربعاء 27 صفر 1448 · 12 أوت 2026
```
- Format fidèle au mockup validé : jour de la semaine + date **hijri** (arabe), puis date **grégorienne** courte (`12 أوت 2026` — jour + mois, année omise si année courante).
- Pas de changement aux actions du header (compteur + menu ⋯).

### 7.2 Bandeau horaires (sous le header, 2 lignes)

```
التـالي العصر 17:15              [متبقي 1س 23د]
الفجر 05:08 · الظهر 13:37 · المغرب 20:22 · العشاء 21:44
```

- **Ligne 1** : « التالي » + nom de la prochaine prière + heure + **chip** de décompte « متبقي Xس Yد » (ou « متبقي Yد » si < 1 h). Chip accent (`--accent-soft`, texte `--accent-dark`).
- **Ligne 2** : les 4 autres prières (toutes sauf la prochaine), format `nom HH:MM`, séparées par `·`, corps réduit. La prière suivante du lendemain (الفجر après minuit) suit la même logique.
- Les **5 prières à compter** : الفجر، الظهر، العصر، المغرب، العشاء. Le الشروق est reçu mais pas affiché ni compté.
- **Pastille de source** (discrète, à côté du décompte) :
  - `api` + cache du jour → « رسمي »
  - cache d'un jour précédent → « من 11 أوت » (date du cache)
  - calcul local → « محتسب »
- **États** :
  - Chargement (1er fetch) : skeleton discret ou vide.
  - Jamais d'état « sans horaires » : le fallback calcul local garantit toujours une valeur.

### 7.3 Sélecteur de ville (dans le menu ⋯)

- Item « المدينة » dans le menu existant (export/import) → ouvre le bottom sheet existant avec une liste de villes marocaines populaires + leurs IDs Habous.
- Liste minimale par défaut : الرباط (1), الدار البيضاء, مراكش, فاس, طنجة — **vérifier les IDs réels pendant l'implémentation** (page `index.php` de Habous, `<select>` des villes).
- Champ libre « code ville » en complément (avancé).
- Sauvegarde dans `3alamates.city` + re-fetch + recalcul.

## 8. Comportements

| Événement | Action |
|---|---|
| Chargement initial | Lit `3alamates.city`, affiche date appareil, fetch `/api/horaires` ; en cas d'échec → cache → calcul local. Cache réécrit après chaque succès. |
| `visibilitychange` (retour sur l'app) | Re-fetch si la date du cache ≠ aujourd'hui ; sinon rien (horaires stables dans la journée). |
| Minuit | Re-fetch si en ligne (nouvelle date). |
| Countdown | `setInterval` 60 s + tick à chaque render ; `nextTime - now` arrondi à la minute. Passage automatique à la prière suivante (et à الفجر du lendemain si toutes passées). |
| Hors ligne (fetch échoue) | Couche 1 (cache) si cache du jour, sinon cache périmé + pastille « من <date> », sinon calcul local + « محتسب ». |
| CORS/proxy down | Même chemin que hors ligne (échec fetch = fallback). |

## 9. Tests / vérifications

1. **Parse HTML** : échantillon réel capturé (Rabat 2026-08-12) → 6 horaires attendus (05:08 / 06:44 / 13:37 / 17:15 / 20:22 / 21:44).
2. **Hijri** : 2026-08-12 → 27 صفر 1448 (vérifié) ; continuité : 2026-08-13 → 28 صفر 1448. (Les dates tabulaires peuvent différer de ±1 jour des dates officielles marocaines basées sur l'observation lunaire — réserve déjà notée en §6.)
3. **Countdown** — cas limites :
   - Maintenant < الفجر → prochaine = الفجر.
   - Maintenant entre العشاء et minuit → prochaine = الفجر demain.
   - Passage 16:59 → 17:00 : bascule العصر→المغرب.
4. **Offline** : avec cache du jour → « رسمي » ; cache périmé → « من <date> » ; sans cache → « محتسب ».
5. **Fonction serverless** : `vercel dev` en local (sert `api/` + statiques) ; en prod `/api/horaires?ville=1` renvoie le JSON attendu.

## 10. Hors périmètre (MVP)

- Cache serveur / KV Vercel pour l'API.
- Changement de jour hijri au coucher du soleil.
- Plus de 5 villes prédéfinies / détection GPS.
- Notifications push à l'heure de prière.
