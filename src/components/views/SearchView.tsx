// Search view — global search results across all libraries.

'use client';

import { useApi } from '@/lib/useApi';
import { useNav, useVideoPlayer, useAudioPlayer } from '@/lib/store';
import { MediaCard, MediaCardSquare } from '@/components/media/MediaCard';
import { Search as SearchIcon, Film, Tv, Music, Mic, BookHeadphones, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface SearchData {
  movies: any[];
  shows: any[];
  albums: any[];
  artists: any[];
  podcasts: any[];
  audiobooks: any[];
  tracks: any[];
  totalResults: number;
}

export function SearchView({ query }: { query: string }) {
  const { data, loading } = useApi<SearchData>(query ? `/api/search?q=${encodeURIComponent(query)}&limit=8` : null, [query]);
  const navigate = useNav((s) => s.navigate);
  const openVideo = useVideoPlayer((s) => s.openPlayer);
  const playAudio = useAudioPlayer((s) => s.playNow);

  if (!query.trim()) {
    return (
      <div className="px-4 md:px-8 py-12">
        <div className="text-center py-16">
          <SearchIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-lg text-muted-foreground">Search across your entire library</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Movies, TV shows, music, podcasts, audiobooks</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 md:px-8 py-6 space-y-8">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-6 w-32 mb-3" />
            <div className="flex gap-3">
              {Array.from({ length: 6 }).map((_, j) => <Skeleton key={j} className="w-[150px] h-[225px] rounded-md" />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.totalResults === 0) {
    return (
      <div className="px-4 md:px-8 py-12">
        <div className="text-center py-16">
          <SearchIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-lg">No results for &ldquo;{query}&rdquo;</p>
          <p className="text-sm text-muted-foreground mt-1">Try a different search term</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 pb-12">
      <h1 className="text-2xl font-bold mb-1">Search results for &ldquo;{query}&rdquo;</h1>
      <p className="text-muted-foreground text-sm mb-8">{data.totalResults} result{data.totalResults !== 1 ? 's' : ''}</p>

      <div className="space-y-10">
        {/* Movies */}
        {data.movies.length > 0 && (
          <SearchSection icon={Film} title="Movies">
            {data.movies.map((m) => (
              <div key={m.id} className="w-[140px] md:w-[160px] flex-shrink-0">
                <MediaCard
                  title={m.title}
                  subtitle={`${m.year ?? ''} • ${m.genre ?? ''}`}
                  color={m.posterColor}
                  rating={m.rating}
                  year={m.year}
                  onClick={() => navigate({ kind: 'movie', id: m.id })}
                />
              </div>
            ))}
          </SearchSection>
        )}

        {/* TV Shows */}
        {data.shows.length > 0 && (
          <SearchSection icon={Tv} title="TV Shows">
            {data.shows.map((s) => (
              <div key={s.id} className="w-[140px] md:w-[160px] flex-shrink-0">
                <MediaCard
                  title={s.title}
                  subtitle={`${s.year ?? ''} • ${s.genre ?? ''}`}
                  color={s.posterColor}
                  rating={s.rating}
                  year={s.year}
                  onClick={() => navigate({ kind: 'show', id: s.id })}
                />
              </div>
            ))}
          </SearchSection>
        )}

        {/* Albums */}
        {data.albums.length > 0 && (
          <SearchSection icon={Music} title="Albums">
            {data.albums.map((a) => (
              <div key={a.id} className="w-[140px] md:w-[160px] flex-shrink-0">
                <MediaCardSquare
                  title={a.title}
                  subtitle={a.artist?.name}
                  color={a.coverColor}
                  onClick={() => navigate({ kind: 'album', id: a.id })}
                />
              </div>
            ))}
          </SearchSection>
        )}

        {/* Artists */}
        {data.artists.length > 0 && (
          <SearchSection icon={User} title="Artists">
            {data.artists.map((a) => (
              <div key={a.id} className="w-[140px] md:w-[160px] flex-shrink-0">
                <button
                  type="button"
                  onClick={() => navigate({ kind: 'artist', id: a.id })}
                  className="group flex flex-col items-center p-3 rounded-lg bg-card hover:bg-card/80 transition cursor-pointer text-center w-full"
                >
                  <div
                    className="w-20 h-20 rounded-full mb-2 flex items-center justify-center text-xl font-bold text-white shadow-lg group-hover:scale-105 transition"
                    style={{ background: `linear-gradient(135deg, ${a.imageColor ?? '#444'} 0%, #111 100%)` }}
                  >
                    {a.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="font-semibold text-xs line-clamp-1">{a.name}</div>
                </button>
              </div>
            ))}
          </SearchSection>
        )}

        {/* Tracks */}
        {data.tracks.length > 0 && (
          <SearchSection icon={Music} title="Tracks">
            <div className="w-full space-y-1">
              {data.tracks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => playAudio([{
                    id: t.id, type: 'track', title: t.title,
                    subtitle: t.artist?.name ?? 'Unknown',
                    duration: t.duration, color: t.album?.coverColor,
                    albumId: t.album?.id,
                  }])}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-card cursor-pointer transition"
                >
                  <div
                    className="w-10 h-10 rounded flex-shrink-0 flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${t.album?.coverColor ?? '#444'} 0%, #111 100%)` }}
                  >
                    <Music className="w-4 h-4 text-white/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {t.artist?.name} • {t.album?.title}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SearchSection>
        )}

        {/* Podcasts */}
        {data.podcasts.length > 0 && (
          <SearchSection icon={Mic} title="Podcasts">
            {data.podcasts.map((p) => (
              <div key={p.id} className="w-[140px] md:w-[160px] flex-shrink-0">
                <button
                  type="button"
                  onClick={() => navigate({ kind: 'podcast', id: p.id })}
                  className="group flex flex-col p-3 rounded-lg bg-card hover:bg-card/80 transition cursor-pointer text-left w-full"
                >
                  <div
                    className="aspect-square rounded-md mb-2 flex items-center justify-center shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${p.coverColor ?? '#444'} 0%, #111 100%)` }}
                  >
                    <Mic className="w-8 h-8 text-white/40" />
                  </div>
                  <div className="font-semibold text-sm line-clamp-2">{p.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{p.author}</div>
                </button>
              </div>
            ))}
          </SearchSection>
        )}

        {/* Audiobooks */}
        {data.audiobooks.length > 0 && (
          <SearchSection icon={BookHeadphones} title="Audiobooks">
            {data.audiobooks.map((a) => (
              <div key={a.id} className="w-[140px] md:w-[160px] flex-shrink-0">
                <MediaCard
                  title={a.title}
                  subtitle={`by ${a.author}`}
                  color={a.coverColor}
                  onClick={() => navigate({ kind: 'audiobook', id: a.id })}
                  onPlay={() => playAudio([{
                    id: a.id, type: 'audiobook', title: a.title,
                    subtitle: a.author ?? 'Unknown Author',
                    color: a.coverColor,
                  }])}
                />
              </div>
            ))}
          </SearchSection>
        )}
      </div>
    </div>
  );
}

function SearchSection({
  icon: Icon, title, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-lg font-bold mb-4">
        <Icon className="w-5 h-5 text-primary" />
        {title}
      </h2>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">{children}</div>
    </section>
  );
}
