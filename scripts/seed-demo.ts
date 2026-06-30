// Demo media generator + database seeder
//
// This script:
// 1. Creates a `media/` directory with the proper Plex-style folder structure
// 2. Generates a handful of real, playable media files using ffmpeg:
//    - Audio: short sine-wave tones (different frequencies per file)
//    - Video: short test-pattern MP4 files with a colored background + tone
// 3. Seeds the database with rich metadata for movies, TV shows, music,
//    podcasts, and audiobooks. Many DB entries point to the same physical
//    files because we are demonstrating the browse/play experience, not
//    shipping copyrighted media.
// 4. Creates default Library entries so the user can immediately browse.

import { promises as fs } from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { db } from '../src/lib/db';

const MEDIA_ROOT = path.resolve(process.cwd(), 'media');

// --------- helpers ---------
function ensureDir(p: string) {
  return fs.mkdir(p, { recursive: true });
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function hueFromString(s: string): number {
  return hashString(s) % 360;
}

// Generate a short audio file (sine wave) using ffmpeg
function genAudio(filePath: string, freq: number, durationSec = 30) {
  const args = [
    '-y',
    '-f', 'lavfi',
    '-i', `sine=frequency=${freq}:duration=${durationSec}`,
    '-c:a', 'libmp3lame',
    '-b:a', '96k',
    filePath,
  ];
  execFileSync('ffmpeg', args, { stdio: 'ignore' });
}

// Generate a short video file (color test pattern + tone) using ffmpeg
function genVideo(filePath: string, hue: number, durationSec = 30) {
  // color source: HSL -> RGB hex
  const hex = hslToHex(hue, 0.5, 0.35);
  const args = [
    '-y',
    '-f', 'lavfi',
    '-i', `color=c=${hex}:s=640x360:d=${durationSec}:r=24`,
    '-f', 'lavfi',
    '-i', `sine=frequency=220:duration=${durationSec}`,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '96k',
    '-shortest',
    filePath,
  ];
  execFileSync('ffmpeg', args, { stdio: 'ignore' });
}

function hslToHex(h: number, s: number, l: number): string {
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp >= 0 && hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = l - c / 2;
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `0x${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function makeSortTitle(title: string): string {
  return title.toLowerCase().replace(/^(the|a|an)\s+/, '').trim();
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

// --------- data definitions ---------

const MOVIES = [
  { title: 'The Quantum Horizon', year: 2024, genre: 'Sci-Fi', director: 'Elena Vasquez', cast: ['Mara Chen', 'Idris Okafor', 'Lena Park'], rating: 8.7, plot: 'When a quantum physicist discovers a parallel timeline bleeding into our own, she must race against rival agencies to seal the breach before both realities collapse into oblivion.' },
  { title: 'Crimson Tide of Stars', year: 2023, genre: 'Action', director: 'Marcus Webb', cast: ['Diego Salazar', 'Anya Petrov'], rating: 7.9, plot: 'A disgraced naval commander is recalled to lead a final desperate mission against an overwhelming enemy fleet at the edge of the solar system.' },
  { title: 'Whispers in the Static', year: 2022, genre: 'Horror', director: 'Yuki Tanaka', cast: ['Sora Kim', 'Reina Mills'], rating: 7.4, plot: 'A late-night radio host begins receiving transmissions from a station that has been off the air for forty years, each broadcast predicting a death in town.' },
  { title: 'The Last Cartographer', year: 2024, genre: 'Drama', director: 'Aisha Bello', cast: ['Henrik Lund', 'Mei Tanaka', 'Caleb Ross'], rating: 8.2, plot: 'An aging mapmaker embarks on one final journey to chart a vanishing coastline, accompanied by his estranged granddaughter who is documenting the trip.' },
  { title: 'Neon Requiem', year: 2023, genre: 'Thriller', director: 'Rex Carver', cast: ['Jada Morales', 'Viktor Stahl'], rating: 7.6, plot: 'In a rain-soaked megacity, a cybernetic detective hunts a serial killer who leaves only fragments of poetry at each crime scene.' },
  { title: 'Echoes of Tomorrow', year: 2021, genre: 'Sci-Fi', director: 'Priya Anand', cast: ['Kai Nakamura', 'Astrid Berg'], rating: 8.0, plot: 'A linguist deciphers a signal from the future that warns of an impending catastrophe, but each translation she completes alters the present in unexpected ways.' },
  { title: 'The Velvet Heist', year: 2024, genre: 'Crime', director: 'Theo Marchand', cast: ['Camille Dubois', 'Rashid Ali', 'Bella Stone'], rating: 7.8, plot: 'A team of art thieves plots the impossible theft of a priceless painting from the most secure vault in Europe during a high-society gala.' },
  { title: 'Solitude', year: 2022, genre: 'Drama', director: 'Naomi Frost', cast: ['Eli Warner'], rating: 8.4, plot: 'A reclusive novelist living in a remote cabin receives a letter that forces her to confront the tragedy she has spent thirty years running from.' },
  { title: 'Ironwood Ridge', year: 2023, genre: 'Western', director: 'Cody Hayes', cast: ['Beau Trent', 'Mabel Stone'], rating: 7.5, plot: 'A former gunslinger returns to the mining town that betrayed him, only to find the real threat is the corporation buying up every acre for miles.' },
  { title: 'The Glasshouse Protocol', year: 2024, genre: 'Sci-Fi', director: 'Hana Yoshida', cast: ['Owen Mercer', 'Lila Park', 'Sam Devereux'], rating: 8.1, plot: 'Inside a sealed biodome built to outlast climate collapse, the inhabitants discover their sanctuary is a simulation run by a much larger experiment.' },
  { title: 'Midnight in Marrakech', year: 2022, genre: 'Romance', director: 'Yasmin El-Amin', cast: ['Tariq Khan', 'Sophie Laurent'], rating: 7.7, plot: 'Two strangers meet in a Marrakech marketplace and spend a single night walking the city together, knowing they will never see each other again.' },
  { title: 'The Hollow Crown', year: 2023, genre: 'Fantasy', director: 'Gareth Lloyd', cast: ['Eira Vaughn', 'Cormac Hale', 'Ines del Rio'], rating: 8.3, plot: 'A reluctant heir to a fallen kingdom must unite the warring noble houses before the ancient evil that broke the old crown returns to finish what it started.' },
];

const TV_SHOWS = [
  {
    title: 'Halcyon Reach', year: 2023, genre: 'Sci-Fi', rating: 8.9, plot: 'A deep-space colony on the edge of charted space struggles to survive after losing contact with Earth, while strange signals suggest they may not be alone.',
    seasons: [
      { seasonNumber: 1, episodes: [
        { title: 'Arrival', plot: 'The colony ship Halcyon reaches its destination after a 200-year journey, only to find the planet is not as uninhabited as the surveys promised.' },
        { title: 'First Light', plot: 'As the colonists establish their foothold, a series of equipment failures suggests sabotage from within.' },
        { title: 'The Signal', plot: 'A repeating transmission is detected from beneath the planet surface, written in a language no one recognizes.' },
        { title: 'Broken Orbit', plot: 'The colony ship suffers a catastrophic failure in orbit, threatening to crash and destroy everything below.' },
        { title: 'Echo Chamber', plot: 'Members of the council begin receiving visions tied to the alien signal, dividing the colony on whether to investigate or destroy it.' },
        { title: 'Salt the Earth', plot: 'A faction moves to sabotage the water purification system to force an evacuation, forcing Commander Vasquez to make an impossible choice.' },
        { title: 'The Long Dark', plot: 'A solar flare knocks out power across the colony, and the long night reveals what has been hiding in the shadows.' },
        { title: 'Contact', plot: 'Season finale. The source of the signal is finally uncovered, and first contact does not go as anyone expected.' },
      ]},
      { seasonNumber: 2, episodes: [
        { title: 'Aftermath', plot: 'Three months after the events of the signal, the colony is fractured and a new threat emerges from the wreckage.' },
        { title: 'The Remnant', plot: 'A survivor from the original survey mission is found in cryosleep, bearing warnings about what the colonists have awoken.' },
        { title: 'Tributaries', plot: 'A water source is discovered deep in the cave system, but the expedition to claim it goes badly wrong.' },
        { title: 'False Vacuum', plot: 'The colony scientists make a breakthrough that could change everything, but at a cost no one is willing to pay.' },
        { title: 'Crossover', plot: 'A second colony ship arrives unexpectedly, and its passengers have very different ideas about how to settle this world.' },
        { title: 'The Calculus of Loss', plot: 'Commander Vasquez is forced into a negotiation that will determine the fate of both colonies.' },
      ]},
    ],
  },
  {
    title: 'The Detective of Whitmore Lane', year: 2022, genre: 'Mystery', rating: 8.5, plot: 'A brilliant but disgraced detective takes a position in a quiet English village, only to discover the countryside holds secrets darker than any city.',
    seasons: [
      { seasonNumber: 1, episodes: [
        { title: 'The Body in the Garden', plot: 'A retired detective\'s first week in Whitmore is interrupted by a body found in the vicar\'s rose garden.' },
        { title: 'Blood on the Moors', plot: 'A shepherd is found dead on the moor, and the prime suspect is a man who has been dead for fifty years.' },
        { title: 'The Locked Library', plot: 'A wealthy bibliophile is found dead inside his locked private library with no sign of forced entry.' },
        { title: 'Whispers at the Inn', plot: 'A traveling salesman vanishes from the village inn, leaving behind a suitcase full of cash and a cryptic note.' },
        { title: 'The Twelve Bells', plot: 'When the church bells ring twelve at midnight, the entire village knows another body will be found by dawn.' },
        { title: 'A Confession in Tea', plot: 'A tea party at the manor house turns deadly, and the killer is one of the four guests seated at the table.' },
      ]},
    ],
  },
  {
    title: 'Crown of Embers', year: 2024, genre: 'Fantasy', rating: 9.1, plot: 'Three sisters, each heir to a different magical bloodline, are drawn into a war for a throne that was supposed to be empty.',
    seasons: [
      { seasonNumber: 1, episodes: [
        { title: 'The Pyre', plot: 'The old king is dead and the kingdom burns. Three sisters, scattered across the realm, each receive a summons they cannot refuse.' },
        { title: 'Ash and Iron', plot: 'The eldest sister claims the capital by force, while the middle sister flees to the mountain holds of her mother\'s people.' },
        { title: 'The Tidewitch', plot: 'The youngest sister is found by the sea witches, who reveal a prophecy about the crown she was born to wear.' },
        { title: 'Broken Vows', plot: 'A wedding meant to seal an alliance becomes a bloodbath, and the war for the crown begins in earnest.' },
        { title: 'The Long Road', plot: 'The middle sister gathers an army from the mountain clans, but the price of their loyalty is higher than she can bear.' },
        { title: 'Salt and Smoke', plot: 'The youngest sister sails against the fleet of the eldest, and a storm of unnatural origin engulfs them both.' },
      ]},
    ],
  },
  {
    title: 'Velocity', year: 2023, genre: 'Action', rating: 7.8, plot: 'An underground street racing crew is recruited by a covert government agency to infiltrate a global smuggling ring that operates through the world\'s most dangerous races.',
    seasons: [
      { seasonNumber: 1, episodes: [
        { title: 'Green Light', plot: 'A street race in Tokyo goes wrong when one of the drivers is murdered in front of the crew, drawing the attention of a mysterious recruiter.' },
        { title: 'The Casablanca Circuit', plot: 'The crew enters their first sanctioned race in Morocco, only to discover the smuggling ring uses the race as cover for a major shipment.' },
        { title: 'Pit Stop', plot: 'A mechanical failure during a race in Dubai forces the crew to improvise, and a member is captured by the ring.' },
        { title: 'Blood on the Track', plot: 'A rescue operation in the Dubai skyline goes sideways, and the crew discovers the true scale of the operation.' },
        { title: 'The Pacific Run', plot: 'A race across the Pacific Rim becomes a chase when the ring realizes the crew has turned.' },
      ]},
    ],
  },
];

const ALBUMS = [
  { artist: 'Lumina Vega', album: 'Stargazer', year: 2024, genre: 'Synthwave', tracks: ['Liftoff', 'Stargazer', 'Nebula Drift', 'Event Horizon', 'Solar Winds', 'Quasar', 'Orbit', 'Reentry', 'Homecoming'] },
  { artist: 'Lumina Vega', album: 'Midnight Frequencies', year: 2022, genre: 'Synthwave', tracks: ['Static', 'Night Drive', 'Signal Lost', 'Frequencies', 'Long Way Home'] },
  { artist: 'The Hollow Suns', album: 'Burn Through the Dark', year: 2023, genre: 'Indie Rock', tracks: ['Matches', 'Burn Through the Dark', 'Tinderbox', 'Smokescreen', 'Afterglow', 'Embers', 'Ashes', 'Wildfire'] },
  { artist: 'The Hollow Suns', album: 'Coastline', year: 2021, genre: 'Indie Rock', tracks: ['Salt Air', 'Coastline', 'Lighthouse', 'The Tide', 'Driftwood', 'Sunset Strip'] },
  { artist: 'Mira Okonkwo', album: 'Lagos to London', year: 2024, genre: 'Afrobeats', tracks: ['Mama Said', 'Lagos to London', 'Jollof', 'Yellow Bus', '3 AM in Peckham', 'Call Home', 'Diaspora'] },
  { artist: 'Mira Okonkwo', album: 'Golden Hour', year: 2022, genre: 'Afrobeats', tracks: ['Golden Hour', 'Sunrise', 'Highlife', 'Owu', 'Brand New'] },
  { artist: 'Caspian Wren', album: 'The Quiet Interior', year: 2023, genre: 'Folk', tracks: ['The Quiet Interior', 'Lamplight', 'Old Wood', 'Snowfall', 'Letter to No One', 'A Long Year', 'Hearth'] },
  { artist: 'Caspian Wren', album: 'Northbound', year: 2021, genre: 'Folk', tracks: ['Northbound', 'Colder Months', 'Trains', 'Hollow Pine', 'Returning'] },
  { artist: 'DJ Pulsewave', album: 'Bassdrop', year: 2024, genre: 'EDM', tracks: ['Bassdrop', 'Festival Lights', 'Subwoofer', 'Hands Up', 'Last Set', 'Encore'] },
  { artist: 'DJ Pulsewave', album: 'Mainstage', year: 2023, genre: 'EDM', tracks: ['Mainstage', 'Crowd Surf', 'Pyro', 'Drop the Bass', 'Afterparty'] },
  { artist: 'The Silver Brass', album: 'Midnight Sessions', year: 2024, genre: 'Jazz', tracks: ['Blue Mode', 'Midnight Sessions', 'Smoke Ring', 'After Hours', 'Last Call', 'Encore'] },
  { artist: 'Aria Solis', album: 'Cielo', year: 2023, genre: 'Classical Crossover', tracks: ['Aurora', 'Cielo', 'Lluvia', 'Eclipse', 'Viento', 'Estrellas'] },
];

const PODCASTS = [
  {
    title: 'The Long Now', author: 'Dr. Helena Cross', description: 'A weekly exploration of long-term thinking, deep history, and the technologies shaping the next thousand years.',
    episodes: [
      { title: 'The 10,000 Year Clock', description: 'We visit the site of the literal 10,000 year clock being built inside a Texas mountain and talk to the engineers trying to design for deep time.' },
      { title: 'Why We Forget the Future', description: 'Cognitive scientist Dr. Amaya Rao explains why humans are so bad at long-term thinking, and what we can do about it.' },
      { title: 'The Language of Climate', description: 'How the words we use to talk about climate change shape what we are willing to do about it.' },
      { title: 'Civilizations That Lasted', description: 'What can we learn from the longest-lasting civilizations in human history? More than you might think.' },
      { title: 'Designing for Deep Time', description: 'How do you design a warning sign that will still be understood in 10,000 years? A nuclear waste expert explains.' },
      { title: 'The Patient Future', description: 'What does it look like to build institutions that think in centuries instead of quarters?' },
    ],
  },
  {
    title: 'True Crime Theater', author: 'Marcus Reed', description: 'Reopening the cold cases that haunt the towns they happened in, with original interviews and new evidence.',
    episodes: [
      { title: 'The Lighthouse Keeper', description: 'In 1972, a lighthouse keeper on a remote Scottish island vanished without a trace. Fifty years later, his daughter found a letter he never sent.' },
      { title: 'The Truck Stop', description: 'A series of disappearances along a 50-mile stretch of highway in the 1990s may finally have a suspect.' },
      { title: 'The Vanishing of Sarah Bell', description: 'A college student disappears during spring break. The case goes cold for twenty years until a true crime podcast gets a call.' },
      { title: 'Blood on the Snow', description: 'A double homicide in a remote Alaskan cabin in 1989. The case was solved in 2021 when the killer\'s daughter turned him in.' },
      { title: 'The Phantom Caller', description: 'For three years, a small town received threatening phone calls from a man who was never identified. Then the calls stopped.' },
    ],
  },
  {
    title: 'Code & Culture', author: 'Priya Shah & Tom Becker', description: 'A weekly conversation about how software is reshaping culture, work, and what it means to be human.',
    episodes: [
      { title: 'The Death of the Homepage', description: 'How the social feed killed the open web, and whether anything can bring it back.' },
      { title: 'When AI Writes the News', description: 'A candid conversation with the editor of an AI-assisted newsroom about what is gained and lost when algorithms write the first draft.' },
      { title: 'The Remote Work Divide', description: 'Five years after the great shift to remote, who is winning and who is being left behind?' },
      { title: 'The Open Source Reckoning', description: 'Why the maintainer burnout crisis may be the most important tech story of the decade.' },
      { title: 'Designing for Disconnection', description: 'A movement of designers are building apps that want you to use them less. We talk to three of them.' },
    ],
  },
  {
    title: 'Mystery Sound Lab', author: 'Yuki Tanaka', description: 'Every episode, a mystery sound. Listen, guess, and then learn the strange story behind it.',
    episodes: [
      { title: 'Episode 23: The Singing Ice', description: 'A sound recorded under a frozen lake in Finland that scientists cannot fully explain.' },
      { title: 'Episode 24: The 52-Hertz Whale', description: 'The loneliest whale in the world sings at a frequency no other whale can hear. Or can they?' },
      { title: 'Episode 25: The Bloop', description: 'The most famous unidentified sound in the ocean has a likely explanation, but the truth is even stranger.' },
      { title: 'Episode 26: Skyquakes', description: 'Mysterious booms have been reported in the sky for centuries. We trace the oldest records to the newest theories.' },
      { title: 'Episode 27: The Hum', description: 'In cities around the world, a small percentage of people hear a constant low hum that no one else can hear.' },
    ],
  },
];

const AUDIOBOOKS = [
  { title: 'The Cartographers', author: 'Eleanor Vance', narrator: 'Margaret Hale', year: 2023, genre: 'Literary Fiction', description: 'A sweeping family saga spanning three generations of mapmakers, from the trenches of World War I to the satellite age. A meditation on the maps we draw of our own lives.' },
  { title: 'A Brief History of Tomorrow', author: 'Dr. James Holloway', narrator: 'The Author', year: 2024, genre: 'Non-Fiction', description: 'A clear-eyed look at the technologies that will define the next century, from AI to fusion power, and the moral questions we are not yet prepared to answer.' },
  { title: 'The Salt Garden', author: 'Nadia Reyes', narrator: 'Sofia Marin', year: 2022, genre: 'Literary Fiction', description: 'A widow returns to the coastal village of her childhood to rebuild her grandmother\'s ruined garden, and finds herself rebuilding a life she thought was over.' },
  { title: 'The Silent Empire', author: 'Theodore Marsh', narrator: 'Richard Easton', year: 2023, genre: 'History', description: 'The forgotten story of the largest empire in human history, told through the silence it left behind in the languages, foods, and gods of the people it conquered.' },
  { title: 'Wolfsbane', author: 'Cassandra Locke', narrator: 'Imogen Hart', year: 2024, genre: 'Fantasy', description: 'A young woman discovers she is the last of a bloodline sworn to hunt the wolf that has stalked her village for three hundred years, and that the wolf has been waiting for her.' },
  { title: 'Letters to My Younger Self', author: 'Various', narrator: 'Full Cast', year: 2022, genre: 'Essays', description: 'Twenty of the most influential voices of our time share the letters they wish they could send back to their younger selves.' },
  { title: 'The Algorithm Garden', author: 'Dr. Wei Chen', narrator: 'The Author', year: 2024, genre: 'Non-Fiction', description: 'A mathematician explores the hidden beauty of the algorithms that run our world, and the gardens of possibility they tend and prune.' },
  { title: 'Iron and Honey', author: 'Beatrix Sol', narrator: 'Hannah Lowe', year: 2023, genre: 'Memoir', description: 'A blacksmith\'s daughter recounts growing up in a forge in rural Vermont, and what the fire taught her about love, loss, and the work of a life.' },
];

// --------- main ---------
async function main() {
  console.log('=== Seeding demo media library ===');

  // 1. Clear existing data
  console.log('Clearing existing data...');
  await db.watchProgress.deleteMany();
  await db.track.deleteMany();
  await db.album.deleteMany();
  await db.artist.deleteMany();
  await db.podcastEpisode.deleteMany();
  await db.podcast.deleteMany();
  await db.audiobook.deleteMany();
  await db.episode.deleteMany();
  await db.season.deleteMany();
  await db.tvShow.deleteMany();
  await db.movie.deleteMany();
  await db.library.deleteMany();

  // 2. Generate the physical media files (only need a handful; many DB entries share)
  console.log('Generating physical media files via ffmpeg...');
  const audioSamples = 12; // generate 12 distinct audio tones
  const videoSamples = 8;  // generate 8 distinct video test patterns

  await ensureDir(path.join(MEDIA_ROOT, 'audio'));
  await ensureDir(path.join(MEDIA_ROOT, 'video'));

  for (let i = 0; i < audioSamples; i++) {
    const f = path.join(MEDIA_ROOT, 'audio', `tone-${i + 1}.mp3`);
    if (!(await fileExists(f))) {
      genAudio(f, 220 + i * 35, 45);
      console.log(`  audio: tone-${i + 1}.mp3`);
    }
  }
  for (let i = 0; i < videoSamples; i++) {
    const f = path.join(MEDIA_ROOT, 'video', `scene-${i + 1}.mp4`);
    if (!(await fileExists(f))) {
      genVideo(f, (i * 47) % 360, 45);
      console.log(`  video: scene-${i + 1}.mp4`);
    }
  }

  const audioFiles = (await fs.readdir(path.join(MEDIA_ROOT, 'audio'))).map((f) => path.join(MEDIA_ROOT, 'audio', f));
  const videoFiles = (await fs.readdir(path.join(MEDIA_ROOT, 'video'))).map((f) => path.join(MEDIA_ROOT, 'video', f));

  // 3. Create Libraries
  console.log('Creating libraries...');
  const movieLib = await db.library.create({ data: { name: 'Movies', type: 'MOVIE', path: path.join(MEDIA_ROOT, 'movies') } });
  const tvLib = await db.library.create({ data: { name: 'TV Shows', type: 'TV', path: path.join(MEDIA_ROOT, 'tv') } });
  const musicLib = await db.library.create({ data: { name: 'Music', type: 'MUSIC', path: path.join(MEDIA_ROOT, 'music') } });
  const podcastLib = await db.library.create({ data: { name: 'Podcasts', type: 'PODCAST', path: path.join(MEDIA_ROOT, 'podcasts') } });
  const audiobookLib = await db.library.create({ data: { name: 'Audiobooks', type: 'AUDIOBOOK', path: path.join(MEDIA_ROOT, 'audiobooks') } });

  // 4. Seed Movies
  console.log('Seeding movies...');
  for (let i = 0; i < MOVIES.length; i++) {
    const m = MOVIES[i];
    const filePath = videoFiles[i % videoFiles.length];
    const stat = await fs.stat(filePath);
    await db.movie.create({
      data: {
        libraryId: movieLib.id,
        title: m.title,
        sortTitle: makeSortTitle(m.title),
        year: m.year,
        plot: m.plot,
        genre: m.genre,
        director: m.director,
        cast: JSON.stringify(m.cast),
        rating: m.rating,
        duration: 45 * 60, // demo: 45 min
        posterColor: `hsl(${hueFromString(m.title)}, 55%, 45%)`,
        backdropColor: `hsl(${hueFromString(m.title + ' backdrop')}, 45%, 25%)`,
        filePath,
        fileSize: stat.size,
        addedAt: new Date(Date.now() - i * 86400000),
      },
    });
  }

  // 5. Seed TV Shows
  console.log('Seeding TV shows...');
  let tvIdx = 0;
  for (const show of TV_SHOWS) {
    const tv = await db.tvShow.create({
      data: {
        libraryId: tvLib.id,
        title: show.title,
        sortTitle: makeSortTitle(show.title),
        year: show.year,
        plot: show.plot,
        genre: show.genre,
        rating: show.rating,
        posterColor: `hsl(${hueFromString(show.title)}, 55%, 45%)`,
        backdropColor: `hsl(${hueFromString(show.title + ' backdrop')}, 45%, 25%)`,
        addedAt: new Date(Date.now() - tvIdx * 86400000),
      },
    });
    for (const season of show.seasons) {
      const s = await db.season.create({
        data: {
          tvShowId: tv.id,
          seasonNumber: season.seasonNumber,
          posterColor: `hsl(${hueFromString(show.title + ' S' + season.seasonNumber)}, 55%, 45%)`,
        },
      });
      for (let e = 0; e < season.episodes.length; e++) {
        const ep = season.episodes[e];
        const filePath = videoFiles[(tvIdx + e) % videoFiles.length];
        const epStat = await fs.stat(filePath);
        await db.episode.create({
          data: {
            seasonId: s.id,
            episodeNumber: e + 1,
            title: ep.title,
            plot: ep.plot,
            duration: 45 * 60,
            filePath,
            fileSize: epStat.size,
            addedAt: new Date(Date.now() - tvIdx * 86400000 - e * 3600000),
          },
        });
      }
    }
    tvIdx++;
  }

  // 6. Seed Music
  console.log('Seeding music...');
  let trackCounter = 0;
  for (const a of ALBUMS) {
    let artist = await db.artist.findFirst({ where: { name: a.artist } });
    if (!artist) {
      artist = await db.artist.create({
        data: { name: a.artist, sortName: makeSortTitle(a.artist), imageColor: `hsl(${hueFromString(a.artist)}, 55%, 45%)` },
      });
    }
    const album = await db.album.create({
      data: {
        libraryId: musicLib.id,
        artistId: artist.id,
        title: a.album,
        sortTitle: makeSortTitle(a.album),
        year: a.year,
        genre: a.genre,
        coverColor: `hsl(${hueFromString(a.album + a.artist)}, 55%, 45%)`,
        addedAt: new Date(),
      },
    });
    for (let t = 0; t < a.tracks.length; t++) {
      const filePath = audioFiles[trackCounter % audioFiles.length];
      const stat = await fs.stat(filePath);
      await db.track.create({
        data: {
          albumId: album.id,
          artistId: artist.id,
          trackNumber: t + 1,
          title: a.tracks[t],
          duration: 180 + (t * 13) % 90, // 3-4.5 min
          filePath,
          fileSize: stat.size,
          addedAt: new Date(),
        },
      });
      trackCounter++;
    }
  }

  // 7. Seed Podcasts
  console.log('Seeding podcasts...');
  let podEpIdx = 0;
  for (const p of PODCASTS) {
    const podcast = await db.podcast.create({
      data: {
        libraryId: podcastLib.id,
        title: p.title,
        sortTitle: makeSortTitle(p.title),
        author: p.author,
        description: p.description,
        coverColor: `hsl(${hueFromString(p.title)}, 55%, 45%)`,
        addedAt: new Date(),
      },
    });
    for (let e = 0; e < p.episodes.length; e++) {
      const ep = p.episodes[e];
      const filePath = audioFiles[podEpIdx % audioFiles.length];
      const stat = await fs.stat(filePath);
      await db.podcastEpisode.create({
        data: {
          podcastId: podcast.id,
          episodeNumber: e + 1,
          title: ep.title,
          description: ep.description,
          duration: 30 * 60 + (e * 47) % 600, // 30-40 min
          filePath,
          fileSize: stat.size,
          pubDate: new Date(Date.now() - e * 7 * 86400000),
          addedAt: new Date(),
        },
      });
      podEpIdx++;
    }
  }

  // 8. Seed Audiobooks
  console.log('Seeding audiobooks...');
  for (let i = 0; i < AUDIOBOOKS.length; i++) {
    const ab = AUDIOBOOKS[i];
    const filePath = audioFiles[i % audioFiles.length];
    const stat = await fs.stat(filePath);
    await db.audiobook.create({
      data: {
        libraryId: audiobookLib.id,
        title: ab.title,
        sortTitle: makeSortTitle(ab.title),
        author: ab.author,
        narrator: ab.narrator,
        description: ab.description,
        genre: ab.genre,
        year: ab.year,
        duration: (8 + (i % 4)) * 3600, // 8-11 hours
        filePath,
        fileSize: stat.size,
        coverColor: `hsl(${hueFromString(ab.title + ab.author)}, 55%, 45%)`,
        addedAt: new Date(),
      },
    });
  }

  // 9. Seed a few watch-progress entries to demo "Continue Watching"
  console.log('Seeding watch progress...');
  const firstMovie = await db.movie.findFirst({ orderBy: { addedAt: 'asc' } });
  if (firstMovie) {
    await db.watchProgress.create({
      data: { mediaType: 'MOVIE', mediaId: firstMovie.id, position: 1230, duration: 45 * 60, updatedAt: new Date(Date.now() - 2 * 3600000) },
    });
  }
  const firstEpisode = await db.episode.findFirst({ orderBy: { addedAt: 'asc' } });
  if (firstEpisode) {
    await db.watchProgress.create({
      data: { mediaType: 'EPISODE', mediaId: firstEpisode.id, position: 980, duration: 45 * 60, updatedAt: new Date(Date.now() - 5 * 3600000) },
    });
  }
  const firstAudiobook = await db.audiobook.findFirst();
  if (firstAudiobook) {
    await db.watchProgress.create({
      data: { mediaType: 'AUDIOBOOK', mediaId: firstAudiobook.id, position: 5400, duration: 8 * 3600, updatedAt: new Date(Date.now() - 24 * 3600000) },
    });
  }
  const firstPodEp = await db.podcastEpisode.findFirst();
  if (firstPodEp) {
    await db.watchProgress.create({
      data: { mediaType: 'PODCAST_EPISODE', mediaId: firstPodEp.id, position: 720, duration: 30 * 60, updatedAt: new Date(Date.now() - 12 * 3600000) },
    });
  }
  const firstTrack = await db.track.findFirst();
  if (firstTrack) {
    await db.watchProgress.create({
      data: { mediaType: 'TRACK', mediaId: firstTrack.id, position: 60, duration: 180, updatedAt: new Date(Date.now() - 30 * 60000) },
    });
  }

  console.log('=== Done seeding. ===');
  console.log(`Movies:    ${await db.movie.count()}`);
  console.log(`TV Shows:  ${await db.tvShow.count()} / Episodes: ${await db.episode.count()}`);
  console.log(`Albums:    ${await db.album.count()} / Tracks: ${await db.track.count()}`);
  console.log(`Podcasts:  ${await db.podcast.count()} / Episodes: ${await db.podcastEpisode.count()}`);
  console.log(`Audiobooks: ${await db.audiobook.count()}`);
  console.log(`Libraries: ${await db.library.count()}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
