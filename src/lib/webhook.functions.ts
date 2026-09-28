import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Transmission de l'analyse vers n8n.
 *
 * L'appel est fait côté serveur (et non depuis le navigateur) : le webhook n8n
 * n'envoie pas les autorisations CORS, ce qui ferait échouer une requête
 * directe depuis la page. Le serveur, lui, peut POSTER librement.
 *
 * Contrat volontairement identique au JSON attendu par n8n.
 */

const URL_WEBHOOK = "https://emfall2015.app.n8n.cloud/webhook-test/analyse-patrimoine";

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
}

export const envoyerAnalyseAuWebhook = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => EntreeWebhookSchema.parse(data))
  .handler(async ({ data }): Promise<StatutWebhook> => {
    const controleur = new AbortController();
    const temporisation = setTimeout(() => controleur.abort(), 15000);

    try {
      const reponse = await fetch(URL_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controleur.signal,
      });

      const corps = await reponse.text().catch(() => "");

      if (!reponse.ok) {
        console.error("Réponse en erreur du webhook n8n :", reponse.status, corps.slice(0, 300));
      }

      return {
        ok: reponse.ok,
        statut: reponse.status,
        message: corps.slice(0, 300),
      };
    } catch (e) {
      const detail =
        e instanceof Error ? (e.name === "AbortError" ? "délai dépassé" : e.message) : "erreur réseau";
      console.error("Appel du webhook n8n impossible :", detail);
      return { ok: false, statut: 0, message: detail };
    } finally {
      clearTimeout(temporisation);
    }
  });
