import { supabase, SUPA_URL, SUPA_KEY } from "./supabaseClient.js";

async function db(table, method = "GET", body = null, query = "") {
  const url = `${SUPA_URL}/rest/v1/${table}${query}`;
  let token = SUPA_KEY;

  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || SUPA_KEY;
  } catch {}

  const res = await fetch(url, {
    method,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : null,
  });

  if (method === "GET" || (method === "POST" && res.ok)) {
    try {
      return await res.json();
    } catch {
      return [];
    }
  }

  return res.ok;
}

const dbGet = (t, q = "") => db(t, "GET", null, q);
const dbPost = (t, b) => db(t, "POST", b, "");
const dbPatch = (t, q, b) => db(t, "PATCH", b, q);
const dbDelete = (t, q = "") => db(t, "DELETE", null, q);

export {
  db,
  dbGet,
  dbPost,
  dbPatch,
  dbDelete
};
