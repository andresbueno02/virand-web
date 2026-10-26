// Edge Function «translate»: propone la traducción al inglés de textos en español con Gemini.
// Solo la pueden usar administradores (la clave anon pasa el JWT pero is_admin() da false).
// Secretos: GEMINI_API_KEY (obligatorio), GEMINI_MODEL (opcional, por defecto un alias que apunta al último Flash-Lite).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import "./core.js";

const C = (globalThis as any).TranslateCore;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Método no permitido." });

  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: isAdmin } = await sb.rpc("is_admin");
  if (isAdmin !== true) return json(403, { error: "No tienes permiso para traducir." });

  let body: unknown;
  try { body = await req.json(); } catch { return json(400, { error: "Petición no válida." }); }
  const v = C.validateRequest(body);
  if (!v.ok) return json(400, { error: v.error });

  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json(500, { error: "Falta configurar la clave de Gemini en el servidor (GEMINI_API_KEY)." });
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-flash-lite-latest";

  let r: Response;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(C.buildRequest(v.items)),
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    return json(504, { error: "La traducción ha tardado demasiado. Inténtalo de nuevo." });
  }
  if (!r.ok) {
    if (r.status === 429) return json(429, { error: "Se ha alcanzado el límite gratuito de traducciones. Espera un minuto e inténtalo de nuevo." });
    if (r.status === 404) return json(502, { error: `El modelo de IA «${model}» no está disponible. Hay que cambiar GEMINI_MODEL.` });
    if (r.status === 400 || r.status === 403) return json(502, { error: "Gemini ha rechazado la petición (¿clave no válida o sin permiso?)." });
    return json(502, { error: "Gemini no ha respondido bien. Inténtalo más tarde." });
  }
  try {
    return json(200, { items: C.parseResponse(await r.json(), v.items) });
  } catch (e) {
    return json(502, { error: (e as Error).message });
  }
});
