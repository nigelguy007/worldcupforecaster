# World Cup Forecaster — Deploy

## Folder structure (already set up)
```
deploy/
├── index.html        ← the app
├── api/
│   └── live.js       ← live-scores function (API-Football proxy)
└── README.md         ← this file
```

## Deploy to Vercel
1. Drag the WHOLE `deploy` folder onto Vercel (New Project → drag & drop),
   or push it to a GitHub repo connected to Vercel.
2. That's it — the app is live. Before the World Cup kicks off it shows a
   countdown + fixtures; it switches to real live scores automatically once
   matches begin AND the API key below is set.

## Enable LIVE data (API-Football) — powers accurate predictions
Once a key is set, `/api/live` returns live matches, ALL finished results, and
upcoming fixtures. The app feeds those results into its model automatically:
it works out who's eliminated (and in which round), who the finalists are, and
sets every knocked-out team's title odds to 0 — no manual editing required.
As each match finishes, the model re-runs and predictions/tips update.

1. Sign up (free): https://dashboard.api-football.com/register
2. Copy your API key from the dashboard.
3. In Vercel → your project → Settings → Environment Variables, add:
      Name:  API_FOOTBALL_KEY
      Value: <your key>
4. Redeploy.
   (Note: World Cup league id is set to 1 in api/live.js — confirm in the
    API-Football dashboard and change LEAGUE_ID if different.)

### Before the key is set (offline fallback)
The app ships with a real-results SNAPSHOT (through the semi-finals) baked in,
so predictions are accurate immediately. But that snapshot is frozen — to keep
it current automatically after new matches, set the API key above. After the
tournament ends you can delete the snapshot in `WCF.seedRealResults` if you
want a clean slate; with the live feed connected it's no longer needed.

## Enable cloud sync of users' picks/watchlist (Firebase Firestore)
In Firebase Console → Firestore → Rules, paste and Publish:

    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /users/{uid} {
          allow read, write: if request.auth != null && request.auth.uid == uid;
        }
      }
    }

Also make sure Email/Password sign-in is enabled in Firebase → Authentication.
(If neither is set up, the app still works — it saves data locally per device.)
