// ===================================================================
//  /api/live  —  Vercel Serverless Function (World Cup Forecaster)
//
//  A single endpoint that returns everything the app needs to keep its
//  model accurate and up to date:
//    • live   — matches in progress right now (scores, stats, events)
//    • results — every FINISHED match this tournament (drives the bracket
//                + elimination logic on the client)
//    • fixtures — upcoming matches
//  Teams are resolved to the app's internal 3-letter codes server-side,
//  so the client never has to guess.
//
//  SETUP (one-time):
//   1. Get a key at https://dashboard.api-football.com  (free tier works)
//   2. Vercel → Project → Settings → Environment Variables:
//        Name:  API_FOOTBALL_KEY      Value: <your key>
//   3. Redeploy. The key stays on the server; the browser only calls /api/live.
//
//  Docs: https://www.api-football.com/documentation-v3
//  Without a key the endpoint returns empty arrays and the app falls back
//  to its built-in status, so nothing breaks.
// ===================================================================

const LEAGUE_ID = 1;     // FIFA World Cup
const SEASON = 2026;
const API = 'https://v3.football.api-sports.io';

export default async function handler(req, res) {
  const key = process.env.API_FOOTBALL_KEY;

  // No key → empty payload; the client keeps its built-in tournament status.
  if (!key) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      live: [], results: [], fixtures: [], updated: new Date().toISOString(),
      note: 'Set API_FOOTBALL_KEY in Vercel env vars to enable live data.'
    });
    return;
  }

  const headers = { 'x-apisports-key': key };
  const get = async (path) => {
    const r = await fetch(API + path, { headers });
    if (!r.ok) throw new Error('API ' + r.status + ' on ' + path);
    return r.json();
  };

  try {
    // Fetch live + the full season fixture list in parallel. The season list
    // gives us every finished result AND every upcoming fixture in one call.
    const [liveData, seasonData] = await Promise.all([
      get(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}&live=all`).catch(() => ({ response: [] })),
      get(`/fixtures?league=${LEAGUE_ID}&season=${SEASON}`).catch(() => ({ response: [] }))
    ]);

    const live = (liveData.response || []).map(normalize);

    const allFixtures = (seasonData.response || []).map(normalize);
    const results = allFixtures.filter(m => m.status === 'FT' || m.status === 'PSO');
    const fixtures = allFixtures.filter(m => m.status === 'UP' || m.status === 'LIVE' || m.status === 'HT');

    // Short cache: live scores refresh fast, finished results are stable.
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
    res.status(200).json({
      live, results, fixtures,
      counts: { live: live.length, results: results.length, fixtures: fixtures.length },
      updated: new Date().toISOString()
    });
  } catch (e) {
    // Fail soft — the client keeps working on its built-in data.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ live: [], results: [], fixtures: [], error: String(e) });
  }
}

// ------------------------------------------------------------------
//  Team resolution: API-Football country name → app's internal code.
//  Covers all 48 finalists plus common name variants the API may use.
// ------------------------------------------------------------------
const NAME2CODE = {
  'Spain': 'ESP', 'France': 'FRA', 'England': 'ENG', 'Argentina': 'ARG', 'Portugal': 'POR',
  'Brazil': 'BRA', 'Germany': 'GER', 'Netherlands': 'NED', 'Norway': 'NOR', 'Belgium': 'BEL',
  'Colombia': 'COL', 'Morocco': 'MAR', 'Croatia': 'CRO', 'Ecuador': 'ECU', 'Switzerland': 'SUI',
  'USA': 'USA', 'United States': 'USA', 'Uruguay': 'URU', 'Japan': 'JPN', 'Mexico': 'MEX',
  'Senegal': 'SEN', 'Sweden': 'SWE', 'Ivory Coast': 'CIV', "Cote d'Ivoire": 'CIV', 'Côte d’Ivoire': 'CIV',
  'Austria': 'AUT', 'South Korea': 'KOR', 'Korea Republic': 'KOR', 'South-Korea': 'KOR',
  'Turkey': 'TUR', 'Türkiye': 'TUR', 'Turkiye': 'TUR', 'Egypt': 'EGY', 'Paraguay': 'PAR',
  'Czechia': 'CZE', 'Czech Republic': 'CZE', 'Algeria': 'ALG', 'Bosnia': 'BIH',
  'Bosnia and Herzegovina': 'BIH', 'Iran': 'IRN', 'IR Iran': 'IRN', 'Qatar': 'QAT', 'Ghana': 'GHA',
  'Tunisia': 'TUN', 'Australia': 'AUS', 'Canada': 'CAN', 'DR Congo': 'COD', 'Congo DR': 'COD',
  'Saudi Arabia': 'KSA', 'Scotland': 'SCO', 'New Zealand': 'NZL', 'Panama': 'PAN', 'Iraq': 'IRQ',
  'South Africa': 'ZAF', 'Uzbekistan': 'UZB', 'Jordan': 'JOR', 'Cape Verde': 'CPV',
  'Cabo Verde': 'CPV', 'Haiti': 'HAI', 'Curacao': 'CUW', 'Curaçao': 'CUW'
};

const NAME2ISO = {
  ESP: 'es', FRA: 'fr', ENG: 'gb-eng', ARG: 'ar', POR: 'pt', BRA: 'br', GER: 'de', NED: 'nl',
  NOR: 'no', BEL: 'be', COL: 'co', MAR: 'ma', CRO: 'hr', ECU: 'ec', SUI: 'ch', USA: 'us',
  URU: 'uy', JPN: 'jp', MEX: 'mx', SEN: 'sn', SWE: 'se', CIV: 'ci', AUT: 'at', KOR: 'kr',
  TUR: 'tr', EGY: 'eg', PAR: 'py', CZE: 'cz', ALG: 'dz', BIH: 'ba', IRN: 'ir', QAT: 'qa',
  GHA: 'gh', TUN: 'tn', AUS: 'au', CAN: 'ca', COD: 'cd', KSA: 'sa', SCO: 'gb-sct', NZL: 'nz',
  PAN: 'pa', IRQ: 'iq', ZAF: 'za', UZB: 'uz', JOR: 'jo', CPV: 'cv', HAI: 'ht', CUW: 'cw'
};

function codeFor(name) { return NAME2CODE[name] || ''; }
function isoFor(code, name) { return NAME2ISO[code] || (name || '').slice(0, 2).toLowerCase(); }

// Map an API round string to our internal stage label.
function stageOf(round) {
  const r = (round || '').toLowerCase();
  if (r.includes('final') && !r.includes('semi') && !r.includes('quarter') && !r.includes('3rd') && !r.includes('third')) return 'Final';
  if (r.includes('3rd') || r.includes('third')) return 'Play-off for third place';
  if (r.includes('semi')) return 'Semi-final';
  if (r.includes('quarter')) return 'Quarter-final';
  if (r.includes('16')) return 'Round of 16';
  if (r.includes('32')) return 'Round of 32';
  if (r.includes('group')) return 'Group stage';
  return round || '';
}

function normalize(f) {
  const short = f.fixture.status.short; // NS,1H,HT,2H,ET,P,FT,AET,PEN,PST...
  const status =
    (short === '1H' || short === '2H' || short === 'ET' || short === 'P' || short === 'BT') ? 'LIVE'
      : short === 'HT' ? 'HT'
      : (short === 'FT' || short === 'AET') ? 'FT'
      : short === 'PEN' ? 'PSO'
      : 'UP';

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

  const hName = f.teams.home.name, aName = f.teams.away.name;
  const hCode = codeFor(hName), aCode = codeFor(aName);
  // For penalty shootouts, the aggregate winner is in f.score.penalty; goals stays level.
  const pen = f.score && f.score.penalty;

  return {
    id: String(f.fixture.id),
    comp: (f.league && f.league.round) || 'World Cup 2026',
    stage: stageOf(f.league && f.league.round),
    kickoff: f.fixture.date,
    home: { code: hCode, name: hName, iso: isoFor(hCode, hName) },
    away: { code: aCode, name: aName, iso: isoFor(aCode, aName) },
    hs: f.goals.home == null ? 0 : f.goals.home,
    as: f.goals.away == null ? 0 : f.goals.away,
    penH: pen && pen.home != null ? pen.home : null,
    penA: pen && pen.away != null ? pen.away : null,
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
