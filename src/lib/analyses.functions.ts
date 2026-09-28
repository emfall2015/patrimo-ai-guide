import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AnalyseRow = {
  id: string;
  revenus_annuels: number;
  epargne: number;
  credit_immobilier: number;
  mensualite: number;
  objectif: string;
  analyse_ia: string | null;
  created_at: string;
};

export const getAnalyses = createServerFn({ method: "GET" }).handler(
  async (): Promise<AnalyseRow[]> => {
    const supabasePublic = createClient<Database>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      {
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
    const { data, error } = await supabasePublic
      .from("analyses")
      .select(
        "id, revenus_annuels, epargne, credit_immobilier, mensualite, objectif, analyse_ia, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as AnalyseRow[];
  },
);
