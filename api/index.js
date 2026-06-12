const ORIGIN = '12TH';
const DESTINATION = '16TH';
const ORIGIN_NAME = '12th St. Oakland';
const DESTINATION_NAME = '16th St. Mission';
const SF_BOUND = ['DALY', 'MLBR', 'SFIA'];

function parseTimeToMinutes(timeStr) {
  const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1]), min = parseInt(m[2]);
  const period = m[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

async function getTravelMinutes(key) {
  try {
    const r = await fetch(
      `https://api.bart.gov/api/sched.aspx?cmd=depart&orig=${ORIGIN}&dest=${DESTINATION}&date=now&key=${key}&b=0&a=1&json=y`
    );
    const data = await r.json();
    const trips = data.root.schedule.request.trip;
    const trip = Array.isArray(trips) ? trips[0] : trips;
    if (!trip) return 19;
    const dep = parseTimeToMinutes(trip['@origTimeMin']);
    const arr = parseTimeToMinutes(trip['@destTimeMin']);
    if (dep === null || arr === null) return 19;
    let diff = arr - dep;
    if (diff < 0) diff += 24 * 60;
    return diff;
  } catch {
    return 19;
  }
}

function clockTime(minutesFromNow) {
  const d = new Date(Date.now() + minutesFromNow * 60000);
  return d.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default async function handler(req, res) {
  try {
    const key = process.env.BART_API_KEY;

    const [etdData, travelMinutes] = await Promise.all([
      fetch(`https://api.bart.gov/api/etd.aspx?cmd=etd&orig=${ORIGIN}&json=y&key=${key}`).then(r => r.json()),
      getTravelMinutes(key),
    ]);

    const etds = etdData.root.station[0].etd ?? [];

    const departures = etds
      .filter(e => SF_BOUND.includes(e.abbreviation))
      .flatMap(e =>
        e.estimate.map(est => ({
          destination: e.destination,
          minutes: est.minutes === 'Leaving' ? 0 : Number(est.minutes),
        }))
      )
      .sort((a, b) => a.minutes - b.minutes)
      .slice(0, 4);

    const trips = departures.map(d => ({
      '@origTimeMin': clockTime(d.minutes),
      '@destTimeMin': clockTime(d.minutes + travelMinutes),
      '@tripTime': String(travelMinutes),
      leg: { '@trainHeadStation': d.destination },
    }));

    res.setHeader('Content-Type', 'application/json');
    res.json({
      origin_name: ORIGIN_NAME,
      destination_name: DESTINATION_NAME,
      origin_abbr: ORIGIN,
      dest_abbr: DESTINATION,
      root: {
        schedule: {
          request: { trip: trips },
        },
      },
    });
  } catch (err) {
    res.json({ root: { message: { error: { text: 'BART API error' } } } });
  }
}
