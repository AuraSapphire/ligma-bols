import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle, Binary, CircleAlert, FileUp, FlaskConical, Info, Lock, Map, MessageSquareText,
  Image as ImageIcon, Loader2, Sparkles, Swords, Trees, X, Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HexViewer } from "@/components/forge/HexViewer";
import { HeaderInspector } from "@/components/forge/HeaderInspector";
import { parseHeader, validate, type GbaHeader, type Warning } from "@/lib/rom/header";
import { makeDemoBytes } from "@/lib/rom/demo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PokéForge Studio — GBA ROM Inspector" },
      { name: "description", content: "Inspect GBA ROM headers, checksums and hex data entirely in your browser. Files never leave your device." },
      { property: "og:title", content: "PokéForge Studio — GBA ROM Inspector" },
      { property: "og:description", content: "Browser-only GBA ROM header inspector and hex viewer for beginner ROM hackers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Studio,
});

const MAX_SIZE = 64 * 1024 * 1024;

interface Session {
  name: string;
  size: number;
  bytes: Uint8Array;
  sha256: string;
  header: GbaHeader | null;
  warnings: Warning[];
  demo: boolean;
}

async function sha256(bytes: Uint8Array) {
  const d = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

const MODULES = [
  { name: "Pokémon Data", icon: Sparkles },
  { name: "Sprites", icon: ImageIcon },
  { name: "Maps", icon: Map },
  { name: "Trainers", icon: Swords },
  { name: "Encounters", icon: Trees },
  { name: "Text & Scripts", icon: MessageSquareText },
];

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / 1024 ** 2).toFixed(2)} MiB`;
}

function Studio() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (name: string, bytes: Uint8Array, demo: boolean) => {
    const header = parseHeader(bytes);
    setSession({ name, size: bytes.length, bytes, sha256: await sha256(bytes), header, warnings: validate(bytes.length, header, name), demo });
  }, []);

  const openFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_SIZE) {
      setError(`"${file.name}" is ${fmtSize(file.size)}. Files above 64 MiB are rejected — GBA ROMs are at most 32 MiB.`);
      return;
    }
    setLoading(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      await load(file.name, buf, false);
    } catch (e) {
      setError(`Could not read the file in your browser: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setSession(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b bg-sidebar px-4 py-2">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground"><Cpu className="h-4 w-4" /></div>
        <h1 className="font-mono text-sm font-semibold tracking-tight">PokéForge<span className="text-primary"> Studio</span></h1>
        <Badge variant="outline" className="border-lime/40 text-lime">Phase 1 · Inspector</Badge>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 text-lime" />
          <span>Files stay in your browser. Nothing is uploaded or saved.</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
          <p className="px-4 pt-4 pb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Workspace</p>
          <div className="mx-2 flex items-center gap-2 rounded bg-accent px-2 py-1.5 text-sm">
            <Binary className="h-4 w-4 text-primary" /> ROM Inspector
          </div>
          <p className="px-4 pt-5 pb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Editor modules</p>
          <ul className="space-y-0.5 px-2">
            {MODULES.map(({ name, icon: Icon }) => (
              <li key={name} aria-disabled className="flex cursor-not-allowed items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground">
                <Icon className="h-4 w-4" /> {name}
                <span className="ml-auto rounded border px-1 text-[10px]">Planned</span>
              </li>
            ))}
          </ul>
          <p className="mt-auto p-4 text-[11px] leading-relaxed text-muted-foreground">
            Editing modules are coming soon. Phase 1 is read-only and does not parse Pokémon data.
          </p>
        </aside>

        <main className="min-w-0 flex-1 overflow-auto bg-glow p-4">
          {error && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
              <CircleAlert className="mt-0.5 h-4 w-4 text-destructive" /> <span>{error}</span>
            </div>
          )}

          {!session ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) openFile(f); }}
              className={`mx-auto mt-10 flex max-w-2xl flex-col items-center rounded-lg border-2 border-dashed p-12 text-center transition-colors ${drag ? "border-primary bg-primary/5" : "bg-panel/60"}`}
            >
              {loading ? (
                <><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="mt-4 text-sm">Reading file and computing SHA-256 locally…</p></>
              ) : (
                <>
                  <FileUp className="h-10 w-10 text-primary" />
                  <h2 className="mt-4 text-lg font-semibold">Open a GBA ROM to inspect</h2>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Drag a .gba or .bin file here, or choose one. Use only ROMs you legally own. The file is read in memory and discarded when you clear it or close the tab.
                  </p>
                  <div className="mt-6 flex gap-2">
                    <Button onClick={() => inputRef.current?.click()}><FileUp /> Choose file</Button>
                    <Button variant="outline" onClick={() => { setError(null); load("demo-synthetic.bin", makeDemoBytes(), true); }}>
                      <FlaskConical /> Load demo data
                    </Button>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">Demo uses 64 KiB of synthetic bytes — not a real ROM.</p>
                </>
              )}
              <input ref={inputRef} type="file" accept=".gba,.bin" className="hidden" aria-label="ROM file"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) openFile(f); }} />
            </div>
          ) : (
            <Loaded s={session} onClear={clear} />
          )}
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 truncate text-sm ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function Loaded({ s, onClear }: { s: Session; onClear: () => void }) {
  const errs = s.warnings.filter((w) => w.severity === "error").length;
  const warns = s.warnings.filter((w) => w.severity === "warning").length;
  return (
    <div className="space-y-4">
      {s.demo && (
        <div className="flex items-center gap-2 rounded-md border border-warn/50 bg-warn/10 p-2 text-sm text-warn">
          <FlaskConical className="h-4 w-4" /> DEMO MODE — synthetic sample bytes generated in your browser. This is not a ROM and not any real game.
        </div>
      )}
      <div className="flex items-center gap-3">
        <h2 className="truncate font-mono text-base font-semibold">{s.name}</h2>
        {s.demo && <Badge className="bg-warn text-primary-foreground">Demo</Badge>}
        <Button size="sm" variant="outline" className="ml-auto" onClick={onClear}><X /> Clear file</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="File size" value={`${fmtSize(s.size)} (${s.size.toLocaleString()} B)`} />
        <Stat label="Header" value={s.header ? "Readable (192 B)" : "Too small"} />
        <Stat label="Checksum" value={s.header ? (s.header.checksumValid ? <span className="text-lime">Valid</span> : <span className="text-destructive">Mismatch</span>) : "—"} />
        <Stat label="Findings" value={<><span className="text-destructive">{errs} errors</span> · <span className="text-warn">{warns} warnings</span></>} />
      </div>
      <div className="rounded-md border bg-card p-3">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">SHA-256 fingerprint (Web Crypto, local)</p>
        <p className="mt-1 break-all font-mono text-xs text-primary">{s.sha256}</p>
      </div>

      {s.warnings.length > 0 && (
        <ul className="space-y-1 rounded-md border bg-panel p-3">
          {s.warnings.map((w, i) => {
            const Icon = w.severity === "error" ? CircleAlert : w.severity === "warning" ? AlertTriangle : Info;
            const c = w.severity === "error" ? "text-destructive" : w.severity === "warning" ? "text-warn" : "text-primary";
            return <li key={i} className="flex items-start gap-2 text-xs"><Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${c}`} /> {w.message}</li>;
          })}
        </ul>
      )}

      <Tabs defaultValue={s.header ? "header" : "hex"}>
        <TabsList>
          <TabsTrigger value="header">Header inspector</TabsTrigger>
          <TabsTrigger value="hex">Hex viewer</TabsTrigger>
        </TabsList>
        <TabsContent value="header">
          {s.header ? <HeaderInspector h={s.header} /> : (
            <div className="rounded-md border bg-panel p-6 text-sm text-muted-foreground">
              This file has only {s.size} bytes. A GBA header needs 192 bytes (0x00–0xBF), so no fields can be read. The raw bytes are still available in the hex viewer.
            </div>
          )}
        </TabsContent>
        <TabsContent value="hex" className="h-[640px]">
          {s.size > 0 ? <HexViewer bytes={s.bytes} /> : <div className="rounded-md border bg-panel p-6 text-sm text-muted-foreground">No bytes to display.</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}