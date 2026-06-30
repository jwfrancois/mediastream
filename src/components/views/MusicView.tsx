// Music browser — Spotify-style with tabs for Albums and Artists.

'use client';

import { useState } from 'react';
import { useApi } from '@/lib/useApi';
import { useNav } from '@/lib/store';
import { MediaCardSquare } from '@/components/media/MediaCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Music, Mic2 } from 'lucide-react';

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
  const { data: albumsData, loading: albumsLoading } = useApi<AlbumsData>('/api/music/albums?sort=recent');
  const { data: artistsData, loading: artistsLoading } = useApi<ArtistsData>('/api/music/artists');

  return (
    <div className="px-4 md:px-8 py-6 pb-12">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Music className="w-7 h-7 text-primary" />
          Music
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {albumsData ? `${albumsData.total} album${albumsData.total !== 1 ? 's' : ''} • ${artistsData?.items.length ?? 0} artist${(artistsData?.items.length ?? 0) !== 1 ? 's' : ''}` : 'Loading your music library…'}
        </p>
      </div>

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
          ) : albumsData && albumsData.items.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {albumsData.items.map((a) => (
                <MediaCardSquare
                  key={a.id}
                  title={a.title}
                  subtitle={`${a.year ?? ''} • ${a.artist?.name ?? ''}`.replace(/^ • | • $/g, '')}
                  color={a.coverColor}
                  onClick={() => navigate({ kind: 'album', id: a.id })}
                />
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
          ) : artistsData && artistsData.items.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {artistsData.items.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => navigate({ kind: 'artist', id: a.id })}
                  className="group flex flex-col items-center p-4 rounded-lg bg-card hover:bg-card/80 transition cursor-pointer text-center"
                >
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
