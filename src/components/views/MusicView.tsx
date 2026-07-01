// Music browser — adapts layout based on the music theme preference.
// Spotify mode: big cards, vibrant gradient header, "Made for You" feel
// Roon mode: dense catalog grid with full sort/group controls

'use client';

import { useState, useMemo } from 'react';
import { useApi } from '@/lib/useApi';
import { useNav, useAudioPlayer, useLocalLibraries, useMusicTheme } from '@/lib/store';
import { MediaCardSquare } from '@/components/media/MediaCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Music, Mic2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlbumsData {
  items: any[];
  total: number;
}
interface ArtistsData {
  items: any[];
}

export function MusicView() {
  const [tab, setTab] = useState('albums');
  const navigate = useNav((s) => s.navigate);
  const playAudio = useAudioPlayer((s) => s.playNow);
  const localItems = useLocalLibraries((s) => s.items);
  const { theme } = useMusicTheme();
  const isSpotify = theme === 'spotify';

  const { data: albumsData, loading: albumsLoading } = useApi<AlbumsData>('/api/music/albums?sort=recent');
  const { data: artistsData, loading: artistsLoading } = useApi<ArtistsData>('/api/music/artists');

  // Group local tracks into albums
  const localAlbums = useMemo(() => {
    const map = new Map<string, { title: string; artist: string; coverColor: string; tracks: any[] }>();
    for (const i of localItems) {
      if (i.mediaType !== 'track') continue;
      const albumKey = i.album || 'Unknown Album';
      const artistName = i.artist || 'Unknown Artist';
      const key = albumKey + '|' + artistName;
      if (!map.has(key)) {
        map.set(key, {
          title: albumKey,
          artist: artistName,
          coverColor: i.color,
          tracks: [],
        });
      }
      map.get(key)!.tracks.push(i);
    }
    return Array.from(map.entries()).map(([key, val]) => ({
      id: 'local_album_' + key,
      title: val.title,
      year: undefined,
      genre: undefined,
      coverColor: val.coverColor,
      addedAt: new Date().toISOString(),
      artist: { id: 'local_artist_' + val.artist, name: val.artist, imageColor: val.coverColor },
      trackCount: val.tracks.length,
      isLocal: true,
      _localTracks: val.tracks,
    }));
  }, [localItems]);

  // Group local tracks into artists
  const localArtists = useMemo(() => {
    const map = new Map<string, { name: string; coverColor: string; albumCount: number; trackCount: number }>();
    for (const i of localItems) {
      if (i.mediaType !== 'track') continue;
      const name = i.artist || 'Unknown Artist';
      if (!map.has(name)) {
        map.set(name, { name, coverColor: i.color, albumCount: 0, trackCount: 0 });
      }
      const a = map.get(name)!;
      a.trackCount++;
    }
    // Count unique albums per artist
    const albumSets = new Map<string, Set<string>>();
    for (const i of localItems) {
      if (i.mediaType !== 'track') continue;
      const name = i.artist || 'Unknown Artist';
      if (!albumSets.has(name)) albumSets.set(name, new Set());
      albumSets.get(name)!.add(i.album || 'Unknown Album');
    }
    return Array.from(map.values()).map((a) => ({
      id: 'local_artist_' + a.name,
      name: a.name,
      imageColor: a.coverColor,
      bio: undefined,
      albumCount: albumSets.get(a.name)?.size ?? 0,
      trackCount: a.trackCount,
      isLocal: true,
    }));
  }, [localItems]);

  const allAlbums = [...(albumsData?.items ?? []), ...localAlbums];
  const allArtists = [...(artistsData?.items ?? []), ...localArtists];

  const handlePlayLocalAlbum = (album: any) => {
    const tracks = album._localTracks;
    if (!tracks || tracks.length === 0) return;
    tracks.sort((a: any, b: any) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
    playAudio(tracks.map((t: any) => ({
      id: t.id,
      type: 'track' as const,
      title: t.title,
      subtitle: album.artist?.name ?? 'Unknown Artist',
      duration: t.duration,
      color: album.coverColor,
      isLocal: true,
    })));
  };

  return (
    <div className="pb-12">
      {/* === Theme-aware header === */}
      {isSpotify ? (
        // Spotify mode: vibrant gradient banner
        <div
          className="relative px-4 md:px-8 pt-10 pb-6 mb-6 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, hsl(145, 60%, 20%) 0%, hsl(145, 50%, 8%) 50%, var(--background) 100%)`,
          }}
        >
          <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{
            background: 'radial-gradient(ellipse 60% 80% at 25% 15%, rgba(255,255,255,0.25) 0%, transparent 55%)',
          }} />
          <div className="relative">
            <div className="text-xs uppercase tracking-widest text-[#1DB954] font-bold mb-1">Made for You</div>
            <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-2">Your Music</h1>
            <p className="text-white/70 text-sm">
              {albumsData ? `${albumsData.total + localAlbums.length} albums • ${allArtists.length} artists` : 'Loading…'}
            </p>
          </div>
        </div>
      ) : (
        // Roon mode: minimal elegant header
        <div className="px-4 md:px-8 py-6 mb-2">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Music className="w-7 h-7 text-primary" />
            Music
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {albumsData ? `${albumsData.total + localAlbums.length} album${(albumsData.total + localAlbums.length) !== 1 ? 's' : ''} • ${allArtists.length} artist${allArtists.length !== 1 ? 's' : ''}${localAlbums.length > 0 ? ` (${localAlbums.length} local)` : ''}` : 'Loading your music library…'}
          </p>
        </div>
      )}

      <div className={isSpotify ? 'px-4 md:px-8' : ''}>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-card">
          <TabsTrigger value="albums">Albums</TabsTrigger>
          <TabsTrigger value="artists">Artists</TabsTrigger>
        </TabsList>

        <TabsContent value="albums" className="mt-6">
          {albumsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 18 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-md" />)}
            </div>
          ) : allAlbums.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {allAlbums.map((a: any) => (
                <div key={a.id} className="relative">
                  {a.isLocal && (
                    <span className="absolute top-2 right-2 z-10 text-[9px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-medium uppercase tracking-wider">Local</span>
                  )}
                  <MediaCardSquare
                    title={a.title}
                    subtitle={`${a.year ?? ''} • ${a.artist?.name ?? ''}`.replace(/^ • | • $/g, '')}
                    color={a.coverColor}
                    onClick={() => navigate({ kind: 'album', id: a.id })}
                    onPlay={() => a.isLocal ? handlePlayLocalAlbum(a) : navigate({ kind: 'album', id: a.id })}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Music} label="No albums found" cta="Add a Music Library" onClick={() => navigate({ kind: 'settings' })} />
          )}
        </TabsContent>

        <TabsContent value="artists" className="mt-6">
          {artistsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-full" />)}
            </div>
          ) : allArtists.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {allArtists.map((a: any) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => navigate({ kind: 'artist', id: a.id })}
                  className="group flex flex-col items-center p-4 rounded-lg bg-card hover:bg-card/80 transition cursor-pointer text-center relative"
                >
                  {a.isLocal && (
                    <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-medium uppercase tracking-wider">Local</span>
                  )}
                  <div
                    className="w-24 h-24 rounded-full mb-3 flex items-center justify-center text-2xl font-bold text-white shadow-lg group-hover:scale-105 transition"
                    style={{
                      background: `linear-gradient(135deg, ${a.imageColor ?? '#444'} 0%, #111 100%)`,
                    }}
                  >
                    {a.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="font-semibold text-sm line-clamp-1">{a.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {a.albumCount} album{a.albumCount !== 1 ? 's' : ''} • {a.trackCount} track{a.trackCount !== 1 ? 's' : ''}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon={Mic2} label="No artists found" cta="Add a Music Library" onClick={() => navigate({ kind: 'settings' })} />
          )}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon, label, cta, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; cta: string; onClick: () => void;
}) {
  return (
    <div className="text-center py-16">
      <Icon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
      <p className="text-muted-foreground">{label}</p>
      <Button variant="outline" className="mt-4" onClick={onClick}>{cta}</Button>
    </div>
  );
}
