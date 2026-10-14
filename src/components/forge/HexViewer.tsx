import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hex2 } from "@/lib/rom/header";

const ROW = 16;
const ROWS_PER_PAGE = 32;
const PAGE = ROW * ROWS_PER_PAGE;

export function HexViewer({ bytes }: { bytes: Uint8Array }) {
  const [page, setPage] = useState(0);
  const [jump, setJump] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const pages = Math.max(1, Math.ceil(bytes.length / PAGE));
  const start = page * PAGE;
  const end = Math.min(bytes.length, start + PAGE);

  const go = (p: number) => setPage(Math.min(pages - 1, Math.max(0, p)));
  const onJump = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(jump.replace(/^0x/i, ""), 16);
    if (Number.isNaN(n) || n < 0 || n >= bytes.length) {
      setErr(`Offset must be hex between 0 and 0x${(bytes.length - 1).toString(16).toUpperCase()}`);
      return;
    }
    setErr(null);
    go(Math.floor(n / PAGE));
  };

  const rows = [];
  for (let off = start; off < end; off += ROW) {
    const slice = bytes.subarray(off, Math.min(off + ROW, end));
    rows.push(
      <div key={off} className="flex gap-4 px-3 py-[1px] hover:bg-accent/50">
        <span className="w-20 shrink-0 text-primary">{off.toString(16).toUpperCase().padStart(8, "0")}</span>
        <span className="flex-1 whitespace-pre text-foreground">
          {Array.from(slice, (b, i) => (
            <span key={i} className={b === 0 ? "text-muted-foreground/50" : undefined}>
              {hex2(b)}
              {i === 7 ? "  " : " "}
            </span>
          ))}
        </span>
        <span className="w-36 shrink-0 whitespace-pre text-lime">
          {Array.from(slice, (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".")).join("")}
        </span>
      </div>,
    );
  }

  return (
    <div className="flex h-full flex-col rounded-md border bg-panel">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <span className="text-xs text-muted-foreground">
          Page {page + 1} / {pages} · 0x{start.toString(16).toUpperCase()}–0x{Math.max(start, end - 1).toString(16).toUpperCase()}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="First page" onClick={() => go(0)}><ChevronsLeft /></Button>
          <Button size="icon" variant="ghost" aria-label="Previous page" onClick={() => go(page - 1)}><ChevronLeft /></Button>
          <Button size="icon" variant="ghost" aria-label="Next page" onClick={() => go(page + 1)}><ChevronRight /></Button>
          <Button size="icon" variant="ghost" aria-label="Last page" onClick={() => go(pages - 1)}><ChevronsRight /></Button>
          <form onSubmit={onJump} className="flex items-center gap-1">
            <Input value={jump} onChange={(e) => setJump(e.target.value)} placeholder="Go to 0x…" aria-label="Jump to hex offset" className="h-8 w-28 font-mono text-xs" />
            <Button size="sm" variant="secondary" type="submit">Go</Button>
          </form>
        </div>
      </div>
      {err && <p role="alert" className="px-3 py-1 text-xs text-destructive">{err}</p>}
      <div className="flex gap-4 border-b px-3 py-1 font-mono text-[11px] text-muted-foreground">
        <span className="w-20">Offset</span>
        <span className="flex-1 whitespace-pre">00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F</span>
        <span className="w-36">ASCII</span>
      </div>
      <div className="flex-1 overflow-auto py-1 font-mono text-xs leading-5">{rows}</div>
    </div>
  );
}