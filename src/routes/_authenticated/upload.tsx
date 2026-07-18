import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/upload")({
  component: UploadPage,
});

type UploadResult = { name: string; ok: boolean; message?: string };

function UploadPage() {
  const navigate = useNavigate();
  const [folder, setFolder] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      setEmail(user?.email ?? null);
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!roles);
    });
    supabase
      .from("levels")
      .select("folder_name")
      .order("id")
      .then(({ data }) => {
        if (data) setFolders(Array.from(new Set(data.map((d: any) => d.folder_name))));
      });
  }, []);


  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!folder || files.length === 0) return;
    setBusy(true);
    setResults([]);
    const out: UploadResult[] = [];

    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      setResults([{ name: "auth", ok: false, message: "Session expirée, reconnecte-toi." }]);
      setBusy(false);
      return;
    }

    for (const file of files) {
      const path = `${folder}/${file.name}`;
      try {
        const fd = new FormData();
        fd.append("folder", folder);
        fd.append("file", file);
        const res = await fetch("/api/upload-icon", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const json: any = await res.json().catch(() => ({}));
        out.push({ name: path, ok: res.ok && json.ok, message: json.error });
      } catch (err: any) {
        out.push({ name: path, ok: false, message: err?.message ?? "network error" });
      }
    }
    setResults(out);
    setBusy(false);
    setFiles([]);
  }


  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Upload d'icônes</h1>
            <p className="text-sm text-slate-400">Connecté : {email}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/" className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-sm">
              ← Jeu
            </Link>
            <button
              onClick={signOut}
              className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-sm"
            >
              Déconnexion
            </button>
          </div>
        </div>

        {isAdmin === false && (
          <div className="bg-red-900/40 border border-red-500/50 rounded-2xl p-5 mb-4 text-sm">
            🔒 Accès réservé aux administrateurs. Ton compte ({email}) n'a pas le rôle <code>admin</code>.
            Contacte le propriétaire du projet pour qu'il te l'attribue.
          </div>
        )}

        <form onSubmit={handleUpload} className={`bg-slate-800 rounded-2xl p-5 space-y-4 ${isAdmin ? "" : "opacity-50 pointer-events-none"}`}>

          <div>
            <label className="block text-sm mb-1">Dossier (folder_name du niveau)</label>
            <input
              list="folders"
              required
              placeholder="ex: animals, fruits, space..."
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 focus:outline-none focus:border-blue-400"
            />
            <datalist id="folders">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm mb-1">Fichiers (.webp, .png, .jpg)</label>
            <input
              type="file"
              multiple
              accept="image/webp,image/png,image/jpeg"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="w-full text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-blue-500 file:text-white hover:file:bg-blue-600"
            />
            {files.length > 0 && (
              <p className="text-xs text-slate-400 mt-1">{files.length} fichier(s) sélectionné(s)</p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy || !folder || files.length === 0}
            className="w-full py-2 rounded bg-blue-500 hover:bg-blue-600 font-medium disabled:opacity-50"
          >
            {busy ? "Upload en cours..." : "Uploader"}
          </button>
        </form>

        {results.length > 0 && (
          <div className="mt-5 bg-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-2">Résultats</h2>
            <ul className="text-sm space-y-1">
              {results.map((r) => (
                <li key={r.name} className={r.ok ? "text-green-400" : "text-red-400"}>
                  {r.ok ? "✓" : "✗"} {r.name}
                  {r.message && <span className="text-slate-400"> — {r.message}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-slate-500 mt-4">
          Astuce : le nom du fichier devient le mot du jeu (ex: <code>tiger.webp</code> → mot "tiger"). N'oublie pas
          d'ajouter aussi l'entrée dans la table <code>level_objects</code> pour qu'il apparaisse dans le jeu.
        </p>
      </div>
    </main>
  );
}
