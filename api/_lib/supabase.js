function getSupabaseConfig() {
  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function isSupabaseConfigured() {
  const { url, key } = getSupabaseConfig();
  return Boolean(url && key);
}

function buildUrl(path, query = {}) {
  const { url } = getSupabaseConfig();
  const target = new URL(`${url.replace(/\/$/, "")}${path}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      target.searchParams.set(key, String(value));
    }
  });

  return target;
}

async function supabaseRequest(path, options = {}) {
  const { key } = getSupabaseConfig();
  if (!isSupabaseConfigured()) {
    const error = new Error("Supabase is not configured");
    error.code = "SUPABASE_NOT_CONFIGURED";
    throw error;
  }

  const method = options.method || "GET";
  const response = await fetch(buildUrl(path, options.query), {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`Supabase request failed: ${response.status}`);
    error.status = response.status;
    error.details = details;
    throw error;
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

module.exports = {
  isSupabaseConfigured,
  supabaseRequest,
};
