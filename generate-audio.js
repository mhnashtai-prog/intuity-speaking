const fs = require('fs');
const path = require('path');

// ── VOICE MAP ─────────────────────────────────────────────────
const VOICES = {
  EX:  'ZEt85AU1ui8Rr8FxNslW',  // Alice      — Examiner
  SOF: 'jv41DhCf464zw0TI7I1w',  // Imogen     — Sofia
  LUC: 'G17SuINrv2H9FC6nvetn',  // Christopher — Luca
  INE: '19STyYD15bswVz51nqLf',  // Samara X   — Ines
  MAY: 'UEKYgullGqaF0keqT8Bu',  // Chris Brift — Maya
  THE: 'goT3UYdM9bhm0n2lmKQx',  // Edward     — Theo
};

// ── CONFIG ────────────────────────────────────────────────────
const API_KEY   = '70111b8f9f678818cb4fca1c5e1d13a439b453d06699d37493577e194b201c9f';   // ← paste your key here
const MODEL     = 'eleven_multilingual_v2';
const OUTPUT    = 'F:\\audio';
const DATA_FILE = './functional-speaking-5candidates.json';
const DELAY_MS  = 500;   // pause between calls — prevents rate limiting

// ── VOICE SETTINGS ────────────────────────────────────────────
const SETTINGS = {
  stability:        0.50,
  similarity_boost: 0.80,
  style:            0.20,
  use_speaker_boost: true
};

// ── HELPERS ───────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function candidateCode(name) {
  const map = { Sofia: 'SOF', Luca: 'LUC', Ines: 'INE', Maya: 'MAY', Theo: 'THE' };
  return map[name];
}

async function generateMP3(text, voiceId, filename) {
  const filepath = path.join(OUTPUT, filename);

  // Skip if already exists — safe to re-run without wasting credits
  if (fs.existsSync(filepath)) {
    console.log(`  ⏭  SKIP  ${filename}  (already exists)`);
    return;
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key':   API_KEY,
        'Content-Type': 'application/json',
        'Accept':       'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id:      MODEL,
        voice_settings: SETTINGS,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error(`  ✗  FAIL  ${filename}  →  ${response.status}: ${err}`);
    return;
  }

  const buffer = await response.arrayBuffer();
  fs.writeFileSync(filepath, Buffer.from(buffer));
  console.log(`  ✓  OK    ${filename}`);
}

// ── MAIN ──────────────────────────────────────────────────────
async function run() {
  // Load data
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`ERROR: ${DATA_FILE} not found. Place it in the same folder as this script.`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  // Create output folder
  fs.mkdirSync(OUTPUT, { recursive: true });

  // Build job list
  const jobs = [];

  for (const d of data) {
    // Examiner — 2 files per domain
    jobs.push({ text: d.examiner.q1.text, voiceId: VOICES.EX, filename: `${d.id}-EX-Q1.mp3` });
    jobs.push({ text: d.examiner.q2.text, voiceId: VOICES.EX, filename: `${d.id}-EX-Q2.mp3` });

    // Candidates — 2 files each × 5 candidates per domain
    for (const c of d.candidates) {
      const code = candidateCode(c.name);
      jobs.push({ text: c.answers.q1.text, voiceId: VOICES[code], filename: `${d.id}-${code}-Q1.mp3` });
      jobs.push({ text: c.answers.q2.text, voiceId: VOICES[code], filename: `${d.id}-${code}-Q2.mp3` });
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  INTUITY Functional Speaking — Audio Generator');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Total files to generate : ${jobs.length}`);
  console.log(`  Output folder           : ${path.resolve(OUTPUT)}`);
  console.log(`  Model                   : ${MODEL}`);
  console.log(`  Delay between calls     : ${DELAY_MS}ms`);
  console.log('═══════════════════════════════════════════════════\n');

  // Estimate credits
  const totalChars = jobs.reduce((sum, j) => sum + j.text.length, 0);
  console.log(`  Estimated characters    : ${totalChars.toLocaleString()}`);
  console.log(`  Estimated credits       : ~${Math.ceil(totalChars / 100) * 10} credits\n`);

  // Generate
  let done = 0;
  for (const job of jobs) {
    process.stdout.write(`[${String(++done).padStart(2,'0')}/${jobs.length}] `);
    await generateMP3(job.text, job.voiceId, job.filename);
    await sleep(DELAY_MS);
  }

  // Final report
  const generated = fs.readdirSync(OUTPUT).filter(f => f.endsWith('.mp3')).length;
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  Complete. ${generated} MP3 files in ${path.resolve(OUTPUT)}`);
  console.log('═══════════════════════════════════════════════════\n');
}

run().catch(err => {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
});
