export function supabaseConfig(env = process.env) {
    const url = new URL(env.SUPABASE_URL || "");
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
        throw new Error("SUPABASE_URL deve ser a origem HTTPS do projeto.");
    }
    const key = env.SUPABASE_PUBLISHABLE_KEY || "";
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
        throw new Error("Informe a chave publishable do Supabase.");
    }
    return { url: url.origin, publishableKey: key };
}
export function siteOrigin(env = process.env) {
    const raw = env.SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL && "https://" + env.VERCEL_PROJECT_PRODUCTION_URL);
    const url = new URL(raw || "");
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
        throw new Error("SITE_URL deve ser a origem HTTPS do site.");
    }
    return url.origin;
}
