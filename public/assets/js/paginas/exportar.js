const exporter=(()=>{const {fetchSales,fetchExpenses,fetchMovements,fetchClosings,sum,brl,todayISO,addDays,formatDayLong,eachDay}=Object.assign({},db,format,period);
const card = "rounded-2xl border border-border bg-card p-5 shadow-panel";
const input = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20";
const labelCls = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const money = (v) => (Math.abs(v) < 0.005 ? "" : Number(v.toFixed(2)));
function dayRows(day, sales, expenses, movements, closing) {
    const rows = [];
    rows.push([`Caixa do dia — ${formatDayLong(day)}`]);
    rows.push([]);
    rows.push(["VENDAS"]);
    rows.push([
        "Tipo",
        "Produto / serviço",
        "Total",
        "Dinheiro",
        "PIX",
        "Débito",
        "Crédito",
        "Parcelas",
        "Troca (valor)",
        "Aparelho da troca",
        "PayJoy",
        "Outras financeiras",
        "Observação",
        "Peças do serviço",
        "Valor pendente",
    ]);
    if (sales.length === 0)
        rows.push(["Nenhuma venda lançada."]);
    for (const s of sales) {
        rows.push([
            s.kind === "SERVICO" ? "Serviço" : "Produto",
            s.product ?? "",
            money(s.total),
            money(s.cash),
            money(s.pix),
            money(s.debit),
            money(s.credit),
            s.installments || "",
            money(s.trade_in),
            s.trade_in_details ?? "",
            money(s.payjoy),
            money(s.other_finance),
            s.note ?? "",
            s.service_parts ?? "",
            money(s.pending_amount ?? 0),
        ]);
    }
    rows.push([
        "TOTAIS",
        "",
        money(sum(sales, (s) => s.total)),
        money(sum(sales, (s) => s.cash)),
        money(sum(sales, (s) => s.pix)),
        money(sum(sales, (s) => s.debit)),
        money(sum(sales, (s) => s.credit)),
        "",
        money(sum(sales, (s) => s.trade_in)),
        "",
        money(sum(sales, (s) => s.payjoy)),
        money(sum(sales, (s) => s.other_finance)),
        "",
        "",
        money(sum(sales, (s) => s.pending_amount ?? 0)),
    ]);
    rows.push([]);
    rows.push(["SAÍDAS / DESPESAS"]);
    rows.push(["Descrição", "Forma de pagamento", "Valor", "Observação"]);
    if (expenses.length === 0)
        rows.push(["Nenhuma saída lançada."]);
    for (const e of expenses) {
        rows.push([e.description ?? "", e.payment_method ?? "", money(e.amount), e.note ?? ""]);
    }
    rows.push(["TOTAL", "", money(sum(expenses, (e) => e.amount)), ""]);
    rows.push([]);
    rows.push(["DEPÓSITOS / RETIRADAS"]);
    rows.push(["Valor", "Observação"]);
    if (movements.length === 0)
        rows.push(["Nenhuma movimentação."]);
    for (const m of movements)
        rows.push([money(m.amount), m.note ?? ""]);
    rows.push(["TOTAL", money(sum(movements, (m) => m.amount))]);
    rows.push([]);
    const dinheiro = sum(sales, (s) => s.cash);
    const saidasDinheiro = sum(expenses.filter((e) => (e.payment_method ?? "").toLowerCase().includes("dinheiro")), (e) => e.amount);
    const retiradas = sum(movements, (m) => m.amount);
    const abertura = closing?.opening_balance ?? 0;
    const contado = closing?.counted_cash ?? 0;
    const teorico = abertura + dinheiro - saidasDinheiro - retiradas;
    rows.push(["FECHAMENTO DO CAIXA"]);
    rows.push(["Saldo inicial", money(abertura)]);
    rows.push(["Entradas em dinheiro", money(dinheiro)]);
    rows.push(["Saídas em dinheiro", money(saidasDinheiro)]);
    rows.push(["Depósitos / retiradas", money(retiradas)]);
    rows.push(["Saldo à vista", Number(teorico.toFixed(2))]);
    rows.push(["Dinheiro contado", money(contado)]);
    rows.push(["Diferença", Number((contado - teorico).toFixed(2))]);
    rows.push(["Responsável", closing?.responsible ?? ""]);
    rows.push(["Observação do fechamento", closing?.note ?? ""]);
    rows.push([]);
    const totalVendas = sum(sales, (s) => s.total);
    const totalSaidas = sum(expenses, (e) => e.amount);
    rows.push(["RESUMO DO DIA"]);
    rows.push(["Vendas", Number(totalVendas.toFixed(2))]);
    rows.push(["Saídas", Number(totalSaidas.toFixed(2))]);
    rows.push(["Resultado", Number((totalVendas - totalSaidas).toFixed(2))]);
    return { rows, totalVendas, totalSaidas, teorico, contado };
}
function ExportarPage() {
    const [start, setStart] = useState(addDays(todayISO(), -6));
    const [end, setEnd] = useState(todayISO());
    const [onlyWithData, setOnlyWithData] = useState(true);
    const [busy, setBusy] = useState(false);
    const days = start <= end ? eachDay(start, end) : [];
    async function exportar() {
        if (days.length === 0) {
            toast.error("Escolha um período válido.");
            return;
        }
        if (days.length > 92) {
            toast.error("Escolha no máximo 92 dias.");
            return;
        }
        setBusy(true);
        try {
            const [sales, expenses, movements, closings] = await Promise.all([
                fetchSales(start, end),
                fetchExpenses(start, end),
                fetchMovements(start, end),
                fetchClosings(start, end),
            ]);
            const wb = XLSX.utils.book_new();
            const resumo = [
                ["Resumo do período", `${formatDayLong(start)} até ${formatDayLong(end)}`],
                [],
                ["Dia", "Vendas", "Saídas", "Resultado", "Saldo à vista", "Dinheiro contado", "Diferença"],
            ];
            let exported = 0;
            for (const day of days) {
                const s = sales.filter((r) => r.sale_date === day);
                const e = expenses.filter((r) => r.expense_date === day);
                const m = movements.filter((r) => r.movement_date === day);
                const c = closings.find((r) => r.closing_date === day);
                const empty = s.length === 0 && e.length === 0 && m.length === 0 && !c;
                if (empty && onlyWithData)
                    continue;
                const { rows, totalVendas, totalSaidas, teorico, contado } = dayRows(day, s, e, m, c);
                const ws = XLSX.utils.aoa_to_sheet(rows);
                ws["!cols"] = [
                    { wch: 24 },
                    { wch: 32 },
                    { wch: 14 },
                    { wch: 14 },
                    { wch: 14 },
                    { wch: 14 },
                    { wch: 14 },
                    { wch: 10 },
                    { wch: 14 },
                    { wch: 22 },
                    { wch: 14 },
                    { wch: 18 },
                    { wch: 30 },
                    { wch: 34 },
                    { wch: 16 },
                ];
                XLSX.utils.book_append_sheet(wb, ws, day.split("-").reverse().join("-"));
                exported++;
                resumo.push([
                    day.split("-").reverse().join("/"),
                    Number(totalVendas.toFixed(2)),
                    Number(totalSaidas.toFixed(2)),
                    Number((totalVendas - totalSaidas).toFixed(2)),
                    Number(teorico.toFixed(2)),
                    Number(contado.toFixed(2)),
                    Number((contado - teorico).toFixed(2)),
                ]);
            }
            if (exported === 0) {
                toast.error("Nenhum dia com lançamentos no período escolhido.");
                return;
            }
            const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
            wsResumo["!cols"] = Array.from({ length: 7 }, () => ({ wch: 18 }));
            XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");
            wb.SheetNames = ["Resumo", ...wb.SheetNames.filter((n) => n !== "Resumo")];
            XLSX.writeFile(wb, `caixa_${start}_a_${end}.xlsx`);
            toast.success(`Planilha gerada com ${exported} dia(s).`);
        }
        catch (err) {
            toast.error(err.message);
        }
        finally {
            setBusy(false);
        }
    }
    return (h("div", { className: "space-y-6" },
        h("div", null,
            h("h1", { className: "font-display text-2xl font-bold" }, "Exportar planilha"),
            h("p", { className: "text-sm text-muted-foreground" },
                "Escolha os dias e baixe um arquivo com ",
                h("strong", null, "uma p\u00E1gina para cada dia"),
                ", tudo detalhado. \u00C9 s\u00F3 abrir no Google Sheets (Arquivo \u2192 Importar) ou no Excel.")),
        h("section", { className: card },
            h("div", { className: "grid gap-3 sm:grid-cols-2" },
                h("div", { className: "space-y-1.5" },
                    h("span", { className: labelCls }, "Data inicial"),
                    h("input", { type: "date", className: input, value: start, onChange: (e) => setStart(e.target.value) })),
                h("div", { className: "space-y-1.5" },
                    h("span", { className: labelCls }, "Data final"),
                    h("input", { type: "date", className: input, value: end, onChange: (e) => setEnd(e.target.value) }))),
            h("div", { className: "mt-4 flex flex-wrap gap-2" }, [
                { label: "Hoje", s: todayISO(), e: todayISO() },
                { label: "Últimos 7 dias", s: addDays(todayISO(), -6), e: todayISO() },
                { label: "Últimos 15 dias", s: addDays(todayISO(), -14), e: todayISO() },
                { label: "Últimos 30 dias", s: addDays(todayISO(), -29), e: todayISO() },
            ].map((p) => (h("button", { key: p.label, onClick: () => {
                    setStart(p.s);
                    setEnd(p.e);
                }, className: "rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" }, p.label)))),
            h("label", { className: "mt-4 flex items-center gap-2 text-sm text-muted-foreground" },
                h("input", { type: "checkbox", className: "size-4 accent-primary", checked: onlyWithData, onChange: (e) => setOnlyWithData(e.target.checked) }),
                "Ignorar dias sem nenhum lan\u00E7amento"),
            h("div", { className: "mt-5 flex flex-wrap items-center gap-3" },
                h("button", { onClick: exportar, disabled: busy, className: "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60" },
                    h(Download, { className: "size-4" }),
                    busy ? "Gerando..." : "Exportar planilha"),
                h("span", { className: "text-sm text-muted-foreground" }, days.length > 0 ? `${days.length} dia(s) selecionado(s)` : "Período inválido"))),
        h("section", { className: `${card} flex gap-3` },
            h(FileSpreadsheet, { className: "mt-0.5 size-5 shrink-0 text-primary" }),
            h("div", { className: "text-sm text-muted-foreground" },
                h("p", { className: "font-medium text-foreground" }, "Como abrir no Google Sheets"),
                h("p", null,
                    "No Google Sheets, clique em ",
                    h("strong", null, "Arquivo \u2192 Importar \u2192 Fazer upload"),
                    " e selecione o arquivo baixado. Cada dia vira uma aba separada, com vendas, sa\u00EDdas, retiradas, fechamento e resumo. Valores em reais (",
                    brl(0),
                    " aparece em branco quando n\u00E3o houver aquela forma de pagamento).")))));
}

return { component: ExportarPage };
})();

mountPage(exporter.component);
