import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getAnalyses, type AnalyseRow } from "@/lib/analyses.functions";

const analysesQuery = queryOptions({
  queryKey: ["analyses"],
  queryFn: () => getAnalyses(),
});

export const Route = createFileRoute("/analyses")({
  loader: ({ context }) => context.queryClient.ensureQueryData(analysesQuery),
  head: () => ({
    meta: [
      { title: "Analyses enregistrées — Assistant Patrimoine IA" },
      {
        name: "description",
        content:
          "Consultez les analyses patrimoniales enregistrées : revenus, épargne, crédit immobilier et objectifs.",
      },
      { property: "og:title", content: "Analyses enregistrées — Assistant Patrimoine IA" },
      {
        property: "og:description",
        content:
          "Consultez les analyses patrimoniales enregistrées : revenus, épargne, crédit immobilier et objectifs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-destructive" role="alert">
        Impossible de charger les analyses : {error.message}
      </p>
      <Link to="/" className="mt-4 inline-block underline">
        Retour à l'accueil
      </Link>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p>Page introuvable.</p>
      <Link to="/" className="mt-4 inline-block underline">
        Retour à l'accueil
      </Link>
    </main>
  ),
  component: AnalysesPage,
});

const formatEuros = (valeur: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(valeur);

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

function AnalyseCard({ analyse }: { analyse: AnalyseRow }) {
  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg font-semibold">{analyse.objectif}</h2>
        <time className="text-sm text-muted-foreground">
          {formatDate(analyse.created_at)}
        </time>
      </header>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Revenus annuels</dt>
          <dd className="font-medium">{formatEuros(analyse.revenus_annuels)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Épargne</dt>
          <dd className="font-medium">{formatEuros(analyse.epargne)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Crédit immobilier</dt>
          <dd className="font-medium">{formatEuros(analyse.credit_immobilier)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mensualité</dt>
          <dd className="font-medium">{formatEuros(analyse.mensualite)}</dd>
        </div>
      </dl>
      {analyse.analyse_ia ? (
        <p className="mt-3 border-t border-border pt-3 text-sm">{analyse.analyse_ia}</p>
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-sm italic text-muted-foreground">
          Analyse IA pas encore générée.
        </p>
      )}
    </article>
  );
}

function AnalysesPage() {
  const { data: analyses } = useSuspenseQuery(analysesQuery);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link to="/" className="text-sm underline">
        ← Retour au formulaire
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold">
        Analyses enregistrées
      </h1>
      <p className="mt-2 text-muted-foreground">
        Les 50 dernières analyses enregistrées dans la base.
      </p>
      {analyses.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          Aucune analyse enregistrée pour le moment.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {analyses.map((analyse) => (
            <AnalyseCard key={analyse.id} analyse={analyse} />
          ))}
        </div>
      )}
    </main>
  );
}
