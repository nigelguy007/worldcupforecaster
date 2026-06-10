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

## Enable LIVE scores (API-Football)
1. Sign up (free): https://dashboard.api-football.com/register
2. Copy your API key from the dashboard.
3. In Vercel → your project → Settings → Environment Variables, add:
      Name:  API_FOOTBALL_KEY
      Value: <your key>
4. Redeploy.
   (Note: World Cup league id is set to 1 in api/live.js — confirm in the
    API-Football dashboard and change LEAGUE_ID if different.)

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
