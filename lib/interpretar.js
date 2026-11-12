import { supabaseConfig } from "./config.js";
import { launchInstructions } from "./exemplos-lancamento.js";

const amounts = ["cash", "pix", "debit", "credit", "trade_in", "payjoy", "other_finance", "pending_amount"];
const textFields = ["product", "trade_in_details", "service_parts", "note", "doubt"];
const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
        ...Object.fromEntries(amounts.map((key) => [key, { type: "number" }])),
        ...Object.fromEntries(textFields.map((key) => [key, { type: "string" }])),
        installments: { type: "integer" },
    },
    required: [...amounts, ...textFields, "installments"],
};
const format = { type: "json_schema", json_schema: { name: "caixa_sale", strict: true, schema } };
const chatResult = (data) => data.choices?.[0]?.message?.content;
const json = (body, status = 200, extra = {}) => Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extra },
});

function providers(env) {
    return [
        { name: "Gemini", key: env.GEMINI_API_KEY, url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            model: env.GEMINI_MODEL || "gemini-3.5-flash-lite", extract: chatResult },
        { name: "Groq", key: env.GROQ_API_KEY, url: "https://api.groq.com/openai/v1/chat/completions",
            model: env.GROQ_MODEL || "openai/gpt-oss-20b", extract: chatResult },
        { name: "Cloudflare Workers AI", key: env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN, cloudflare: true,
            url: "https://api.cloudflare.com/client/v4/accounts/" + encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID || "") +
                "/ai/run/" + (env.CLOUDFLARE_MODEL || "@cf/meta/llama-3.1-8b-instruct"),
            extract: (data) => data.result?.response },
        { name: "OpenRouter", key: env.OPENROUTER_API_KEY, url: "https://openrouter.ai/api/v1/chat/completions",
            model: env.OPENROUTER_MODEL || "openrouter/free", extract: chatResult },
    ].filter((provider) => provider.key);
}

function parsedSale(content, kind) {
    const fields = typeof content === "string"
        ? JSON.parse(content.trim().replace(/^`{3}(?:json)?\s*([\s\S]*?)\s*`{3}$/i, "$1")) : content;
    if (!fields || !textFields.every((key) => typeof fields[key] === "string" && fields[key].length <= 1500)) return null;
    if (fields.doubt.trim()) return { doubt: fields.doubt.trim() };
    if (!amounts.every((key) => Number.isFinite(fields[key]) && fields[key] >= 0 && fields[key] <= 1e8)) return null;
    if (!Number.isSafeInteger(fields.installments) || fields.installments < 0 || (fields.installments > 0 && fields.credit <= 0)) return null;
    const values = Object.fromEntries(amounts.map((key) => [key, Math.round(fields[key] * 100) / 100]));
    const product = fields.product.trim();
    const parts = fields.service_parts.trim();
    const trade = fields.trade_in_details.trim();
    if (kind === "SERVICO" ? !product && !parts : !product || (!trade && !amounts.some((key) => values[key] > 0))) return null;
    return { ...values, product, note: fields.note.trim(), trade_in_details: trade, installments: fields.installments,
        ...(kind === "SERVICO" ? { service_parts: parts } : {}) };
}

async function readLaunch(request) {
    const reader = request.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder();
    let bytes = 0;
    let body = "";
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 8192) { await reader.cancel(); return null; }
        body += decoder.decode(value, { stream: true });
    }
    const { text, kind = "PRODUTO" } = JSON.parse(body + decoder.decode()) ?? {};
    if (kind !== "PRODUTO" && kind !== "SERVICO") return null;
    if (typeof text !== "string" || !text.trim() || text.length > 1500) return null;
    return { text: text.trim(), kind };
}

export async function interpretRequest(request, env = process.env, fetcher = fetch) {
    if (request.method !== "POST") return json({ error: "Use POST." }, 405, { Allow: "POST" });
    if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") || "")) {
        return json({ error: "Formato inválido." }, 415);
    }
    const authorization = request.headers.get("authorization");
    if (!/^Bearer [A-Za-z0-9._-]+$/.test(authorization || "")) return json({ error: "Entre no caixa para usar a IA." }, 401);
    let config;
    try { config = supabaseConfig(env); } catch { return json({ error: "Configure o Supabase." }, 503); }

    let user;
    try {
        user = await fetcher(config.url + "/auth/v1/user", {
            headers: { apikey: config.publishableKey, Authorization: authorization },
            signal: AbortSignal.timeout(3000),
        });
    } catch {
        return json({ error: "Não foi possível validar a sessão agora." }, 503);
    }
    if (!user.ok) {
        return user.status >= 500
            ? json({ error: "Não foi possível validar a sessão agora." }, 503)
            : json({ error: "Entre novamente para usar a IA." }, 401);
    }
    let launch;
    try { launch = await readLaunch(request); } catch {}
    if (!launch) return json({ error: "Digite uma venda ou um serviço de até 1.500 caracteres." }, 400);
    const { text, kind } = launch;
    const available = providers(env);
    if (!available.length) return json({ error: "A IA ainda não foi configurada. Use o formato do exemplo ou lance manualmente." }, 503);

    const messages = [{ role: "system", content: launchInstructions(kind) }, { role: "user", content: text }];
    for (const provider of available) {
        try {
            const groqReasoning = provider.name === "Groq" && /^openai\/gpt-oss-(20b|120b)$/.test(provider.model);
            const response = await fetcher(provider.url, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + provider.key },
                body: JSON.stringify(provider.cloudflare
                    ? { messages, max_tokens: 768, response_format: { type: "json_schema", json_schema: schema } }
                    : { model: provider.model, messages, max_completion_tokens: 1024, response_format: format,
                        ...(groqReasoning ? { reasoning_effort: "low" } : {}) }),
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok) {
                console.warn("IA de vendas recusou a requisição", { provider: provider.name, status: response.status });
                await response.body?.cancel();
                continue;
            }
            const sale = parsedSale(provider.extract(await response.json()), kind);
            if (sale?.doubt) return json({ error: sale.doubt }, 422);
            if (sale) return json(sale);
            console.warn("IA de vendas retornou dados inválidos", { provider: provider.name });
        } catch (error) {
            const reason = error?.name === "TimeoutError" ? "tempo limite"
                : error?.name === "SyntaxError" ? "JSON inválido" : "erro de comunicação";
            console.warn("Falha na IA de vendas", { provider: provider.name, reason });
        }
    }
    return json({ error: "A IA está indisponível. Use o formato do exemplo ou lance manualmente." }, 503);
}
