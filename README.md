# MediaStream

A self-hosted media streaming platform that combines the best of **Netflix** (movies & TV), **Spotify** (music & podcasts), and **Audible** (audiobooks) into one Plex/Jellyfin-style app.

Scan your local media folders and stream them flawlessly — **your files never leave your computer**.

## Features

### Five media libraries
- **Movies** — Netflix-style grid with genre filters, ratings, collections (franchise grouping)
- **TV Shows** — seasons and episodes, with `SxxExx` filename parsing
- **Music** — artists, albums, and track lists (reads folder structure as artist/album/track)
- **Podcasts** — episode lists grouped by podcast
- **Audiobooks** — with chapter navigation

### Local folder scanning (no uploads)
Uses the browser's **File System Access API** to scan a folder on your computer and stream files directly from disk via blob URLs. Nothing is uploaded to a server. Works in Chrome, Edge, Opera, and Brave.

### AI metadata enrichment
Click "Enrich" on any local library to extract rich metadata using an LLM:
- Plot summaries, genres, release years, directors, cast, ratings (0-10)
- **Collections** — automatically groups movie sequels and franchises together (e.g. "Harry Potter Collection", "The Lord of the Rings Trilogy") with correct viewing order
- Processes in small batches with automatic split-and-retry on timeouts

### Streaming & playback
- **Video player** — full-screen overlay with custom controls (seek, ±10s skip, volume, fullscreen, keyboard shortcuts)
- **Audio player** — Spotify-style bottom bar with queue, shuffle, repeat, next/prev, expandable "Now Playing" panel
- HTTP Range support for seeking in server-streamed media
- **Continue Watching** — cross-media-type progress tracking with resume support
- **Global search** across all 5 libraries simultaneously

### Browser persistence
Local libraries and their file handles are stored in **IndexedDB**, so they survive page reloads. The browser asks you to re-grant folder permission each session (security requirement).

## Tech stack
- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS 4** + **shadcn/ui** component library
- **Prisma ORM** (SQLite) for server-side libraries
- **Zustand** for client state, custom hooks for server state
- **z-ai-web-dev-sdk** (GLM LLM) for metadata enrichment
- **File System Access API** + **IndexedDB** for browser-side local libraries

## Getting started

### Prerequisites
- Node.js 18+ or [Bun](https://bun.sh)
- A Chromium-based browser (Chrome, Edge, Opera, Brave) for local folder access

### Installation

```bash
# Install dependencies
bun install

# Set up the database
cp .env.example .env  # if not present, DATABASE_URL=file:./db/custom.db
bun run db:push

# (Optional) Seed demo data — generates playable test media with ffmpeg
bun run scripts/seed-demo.ts

# Start the dev server
bun run dev
```

Open http://localhost:3000 in your browser.

### Adding your media

1. Go to **Settings** → scroll to **Local Folder Libraries**
2. Enter a name, pick the type (Movies/TV/Music/Podcasts/Audiobooks), click **Pick Folder**
3. Choose a folder on your computer — subfolders are scanned recursively
4. Click **Scan** to index the files
5. Click **Enrich** to extract metadata (plot, cast, rating) and group sequels into collections

### Supported file types
- **Video**: `.mp4` `.mkv` `.avi` `.mov` `.webm` `.m4v`
- **Audio**: `.mp3` `.flac` `.m4a` `.wav` `.ogg` `.aac` `.opus`

### Filename conventions
- **TV shows**: `Show Name S01E05.mkv` or `Show Name/Season 01/Show Name S01E05.mkv`
- **Music**: `Artist/Album/01 Track Name.mp3` (folder structure = artist/album)
- **Podcasts**: `Podcast Name/Episode 01.mp3`
- **Movies / Audiobooks**: any filename, one file per item

## How it works

### Local libraries (browser-side)
The File System Access API (`showDirectoryPicker`) grants the web app read access to a folder on your computer. The scanner walks the folder tree, parses filenames, and stores metadata + file handles in IndexedDB. When you click play, the file is read from disk via `getFile()` and played from a blob URL — no server round-trip, no upload.

### Server libraries (optional)
You can also add server-side libraries that point to filesystem paths on the server (like traditional Plex/Jellyfin). These stream via an API route with full HTTP Range support for seeking. Useful if you run this app on the same machine as your media (e.g. a home server or NAS).

### Metadata enrichment
The `/api/enrich` endpoint sends batched media titles to the z-ai-web-dev-sdk LLM, which returns structured JSON with plot, genre, year, director, cast, rating, and collection grouping. The LLM detects franchises (Harry Potter, Marvel, Star Wars, etc.) and assigns viewing order. Results are merged back into the IndexedDB item records.

## Project structure

```
prisma/schema.prisma          # Database models (Library, Movie, TvShow, Episode, etc.)
src/lib/
  local-library.ts            # File System Access API + IndexedDB + scanner
  scanner.ts                  # Server-side filesystem scanner
  store.ts                    # Zustand state (nav, players, local libraries)
  format.ts                   # Duration/formatting helpers
src/app/api/
  stream/[type]/[id]/         # Streaming with HTTP Range support
  enrich/                     # LLM metadata extraction + collection detection
  libraries/                  # Server library CRUD + scan trigger
  movies/ tv/ music/ podcasts/ audiobooks/  # Browse + detail endpoints
  dashboard/ progress/ search/
src/components/
  views/                      # Dashboard, Movies, TV, Music, Podcasts, Audiobooks, Search, Settings
  player/                     # VideoPlayer, AudioPlayerBar
  media/                      # MediaPoster, MediaCard, MediaRow
  layout/                     # AppShell, Sidebar, TopBar
scripts/
  seed-demo.ts                # Generate demo media + metadata
  clear-demo-data.ts          # Wipe demo data
```

## Browser support

| Browser | Local folder scanning | Server streaming |
|---------|----------------------|------------------|
| Chrome  | ✅                   | ✅               |
| Edge    | ✅                   | ✅               |
| Opera   | ✅                   | ✅               |
| Brave   | ✅                   | ✅               |
| Firefox | ❌ (no File System Access API) | ✅ |
| Safari  | ❌ (no File System Access API) | ✅ |

Firefox and Safari users can still use server-side libraries — just not the browser-side local folder feature.

## License

MIT
