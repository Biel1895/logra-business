const stats=(()=>{const {fetchSales,fetchExpenses,fetchMovements,fetchClosing,fetchAuditLogs,paymentTotal,sum,brl,brlCompact,parseMoney,todayISO,isoToDate,addDays,formatDayLong,formatDayShort,PERIODS,periodRange,previousRange,eachDay}=Object.assign({},db,format,period);
const card = "rounded-2xl border border-border bg-card p-5 shadow-panel";
const label = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
function useRangeData(start, end, key) {
    const sales = useQuery({ queryKey: ["sales", key, start, end], queryFn: () => fetchSales(start, end) });
    const expenses = useQuery({
        queryKey: ["expenses", key, start, end],
        queryFn: () => fetchExpenses(start, end),
    });
    return { sales: sales.data ?? [], expenses: expenses.data ?? [], loading: sales.isLoading };
}
function EstatisticasPage() {
    const [period, setPeriod] = useState("week");
    const today = todayISO();
    const current = periodRange(period, today);
    const previous = previousRange(period, today);
    const cur = useRangeData(current.start, current.end, "cur");
    const prev = useRangeData(previous.start, previous.end, "prev");
    const curVendas = sum(cur.sales, (s) => s.total);
    const curSaidas = sum(cur.expenses, (e) => e.amount);
    const prevVendas = sum(prev.sales, (s) => s.total);
    const prevSaidas = sum(prev.expenses, (e) => e.amount);
    const series = useMemo(() => eachDay(current.start, current.end).map((day) => ({
        day: formatDayShort(day),
        vendas: sum(cur.sales.filter((s) => s.sale_date === day), (s) => s.total),
        saidas: sum(cur.expenses.filter((e) => e.expense_date === day), (e) => e.amount),
        qtd: cur.sales.filter((s) => s.sale_date === day).length,
    })), [cur.sales, cur.expenses, current.start, current.end]);
    const methods = useMemo(() => {
        const m = [
            { name: "Dinheiro", value: sum(cur.sales, (s) => s.cash) },
            { name: "PIX", value: sum(cur.sales, (s) => s.pix) },
            { name: "Débito", value: sum(cur.sales, (s) => s.debit) },
            { name: "Crédito", value: sum(cur.sales, (s) => s.credit) },
            { name: "Troca", value: sum(cur.sales, (s) => s.trade_in) },
            { name: "Financeiras", value: sum(cur.sales, (s) => s.payjoy + s.other_finance) },
        ];
        return m.filter((x) => x.value > 0);
    }, [cur.sales]);
    const colors = [
        "var(--chart-1)",
        "var(--chart-2)",
        "var(--chart-3)",
        "var(--chart-4)",
        "var(--chart-5)",
        "var(--muted-foreground)",
    ];
    const byKind = useMemo(() => {
        const kinds = [
            { key: "PRODUTO", name: "Produtos" },
            { key: "SERVICO", name: "Serviços" },
        ];
        return kinds.map((k) => {
            const rows = cur.sales.filter((s) => (s.kind ?? "PRODUTO") === k.key);
            return { name: k.name, count: rows.length, value: sum(rows, (s) => s.total) };
        });
    }, [cur.sales]);
    const ticket = cur.sales.length ? curVendas / cur.sales.length : 0;
    return (h("div", { className: "space-y-6" },
        h("div", null,
            h("h1", { className: "font-display text-2xl font-bold" }, "Estat\u00EDsticas"),
            h("p", { className: "text-sm text-muted-foreground" },
                formatDayShort(current.start),
                " a ",
                formatDayShort(current.end),
                " \u00B7 comparado com o per\u00EDodo anterior")),
        h("div", { className: "flex flex-wrap gap-2" }, PERIODS.map((p) => (h("button", { key: p.key, onClick: () => setPeriod(p.key), className: `h-10 rounded-lg px-4 text-sm font-semibold transition-colors ${period === p.key
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-secondary"}` }, p.label)))),
        h("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4" },
            h(Kpi, { title: "Vendas", value: brl(curVendas), delta: delta(curVendas, prevVendas), good: true }),
            h(Kpi, { title: "Sa\u00EDdas", value: brl(curSaidas), delta: delta(curSaidas, prevSaidas) }),
            h(Kpi, { title: "Resultado", value: brl(curVendas - curSaidas), delta: delta(curVendas - curSaidas, prevVendas - prevSaidas), good: true }),
            h(Kpi, { title: "Ticket m\u00E9dio", value: brl(ticket), sub: `${cur.sales.length} vendas` })),
        h("section", { className: card },
            h("h2", { className: "font-display text-lg font-semibold" }, "Vendas e sa\u00EDdas por dia"),
            h("div", { className: "mt-4 h-80" },
                h(ResponsiveContainer, { width: "100%", height: "100%" },
                    h(BarChart, { data: series, margin: { top: 24 } },
                        h(CartesianGrid, { strokeDasharray: "3 3", stroke: "var(--border)", vertical: false }),
                        h(XAxis, { dataKey: "day", tick: { fontSize: 12 }, stroke: "var(--muted-foreground)" }),
                        h(YAxis, { tickFormatter: (v) => brlCompact(Number(v)), tick: { fontSize: 12 }, stroke: "var(--muted-foreground)", width: 70 }),
                        h(Legend, null),
                        h(Bar, { dataKey: "vendas", name: "Vendas", fill: "var(--chart-1)", radius: [4, 4, 0, 0] },
                            h(LabelList, { dataKey: "vendas", position: "top", fontSize: 11, formatter: (v) => (v ? brlCompact(v) : "") })),
                        h(Bar, { dataKey: "saidas", name: "Sa\u00EDdas", fill: "var(--chart-3)", radius: [4, 4, 0, 0] },
                            h(LabelList, { dataKey: "saidas", position: "top", fontSize: 11, formatter: (v) => (v ? brlCompact(v) : "") }))))),
            h("div", { className: "mt-5 overflow-x-auto" },
                h("table", { className: "w-full min-w-[520px] text-sm" },
                    h("thead", null,
                        h("tr", { className: "border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground" },
                            h("th", { className: "py-2" }, "Dia"),
                            h("th", { className: "py-2 text-right" }, "Vendas"),
                            h("th", { className: "py-2 text-right" }, "Sa\u00EDdas"),
                            h("th", { className: "py-2 text-right" }, "Resultado"),
                            h("th", { className: "py-2 text-right" }, "N\u00BA de vendas"))),
                    h("tbody", null,
                        series.map((row) => (h("tr", { key: row.day, className: "border-b border-border/60" },
                            h("td", { className: "py-2" }, row.day),
                            h("td", { className: "py-2 text-right text-positive" }, brl(row.vendas)),
                            h("td", { className: "py-2 text-right text-destructive" }, brl(row.saidas)),
                            h("td", { className: "py-2 text-right font-semibold" }, brl(row.vendas - row.saidas)),
                            h("td", { className: "py-2 text-right" }, row.qtd)))),
                        h("tr", { className: "font-semibold" },
                            h("td", { className: "py-2" }, "Total"),
                            h("td", { className: "py-2 text-right" }, brl(curVendas)),
                            h("td", { className: "py-2 text-right" }, brl(curSaidas)),
                            h("td", { className: "py-2 text-right" }, brl(curVendas - curSaidas)),
                            h("td", { className: "py-2 text-right" }, cur.sales.length)))))),
        h("section", { className: card },
            h("h2", { className: "font-display text-lg font-semibold" }, "Formas de recebimento"),
            methods.length === 0 ? (h("p", { className: "py-10 text-center text-sm text-muted-foreground" }, "Sem vendas registradas neste per\u00EDodo.")) : (h(Fragment, null,
                h("div", { className: "mt-4 h-80" },
                    h(ResponsiveContainer, { width: "100%", height: "100%" },
                        h(PieChart, null,
                            h(Pie, { data: methods, dataKey: "value", nameKey: "name", innerRadius: 55, outerRadius: 95, labelLine: true, label: (e) => `${e.name}: ${brl(Number(e.value ?? 0))}` }, methods.map((_, i) => (h(Cell, { key: i, fill: colors[i % colors.length] })))),
                            h(Legend, null)))),
                h("div", { className: "mt-4 overflow-x-auto" },
                    h("table", { className: "w-full min-w-[360px] text-sm" },
                        h("thead", null,
                            h("tr", { className: "border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground" },
                                h("th", { className: "py-2" }, "Forma"),
                                h("th", { className: "py-2 text-right" }, "Valor"),
                                h("th", { className: "py-2 text-right" }, "% do total"))),
                        h("tbody", null, methods.map((m) => (h("tr", { key: m.name, className: "border-b border-border/60" },
                            h("td", { className: "py-2" }, m.name),
                            h("td", { className: "py-2 text-right" }, brl(m.value)),
                            h("td", { className: "py-2 text-right" },
                                curVendas ? ((m.value / curVendas) * 100).toFixed(1) : "0.0",
                                "%")))))))))),
        h("section", { className: card },
            h("h2", { className: "font-display text-lg font-semibold" }, "Produtos x servi\u00E7os"),
            h("div", { className: "mt-4 overflow-x-auto" },
                h("table", { className: "w-full min-w-[360px] text-sm" },
                    h("thead", null,
                        h("tr", { className: "border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground" },
                            h("th", { className: "py-2" }, "Tipo"),
                            h("th", { className: "py-2 text-right" }, "N\u00BA de vendas"),
                            h("th", { className: "py-2 text-right" }, "Valor"),
                            h("th", { className: "py-2 text-right" }, "Ticket m\u00E9dio"))),
                    h("tbody", null, byKind.map((k) => (h("tr", { key: k.name, className: "border-b border-border/60" },
                        h("td", { className: "py-2" }, k.name),
                        h("td", { className: "py-2 text-right" }, k.count),
                        h("td", { className: "py-2 text-right" }, brl(k.value)),
                        h("td", { className: "py-2 text-right" }, brl(k.count ? k.value / k.count : 0))))))))),
        h("section", { className: card },
            h("h2", { className: "font-display text-lg font-semibold" }, "Sa\u00EDdas do per\u00EDodo"),
            h("div", { className: "mt-4 overflow-x-auto" },
                h("table", { className: "w-full min-w-[420px] text-sm" },
                    h("thead", null,
                        h("tr", { className: "border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground" },
                            h("th", { className: "py-2" }, "Data"),
                            h("th", { className: "py-2" }, "Descri\u00E7\u00E3o"),
                            h("th", { className: "py-2" }, "Forma"),
                            h("th", { className: "py-2 text-right" }, "Valor"))),
                    h("tbody", null,
                        cur.expenses.map((e) => (h("tr", { key: e.id, className: "border-b border-border/60" },
                            h("td", { className: "py-2" }, formatDayShort(e.expense_date)),
                            h("td", { className: "py-2" }, e.description || "—"),
                            h("td", { className: "py-2" }, e.payment_method),
                            h("td", { className: "py-2 text-right text-destructive" }, brl(e.amount))))),
                        cur.expenses.length === 0 && (h("tr", null,
                            h("td", { colSpan: 4, className: "py-6 text-center text-muted-foreground" }, "Nenhuma sa\u00EDda no per\u00EDodo.")))))))));
}
function delta(now, before) {
    if (!before)
        return now > 0 ? 100 : 0;
    return ((now - before) / Math.abs(before)) * 100;
}
function Kpi({ title, value, delta: d, sub, good, }) {
    const up = (d ?? 0) >= 0;
    const positive = good ? up : !up;
    return (h("div", { className: card },
        h("p", { className: label }, title),
        h("p", { className: "mt-2 font-display text-2xl font-bold" }, value),
        d !== undefined && (h("p", { className: `mt-1 text-xs font-semibold ${positive ? "text-positive" : "text-negative"}` },
            up ? "+" : "",
            d.toFixed(1),
            "% vs. per\u00EDodo anterior")),
        sub && h("p", { className: "mt-1 text-xs text-muted-foreground" }, sub)));
}

return { component: EstatisticasPage };
})();

mountPage(stats.component);
