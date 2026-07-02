'use client';

import { AppShell } from '@/components/layout/AppShell';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { useNav } from '@/lib/store';

// Lazy-load views to keep the initial bundle small
import { DashboardView } from '@/components/views/DashboardView';
import { MoviesView } from '@/components/views/MoviesView';
import { MovieDetailView } from '@/components/views/MovieDetailView';
import { TvView } from '@/components/views/TvView';
import { TvDetailView } from '@/components/views/TvDetailView';
import { MusicView } from '@/components/views/MusicView';
import { AlbumDetailView } from '@/components/views/AlbumDetailView';
import { ArtistDetailView } from '@/components/views/ArtistDetailView';
import { PodcastsView } from '@/components/views/PodcastsView';
import { PodcastDetailView } from '@/components/views/PodcastDetailView';
import { AudiobooksView } from '@/components/views/AudiobooksView';
import { AudiobookDetailView } from '@/components/views/AudiobookDetailView';
import { SearchView } from '@/components/views/SearchView';
import { SettingsView } from '@/components/views/SettingsView';

export default function Home() {
  const view = useNav((s) => s.view);

  return (
    <AppShell>
      <ViewRouter view={view} />
      <VideoPlayer />
    </AppShell>
  );
}

function ViewRouter({ view }: { view: ReturnType<typeof useNav.getState>['view'] }) {
  switch (view.kind) {
    case 'dashboard':       return <DashboardView />;
    case 'movies':          return <MoviesView />;
    case 'movie':           return <MovieDetailView id={view.id} />;
    case 'tv':              return <TvView />;
    case 'show':            return <TvDetailView id={view.id} />;
    case 'music':           return <MusicView />;
    case 'album':           return <AlbumDetailView id={view.id} />;
    case 'artist':          return <ArtistDetailView id={view.id} />;
    case 'podcasts':        return <PodcastsView />;
    case 'podcast':         return <PodcastDetailView id={view.id} />;
    case 'audiobooks':      return <AudiobooksView />;
    case 'audiobook':       return <AudiobookDetailView id={view.id} />;
    case 'search':          return <SearchView query={view.q} />;
    case 'settings':        return <SettingsView />;
    default:                return <DashboardView />;
  }
}
