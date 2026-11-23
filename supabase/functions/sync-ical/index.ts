// Edge Function «sync-ical»: descarga los calendarios iCal activos (Airbnb/Booking) y actualiza ical_blocks.
// Autorización: administrador autenticado (JWT + is_admin()) O cabecera x-sync-secret == SYNC_ICAL_SECRET (para cron).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import "./core.js";

const C = (globalThis as any).SyncIcalCore;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Método no permitido." });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!service) return json(500, { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el entorno." });

  const secret = Deno.env.get("SYNC_ICAL_SECRET");
  const hdrSecret = req.headers.get("x-sync-secret");
  let allowed = Boolean(secret && hdrSecret && hdrSecret === secret);

  if (!allowed) {
    const auth = req.headers.get("Authorization") ?? "";
    const userSb = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: isAdmin } = await userSb.rpc("is_admin");
    allowed = isAdmin === true;
  }
  if (!allowed) return json(403, { error: "No tienes permiso para sincronizar calendarios." });

  let flatId: string | null = null;
  try {
    const body = await req.json();
    if (body && typeof body.flat_id === "string" && body.flat_id) flatId = body.flat_id;
  } catch { /* body opcional */ }

  const admin = createClient(url, service);
  let q = admin.from("ical_sources").select("id,flat_id,label,url").eq("active", true);
  if (flatId) q = q.eq("flat_id", flatId);
  const { data: sources, error: sErr } = await q;
  if (sErr) return json(500, { error: sErr.message });

  let okCount = 0, failCount = 0, totalBlocks = 0;
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  for (const src of sources || []) {
    try {
      const r = await fetch(src.url, {
        headers: { "User-Agent": "VirAnd-Calendar-Sync/1.0" },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      if (text.indexOf("BEGIN:VCALENDAR") === -1) throw new Error("Respuesta no es un iCal válido");

      const parsed = C.parseIcal(text).filter((b: { end_date: string }) => b.end_date >= today);
      const { error: dErr } = await admin.from("ical_blocks").delete().eq("source_id", src.id);
      if (dErr) throw new Error(dErr.message);

      if (parsed.length) {
        const rows = parsed.map((b: { start_date: string; end_date: string; uid: string | null }) => ({
          source_id: src.id, flat_id: src.flat_id, start_date: b.start_date, end_date: b.end_date, uid: b.uid, fetched_at: now,
        }));
        const { error: iErr } = await admin.from("ical_blocks").insert(rows);
        if (iErr) throw new Error(iErr.message);
      }

      await admin.from("ical_sources").update({ last_fetch: now, last_status: "ok" }).eq("id", src.id);
      okCount++; totalBlocks += parsed.length;
    } catch (e) {
      failCount++;
      const msg = ((e as Error).message || "Error desconocido").slice(0, 120);
      await admin.from("ical_sources").update({ last_fetch: now, last_status: msg }).eq("id", src.id);
    }
  }

  return json(200, { sources: (sources || []).length, ok: okCount, failed: failCount, blocks: totalBlocks });
});
