const ORIGIN = '12TH';
const SF_BOUND = ['DALY', 'MLBR', 'SFIA'];

const LINE_COLOR = {
  YELLOW: '#FDB913',
  RED:    '#EE352E',
  BLUE:   '#0039A6',
  GREEN:  '#009B3A',
  ORANGE: '#F6791F',
  BEIGE:  '#D8C99A',
};

export default async function handler(req, res) {
  try {
    const key = process.env.BART_API_KEY || 'MW9S-E7SL-26DI-SM36';
    const r = await fetch(
      `https://api.bart.gov/api/etd.aspx?cmd=etd&orig=${ORIGIN}&json=y&key=${key}`
    );
    const data = await r.json();
    const etds = data.root.station[0].etd ?? [];

    const departures = etds
      .filter(e => SF_BOUND.includes(e.abbreviation))
      .flatMap(e =>
        e.estimate.map(est => ({
          color: est.color.toUpperCase(),
          minutes: est.minutes === 'Leaving' ? 0 : Number(est.minutes),
          length: Number(est.length),
          destination: e.destination,
        }))
      )
      .sort((a, b) => a.minutes - b.minutes)
      .slice(0, 6);

    const rows = departures.length
      ? departures.map(d => `
        <div class="item">
          <div class="flex gap--sm align-center">
            <div style="width:10px;height:10px;border-radius:50%;background:${LINE_COLOR[d.color] ?? '#888'};flex-shrink:0"></div>
            <span class="label truncate">${d.destination}</span>
          </div>
          <span class="value value--lg">${d.minutes === 0 ? 'Now' : `${d.minutes} min`}</span>
        </div>`).join('')
      : '<span class="label">No departures found</span>';

    const markup = `
      <div class="layout layout--col gap--md">
        <div class="title_bar">
          <span class="title">12th St → 16th St Mission</span>
          <span class="title title--sm label">BART</span>
        </div>
        <div class="flex flex--col gap--sm w--full">
          ${rows}
        </div>
      </div>`;

    res.setHeader('Content-Type', 'application/json');
    res.json({ markup });
  } catch (err) {
    res.json({ markup: '<div class="item"><span class="title">BART API error</span></div>' });
  }
}
