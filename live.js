// ===================================================================
//  /api/live  —  Vercel Serverless Function
//  Securely fetches live World Cup data from API-Football.
//
//  SETUP (one-time):
//   1. Get a free key at https://dashboard.api-football.com
//   2. In Vercel: Project → Settings → Environment Variables
//        Name:  API_FOOTBALL_KEY
//        Value: <your key>
//      (Save, then redeploy.)
//   3. This file must live at:  /api/live.js  in your project root.
//
//  The browser only ever calls /api/live — your secret key stays on the
//  server and is never exposed in the HTML.
//
//  Docs: https://www.api-football.com/documentation-v3
// ===================================================================

const LEAGUE_ID = 1;     // FIFA World Cup
const SEASON = 2026;

export default async function handler(req, res) {
  const key = process.env.API_FOOTBALL_KEY;

  // No key yet → return empty so the app stays in pre-tournament mode.
  if (!key) {
    res.status(200).json({ matches: [], note: 'Set API_FOOTBALL_KEY in Vercel env vars to enable live data.' });
    return;
  }

  try {
    const r = await fetch(
      `https://v3.football.api-sports.io/fixtures?league=${LEAGUE_ID}&season=${SEASON}&live=all`,
      { headers: { 'x-apisports-key': key } }
    );
    const data = await r.json();
    const matches = (data.response || []).map(normalize);
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    res.status(200).json({ matches });
  } catch (e) {
    res.status(200).json({ matches: [], error: String(e) });
  }
}

// Map API-Football country names → flagcdn ISO codes (matches our team set).
const NAME2ISO = {
  'Spain': 'es', 'France': 'fr', 'England': 'gb-eng', 'Argentina': 'ar', 'Brazil': 'br',
  'Germany': 'de', 'Portugal': 'pt', 'Netherlands': 'nl', 'Italy': 'it', 'Belgium': 'be',
  'Mexico': 'mx', 'Denmark': 'dk', 'Norway': 'no', 'Sweden': 'se', 'Croatia': 'hr',
  'Poland': 'pl', 'Ukraine': 'ua', 'Scotland': 'gb-sct', 'Wales': 'gb-wls', 'Austria': 'at',
  'Switzerland': 'ch', 'Serbia': 'rs', 'Senegal': 'sn', 'Morocco': 'ma', 'USA': 'us',
  'United States': 'us', 'Japan': 'jp', 'Uruguay': 'uy', 'Colombia': 'co', 'Ecuador': 'ec',
  'Nigeria': 'ng', 'South-Korea': 'kr', 'South Korea': 'kr', 'Korea Republic': 'kr',
  'Ivory Coast': 'ci', "Cote d'Ivoire": 'ci', 'Australia': 'au', 'Canada': 'ca', 'Egypt': 'eg',
  'Turkey': 'tr', 'Türkiye': 'tr', 'Iran': 'ir', 'Ghana': 'gh', 'Paraguay': 'py', 'Qatar': 'qa',
  'Costa Rica': 'cr', 'Saudi Arabia': 'sa', 'Tunisia': 'tn', 'Panama': 'pa',
  'New Zealand': 'nz', 'Jordan': 'jo', 'Cape Verde': 'cv', 'Uzbekistan': 'uz'
};

function iso(name) { return NAME2ISO[name] || (name || '').slice(0, 2).toLowerCase(); }

function normalize(f) {
  const short = f.fixture.status.short; // NS,1H,HT,2H,ET,P,FT,AET,PEN...
  const status =
    (short === '1H' || short === '2H' || short === 'ET' || short === 'P' || short === 'BT') ? 'LIVE'
      : short === 'HT' ? 'HT'
      : (short === 'FT' || short === 'AET' || short === 'PEN') ? 'FT'
      : 'UP';

  // Pull live stats if the plan returns them; otherwise sensible defaults.
  const stat = {};
  (f.statistics || []).forEach(side => {
    const home = side.team.id === f.teams.home.id;
    (side.statistics || []).forEach(s => {
      const v = parseInt(s.value) || 0;
      if (s.type === 'Ball Possession') stat[home ? 'possH' : 'possA'] = parseInt(s.value) || 50;
      if (s.type === 'Total Shots') stat[home ? 'shotsH' : 'shotsA'] = v;
      if (s.type === 'Shots on Goal') stat[home ? 'sotH' : 'sotA'] = v;
      if (s.type === 'Corner Kicks') stat[home ? 'cornersH' : 'cornersA'] = v;
      if (s.type === 'expected_goals') stat[home ? 'xgH' : 'xgA'] = parseFloat(s.value) || 0;
    });
  });

  return {
    id: String(f.fixture.id),
    comp: (f.league && f.league.round) || 'World Cup 2026',
    home: { code: '', name: f.teams.home.name, iso: iso(f.teams.home.name) },
    away: { code: '', name: f.teams.away.name, iso: iso(f.teams.away.name) },
    hs: f.goals.home || 0,
    as: f.goals.away || 0,
    min: f.fixture.status.elapsed || 0,
    status,
    poss: stat.possH || 50,
    shotsH: stat.shotsH || 0, shotsA: stat.shotsA || 0,
    sotH: stat.sotH || 0, sotA: stat.sotA || 0,
    xgH: stat.xgH || 0, xgA: stat.xgA || 0,
    cornersH: stat.cornersH || 0, cornersA: stat.cornersA || 0,
    events: (f.events || []).map(ev => ({
      min: (ev.time && ev.time.elapsed) || 0,
      type: ev.type === 'Goal' ? 'GOAL'
        : ev.type === 'Card' ? ((ev.detail || '').indexOf('Red') >= 0 ? 'RED' : 'YELLOW')
        : ev.type === 'subst' ? 'SUB' : 'CHANCE',
      txt: (ev.type === 'Goal' ? 'Goal — ' : ev.type === 'Card' ? 'Card — ' : '') + (ev.team ? ev.team.name : ''),
      sub: [(ev.player && ev.player.name), (ev.detail || '')].filter(Boolean).join(' · ')
    }))
  };
}
