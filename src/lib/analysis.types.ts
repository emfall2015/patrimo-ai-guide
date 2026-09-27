/**
 * Types partagés de l'Assistant Patrimoine IA.
 *
 * Ces types décrivent le contrat entre l'interface, le futur backend
 * (Supabase) et la future API d'analyse IA. Ils sont volontairement
 * sérialisables (JSON) pour voyager sans friction entre client et serveur.
 */

export const OBJECTIFS_PATRIMONIAUX = [
  "Investir",
  "Acheter un bien",
  "Préparer la retraite",
  "Épargner",
] as const;

export type ObjectifPatrimonial = (typeof OBJECTIFS_PATRIMONIAUX)[number];

/** Données saisies par l'utilisateur dans le formulaire principal. */
export interface PatrimoineInput {
  /** Revenus annuels nets (€) */
  revenusAnnuels: number;
  /** Épargne disponible (€) */
  epargneDisponible: number;
  /** Capital restant dû du crédit immobilier (€) */
  montantCredit: number;
  /** Mensualité du crédit (€) */
  mensualiteCredit: number;
  /** Objectif patrimonial choisi */
  objectif: ObjectifPatrimonial;
}

export type PointNature = "force" | "attention";

export interface PointAnalyse {
  nature: PointNature;
  texte: string;
}

/** Résultat d'une analyse patrimoniale (fourni aujourd'hui en mock, demain par l'IA). */
export interface AnalysePatrimoniale {
  resume: string;
  pointsForts: string[];
  pointsAttention: string[];
  recommandations: string[];
  /** Horodatage de la génération, utile pour la persistance Supabase future. */
  genereLe: string;
}
