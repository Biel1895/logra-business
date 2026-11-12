import { createClient } from "@supabase/supabase-js";

const { url, publishableKey } = __CAIXA_CONFIG__;
const client = createClient(url, publishableKey, {
    auth: { storageKey: "soma-clara-caixa.auth", persistSession: true, autoRefreshToken: true },
});

globalThis.cashStore = {
    auth: client.auth,
    from: (table) => client.from("caixa_" + table),
};
