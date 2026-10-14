import { Badge } from "@/components/ui/badge";
import { type GbaHeader, hex2, hexBytes } from "@/lib/rom/header";

function Row({ off, label, value, note, ok }: { off: string; label: string; value: React.ReactNode; note?: string; ok?: boolean }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-1.5 pr-3 font-mono text-xs text-primary">{off}</td>
      <td className="py-1.5 pr-3 text-xs text-muted-foreground">{label}</td>
      <td className="py-1.5 pr-3 font-mono text-xs">{value}</td>
      <td className="py-1.5 text-xs">
        {ok === true && <Badge className="bg-lime text-primary-foreground">OK</Badge>}
        {ok === false && <Badge variant="destructive">Check</Badge>}
        {note && <span className="ml-2 text-muted-foreground">{note}</span>}
      </td>
    </tr>
  );
}

export function HeaderInspector({ h }: { h: GbaHeader }) {
  const logoNote = { valid: "Matches reference bitmap", mismatch: `${h.logoMismatchCount}/156 bytes differ`, empty: "Region is blank" }[h.logoStatus];
  return (
    <div className="overflow-x-auto rounded-md border bg-panel p-3">
      <table className="w-full">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="pb-2">Offset</th><th className="pb-2">Field</th><th className="pb-2">Value</th><th className="pb-2">Status</th>
          </tr>
        </thead>
        <tbody>
          <Row off="0x00–03" label="Entry point" value={hexBytes(h.entryPoint)} ok={h.entryIsBranch} note={h.entryIsBranch ? "ARM branch" : "Not an ARM branch"} />
          <Row off="0x04–9F" label="Nintendo logo" value={h.logoStatus} ok={h.logoStatus === "valid"} note={logoNote} />
          <Row off="0xA0–AB" label="Game title" value={h.title || <em className="text-muted-foreground">(blank)</em>} />
          <Row off="0xAC–AF" label="Game code" value={h.gameCode || "—"} note="Raw 4-char code; not interpreted" />
          <Row off="0xB0–B1" label="Maker code" value={h.makerCode || "—"} />
          <Row off="0xB2" label="Fixed value" value={`0x${hex2(h.fixedValue)}`} ok={h.fixedValue === 0x96} note="Must be 0x96" />
          <Row off="0xB3" label="Unit code" value={`0x${hex2(h.unitCode)}`} note="0x00 for GBA" />
          <Row off="0xB4" label="Device type" value={`0x${hex2(h.deviceType)}`} />
          <Row off="0xBC" label="Software version" value={`0x${hex2(h.version)}`} />
          <Row off="0xBD" label="Header checksum" value={`stored 0x${hex2(h.storedChecksum)} · computed 0x${hex2(h.computedChecksum)}`} ok={h.checksumValid} />
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Checksum = (−Σ bytes 0xA0..0xBC − 0x19) mod 256. Fields are shown as raw header data; PokéForge does not identify the game or version in phase 1.
      </p>
    </div>
  );
}