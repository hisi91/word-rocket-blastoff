import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/upload" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/upload` },
        });
        if (error) throw error;
        setInfo("Compte créé. Tu peux te connecter.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/upload" });
      }
    } catch (err: any) {
      setError(err.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
      <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-6 shadow-xl">
        <h1 className="text-2xl font-bold mb-1">
          {mode === "signin" ? "Connexion" : "Créer un compte"}
        </h1>
        <p className="text-sm text-slate-400 mb-5">Accès uploader d'icônes</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 focus:outline-none focus:border-blue-400"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Mot de passe (min 6)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 focus:outline-none focus:border-blue-400"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {info && <p className="text-green-400 text-sm">{info}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded bg-blue-500 hover:bg-blue-600 font-medium disabled:opacity-50"
          >
            {loading ? "..." : mode === "signin" ? "Se connecter" : "S'inscrire"}
          </button>
        </form>
        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setInfo(null);
          }}
          className="mt-4 text-sm text-blue-400 hover:underline w-full text-center"
        >
          {mode === "signin" ? "Pas de compte ? Créer un compte" : "Déjà un compte ? Se connecter"}
        </button>
        <Link to="/" className="mt-3 text-xs text-slate-400 hover:underline w-full text-center block">
          ← Retour au jeu
        </Link>
      </div>
    </main>
  );
}
