const audit=(()=>{const {fetchSales,fetchExpenses,fetchMovements,fetchClosing,fetchAuditLogs,paymentTotal,sum,brl,brlCompact,parseMoney,todayISO,isoToDate,addDays,formatDayLong,formatDayShort}=Object.assign({},db,format);
const card = "rounded-2xl border border-border bg-card p-5 shadow-panel";
const input = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20";
const label = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const TABLES = {
    sales: "Venda",
    expenses: "Saída / despesa",
    cash_movements: "Depósito / retirada",
    day_closings: "Fechamento do caixa",
};
const ACTIONS = {
    INSERT: { text: "Criado", className: "bg-positive/10 text-positive" },
    UPDATE: { text: "Alterado", className: "bg-primary/10 text-primary" },
    DELETE: { text: "Excluído", className: "bg-destructive/10 text-destructive" },
};
const FIELDS = {
    kind: "Tipo",
    product: "Produto / serviço",
    total: "Valor total",
    cash: "Dinheiro",
    pix: "PIX",
    debit: "Débito",
    credit: "Crédito",
    installments: "Parcelas",
    trade_in: "Troca (R$)",
    trade_in_details: "Aparelho da troca",
    service_parts: "Peças do serviço",
    payjoy: "PayJoy",
    other_finance: "Outras financeiras",
    pending_amount: "Valor pendente",
    note: "Observação",
    sale_date: "Data",
    description: "Descrição",
    payment_method: "Forma de pagamento",
    amount: "Valor",
    expense_date: "Data",
    movement_date: "Data",
    closing_date: "Data",
    opening_balance: "Saldo inicial",
    counted_cash: "Dinheiro contado",
    responsible: "Responsável",
};
const MONEY = new Set([
    "total",
    "cash",
    "pix",
    "debit",
    "credit",
    "trade_in",
    "payjoy",
    "other_finance",
    "pending_amount",
    "amount",
    "opening_balance",
    "counted_cash",
]);
const HIDDEN = new Set(["id", "user_id", "created_at", "updated_at"]);
function show(field, value) {
    if (value === null || value === undefined || value === "")
        return "—";
    if (MONEY.has(field))
        return brl(Number(value));
    return String(value);
}
function AuditoriaPage() {
    const [unlocked, setUnlocked] = useState(false);
    if (!unlocked)
        return h(PasswordGate, { onUnlock: () => setUnlocked(true) });
    return h(AuditList, null);
}
function PasswordGate({ onUnlock }) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    async function submit(e) {
        e.preventDefault();
        setLoading(true);
        setError("");
        const { data } = await cashStore.auth.getUser();
        const email = data.user?.email;
        if (!email) {
            setError("Sessão expirada. Entre novamente.");
            setLoading(false);
            return;
        }
        const { error: authError } = await cashStore.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (authError) {
            setError("Senha incorreta.");
            return;
        }
        onUnlock();
    }
    return (h("div", { className: "mx-auto max-w-md" },
        h("form", { onSubmit: submit, className: card },
            h("div", { className: "flex size-11 items-center justify-center rounded-lg bg-secondary" },
                h(Lock, { className: "size-5" })),
            h("h1", { className: "mt-4 font-display text-xl font-bold" }, "\u00C1rea protegida"),
            h("p", { className: "mt-1 text-sm text-muted-foreground" }, "Digite a senha da sua conta para ver o hist\u00F3rico de todas as altera\u00E7\u00F5es."),
            h("div", { className: "mt-5" },
                h("span", { className: label }, "Senha"),
                h("input", { type: "password", autoComplete: "current-password", className: `${input} mt-1.5`, value: password, onChange: (e) => setPassword(e.target.value) })),
            error && h("p", { className: "mt-2 text-sm font-medium text-destructive" }, error),
            h("button", { type: "submit", disabled: loading || !password, className: "mt-5 h-11 w-full rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60" }, loading ? "Verificando..." : "Desbloquear"))));
}
function AuditList() {
    const [table, setTable] = useState("todos");
    const [date, setDate] = useState(todayISO());
    const [allDays, setAllDays] = useState(false);
    const logs = useQuery({
        queryKey: ["audit", allDays ? "todos" : date],
        queryFn: () => fetchAuditLogs(400, allDays ? undefined : date),
    });
    const rows = useMemo(() => (logs.data ?? []).filter((l) => table === "todos" || l.table_name === table), [logs.data, table]);
    return (h("div", { className: "space-y-5" },
        h("div", { className: "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between" },
            h("div", { className: "flex min-w-0 items-center gap-3" },
                h(ShieldCheck, { className: "size-6 shrink-0 text-primary" }),
                h("div", { className: "min-w-0" },
                    h("h1", { className: "font-display text-2xl font-bold" }, "Hist\u00F3rico de altera\u00E7\u00F5es"),
                    h("p", { className: "text-sm text-muted-foreground" }, "Todo lan\u00E7amento criado, alterado ou exclu\u00EDdo fica registrado com data e hora."))),
            h("div", { className: "flex shrink-0 items-center gap-2" },
                h("input", { type: "date", value: date, disabled: allDays, onChange: (e) => setDate(e.target.value || todayISO()), className: `${input} w-auto disabled:opacity-50` }),
                h("button", { onClick: () => setAllDays((v) => !v), className: `h-11 shrink-0 rounded-lg px-3 text-sm font-semibold transition-colors ${allDays
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground hover:bg-secondary"}` }, "Todos os dias"))),
        h("div", { className: "flex flex-wrap gap-2" }, [["todos", "Tudo"], ...Object.entries(TABLES)].map(([key, text]) => (h("button", { key: key, onClick: () => setTable(key ?? "todos"), className: `h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${table === key
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-secondary"}` }, text)))),
        logs.isLoading && h("p", { className: "text-sm text-muted-foreground" }, "Carregando hist\u00F3rico..."),
        !logs.isLoading && rows.length === 0 && (h("p", { className: `${card} text-center text-sm text-muted-foreground` },
            "Nenhuma altera\u00E7\u00E3o registrada ",
            allDays ? "" : "neste dia",
            ".")),
        h("ul", { className: "space-y-3" }, rows.map((log) => (h(LogItem, { key: log.id, log: log }))))));
}
function LogItem({ log }) {
    const action = ACTIONS[log.action] ?? { text: log.action, className: "bg-secondary" };
    const when = new Date(log.created_at).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
    const changes = useMemo(() => {
        const oldD = log.old_data ?? {};
        const newD = log.new_data ?? {};
        const keys = [...new Set([...Object.keys(oldD), ...Object.keys(newD)])].filter((k) => !HIDDEN.has(k));
        if (log.action === "UPDATE") {
            return keys
                .filter((k) => String(oldD[k] ?? "") !== String(newD[k] ?? ""))
                .map((k) => ({ field: k, before: oldD[k], after: newD[k] }));
        }
        const data = log.action === "DELETE" ? oldD : newD;
        return keys
            .filter((k) => {
            const v = data[k];
            return v !== null && v !== undefined && v !== "" && v !== 0 && v !== "0";
        })
            .map((k) => ({ field: k, before: undefined, after: data[k] }));
    }, [log]);
    return (h("li", { className: card },
        h("div", { className: "flex flex-wrap items-center gap-3" },
            h("span", { className: `rounded-md px-2 py-0.5 text-xs font-bold ${action.className}` }, action.text),
            h("span", { className: "font-semibold" }, TABLES[log.table_name] ?? log.table_name),
            h("span", { className: "ml-auto text-sm text-muted-foreground" }, when)),
        h("div", { className: "mt-3 overflow-x-auto" },
            h("table", { className: "w-full min-w-[420px] text-sm" },
                h("tbody", null,
                    changes.map((c) => (h("tr", { key: c.field, className: "border-b border-border/50 last:border-0" },
                        h("td", { className: "w-48 py-1.5 text-muted-foreground" }, FIELDS[c.field] ?? c.field),
                        log.action === "UPDATE" ? (h("td", { className: "py-1.5" },
                            h("span", { className: "text-muted-foreground line-through" }, show(c.field, c.before)),
                            h("span", { className: "mx-2" }, "\u2192"),
                            h("span", { className: "font-semibold" }, show(c.field, c.after)))) : (h("td", { className: "py-1.5 font-medium" }, show(c.field, c.after)))))),
                    changes.length === 0 && (h("tr", null,
                        h("td", { className: "py-1.5 text-muted-foreground" }, "Sem campos alterados."))))))));
}

return { component: AuditoriaPage };
})();

mountPage(audit.component);
