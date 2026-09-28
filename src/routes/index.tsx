import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  OBJECTIFS_PATRIMONIAUX,
  type AnalysePatrimoniale,
  type ObjectifPatrimonial,
  type PatrimoineInput,
} from "@/lib/analysis.types";
import { analyserSituation } from "@/lib/patrimoine.service";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Assistant Patrimoine IA — Analysez votre situation financière" },
      {
        name: "description",
        content:
          "Saisissez vos revenus, votre épargne et votre crédit pour obtenir une analyse patrimoniale générée par l'IA : résumé, points forts, points d'attention et recommandations.",
      },
      {
        property: "og:title",
        content: "Assistant Patrimoine IA — Analysez votre situation financière",
      },
      {
        property: "og:description",
        content: "Analysez votre situation financière avec l'aide de l'IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const CHAMPS_NOMBRE = [
  { cle: "revenusAnnuels", label: "Revenus annuels (€)", placeholder: "62 000" },
  { cle: "epargneDisponible", label: "Épargne disponible (€)", placeholder: "41 500" },
  { cle: "montantCredit", label: "Montant du crédit immobilier (€)", placeholder: "285 000" },
  { cle: "mensualiteCredit", label: "Mensualité du crédit (€)", placeholder: "1 420" },
] as const;

function Index() {
  const [champs, setChamps] = useState<Record<string, string>>({
    revenusAnnuels: "",
    epargneDisponible: "",
    montantCredit: "",
    mensualiteCredit: "",
  });
  const [objectif, setObjectif] = useState<ObjectifPatrimonial>(OBJECTIFS_PATRIMONIAUX[0]);
  const [analyse, setAnalyse] = useState<AnalysePatrimoniale | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const handleChange = (cle: string, valeur: string) => {
    setChamps((prev) => ({ ...prev, [cle]: valeur }));
    setErreur(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const input: PatrimoineInput = {
      revenusAnnuels: Number(champs["revenusAnnuels"]) || 0,
      epargneDisponible: Number(champs["epargneDisponible"]) || 0,
      montantCredit: Number(champs["montantCredit"]) || 0,
      mensualiteCredit: Number(champs["mensualiteCredit"]) || 0,
      objectif,
    };

    setChargement(true);
    setErreur(null);
    setConfirmation(null);
    try {
      // Insertion réelle dans la table "analyses" (Supabase).
      // On récupère et vérifie explicitement la variable "error" renvoyée
      // par le client Supabase : le succès n'est affirmé QUE si error est null.
      const { error: erreurInsert } = await supabase.from("analyses").insert({
        revenus_annuels: input.revenusAnnuels,
        epargne: input.epargneDisponible,
        credit_immobilier: input.montantCredit,
        mensualite: input.mensualiteCredit,
        objectif: input.objectif,
      });
      if (erreurInsert) {
        console.error("Erreur d'insertion Supabase :", erreurInsert.message);
        setErreur("Erreur lors de l'enregistrement");
        return; // Aucun message de succès en cas d'erreur.
      }
      // Insertion réellement réussie : on affiche le succès et on vide le formulaire.
      setChamps({ revenusAnnuels: "", epargneDisponible: "", montantCredit: "", mensualiteCredit: "" });
      const resultat = await analyserSituation(input);
      setAnalyse(resultat);
      setConfirmation("Analyse enregistrée avec succès.");
    } catch (e) {
      console.error("Erreur inattendue lors de l'enregistrement :", e);
      setErreur("Erreur lors de l'enregistrement");
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* En-tête */}
      <header className="flex items-center justify-between px-6 py-6 sm:px-10">
        <span className="inline-flex items-center gap-2 font-semibold">
          <span className="size-3 rounded-full bg-primary ring-4 ring-primary/20" aria-hidden />
          Assistant Patrimoine IA
        </span>
        <Link
          to="/analyses"
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          Voir les analyses enregistrées
        </Link>
      </header>

      {/* Héros */}
      <section className="mx-auto max-w-6xl px-6 pt-6 pb-4 sm:px-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          Analyse patrimoniale assistée par l'IA
        </p>
        <h1 className="mt-3 text-balance font-display text-6xl font-black leading-[0.92] sm:text-7xl lg:text-8xl">
          Assistant <span className="text-primary">Patrimoine</span> IA
        </h1>
        <p className="mt-5 max-w-[52ch] text-pretty text-base text-foreground/70 sm:text-lg">
          Analysez votre situation financière avec l'aide de l'IA.
        </p>
      </section>

      {/* Formulaire + analyse */}
      <main className="mx-auto grid max-w-6xl gap-6 px-6 pb-20 sm:px-10 lg:grid-cols-[1.05fr_1fr]">
        {/* Formulaire */}
        <section className="rounded-[32px] bg-card p-6 ring-1 ring-black/5 sm:p-8">
          <h2 className="font-display text-2xl font-bold">Votre dossier</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Renseignez vos chiffres — tout reste sur votre appareil.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
            {CHAMPS_NOMBRE.map((champ) => (
              <label key={champ.cle} className="grid gap-1.5 text-sm font-semibold">
                {champ.label}
                <input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="numeric"
                  placeholder={champ.placeholder}
                  value={champs[champ.cle]}
                  onChange={(e) => handleChange(champ.cle, e.target.value)}
                  required={champ.cle === "revenusAnnuels"}
                  className="rounded-2xl border-2 border-ink/10 bg-secondary/40 px-4 py-3 text-base font-medium text-foreground outline-none focus:border-primary"
                />
              </label>
            ))}

            <label className="grid gap-1.5 text-sm font-semibold">
              Objectif patrimonial
              <select
                value={objectif}
                onChange={(e) => setObjectif(e.target.value as ObjectifPatrimonial)}
                className="rounded-2xl border-2 border-ink/10 bg-secondary/40 px-4 py-3 text-base font-medium text-foreground outline-none focus:border-primary"
              >
                {OBJECTIFS_PATRIMONIAUX.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>

            {erreur && (
              <p role="alert" className="text-sm font-semibold text-destructive">
                {erreur}
              </p>
            )}

            {confirmation && (
              <p role="status" className="text-sm font-semibold text-teal">
                {confirmation}
              </p>
            )}

            <button
              type="submit"
              disabled={chargement}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-bold text-primary-foreground ring-1 ring-primary/40 transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
            >
              {chargement ? "Analyse en cours…" : "Analyser ma situation"}
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              Vos données sont enregistrées de manière sécurisée pour générer votre analyse.
            </p>
          </form>
        </section>

        {/* Analyse IA */}
        <section className="rounded-[32px] bg-dossier p-6 text-dossier-foreground ring-1 ring-black/5 sm:p-8">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cream/60">
            <span className="size-2 rounded-full bg-mustard" aria-hidden />
            Analyse IA
          </div>

          {!analyse && !chargement && (
            <div className="mt-6 grid flex-1 place-items-center rounded-2xl border border-dashed border-white/15 p-10 text-center">
              <p className="text-sm leading-relaxed text-cream/50">
                Votre analyse apparaîtra ici.
                <br />
                Renseignez le formulaire puis lancez l'analyse.
              </p>
            </div>
          )}

          {chargement && (
            <div className="mt-6 space-y-3" aria-live="polite">
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/10" />
              <div className="h-4 w-full animate-pulse rounded-full bg-white/10" />
              <div className="h-4 w-5/6 animate-pulse rounded-full bg-white/10" />
              <div className="h-4 w-3/4 animate-pulse rounded-full bg-white/10" />
            </div>
          )}

          {analyse && !chargement && (
            <div aria-live="polite">
              <div className="mt-4 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                <h3 className="text-sm font-bold uppercase tracking-wider text-coral">
                  Résumé de la situation
                </h3>
                <p className="mt-2 text-pretty text-sm leading-relaxed text-cream/80">
                  {analyse.resume}
                </p>
              </div>

              <div className="mt-3 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                <h3 className="text-sm font-bold uppercase tracking-wider text-teal">Points forts</h3>
                <ul className="mt-2 grid gap-2 text-sm text-cream/80">
                  {analyse.pointsForts.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal" aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                <h3 className="text-sm font-bold uppercase tracking-wider text-mustard">
                  Points d'attention
                </h3>
                <ul className="mt-2 grid gap-2 text-sm text-cream/80">
                  {analyse.pointsAttention.length === 0 && (
                    <li className="flex gap-2">Aucun point d'attention identifié pour cette analyse.</li>
                  )}
                  {analyse.pointsAttention.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-mustard" aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                <h3 className="text-sm font-bold uppercase tracking-wider text-plum">
                  Recommandations
                </h3>
                <ul className="mt-2 grid gap-2 text-sm text-cream/80">
                  {analyse.recommandations.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-plum" aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mt-5 max-w-[46ch] text-[11px] leading-relaxed text-cream/40">
                Chaque analyse est enregistrée dans la base de données, puis complétée
                par l'IA.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
