import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, Pencil, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Field = { key: string; label: string; offset: number; width?: 1 | 2 | 4; min?: number; max?: number; signed?: boolean; help?: string };
const SPECIES_FIELDS: Field[] = [
  { key: "hp", label: "HP", offset: 0, max: 255 },
  { key: "attack", label: "Attack", offset: 1, max: 255 },
  { key: "defense", label: "Defense", offset: 2, max: 255 },
  { key: "speed", label: "Speed", offset: 3, max: 255 },
  { key: "spAttack", label: "Sp. Attack", offset: 4, max: 255 },
  { key: "spDefense", label: "Sp. Defense", offset: 5, max: 255 },
  { key: "type1", label: "Type ID 1", offset: 6, max: 255, help: "Numeric type ID; this editor does not guess a game's type-name table." },
  { key: "type2", label: "Type ID 2", offset: 7, max: 255 },
  { key: "catchRate", label: "Catch rate", offset: 8, max: 255 },
  { key: "expYield", label: "Base EXP yield", offset: 9, max: 255 },
  { key: "evYieldPacked", label: "EV yield packed (decimal)", offset: 10, width: 2, max: 65535, help: "Two little-endian bytes containing six 2-bit EV yields. Enter decimal." },
  { key: "itemCommon", label: "Common held item ID", offset: 12, width: 2, max: 65535 },
  { key: "itemRare", label: "Rare held item ID", offset: 14, width: 2, max: 65535 },
  { key: "genderRatio", label: "Gender ratio", offset: 16, max: 255 },
  { key: "eggCycles", label: "Egg cycles", offset: 17, max: 255 },
  { key: "friendship", label: "Base friendship", offset: 18, max: 255 },
  { key: "growthRate", label: "Growth-rate ID", offset: 19, max: 255 },
  { key: "eggGroup1", label: "Egg group ID 1", offset: 20, max: 255 },
  { key: "eggGroup2", label: "Egg group ID 2", offset: 21, max: 255 },
  { key: "ability1", label: "Ability ID 1", offset: 22, max: 255 },
  { key: "ability2", label: "Ability ID 2", offset: 23, max: 255 },
  { key: "safariFleeRate", label: "Safari flee rate", offset: 24, max: 255 },
  { key: "bodyColorNoFlip", label: "Body color / no-flip byte", offset: 25, max: 255 },
];
const MOVE_FIELDS: Field[] = [
  { key: "effect", label: "Effect ID", offset: 0, max: 255 },
  { key: "power", label: "Power", offset: 1, max: 255 },
  { key: "type", label: "Type ID", offset: 2, max: 255 },
  { key: "accuracy", label: "Accuracy (0–255)", offset: 3, max: 255, help: "Many Gen III moves use 0 to mean always hits." },
  { key: "pp", label: "PP", offset: 4, max: 255 },
  { key: "secondaryEffectChance", label: "Secondary effect chance", offset: 5, max: 255 },
  { key: "target", label: "Target flags / ID", offset: 6, max: 255 },
  { key: "priority", label: "Priority (signed)", offset: 7, min: -128, max: 127, signed: true },
  { key: "flags", label: "Move flags", offset: 8, max: 255, help: "Flags vary by game engine." },
];
const SPECIES_SIZE = 26;
const MOVE_SIZE = 9;

function readValue(bytes: Uint8Array, start: number, field: Field): number {
  const width = field.width ?? 1;
  let n = 0;
  for (let i = 0; i < width; i++) n += bytes[start + field.offset + i] * 2 ** (8 * i);
  if (field.signed && n >= 128) n -= 256;
  return n;
}
function writeValue(bytes: Uint8Array, start: number, field: Field, value: number) {
  const width = field.width ?? 1;
  let n = value;
  if (field.signed && n < 0) n += 256;
  for (let i = 0; i < width; i++) bytes[start + field.offset + i] = Math.floor(n / 2 ** (8 * i)) & 0xff;
}
function parseOffset(value: string): number {
  const raw = value.trim();
  if (!raw) throw new Error("Enter the table's base offset first.");
  const parsed = /^0x/i.test(raw) ? Number.parseInt(raw.slice(2), 16) : Number.parseInt(raw, 16);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Offset must be a non-negative hex value, e.g. 0x123456.");
  return parsed;
}

