import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const URL_WEBHOOK = "https://emfall2015.app.n8n.cloud/webhook/analyse-patrimoine";

const EntreeWebhookSchema = z.object({
  revenus_annuels: z.number(),
  epargne: z.number(),
  credit_immobilier: z.number(),
  mensualite: z.number(),
  objectif: z.string(),
});

export interface StatutWebhook {
  ok: boolean;
  statut: number;
  message: string;
  id?: string | number | null;
}

export const envoyerAnalyseAuWebhook = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => EntreeWebhookSchema.parse(data))
  .handler(async ({ data }): Promise<StatutWebhook> => {
    try {
      const reponse = await fetch(URL_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const texte = await reponse.text().catch(() => "");
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(texte);
      } catch {}

      const ok = reponse.ok && (parsed["success"] === undefined || parsed["success"] === true);
      const id = (parsed["id"] as string | number | undefined) ?? null;

      if (!ok) {
        console.error("Réponse en erreur du webhook n8n :", reponse.status, texte.slice(0, 300));
      }

      return {
        ok,
        statut: reponse.status,
        message: (parsed["message"] as string) || texte.slice(0, 300),
        id,
      };
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Erreur réseau";
      console.error("Appel du webhook n8n impossible :", detail);
      return { ok: false, statut: 0, message: detail, id: null };
    }
  });
