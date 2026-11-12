import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { supabaseConfig, siteOrigin } from "../lib/config.js";

const config = supabaseConfig();
const origin = siteOrigin();
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });

const pages = ["index.html", "auth/index.html", "caixa/index.html", "estatisticas/index.html", "auditoria/index.html", "exportar/index.html"];
for (const file of pages) {
    const target = "dist/" + file;
    const source = await readFile(target, "utf8");
    await writeFile(target, source.replaceAll("__SITE_ORIGIN__", origin));
}

await build({
    entryPoints: ["src/supabase-client.js"],
    outfile: "dist/assets/caixa-store.js",
    define: { __CAIXA_CONFIG__: JSON.stringify(config), "process.env.NODE_ENV": '"production"' },
    bundle: true,
    platform: "browser",
    format: "iife",
    legalComments: "eof",
    minify: true,
    target: "es2022",
});
