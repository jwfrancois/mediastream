// Settings view — manage libraries, trigger scans, view stats.

'use client';

import { useState } from 'react';
import { useApi, postJson, deleteJson } from '@/lib/useApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Library, Plus, RefreshCw, Trash2, Film, Tv, Music, Mic, BookHeadphones, CheckCircle2, AlertCircle, Loader2, FolderOpen, HardDrive, Cloud } from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime } from '@/lib/format';
import { useLocalLibraries } from '@/lib/store';
import { isLocalLibrarySupported } from '@/lib/local-library';

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
  const { libraries, items, scanning, adding, addLocalLibrary, scanLocalLibrary, removeLocalLibrary, loaded } = useLocalLibraries();
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'MOVIE' | 'TV' | 'MUSIC' | 'PODCAST' | 'AUDIOBOOK'>('MOVIE');

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
      const { added, skipped } = await scanLocalLibrary(id);
      if (skipped > 0) {
        toast.success(
          `Scanned "${name}": ${added} file${added !== 1 ? 's' : ''} indexed (${skipped} skipped due to access errors — see console for details)`,
        );
      } else {
        toast.success(`Scanned "${name}": ${added} file${added !== 1 ? 's' : ''} indexed`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Scan failed');
    }
  };

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
              const needsPermission = lib.permission !== 'granted';
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
                      {lib.lastScanAt > 0 && ` • Last scanned ${formatRelativeTime(new Date(lib.lastScanAt))}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleScan(lib.id, lib.name)}
                      disabled={isScanning || !supported}
                    >
                      {isScanning ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                      {isScanning ? 'Scanning…' : 'Scan'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(lib.id, lib.name)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete local library"
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
