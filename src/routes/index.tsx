import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, type FormEvent } from "react";
import {
  OBJECTIFS_PATRIMONIAUX,
  type ObjectifPatrimonial,
  type PatrimoineInput,
} from "@/lib/analysis.types";
import { supabase } from "@/integrations/supabase/client";
import { envoyerAnalyseAuWebhook } from "@/lib/webhook.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Assistant Patrimoine IA — Analysez votre situation financière" },
      {
        name: "description",
        content:
          "Saisissez vos revenus, votre épargne et votre crédit pour obtenir une analyse patrimoniale générée par l'IA.",
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

/**
 * Composant de rendu Markdown sans dépendance externe :
 * gère les titres (#, ##, ###), le gras (**texte**), les listes à puces et les sauts de ligne.
 */
function RenduMarkdown({ contenu }: { contenu: string }) {
  const lignes = contenu.split("\n");
  const elements: React.ReactNode[] = [];
  let bufferListe: string[] = [];

  const viderListe = (clef: string) => {
    if (bufferListe.length > 0) {
      elements.push(
        <ul key={clef} className="my-2 grid gap-1.5 pl-4 text-cream/85">
          {bufferListe.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm leading-relaxed">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal" aria-hidden />
              <span>{rendreGras(item)}</span>
            </li>
          ))}
        </ul>
      );
      bufferListe = [];
    }
  };

  const rendreGras = (texte: string) => {
    const parties = texte.split(/(\*\*[^*]+\*\*)/g);
    return parties.map((partie, i) => {
      if (partie.startsWith("**") && partie.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-cream">
            {partie.slice(2, -2)}
          </strong>
        );
      }
      return partie;
    });
  };

  lignes.forEach((brut, index) => {
    const ligne = brut.trim();
    if (!ligne) {
      viderListe(`liste-vide-${index}`);
      return;
    }

    if (ligne.startsWith("### ")) {
      viderListe(`liste-h3-${index}`);
      elements.push(
        <h4 key={index} className="mt-4 text-sm font-bold uppercase tracking-wider text-mustard">
          {rendreGras(ligne.replace(/^###\s+/, ""))}
        </h4>
      );
    } else if (ligne.startsWith("## ")) {
      viderListe(`liste-h2-${index}`);
      elements.push(
        <h3 key={index} className="mt-5 text-base font-bold text-coral">
          {rendreGras(ligne.replace(/^##\s+/, ""))}
        </h3>
      );
    } else if (ligne.startsWith("# ")) {
      viderListe(`liste-h1-${index}`);
      elements.push(
        <h2 key={index} className="mt-6 font-display text-lg font-bold text-cream">
          {rendreGras(ligne.replace(/^#\s+/, ""))}
        </h2>
      );
    } else if (/^[-*•]\s+/.test(ligne)) {
      bufferListe.push(ligne.replace(/^[-*•]\s+/, ""));
    } else {
      viderListe(`liste-p-${index}`);
      elements.push(
        <p key={index} className="mt-2 text-sm leading-relaxed text-cream/80">
          {rendreGras(ligne)}
        </p>
      );
    }
  });

  viderListe("liste-finale");

  return <div className="space-y-1">{elements}</div>;
}

function Index() {
  const [champs, setChamps] = useState<Record<string, string>>({
    revenusAnnuels: "",
    epargneDisponible: "",
    montantCredit: "",
    mensualiteCredit: "",
  });
  const [objectif, setObjectif] = useState<ObjectifPatrimonial>(OBJECTIFS_PATRIMONIAUX[0]);
  const [analyseMarkdown, setAnalyseMarkdown] = useState<string | null>(null);
  const [enAttenteIA, setEnAttenteIA] = useState(false);
  const [tentativesRestantes, setTentativesRestantes] = useState(40);
  const [messageTimeout, setMessageTimeout] = useState<string | null>(null);
  const [chargementEnvoi, setChargementEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const arreterPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    return () => arreterPolling();
  }, []);

  const handleChange = (cle: string, valeur: string) => {
    setChamps((prev) => ({ ...prev, [cle]: valeur }));
    setErreur(null);
  };

  const demarrerPolling = (idAnalyse: string) => {
    arreterPolling();
    setEnAttenteIA(true);
    setMessageTimeout(null);
    let compteur = 40; // 40 tentatives * 3s = 120s (2 minutes)
    setTentativesRestantes(compteur);

    pollingRef.current = setInterval(async () => {
      compteur -= 1;
      setTentativesRestantes(compteur);

      try {
        // Lecture directe de la colonne analyse_ia pour l'enregistrement
        const { data, error } = await supabase
          .from("analyses")
          .select("analyse_ia")
          .eq("id", idAnalyse)
          .maybeSingle();

        if (error) {
          console.warn("Erreur temporaire de lecture Supabase :", error.message);
        } else if (data?.analyse_ia && data.analyse_ia.trim().length > 0) {
          // L'analyse a été complétée par n8n dans la base !
          setAnalyseMarkdown(data.analyse_ia.trim());
          setEnAttenteIA(false);
          arreterPolling();
          return;
        }

        // Si 2 minutes écoulées sans analyse
        if (compteur <= 0) {
          arreterPolling();
          setEnAttenteIA(false);
          setMessageTimeout("L'analyse prend plus de temps que prévu, veuillez réessayer plus tard.");
        }
      } catch (err) {
        console.error("Erreur lors de la vérification de l'analyse :", err);
      }
    }, 3000);
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

    setChargementEnvoi(true);
    setErreur(null);
    setConfirmation(null);
    setMessageTimeout(null);
    setAnalyseMarkdown(null);
    arreterPolling();

    try {
      // 1. Insertion de la demande dans la table "analyses" de Supabase
      const { data: ligneCreee, error: erreurInsert } = await supabase
        .from("analyses")
        .insert({
          revenus_annuels: input.revenusAnnuels,
          epargne: input.epargneDisponible,
          credit_immobilier: input.montantCredit,
          mensualite: input.mensualiteCredit,
          objectif: input.objectif,
        })
        .select("id")
        .single();

      if (erreurInsert || !ligneCreee?.id) {
        console.error("Erreur d'insertion Supabase :", erreurInsert?.message);
        setErreur("Erreur lors de l'enregistrement de votre dossier.");
        setChargementEnvoi(false);
        return;
      }

      // 2. Appel POST vers le webhook n8n
      const reponseWebhook = await envoyerAnalyseAuWebhook({
        data: {
          revenus_annuels: input.revenusAnnuels,
          epargne: input.epargneDisponible,
          credit_immobilier: input.montantCredit,
          mensualite: input.mensualiteCredit,
          objectif: input.objectif,
        },
      });

      // Erreur seulement si l'appel échoue vraiment (erreur réseau ou HTTP != 200)
      if (!reponseWebhook.ok) {
        console.error("Échec de l'appel au webhook n8n :", reponseWebhook.statut, reponseWebhook.message);
        setErreur(`Échec de la communication avec le serveur d'analyse${reponseWebhook.statut ? ` (code ${reponseWebhook.statut})` : ""}.`);
        setChargementEnvoi(false);
        return;
      }

      // Succès : réinitialisation du formulaire
      setChamps({
        revenusAnnuels: "",
        epargneDisponible: "",
        montantCredit: "",
        mensualiteCredit: "",
      });
      setConfirmation("Dossier envoyé avec succès. Analyse en cours…");

      // 3. Déclenchement de la surveillance de la table Supabase
      demarrerPolling(ligneCreee.id);
    } catch (e) {
      console.error("Erreur inattendue lors de la soumission :", e);
      setErreur("Une erreur est survenue lors de l'envoi.");
    } finally {
      setChargementEnvoi(false);
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
            Renseignez vos chiffres — vos données sont traitées de manière sécurisée.
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
              disabled={chargementEnvoi || enAttenteIA}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-bold text-primary-foreground ring-1 ring-primary/40 transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
            >
              {chargementEnvoi
                ? "Envoi du dossier…"
                : enAttenteIA
                  ? "Analyse en cours par l'IA…"
                  : "Analyser ma situation"}
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              Vos données sont enregistrées dans la base puis analysées par l'IA.
            </p>
          </form>
        </section>

        {/* Analyse IA */}
        <section className="rounded-[32px] bg-dossier p-6 text-dossier-foreground ring-1 ring-black/5 sm:p-8 flex flex-col">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-cream/60">
            <span className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${enAttenteIA ? "animate-ping bg-coral" : "bg-mustard"}`}
                aria-hidden
              />
              Analyse IA
            </span>
            {enAttenteIA && (
              <span className="text-[10px] text-cream/40 font-mono">
                actualisation ~3s ({tentativesRestantes * 3}s max)
              </span>
            )}
          </div>

          {/* État initial : vide */}
          {!analyseMarkdown && !enAttenteIA && !messageTimeout && (
            <div className="mt-6 grid flex-1 place-items-center rounded-2xl border border-dashed border-white/15 p-10 text-center">
              <p className="text-sm leading-relaxed text-cream/50">
                Votre analyse apparaîtra ici.
                <br />
                Renseignez le formulaire puis lancez l'analyse.
              </p>
            </div>
          )}

          {/* État en cours : attente de n8n / Gemini */}
          {enAttenteIA && (
            <div className="mt-6 flex flex-1 flex-col justify-center rounded-2xl border border-white/10 bg-white/5 p-8 text-center" aria-live="polite">
              <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <h3 className="font-display text-base font-bold text-cream">
                Analyse en cours de génération par l'IA…
              </h3>
              <p className="mt-2 text-xs text-cream/60 max-w-sm mx-auto">
                Gemini traite vos données financières. Le résultat s'affichera automatiquement dès son enregistrement.
              </p>
              <div className="mt-6 space-y-2.5 max-w-xs mx-auto w-full">
                <div className="h-3 w-3/4 animate-pulse rounded-full bg-white/10 mx-auto" />
                <div className="h-3 w-full animate-pulse rounded-full bg-white/10" />
                <div className="h-3 w-5/6 animate-pulse rounded-full bg-white/10 mx-auto" />
              </div>
            </div>
          )}

          {/* Délai dépassé (> 2 minutes) */}
          {messageTimeout && !analyseMarkdown && (
            <div className="mt-6 rounded-2xl border border-mustard/30 bg-mustard/10 p-6 text-center" role="alert">
              <p className="text-sm font-medium text-mustard">
                {messageTimeout}
              </p>
            </div>
          )}

          {/* Affichage du résultat final Markdown */}
          {analyseMarkdown && (
            <div className="mt-4 flex-1 overflow-y-auto pr-1" aria-live="polite">
              <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                <RenduMarkdown contenu={analyseMarkdown} />
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-cream/40">
                Analyse financière générée par l'IA et enregistrée dans votre base de données.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
