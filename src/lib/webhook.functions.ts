import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AnalysePatrimoniale } from "./analysis.types";

/**
 * Transmission de l'analyse vers n8n.
 *
 * L'appel est fait côté serveur (et non depuis le navigateur) : le webhook n8n
 * n'envoie pas les autorisations CORS, ce qui ferait échouer une requête
 * directe depuis la page. Le serveur, lui, peut POSTER librement.
 *
 * Contrat volontairement identique au JSON attendu par n8n.
 */

// URL de PRODUCTION du webhook n8n (le scénario doit être "Actif" pour répondre).
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
  /** Analyse renvoyée par n8n, si la réponse en contient une. */
  analyse: AnalysePatrimoniale | null;
}

/** Normalise un champ (tableau ou texte à puces) en liste de lignes. */
function enListe(valeur: unknown): string[] {
  if (Array.isArray(valeur)) {
    return valeur.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof valeur === "string") {
    return valeur
      .split(/\n+/)
      .map((l) => l.replace(/^\s*[-•*]\s?/, "").trim())
      .filter(Boolean);
  }
  return [];
}

/** Détecte une ligne de titre de section (« Points forts », « Recommandations »…). */
function sectionDe(ligne: string): keyof Omit<AnalysePatrimoniale, "resume" | "genereLe"> | "resume" | null {
  const net = ligne
    .replace(/^[#*\-•\s]+/, "")
    .replace(/[*_`#]+/g, "")
    .trim()
    .replace(/[:：]\s*$/, "");
  if (/^r[ée]sum[ée](\s+de\s+la\s+situation)?$/i.test(net)) return "resume";
  if (/^points?\s+forts?$/i.test(net)) return "pointsForts";
  if (/^points?\s+d['’]attention$/i.test(net)) return "pointsAttention";
  if (/^recommandations?$/i.test(net)) return "recommandations";
  return null;
}

/**
 * Découpe un texte libre en sections standard. Si aucune section n'est
 * reconnue, tout le texte devient le résumé.
 */
function decouperSections(texte: string): AnalysePatrimoniale {
  const resultat: AnalysePatrimoniale = {
    resume: "",
    pointsForts: [],
    pointsAttention: [],
    recommandations: [],
    genereLe: new Date().toISOString(),
  };
  let section: "resume" | "pointsForts" | "pointsAttention" | "recommandations" = "resume";
  for (const brut of texte.split("\n")) {
    const ligne = brut.trim();
    if (!ligne) continue;
    const s = sectionDe(ligne);
    if (s) {
      section = s;
      continue;
    }
    const item = ligne.replace(/^[-•*]\s+/, "").replace(/^\d+[.)]\s+/, "").trim();
    if (section === "resume") {
      resultat.resume += (resultat.resume ? "\n" : "") + item;
    } else {
      resultat[section].push(item);
    }
  }
  resultat.resume = resultat.resume.trim();
  return resultat;
}

/**
 * Extrait une analyse de la réponse du webhook n8n :
 * - JSON structuré (resume, points_forts, points_attention, recommandations)
 * - JSON avec un champ texte (output, reponse, analyse, texte…)
 * - texte brut découpé par sections
 * Renvoie null si la réponse ne contient pas de contenu exploitable.
 */
function extraireAnalyse(corps: string): AnalysePatrimoniale | null {
  const texte = corps.trim();
  if (!texte) return null;

  if (texte.startsWith("{") || texte.startsWith("[")) {
    try {
      const parse = JSON.parse(texte);
      const source = Array.isArray(parse) ? parse[0] : parse;
      if (source && typeof source === "object") {
        const resume = source["resume"] ?? source["résumé"] ?? source["summary"];
        if (typeof resume === "string" && resume.trim()) {
          return {
            resume: resume.trim(),
            pointsForts: enListe(source["pointsForts"] ?? source["points_forts"] ?? source["points forts"]),
            pointsAttention: enListe(
              source["pointsAttention"] ?? source["points_attention"] ?? source["points d'attention"],
            ),
            recommandations: enListe(source["recommandations"]),
            genereLe: new Date().toISOString(),
          };
        }
        const champTexte = ["output", "texte", "text", "reponse", "réponse", "analyse", "resultat", "résultat", "content"].find(
          (cle) => typeof source[cle] === "string" && (source[cle] as string).trim(),
        );
        if (champTexte) return decouperSections(source[champTexte] as string);
      }
      // JSON sans contenu d'analyse exploitable (ex. accusé de réception
      // « Demande reçue, analyse en cours ») : ce n'est pas une analyse.
      return null;
    } catch {
      // Pas du JSON valide : on traite comme du texte brut.
    }
  }

  return decouperSections(texte);
}

export const envoyerAnalyseAuWebhook = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => EntreeWebhookSchema.parse(data))
  .handler(async ({ data }): Promise<StatutWebhook> => {
    const controleur = new AbortController();
    const temporisation = setTimeout(() => controleur.abort(), 30000);

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
        analyse: reponse.ok ? extraireAnalyse(corps) : null,
      };
    } catch (e) {
      const detail =
        e instanceof Error ? (e.name === "AbortError" ? "délai dépassé" : e.message) : "erreur réseau";
      console.error("Appel du webhook n8n impossible :", detail);
      return { ok: false, statut: 0, message: detail, analyse: null };
    } finally {
      clearTimeout(temporisation);
    }
  });
