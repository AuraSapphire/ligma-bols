import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle, Binary, CircleAlert, FileUp, FlaskConical, Info, Lock, Loader2,
  Search, Download, Undo2, ShieldCheck, Wrench, FileDiff, Cpu, Sparkles, Image as ImageIcon, Pencil,
  Map, Swords, Trees, MessageSquareText, Puzzle, CheckCircle2, BookOpen, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { HexViewer } from "@/components/forge/HexViewer";
import { HeaderInspector } from "@/components/forge/HeaderInspector";
import { parseHeader, validate, type GbaHeader, type Warning } from "@/lib/rom/header";
import { makeDemoBytes } from "@/lib/rom/demo";
import { applyIpsPatch, createIpsPatch } from "@/lib/rom/ips";
import { compareBytes, findBytes, findFreeSpace, identifyGameCode, parseHexPattern } from "@/lib/rom/tools";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PokéForge Studio — GBA ROM Hack Workshop" },
      { name: "description", content: "A beginner-friendly, browser-only Pokémon GBA ROM hacking workbench. Your ROM stays on your device." },
      { property: "og:title", content: "PokéForge Studio" },
      { property: "og:description", content: "Safely inspect ROMs, apply IPS patches, search bytes and export a new copy." },
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
  { name: "Pokémon data", icon: Sparkles, status: "Profile needed" },
  { name: "Sprites & colors", icon: ImageIcon, status: "Preview planned" },
  { name: "Maps & events", icon: Map, status: "Profile needed" },
  { name: "Trainers", icon: Swords, status: "Profile needed" },
  { name: "Wild encounters", icon: Trees, status: "Profile needed" },
  { name: "Text & scripts", icon: MessageSquareText, status: "Limited" },
];

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / 1024 ** 2).toFixed(2)} MiB`;
}

function downloadBytes(bytes: Uint8Array, filename: string, type = "application/octet-stream") {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Studio() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (name: string, bytes: Uint8Array, demo: boolean) => {
    const copy = bytes.slice();
    const header = parseHeader(copy);
    setSession({ name, size: copy.length, bytes: copy, sha256: await sha256(copy), header, warnings: validate(copy.length, header, name), demo });
  }, []);

  const openFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_SIZE) {
      setError(`"${file.name}" is ${fmtSize(file.size)}. Files above 64 MiB are rejected to keep the browser responsive.`);
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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-sidebar/95 px-4 py-3 backdrop-blur">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Cpu className="h-5 w-5" /></div>
        <div>
          <h1 className="font-mono text-base font-bold tracking-tight">PokéForge<span className="text-primary"> Studio</span></h1>
          <p className="text-[11px] text-muted-foreground">Your friendly GBA hack workshop</p>
        </div>
        <Badge variant="outline" className="border-lime/40 text-lime">Early build</Badge>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-4 w-4 text-lime" />
          <span className="hidden sm:inline">Your ROM stays in this browser</span>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
          <p className="px-4 pb-2 pt-5 text-[11px] uppercase tracking-wider text-muted-foreground">Start here</p>
          <div className="mx-2 flex items-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-medium">
            <BookOpen className="h-4 w-4 text-primary" /> My ROM workspace
          </div>
          <p className="px-4 pb-2 pt-6 text-[11px] uppercase tracking-wider text-muted-foreground">Hacking tools</p>
          <ul className="space-y-1 px-2">
            {[
              { label: "Patch a game", icon: Puzzle, ready: true },
              { label: "Find bytes", icon: Search, ready: true },
              { label: "Compare files", icon: FileDiff, ready: true },
              { label: "Free-space finder", icon: Wrench, ready: true },
            ].map(({ label, icon: Icon, ready }) => (
              <li key={label} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                <Icon className="h-4 w-4" /> {label}
                {ready && <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-lime" />}
              </li>
            ))}
          </ul>
          <p className="px-4 pb-2 pt-6 text-[11px] uppercase tracking-wider text-muted-foreground">Game editors</p>
          <ul className="space-y-1 px-2">
            {MODULES.map(({ name, icon: Icon, status }) => (
              <li key={name} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground" title={status}>
                <Icon className="h-4 w-4" /> <span>{name}</span>
                <span className="ml-auto max-w-24 text-right text-[9px] leading-tight">{status}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto border-t p-4 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mb-2 h-5 w-5 text-lime" />
            <strong className="block text-foreground">Safe by default</strong>
            Your original file is never overwritten. Export always creates a new file.
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-auto bg-glow p-3 sm:p-6">
          {error && (
            <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> <span>{error}</span>
            </div>
          )}

          {!session ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void openFile(f); }}
              className={`mx-auto mt-6 flex max-w-3xl flex-col items-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:mt-12 sm:p-12 ${drag ? "border-primary bg-primary/5" : "bg-panel/60"}`}
            >
              {loading ? (
                <><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="mt-4 text-sm">Opening your file safely…</p></>
              ) : (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><FileUp className="h-8 w-8" /></div>
                  <h2 className="mt-5 text-2xl font-bold">Let’s make a Pokémon hack!</h2>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                    First, open a GBA game file you are legally entitled to use. We’ll inspect it and help you use patches and tools. No coding needed for these tools.
                  </p>
                  <div className="mt-6 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
                    <Button size="lg" className="min-h-12" onClick={() => inputRef.current?.click()}><FileUp className="mr-1 h-5 w-5" /> Open my ROM</Button>
                    <Button size="lg" variant="outline" className="min-h-12" onClick={() => { setError(null); void load("demo-synthetic.bin", makeDemoBytes(), true); }}><FlaskConical className="mr-1 h-5 w-5" /> Try the demo</Button>
                  </div>
                  <input ref={inputRef} type="file" accept=".gba,.bin" className="hidden" aria-label="Choose your GBA ROM file"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void openFile(f); }} />
                  <div className="mt-8 grid w-full max-w-2xl gap-3 text-left sm:grid-cols-3">
                    {[
                      { title: "1. Open", body: "Choose your own .gba file." },
                      { title: "2. Explore", body: "Use safe tools and patches." },
                      { title: "3. Export", body: "Download a separate edited copy." },
                    ].map((item) => <div key={item.title} className="rounded-xl border bg-card p-4"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.body}</p></div>)}
                  </div>
                  <p className="mt-5 max-w-lg text-[11px] text-muted-foreground">Privacy: files are processed locally in this tab and are not uploaded. Demo bytes are invented sample data, not a game.</p>
                </>
              )}
            </div>
          ) : (
            <Loaded key={sKey(session)} s={session} onClear={clear} />
          )}
        </main>
      </div>
    </div>
  );
}

function sKey(s: Session) { return `${s.name}-${s.sha256}`; }

function Stat({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 break-words text-sm ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function Loaded({ s, onClear }: { s: Session; onClear: () => void }) {
  const [working, setWorking] = useState(() => s.bytes.slice());
  const [undoStack, setUndoStack] = useState<Uint8Array[]>([]);
  const [patchName, setPatchName] = useState("");
  const [patchError, setPatchError] = useState<string | null>(null);
  const [patchStatus, setPatchStatus] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("08 00 00 00");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<number[] | null>(null);
  const [editOffset, setEditOffset] = useState("0xA0");
  const [editValue, setEditValue] = useState("00");
  const [editError, setEditError] = useState<string | null>(null);
  const [minRun, setMinRun] = useState("1024");
  const [freeRanges, setFreeRanges] = useState<ReturnType<typeof findFreeSpace> | null>(null);
  const [compareResult, setCompareResult] = useState<ReturnType<typeof compareBytes> | null>(null);
  const [activeTool, setActiveTool] = useState("overview");
  const patchInput = useRef<HTMLInputElement>(null);
  const dirty = working.length !== s.bytes.length || working.some((b, i) => b !== s.bytes[i]);
  const header = parseHeader(working);
  const warnings = validate(working.length, header, s.name);
  const game = identifyGameCode(header?.gameCode ?? "");
  const errs = warnings.filter((w) => w.severity === "error").length;
  const warns = warnings.filter((w) => w.severity === "warning").length;

  const pushWorking = (next: Uint8Array) => {
    setUndoStack((old) => [...old.slice(-9), working.slice()]);
    setWorking(next);
  };

  const applyPatchFile = async (file: File) => {
    setPatchError(null);
    setPatchStatus(null);
    try {
      if (file.size > 16 * 1024 * 1024) throw new Error("Patch file is unexpectedly large (over 16 MiB).");
      const patch = new Uint8Array(await file.arrayBuffer());
      const result = applyIpsPatch(working, patch);
      pushWorking(result);
      setPatchName(file.name);
      setPatchStatus(`Applied ${file.name}. Your original file is untouched. Review the result, then export a new ROM copy.`);
    } catch (e) {
      setPatchError(e instanceof Error ? e.message : String(e));
    }
  };

  const runSearch = () => {
    try {
      const pattern = parseHexPattern(searchText);
      const results = findBytes(working, pattern, 0, 100);
      setSearchResults(results);
      setSearchError(results.length ? null : "No matches found. Try another byte pattern.");
    } catch (e) {
      setSearchResults(null);
      setSearchError(e instanceof Error ? e.message : String(e));
    }
  };

  const exportRom = () => {
    const base = s.name.replace(/\.(gba|bin)$/i, "") || "pokemon-hack";
    downloadBytes(working, `${base}-edited.gba`);
  };

  const exportPatch = () => {
    try {
      const patch = createIpsPatch(s.bytes, working);
      downloadBytes(patch, `${s.name.replace(/\.(gba|bin)$/i, "") || "pokemon-hack"}.ips`, "application/octet-stream");
      setPatchError(null);
      setPatchStatus("IPS patch created from the original file to your current working copy.");
    } catch (e) {
      setPatchError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {s.demo && (
        <div className="flex items-start gap-2 rounded-xl border border-warn/50 bg-warn/10 p-3 text-sm text-warn">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" /> <span><strong>Demo mode.</strong> These are synthetic sample bytes, not a Pokémon game. Use this mode to try tools without risking a real file.</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0"><h2 className="truncate text-lg font-bold">{s.name}</h2><p className="text-xs text-muted-foreground">{fmtSize(s.size)} original · {dirty ? "Working copy has edits" : "No edits yet"}</p></div>
        {dirty ? <Badge className="bg-warn text-primary-foreground">Unsaved changes</Badge> : <Badge variant="outline">Original loaded safely</Badge>}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!undoStack.length} onClick={() => { const last = undoStack[undoStack.length - 1]; setWorking(last); setUndoStack((old) => old.slice(0, -1)); setPatchStatus("Last operation undone."); }}><Undo2 className="mr-1 h-4 w-4" /> Undo</Button>
          <Button size="sm" disabled={!dirty} onClick={exportRom}><Download className="mr-1 h-4 w-4" /> Export new ROM</Button>
          <Button size="sm" variant="ghost" onClick={onClear}><RotateCcw className="mr-1 h-4 w-4" /> Close file</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="File size" value={fmtSize(working.length)} />
        <Stat label="Detected game" value={game.name} />
        <Stat label="Header checksum" value={header ? (header.checksumValid ? <span className="text-lime">Valid</span> : <span className="text-destructive">Mismatch</span>) : "Header too small"} />
        <Stat label="Validation" value={<><span className="text-destructive">{errs} errors</span> · <span className="text-warn">{warns} warnings</span></>} />
      </div>
      <div className="rounded-xl border bg-card p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Original SHA-256 · unchanged source fingerprint</p>
        <p className="mt-1 break-all font-mono text-[11px] text-primary">{s.sha256}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { id: "overview", icon: ShieldCheck, title: "ROM checkup", body: "Read header and validation warnings." },
          { id: "patch", icon: Puzzle, title: "Apply an IPS patch", body: "Patch your working copy safely." },
          { id: "search", icon: Search, title: "Find bytes", body: "Search for a byte pattern." },
          { id: "hex-edit", icon: Pencil, title: "Edit a byte", body: "Change one byte in your working copy." },
          { id: "tools", icon: Wrench, title: "ROM tools", body: "Compare files and find blank areas." },
        ].map(({ id, icon: Icon, title, body }) => (
          <button key={id} onClick={() => setActiveTool(id)} className={`rounded-xl border p-4 text-left transition-colors hover:border-primary/60 ${activeTool === id ? "border-primary bg-primary/5" : "bg-card"}`}>
            <Icon className="h-5 w-5 text-primary" /><p className="mt-3 text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{body}</p>
          </button>
        ))}
      </div>

      {activeTool === "overview" && <div className="space-y-3">
        {warnings.length > 0 ? <ul className="space-y-2 rounded-xl border bg-panel p-4">{warnings.map((w, i) => {
          const Icon = w.severity === "error" ? CircleAlert : w.severity === "warning" ? AlertTriangle : Info;
          const c = w.severity === "error" ? "text-destructive" : w.severity === "warning" ? "text-warn" : "text-primary";
          return <li key={i} className="flex items-start gap-2 text-xs"><Icon className={`mt-0.5 h-4 w-4 shrink-0 ${c}`} />{w.message}</li>;
        })}</ul> : <div className="rounded-xl border bg-card p-4 text-sm text-lime"><CheckCircle2 className="mr-2 inline h-4 w-4" />No validation warnings detected.</div>}
        <Tabs defaultValue={header ? "header" : "hex"}>
          <TabsList><TabsTrigger value="header">Header details</TabsTrigger><TabsTrigger value="hex">Hex viewer</TabsTrigger></TabsList>
          <TabsContent value="header">{header ? <HeaderInspector h={header} /> : <div className="rounded-lg border bg-panel p-5 text-sm text-muted-foreground">This file is too small to contain a full GBA header. Raw bytes remain available below.</div>}</TabsContent>
          <TabsContent value="hex" className="h-[520px]"><HexViewer bytes={working} /></TabsContent>
        </Tabs>
      </div>}

      {activeTool === "patch" && <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
        <div><h3 className="text-lg font-bold">Patch your working copy</h3><p className="mt-1 text-sm text-muted-foreground">An IPS patch is a small file containing changes to another file. We keep your original ROM unchanged and apply the patch to a separate copy.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => patchInput.current?.click()}><Puzzle className="mr-1 h-4 w-4" /> Choose IPS patch</Button>
          <Button variant="outline" disabled={!dirty} onClick={exportPatch}><Download className="mr-1 h-4 w-4" /> Create IPS from my edits</Button>
          <input ref={patchInput} type="file" accept=".ips" className="hidden" aria-label="Choose IPS patch" onChange={(e) => { const f = e.target.files?.[0]; if (f) void applyPatchFile(f); e.currentTarget.value = ""; }} />
        </div>
        {patchName && <p className="text-xs text-muted-foreground">Last patch: {patchName}</p>}
        {patchStatus && <p role="status" className="rounded-lg border border-lime/30 bg-lime/5 p-3 text-sm text-lime">{patchStatus}</p>}
        {patchError && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{patchError}</p>}
        <div className="rounded-lg border border-warn/40 bg-warn/5 p-3 text-xs text-muted-foreground"><AlertTriangle className="mr-1 inline h-4 w-4 text-warn" />Always verify that a patch matches your exact game and region. IPS patches cannot address bytes above the 16 MiB offset range. Export creates a new file; it never overwrites your original.</div>
      </section>}

      {activeTool === "search" && <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
        <div><h3 className="text-lg font-bold">Find a byte pattern</h3><p className="mt-1 text-sm text-muted-foreground">Search the current working copy. Type hex bytes with or without spaces, for example <code>08 00 00 00</code>.</p></div>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); runSearch(); }}>
          <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} className="font-mono" aria-label="Hex bytes to search for" placeholder="DE AD BE EF" />
          <Button type="submit"><Search className="mr-1 h-4 w-4" /> Find bytes</Button>
        </form>
        {searchError && <p role="status" className="text-sm text-warn">{searchError}</p>}
        {searchResults && searchResults.length > 0 && <div className="rounded-lg border p-3"><p className="mb-2 text-sm font-semibold">{searchResults.length} match{searchResults.length === 1 ? "" : "es"}{searchResults.length === 100 ? " (showing first 100)" : ""}</p><div className="flex flex-wrap gap-2">{searchResults.map((offset) => <Button key={offset} variant="outline" size="sm" className="font-mono" onClick={() => { setActiveTool("overview"); }}>{`0x${offset.toString(16).toUpperCase()}`}</Button>)}</div><p className="mt-2 text-xs text-muted-foreground">Offsets are shown in hexadecimal. Open the hex viewer and use its “Go to” field to inspect a match.</p></div>}
      </section>}

      {activeTool === "hex-edit" && <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
        <div><h3 className="text-lg font-bold">Edit a byte</h3><p className="mt-1 text-sm text-muted-foreground">A byte is one tiny piece of file data, written as two hex digits (00–FF). This changes only the working copy in memory, never your original file.</p></div>
        <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => {
          e.preventDefault();
          try {
            const raw = editOffset.trim();
            const offset = /^0x/i.test(raw) ? Number.parseInt(raw.slice(2), 16) : /^\d+$/.test(raw) ? Number(raw) : Number.parseInt(raw, 16);
            if (!Number.isSafeInteger(offset) || offset < 0 || offset >= working.length) throw new Error(`Offset must be between 0 and 0x${(working.length - 1).toString(16).toUpperCase()}.`);
            const v = editValue.trim().replace(/^0x/i, "");
            if (!/^[\da-f]{1,2}$/i.test(v)) throw new Error("Enter a byte from 00 to FF.");
            const next = working.slice();
            const previous = next[offset];
            next[offset] = Number.parseInt(v, 16);
            pushWorking(next);
            setEditError(null);
            setPatchStatus(`Changed byte at 0x${offset.toString(16).toUpperCase()}: ${previous.toString(16).padStart(2,"0").toUpperCase()} → ${next[offset].toString(16).padStart(2,"0").toUpperCase()}.`);
          } catch (e) { setEditError(e instanceof Error ? e.message : String(e)); }
        }}>
          <label className="space-y-1 text-xs text-muted-foreground"><span>File offset (hex)</span><Input value={editOffset} onChange={(e) => setEditOffset(e.target.value)} className="font-mono" placeholder="0xA0" aria-label="Byte offset" /></label>
          <label className="space-y-1 text-xs text-muted-foreground"><span>New byte (00–FF)</span><Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="font-mono" placeholder="FF" aria-label="New byte value" maxLength={4} /></label>
          <div className="flex items-end"><Button type="submit" className="w-full sm:w-auto"><Pencil className="mr-1 h-4 w-4" /> Change byte</Button></div>
        </form>
        {editError && <p role="alert" className="text-sm text-destructive">{editError}</p>}
        {patchStatus && <p role="status" className="rounded-lg border border-lime/30 bg-lime/5 p-3 text-sm text-lime">{patchStatus}</p>}
        <div className="rounded-lg border border-warn/40 bg-warn/5 p-3 text-xs text-muted-foreground"><AlertTriangle className="mr-1 inline h-4 w-4 text-warn" />Raw byte editing is powerful but can break a ROM if you change the wrong offset. This tool does not know what every byte means. Use undo or reopen the original if a change causes problems.</div>
      </section>}

      {activeTool === "tools" && <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-6">
        <div><h3 className="text-lg font-bold">ROM utility toolbox</h3><p className="mt-1 text-sm text-muted-foreground">Helpful diagnostics. Blank areas are only guesses—not guaranteed safe places to write game data.</p></div>
        <div className="space-y-2"><h4 className="text-sm font-semibold">Find long blank areas</h4><form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(minRun); if (!Number.isSafeInteger(n) || n < 16 || n > working.length) { setFreeRanges([]); return; } setFreeRanges(findFreeSpace(working, n, 100)); }}><Input value={minRun} onChange={(e) => setMinRun(e.target.value)} type="number" min="16" max={working.length} className="max-w-48" aria-label="Minimum blank run length in bytes" /><Button type="submit">Find blank areas</Button></form>
        {freeRanges && <div className="rounded-lg border p-3"><p className="mb-2 text-sm font-semibold">{freeRanges.length} possible blank areas</p><div className="max-h-64 space-y-1 overflow-auto font-mono text-xs">{freeRanges.map((r) => <div key={r.start} className="flex flex-wrap justify-between gap-2 border-b py-1 last:border-0"><span>0x{r.start.toString(16).toUpperCase()}–0x{r.end.toString(16).toUpperCase()}</span><span>{fmtSize(r.length)} · {r.value === 0 ? "00" : "FF"}</span></div>)}</div></div>}</div>
        <div className="space-y-2 border-t pt-4"><h4 className="text-sm font-semibold">Compare with another ROM or binary</h4><p className="text-xs text-muted-foreground">Choose a second file to count differing bytes against the current working copy.</p><Input type="file" accept=".gba,.bin,.ips" aria-label="Choose a file to compare" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const b = new Uint8Array(await f.arrayBuffer()); setCompareResult(compareBytes(working, b)); } catch { setCompareResult(null); } e.currentTarget.value = ""; }} />
        {compareResult && <div className="rounded-lg border p-3 text-sm"><p className={compareResult.same ? "text-lime" : "text-warn"}>{compareResult.same ? "Files are byte-for-byte identical." : `${compareResult.differentBytes.toLocaleString()} differing byte positions.`}</p><p className="mt-1 text-xs text-muted-foreground">Working copy: {fmtSize(compareResult.leftLength)} · Other file: {fmtSize(compareResult.rightLength)}{compareResult.firstDifference !== null ? ` · First difference at 0x${compareResult.firstDifference.toString(16).toUpperCase()}` : ""}</p></div>}</div>
        <div className="space-y-2 border-t pt-4"><h4 className="text-sm font-semibold">Export a reusable IPS patch</h4><p className="text-xs text-muted-foreground">Create a patch from your original file to the current working copy, so you can keep the original and share only your changes.</p><Button variant="outline" disabled={!dirty} onClick={exportPatch}><Download className="mr-1 h-4 w-4" /> Create IPS patch</Button></div>
      </section>}

      <section className="rounded-xl border bg-panel/70 p-4">
        <h3 className="text-sm font-semibold"><Info className="mr-2 inline h-4 w-4 text-primary" />What this build can do</h3>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Real features now include ROM header inspection, validation, hex viewing, local byte search, blank-run heuristics, byte comparison, IPS patch apply/create, undo for the last operation, and exporting a separate .gba file. Pokémon stats, trainer parties, maps, wild encounters, and pointer-based game data still need verified per-game profiles; those are not falsely presented as working editors yet.</p>
      </section>
    </div>
  );
}
