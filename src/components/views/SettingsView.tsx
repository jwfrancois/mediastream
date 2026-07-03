// Settings view — manage libraries, trigger scans, view stats.

'use client';

import { useState } from 'react';
import { useApi, postJson, deleteJson } from '@/lib/useApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Library, Plus, RefreshCw, Trash2, Film, Tv, Music, Mic, BookHeadphones, CheckCircle2, AlertCircle, Loader2, FolderOpen, HardDrive, Cloud, Sparkles, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime } from '@/lib/format';
import { useLocalLibraries, useMusicTheme, useAutoEnrich } from '@/lib/store';
import { isLocalLibrarySupported } from '@/lib/local-library';
import { MusicThemeToggle } from '@/components/layout/MusicThemeToggle';

interface LibraryData {
  id: string;
  name: string;
  type: string;
  path: string;
  lastScanAt: string | null;
  itemCount: number;
  episodeCount: number;
}

const LIBRARY_TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  MOVIE: { label: 'Movies', icon: Film },
  TV: { label: 'TV Shows', icon: Tv },
  MUSIC: { label: 'Music', icon: Music },
  PODCAST: { label: 'Podcasts', icon: Mic },
  AUDIOBOOK: { label: 'Audiobooks', icon: BookHeadphones },
};

export function SettingsView() {
  const { data: libraries, loading, refetch } = useApi<LibraryData[]>('/api/libraries');
  const { theme } = useMusicTheme();
  const { autoEnrich, setAutoEnrich } = useAutoEnrich();
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('MOVIE');
  const [newPath, setNewPath] = useState('');
  const [scanning, setScanning] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newName || !newPath) {
      toast.error('Please provide a name and path');
      return;
    }
    setAdding(true);
    try {
      await postJson('/api/libraries', { name: newName, type: newType, path: newPath });
      toast.success(`Library "${newName}" added`);
      setNewName('');
      setNewPath('');
      refetch();
    } catch (e) {
      toast.error(`Failed to add library: ${(e as Error).message}`);
    } finally {
      setAdding(false);
    }
  };

  const handleScan = async (lib: LibraryData) => {
    setScanning(lib.id);
    try {
      const result = await postJson(`/api/libraries/${lib.id}/scan`);
      toast.success(
        `Scan complete: ${result.added} added, ${result.updated} updated, ${result.skipped} unchanged`,
      );
      refetch();
    } catch (e) {
      toast.error(`Scan failed: ${(e as Error).message}`);
    } finally {
      setScanning(null);
    }
  };

  const handleDelete = async (lib: LibraryData) => {
    if (!confirm(`Delete library "${lib.name}"? This will remove all ${lib.itemCount} items from the database (your files will not be deleted).`)) return;
    try {
      await deleteJson(`/api/libraries/${lib.id}`);
      toast.success(`Library "${lib.name}" deleted`);
      refetch();
    } catch (e) {
      toast.error(`Failed to delete: ${(e as Error).message}`);
    }
  };

  return (
    <div className="px-4 md:px-8 py-6 pb-12 max-w-4xl">
      <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
        <Library className="w-7 h-7 text-primary" />
        Settings
      </h1>
      <p className="text-muted-foreground mb-8">
        Manage your media libraries. Add a folder pointing to your media, then scan it to populate your catalog.
      </p>

      {/* Music experience theme toggle */}
      <Card className="mb-8 border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            Music & Podcast Experience
          </CardTitle>
          <CardDescription>
            Choose your preferred design language for music and podcasts. Switch anytime — your libraries and playback are not affected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-medium">
                {theme === 'spotify' ? 'Spotify Mode' : 'Roon Mode'}
              </div>
              <p className="text-xs text-muted-foreground max-w-md">
                {theme === 'spotify'
                  ? 'Green accent, vibrant album-art gradients, big cards, and a "Made for You" discovery feel.'
                  : 'Gold accent, ambient aurora background, dense metadata, and an immersive audiophile player with full credits and bios.'}
              </p>
            </div>
            <MusicThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* Auto-enrichment toggle */}
      <Card className="mb-8 border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Auto-Enrichment
          </CardTitle>
          <CardDescription>
            When enabled, scanning a library automatically fetches metadata (plot, cast, ratings) and real poster artwork — just like Plex and Jellyfin. You no longer need to click Enrich and Art manually.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium">
                {autoEnrich ? 'Enabled' : 'Disabled'}
              </div>
              <p className="text-xs text-muted-foreground max-w-md">
                {autoEnrich
                  ? 'Scan → Enrich → Fetch Art runs automatically in sequence. The pipeline shows progress for each stage.'
                  : 'You will need to click Enrich and Art buttons manually after scanning.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutoEnrich(!autoEnrich)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${autoEnrich ? 'bg-primary' : 'bg-muted'}`}
              role="switch"
              aria-checked={autoEnrich}
              aria-label="Toggle auto-enrichment"
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${autoEnrich ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Libraries list */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Your Libraries</CardTitle>
          <CardDescription>
            Each library points to a folder on your computer. Media files in that folder (and subfolders) will be scanned and indexed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && (
            <div className="text-muted-foreground text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading libraries…
            </div>
          )}
          {libraries && libraries.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No libraries yet. Add one below to get started.
            </div>
          )}
          {libraries?.map((lib) => {
            const meta = LIBRARY_TYPE_META[lib.type] ?? { label: lib.type, icon: Library };
            const Icon = meta.icon;
            const isScanning = scanning === lib.id;
            return (
              <div
                key={lib.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border border-border bg-card/50"
              >
                <div className="w-10 h-10 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{lib.name}</div>
                  <div className="text-xs text-muted-foreground truncate font-mono">{lib.path}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {lib.itemCount} {lib.type === 'TV' ? 'show' : lib.type === 'MUSIC' ? 'album' : lib.type === 'PODCAST' ? 'podcast' : 'item'}{lib.itemCount !== 1 ? 's' : ''}
                    {lib.episodeCount > 0 && ` • ${lib.episodeCount} ${lib.type === 'MUSIC' ? 'tracks' : 'episodes'}`}
                    {lib.lastScanAt && ` • Last scanned ${formatRelativeTime(lib.lastScanAt)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleScan(lib)}
                    disabled={isScanning}
                  >
                    {isScanning ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                    {isScanning ? 'Scanning…' : 'Scan'}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(lib)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete library"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Add new library */}
      <Card>
        <CardHeader>
          <CardTitle>Add a Library</CardTitle>
          <CardDescription>
            Point MediaStream at a folder containing your media. The scanner will walk the folder tree and index every supported file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lib-name">Name</Label>
              <Input
                id="lib-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. My Movies"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lib-type">Type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger id="lib-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MOVIE">Movies</SelectItem>
                  <SelectItem value="TV">TV Shows</SelectItem>
                  <SelectItem value="MUSIC">Music</SelectItem>
                  <SelectItem value="PODCAST">Podcasts</SelectItem>
                  <SelectItem value="AUDIOBOOK">Audiobooks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lib-path">Folder Path (absolute)</Label>
            <Input
              id="lib-path"
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="/mnt/media/movies"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              The path must be readable by the server. Subfolders are scanned recursively.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card/40 p-4 text-sm">
            <div className="font-semibold mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Supported file types
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs text-muted-foreground">
              <span>• Video: .mp4 .mkv .avi .mov .webm .m4v</span>
              <span>• Audio: .mp3 .flac .m4a .wav .ogg .aac .opus</span>
              <span>• TV shows use SxxExx patterns</span>
              <span>• Music reads ID3 tags</span>
              <span>• Podcasts group by folder</span>
              <span>• Audiobooks: one file per book</span>
            </div>
          </div>
          <Button onClick={handleAdd} disabled={adding} className="w-full sm:w-auto">
            {adding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {adding ? 'Adding…' : 'Add Library'}
          </Button>
        </CardContent>
      </Card>

      {/* Local Libraries (browser-side, File System Access API) */}
      <LocalLibrariesCard />

      <div className="mt-8 p-4 rounded-lg border border-border bg-card/30 text-sm text-muted-foreground flex gap-3">
        <AlertCircle className="w-5 h-5 flex-shrink-0 text-primary mt-0.5" />
        <div>
          <p className="font-medium text-foreground mb-1">How library scanning works</p>
          <p>
            MediaStream reads your filesystem and stores metadata in its database — your files are never uploaded or modified.
            The scanner parses filenames (e.g. <code className="text-foreground">Show Name S01E05.mkv</code>), reads ID3 tags for music,
            and uses ffprobe for duration. Re-scan anytime to pick up new files.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------- Local Libraries Card ----------
// Uses the File System Access API to scan a folder on the user's computer
// directly from the browser. Files are played from disk via blob URLs —
// nothing is uploaded to the server. Supported in Chrome, Edge, Opera, Brave.

function LocalLibrariesCard() {
  const { libraries, items, scanning, enriching, fetchingArt, adding, pipelineStage, addLocalLibrary, scanLocalLibrary, enrichLibrary, fetchArt, removeLocalLibrary, loaded } = useLocalLibraries();
  const { autoEnrich } = useAutoEnrich();
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'MOVIE' | 'TV' | 'MUSIC' | 'PODCAST' | 'AUDIOBOOK'>('MOVIE');
  const [enrichProgress, setEnrichProgress] = useState<{ done: number; total: number } | null>(null);
  const [artProgress, setArtProgress] = useState<{ done: number; total: number } | null>(null);

  const supported = typeof window !== 'undefined' && isLocalLibrarySupported();

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error('Please enter a name for the library');
      return;
    }
    try {
      await addLocalLibrary(newName.trim(), newType);
      toast.success(`Local library "${newName}" added. Click Scan to index its files.`);
      setNewName('');
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        // user cancelled the picker — silent
        return;
      }
      toast.error(e?.message || 'Failed to add local library');
    }
  };

  const handleScan = async (id: string, name: string) => {
    try {
      // If auto-enrich is on, the scan will chain into enrichment + art fetching
      // automatically. Show a combined message at the end.
      const { added, skipped } = await scanLocalLibrary(id);

      if (autoEnrich && added > 0) {
        // The pipeline already ran enrichment + art. Show a combined summary.
        const enrichedCount = items.filter((i) => i.libraryId === id && i.enriched).length;
        const artCount = items.filter((i) => i.libraryId === id && i.posterUrl).length;
        toast.success(
          `"${name}" ready: ${added} files indexed • ${enrichedCount} enriched • ${artCount} with artwork`,
        );
      } else if (skipped > 0) {
        toast.success(
          `Scanned "${name}": ${added} file${added !== 1 ? 's' : ''} indexed (${skipped} skipped due to access errors — see console for details)`,
        );
      } else if (added === 0) {
        toast.info(`"${name}": no new files found (already up to date)`);
      } else {
        toast.success(`Scanned "${name}": ${added} file${added !== 1 ? 's' : ''} indexed`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Scan failed');
    }
  };

  const handleEnrich = async (id: string, name: string) => {
    setEnrichProgress({ done: 0, total: 0 });
    try {
      const { enriched, failedBatches } = await enrichLibrary(id, (done, total) => setEnrichProgress({ done, total }));
      if (enriched === 0 && failedBatches > 0) {
        toast.error(`Enrichment failed for "${name}" — the AI service timed out. Try again (batches are now smaller) or enrich fewer items at a time.`);
      } else if (enriched === 0) {
        toast.info(`"${name}": no new items to enrich (already up to date)`);
      } else if (failedBatches > 0) {
        toast.warning(`Enriched "${name}": ${enriched} item${enriched !== 1 ? 's' : ''} updated, but ${failedBatches} batch${failedBatches !== 1 ? 'es' : ''} failed (timeout). Click Enrich again to retry the remaining items.`);
      } else {
        toast.success(`Enriched "${name}": ${enriched} item${enriched !== 1 ? 's' : ''} updated with metadata${lib(id)?.type === 'MOVIE' ? ' and collection grouping' : ''}`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Enrichment failed');
    } finally {
      setEnrichProgress(null);
    }
  };

  const handleFetchArt = async (id: string, name: string) => {
    setArtProgress({ done: 0, total: 0 });
    try {
      const { fetched, failed } = await fetchArt(id, (done, total) => setArtProgress({ done, total }));
      if (fetched === 0 && failed > 0) {
        toast.error(`Artwork fetch failed for "${name}" — the image service may be unavailable. Try again later.`);
      } else if (fetched === 0) {
        toast.info(`"${name}": all items already have artwork (up to date)`);
      } else if (failed > 0) {
        toast.warning(`Fetched artwork for "${name}": ${fetched} item${fetched !== 1 ? 's' : ''} updated, ${failed} failed. Click Fetch Art again to retry.`);
      } else {
        toast.success(`Fetched artwork for "${name}": ${fetched} item${fetched !== 1 ? 's' : ''} updated with real poster images, cast photos, and filmographies`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Artwork fetch failed');
    } finally {
      setArtProgress(null);
    }
  };

  const lib = (id: string) => libraries.find((l) => l.id === id);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete local library "${name}"? This removes it from the browser. Your files on disk are not affected.`)) return;
    try {
      await removeLocalLibrary(id);
      toast.success(`Local library "${name}" deleted`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete');
    }
  };

  return (
    <Card className="mt-8 border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-primary" />
          Local Folder Libraries
        </CardTitle>
        <CardDescription>
          Scan a folder <strong>directly on your computer</strong> from the browser. Files are streamed from disk — nothing is uploaded.
          Works in Chrome, Edge, Opera, and Brave. The library persists across page reloads (you may be asked to re-grant folder access).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!supported && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm flex gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-yellow-500 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-200 mb-1">Browser not supported</p>
              <p className="text-yellow-100/80">
                Your browser doesn't support the File System Access API. To scan folders on your computer,
                please use <strong>Chrome</strong>, <strong>Edge</strong>, <strong>Opera</strong>, or <strong>Brave</strong>.
                (Firefox and Safari don't support this feature.)
              </p>
            </div>
          </div>
        )}

        {/* Existing local libraries */}
        {loaded && libraries.length > 0 && (
          <div className="space-y-2">
            {libraries.map((lib) => {
              const meta = LIBRARY_TYPE_META[lib.type] ?? { label: lib.type, icon: Library };
              const Icon = meta.icon;
              const itemCount = items.filter((i) => i.libraryId === lib.id).length;
              const isScanning = scanning === lib.id;
              const isEnriching = enriching === lib.id;
              const isFetchingArt = fetchingArt === lib.id;
              const enrichedCount = items.filter((i) => i.libraryId === lib.id && i.enriched).length;
              const artCount = items.filter((i) => i.libraryId === lib.id && i.posterUrl).length;
              const needsPermission = lib.permission !== 'granted';
              const showEnrichButton = true; // All library types support enrichment
              return (
                <div
                  key={lib.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border border-border bg-card/50"
                >
                  <div className="w-10 h-10 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold flex items-center gap-2">
                      {lib.name}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium uppercase tracking-wider">Local</span>
                      {needsPermission && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-medium">Needs permission</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      Folder: <span className="font-mono">{lib.handle.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {itemCount} file{itemCount !== 1 ? 's' : ''} indexed
                      {enrichedCount > 0 && ` • ${enrichedCount} enriched`}
                      {artCount > 0 && ` • ${artCount} with artwork`}
                      {lib.lastScanAt > 0 && ` • Last scanned ${formatRelativeTime(new Date(lib.lastScanAt))}`}
                    </div>
                    {/* Pipeline stage progress (auto-enrich: Scanning → Enriching → Fetching Art) */}
                    {pipelineStage?.libraryId === lib.id && pipelineStage.stage !== 'done' && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] text-primary font-medium whitespace-nowrap flex items-center gap-1">
                          {pipelineStage.stage === 'scanning' && <><Loader2 className="w-3 h-3 animate-spin" /> Scanning</>}
                          {pipelineStage.stage === 'enriching' && <><Loader2 className="w-3 h-3 animate-spin" /> Enriching metadata</>}
                          {pipelineStage.stage === 'fetching-art' && <><Loader2 className="w-3 h-3 animate-spin" /> Fetching artwork</>}
                        </span>
                        {pipelineStage.progress && pipelineStage.progress.total > 0 && (
                          <>
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((pipelineStage.progress.done / pipelineStage.progress.total) * 100)}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">{pipelineStage.progress.done}/{pipelineStage.progress.total}</span>
                          </>
                        )}
                      </div>
                    )}
                    {pipelineStage?.libraryId === lib.id && pipelineStage.stage === 'done' && (
                      <div className="mt-2 text-[10px] text-green-500 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Pipeline complete
                      </div>
                    )}
                    {/* Manual progress bars (when Enrich/Art buttons are clicked directly) */}
                    {(isEnriching && enrichProgress && enrichProgress.total > 0 && !pipelineStage) && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">Enriching</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((enrichProgress.done / enrichProgress.total) * 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">{enrichProgress.done}/{enrichProgress.total}</span>
                      </div>
                    )}
                    {(isFetchingArt && artProgress && artProgress.total > 0 && !pipelineStage) && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">Fetching art</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((artProgress.done / artProgress.total) * 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">{artProgress.done}/{artProgress.total}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleScan(lib.id, lib.name)}
                      disabled={isScanning || isEnriching || isFetchingArt || !supported}
                    >
                      {isScanning ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                      {isScanning ? 'Scanning…' : 'Scan'}
                    </Button>
                    {showEnrichButton && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleEnrich(lib.id, lib.name)}
                        disabled={isScanning || isEnriching || isFetchingArt || itemCount === 0}
                        title="Extract metadata (plot, cast, rating) and group sequels into collections using AI"
                      >
                        {isEnriching ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                        {isEnriching ? 'Enriching…' : 'Enrich'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleFetchArt(lib.id, lib.name)}
                      disabled={isScanning || isEnriching || isFetchingArt || itemCount === 0}
                      title="Fetch real poster art, cast photos, and filmography from the web"
                    >
                      {isFetchingArt ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ImageIcon className="w-4 h-4 mr-1" />}
                      {isFetchingArt ? 'Fetching…' : 'Art'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(lib.id, lib.name)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete local library"
                      disabled={isScanning || isEnriching || isFetchingArt}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {loaded && libraries.length === 0 && supported && (
          <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
            No local libraries yet. Pick a folder below to start scanning your computer.
          </div>
        )}

        {/* Add form */}
        {supported && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="font-medium text-sm">Add a local folder</div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-3 items-end">
              <div className="space-y-2">
                <Label htmlFor="local-lib-name" className="text-xs">Name</Label>
                <Input
                  id="local-lib-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. My Movies"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="local-lib-type" className="text-xs">Type</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as any)}>
                  <SelectTrigger id="local-lib-type" className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MOVIE">Movies</SelectItem>
                    <SelectItem value="TV">TV Shows</SelectItem>
                    <SelectItem value="MUSIC">Music</SelectItem>
                    <SelectItem value="PODCAST">Podcasts</SelectItem>
                    <SelectItem value="AUDIOBOOK">Audiobooks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} disabled={adding} className="h-9">
                {adding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FolderOpen className="w-4 h-4 mr-2" />}
                {adding ? 'Opening…' : 'Pick Folder'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Clicking "Pick Folder" opens your browser's folder picker. Choose any folder on your computer — subfolders are scanned recursively.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