export function Gen3DataEditor({ bytes, disabled, onApply }: {
  bytes: Uint8Array;
  disabled: boolean;
  onApply: (next: Uint8Array, description: string) => void;
}) {
  const [kind, setKind] = useState<"species" | "move">("species");
  const [baseOffset, setBaseOffset] = useState("");
  const [recordIndex, setRecordIndex] = useState("1");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const fields = kind === "species" ? SPECIES_FIELDS : MOVE_FIELDS;
  const size = kind === "species" ? SPECIES_SIZE : MOVE_SIZE;
  const start = useMemo(() => {
    try {
      const base = parseOffset(baseOffset);
      const index = Number(recordIndex);
      if (!Number.isSafeInteger(index) || index < 0) return null;
      const offset = base + index * size;
      return offset + size <= bytes.length ? offset : null;
    } catch { return null; }
  }, [baseOffset, recordIndex, size, bytes.length]);

  useEffect(() => {
    if (start === null) { setValues({}); return; }
    const next: Record<string, string> = {};
    for (const field of fields) next[field.key] = String(readValue(bytes, start, field));
    setValues(next);
    setError(null);
    setStatus(null);
  }, [start, kind, bytes, fields]);

  const recordSize = size;
  const end = start === null ? null : start + recordSize - 1;
  const save = () => {
    if (disabled) { setError("Demo mode is read-only. Open your own ROM to edit it."); return; }
    if (start === null) { setError("This record is outside the file, or the base offset is invalid. Check the offset and record index."); return; }
    try {
      const next = bytes.slice();
      for (const field of fields) {
        const raw = values[field.key] ?? "";
        const value = Number(raw);
        const min = field.min ?? 0;
        const max = field.max ?? (field.width === 4 ? 4294967295 : field.width === 2 ? 65535 : 255);
        if (raw.trim() === "" || !Number.isSafeInteger(value) || value < min || value > max)
          throw new Error(`${field.label} must be a whole number from ${min.toLocaleString()} to ${max.toLocaleString()}.`);
        writeValue(next, start, field, value);
      }
      onApply(next, `Edited Gen III ${kind} record ${recordIndex} at 0x${start.toString(16).toUpperCase()}.`);
      setError(null);
      setStatus("Record saved to the in-memory working copy. Export a new ROM when you are ready.");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
      <div>
        <h3 className="text-lg font-bold">Pokémon data editor <span className="text-xs font-normal text-muted-foreground">experimental</span></h3>
        <p className="mt-1 text-sm text-muted-foreground">Edit Gen III species stats or battle-move fields in a record you locate. This first version requires you to supply the table offset; it will not guess offsets or pretend it has identified a safe table.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant={kind === "species" ? "default" : "outline"} onClick={() => { setKind("species"); setValues({}); }}>Species stats · 26 bytes</Button>
        <Button variant={kind === "move" ? "default" : "outline"} onClick={() => { setKind("move"); setValues({}); }}>Battle move · 9 bytes</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-muted-foreground"><span>Table base offset (hex)</span><Input value={baseOffset} onChange={(e) => setBaseOffset(e.target.value)} placeholder="e.g. 0x123456" className="font-mono" /></label>
        <label className="space-y-1 text-xs text-muted-foreground"><span>Record index (decimal, 0-based)</span><Input value={recordIndex} onChange={(e) => setRecordIndex(e.target.value)} type="number" min="0" step="1" /></label>
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-warn/40 bg-warn/5 p-3 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
        <span><strong className="text-foreground">Important:</strong> game, region, revision, and hack can change table locations and field layouts. Find the exact table for your ROM first. A wrong offset can change unrelated bytes. Changes are undoable and stay in memory until you export.</span>
      </div>
      {start !== null ? (
        <div className="flex items-center gap-2 rounded-lg border bg-panel p-3 text-xs">
          <CheckCircle2 className="h-4 w-4 text-lime" />
          <span>Record fits in file: <code>0x{start.toString(16).toUpperCase()}</code>–<code>0x{end!.toString(16).toUpperCase()}</code> · {recordSize} bytes</span>
        </div>
      ) : (
        <div className="rounded-lg border border-warn/40 bg-warn/5 p-3 text-xs text-muted-foreground"><AlertTriangle className="mr-1 inline h-4 w-4 text-warn" />Enter a valid base offset and record index that fit inside the loaded file.</div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <label key={field.key} className="space-y-1 text-xs text-muted-foreground">
            <span className="block font-medium text-foreground">{field.label}</span>
            <Input type="number" value={values[field.key] ?? ""} min={field.min ?? 0} max={field.max ?? (field.width === 4 ? 4294967295 : field.width === 2 ? 65535 : 255)} step="1"
              disabled={start === null || disabled}
              onChange={(e) => setValues((old) => ({ ...old, [field.key]: e.target.value }))} />
            {field.help && <span className="block leading-relaxed">{field.help}</span>}
          </label>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {status && <p role="status" className="rounded-lg border border-lime/30 bg-lime/5 p-3 text-sm text-lime">{status}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={disabled || start === null}><Pencil className="mr-1 h-4 w-4" /> Save record to working copy</Button>
        <span className="text-xs text-muted-foreground"><BookOpen className="mr-1 inline h-3.5 w-3.5" />No automatic game-profile detection yet.</span>
      </div>
    </section>
  );
}
