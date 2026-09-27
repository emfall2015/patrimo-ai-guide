import type { AnalysePatrimoniale, PatrimoineInput } from "./analysis.types";

/**
 * Service d'analyse patrimoniale.
 *
 * Aujourd'hui : analyse 100 % locale (mockée) à partir de ratios simples —
 * aucune API IA ni base de données n'est appelée.
 *
 * Plus tard : remplacer le corps de `analyserSituation` par un appel
 * `createServerFn` (TanStack Start) qui, côté serveur :
 *   1. persiste la saisie dans Supabase (table `patrimoine_inputs`),
 *   2. appelle l'API IA externe avec la clé stockée dans les variables
 *      d'environnement (jamais côté client),
 *   3. renvoie un `AnalysePatrimoniale` identique à celui du mock.
 *
 * Le contrat d'entrée/sortie ne changera pas : l'interface n'aura rien à
 * modifier pour basculer sur le vrai backend.
 */

export function validerSaisie(input: PatrimoineInput): string | null {
  if (input.revenusAnnuels <= 0) return "Merci de renseigner vos revenus annuels.";
  if (input.epargneDisponible < 0) return "L'épargne disponible doit être positive.";
  if (input.mensualiteCredit < 0) return "La mensualité du crédit doit être positive.";
  return null;
}

function formatEuro(valeur: number): string {
  return `${Math.round(valeur).toLocaleString("fr-FR")} €`;
}

function construireAnalyse(input: PatrimoineInput): AnalysePatrimoniale {
  const effortAnnuel = input.mensualiteCredit * 12;
  const tauxEndettement = input.revenusAnnuels > 0 ? effortAnnuel / input.revenusAnnuels : 0;
  const tauxEndettementPct = Math.round(tauxEndettement * 100);

  const epargneMois = input.mensualiteCredit > 0 ? input.epargneDisponible / input.mensualiteCredit : 0;
  const epargneMoisPct = Math.max(1, Math.round(epargneMois));

  const resume = `Vos mensualités représentent environ ${tauxEndettementPct} % de vos revenus annuels${
    tauxEndettement <= 33
      ? ", un niveau maîtrisé au regard des standards bancaires."
      : ", un niveau élevé qui limite votre capacité d'épargne immédiate."
  } Votre épargne disponible couvre environ ${epargneMoisPct} mois de mensualités. Objectif retenu : ${input.objectif.toLowerCase()}.`;

  const pointsForts: string[] = [];
  const pointsAttention: string[] = [];
  const recommandations: string[] = [];

  if (input.epargneDisponible >= input.mensualiteCredit * 6) {
    pointsForts.push(
      `Épargne de précaution solide : ${formatEuro(input.epargneDisponible)}, soit plus de 6 mois de mensualités.`
    );
  } else {
    pointsAttention.push(
      `Réserve de précaution à consolider : visez 3 à 6 mois de charges (soit environ ${formatEuro(
        input.mensualiteCredit * 6
      )}).`
    );
  }

  if (tauxEndettement <= 33) {
    pointsForts.push(`Taux d'endettement maîtrisé (${tauxEndettementPct} %), sous le seuil de vigilance.`);
  } else {
    pointsAttention.push(
      `Taux d'endettement au-dessus du seuil de 33 % (${tauxEndettementPct} %) : évitez tout nouveau crédit à court terme.`
    );
  }

  if (input.epargneDisponible >= input.revenusAnnuels * 0.2) {
    pointsForts.push(
      `Apport de ${formatEuro(input.epargneDisponible)} représentant plus de 20 % de vos revenus : une base de départ confortable.`
    );
  } else {
    pointsAttention.push(
      "L'épargne disponible reste modeste par rapport à vos revenus : construisez-la avant d'engager un nouvel objectif."
    );
  }

  switch (input.objectif) {
    case "Investir":
      recommandations.push(
        "Ouvrir une enveloppe d'investissement progressif (assurance-vie diversifiée, PEA) pour placer à horizon long.",
        "Automatiser un virement mensuel régulier vers cette enveloppe plutôt qu'un investissement ponctuel."
      );
      break;
    case "Acheter un bien":
      recommandations.push(
        `Capitaliser votre apport de ${formatEuro(input.epargneDisponible)} et vérifier votre capacité d'emprunt actualisée.`,
        "Simuler un scénario d'achat à 12-18 mois en intégrant frais de notaire et travaux."
      );
      break;
    case "Préparer la retraite":
      recommandations.push(
        "Étudier l'ouverture d'un Plan d'Épargne Retraite (PER) pour bénéficier de l'avantage fiscal dédié.",
        "Estimer votre besoin de revenu futur et le décalage avec vos droits actuels."
      );
      break;
    case "Épargner":
      recommandations.push(
        "Sécuriser d'abord l'épargne de précaution sur un livret rémunéré, avant toute prise de risque.",
        "Définir un virement automatique mensuel pour rendre l'épargne systématique."
      );
      break;
  }

  recommandations.push(
    "Revoir annuellement cette analyse : situation, taux et objectifs évoluent avec le temps."
  );

  return {
    resume,
    pointsForts,
    pointsAttention,
    recommandations,
    genereLe: new Date().toISOString(),
  };
}

/**
 * Analyse locale (mock). Simule une latence de génération IA.
 * Point d'entrée unique : c'est ici que la future API IA sera branchée.
 */
export async function analyserSituation(input: PatrimoineInput): Promise<AnalysePatrimoniale> {
  const erreur = validerSaisie(input);
  if (erreur) throw new Error(erreur);

  // Latence simulée pour préparer l'ergonomie d'un vrai appel réseau.
  await new Promise((resolve) => setTimeout(resolve, 900));

  return construireAnalyse(input);
}
