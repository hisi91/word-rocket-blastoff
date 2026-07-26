import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";

import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/upload-icon")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const token = authHeader.slice(7);
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
          const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

          if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
            return Response.json({ error: "Missing Supabase server configuration" }, { status: 500 });
          }

          const userClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              storage: undefined,
            },
          });

          const { data: userData, error: userError } = await userClient.auth.getUser(token);
          if (userError || !userData?.user) {
            return Response.json({ error: "Invalid token" }, { status: 401 });
          }

          const { data: roleRow } = await userClient
            .from("user_roles")
            .select("role")
            .eq("user_id", userData.user.id)
            .eq("role", "admin")
            .maybeSingle();

          if (!roleRow) {
            return Response.json({ error: "Forbidden: admin only" }, { status: 403 });
          }

          const form = await request.formData();
          const folder = String(form.get("folder") ?? "").trim();
          const file = form.get("file");

          if (!folder || !(file instanceof File)) {
            return Response.json({ error: "Missing folder or file" }, { status: 400 });
          }

          if (!/^[a-zA-Z0-9_-]+$/.test(folder)) {
            return Response.json({ error: "Invalid folder name" }, { status: 400 });
          }

          const adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              storage: undefined,
            },
          });

          const storagePath = `${folder}/${file.name}`;
          const bytes = new Uint8Array(await file.arrayBuffer());
          const { error: uploadError } = await adminClient.storage
            .from("game-icons")
            .upload(storagePath, bytes, {
              upsert: true,
              contentType: file.type || "image/webp",
            });

          if (uploadError) {
            return Response.json({ error: uploadError.message }, { status: 500 });
          }

          return Response.json({ ok: true, path: storagePath });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Server error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
