const cash=(()=>{const {fetchSales,fetchExpenses,fetchMovements,fetchClosing,fetchAuditLogs,paymentTotal,sum,brl,brlCompact,parseMoney,todayISO,isoToDate,addDays,formatDayLong,formatDayShort,MoneyInput}=Object.assign({},db,format,money);
const card = "rounded-2xl border border-border bg-card p-5 shadow-panel";
const input = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20";
const label = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const emptySale = {
    kind: "PRODUTO",
    product: "",
    cash: 0,
    pix: 0,
    debit: 0,
    credit: 0,
    installments: 0,
    trade_in: 0,
    trade_in_details: "",
    payjoy: 0,
    other_finance: 0,
    note: "",
};
const salePayments = [
    ["cash", "À vista"], ["pix", "PIX"], ["debit", "Débito"],
    ["credit", "Crédito"], ["trade_in", "Troca de aparelho"],
    ["payjoy", "PayJoy"], ["other_finance", "Outras financeiras"],
];
const serviceAccessoryMessage = "Lance acessórios em Vendas do dia. Nesta seção, registre apenas a manutenção.";
function hasServiceAccessory(text) {
    return text.split(/[+;\n]/).some((item) => {
        const normalized = item.trim().normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
        return /^(?:(?:venda de|vendi)\s+)?(?:\d+\s*(?:x\s*)?)?(?:capas?|capinhas?|cases?|peliculas?|hidrogel|carregadores?|fones?(?: de ouvido)?|cabos? (?:usb|lightning|de carregamento))\b/.test(normalized);
    });
}
function salePaymentAmount(sale, key) {
    const amount = brl(sale[key] ?? 0);
    return key === "credit" && sale.installments > 0 ? amount + " · " + sale.installments + "x" : amount;
}
function SaleFields({ sale, setSale, recognized }) {
    const show = (key) => !recognized || Boolean(recognized[key]);
    const field = (key, title, full, control) => h("div", { className: full ? "cash-field cash-field-wide" : "cash-field" },
        h("label", { htmlFor: "sale-" + key }, title), control);
    const text = (key, title, placeholder) => field(key, title, true, h("input", {
        id: "sale-" + key, className: input, value: sale[key], placeholder,
        onChange: (event) => setSale({ ...sale, [key]: event.target.value }),
    }));
    const money = (key, title) => field(key, title, false,
        h(MoneyInput, { id: "sale-" + key, value: sale[key], onChange: (amount) => setSale({ ...sale, [key]: amount }) }));
    return h("div", { className: "cash-field-grid" },
        text("product", sale.kind === "SERVICO" ? "Manutenção" : "Produto", "Ex.: iPhone 14 128GB preto"),
        sale.kind === "SERVICO" && show("service_parts") && field("service_parts", "Peças", true,
            h("textarea", { id: "sale-service_parts", className: "cash-service-input", rows: 3, value: sale.service_parts || "",
                onInput: (event) => setSale({ ...sale, service_parts: event.target.value }) })),
        salePayments.filter(([key]) => key !== "trade_in" && show(key)).map(([key, title]) => {
            if (key !== "credit" || !show("installments")) return money(key, title);
            return field(key, title, false, h("div", { className: "cash-credit-pair" },
                h(MoneyInput, { id: "sale-credit", value: sale.credit, onChange: (amount) => setSale({ ...sale, credit: amount }) }),
                h("div", { className: "cash-credit-count" },
                    h("input", { id: "sale-installments", className: input, inputMode: "numeric", type: "number", min: 0,
                        step: 1, value: sale.installments || "", placeholder: "1", "aria-label": "Quantidade de parcelas no crédito",
                        onChange: (event) => setSale({ ...sale, installments: Number(event.target.value) }) }),
                    h("span", { "aria-hidden": "true" }, "x"))));
        }),
        (show("trade_in_details") || show("trade_in")) && h("div", { className: "cash-trade-pair cash-field-wide" },
            show("trade_in_details") && text("trade_in_details", "Aparelho recebido na troca", "Ex.: Galaxy A34 128GB"),
            show("trade_in") && money("trade_in", "Valor do aparelho")),
        (sale.kind === "PRODUTO" || show("note")) && text("note", "Observação", "Ex.: Parcelex a receber"));
}
function SaleDetails({ record }) {
    const pairs = [
        ["Data da venda", formatDayLong(record.sale_date)],
        record.kind && ["Tipo", record.kind === "SERVICO" ? "Serviço" : "Produto"],
        ...salePayments.filter(([key]) => key !== "trade_in" && record[key] > 0).map(([key, title]) => [title, salePaymentAmount(record, key)]),
    ];
    const detail = (title, value) => h("div", { key: title }, h("dt", null, title), h("dd", null, value));
    return h("div", null,
        h("p", { className: "cash-detail-product" }, record.product || "Venda sem descrição"),
        h("dl", { className: "cash-detail-grid" },
            pairs.filter(Boolean).map(([title, value]) => detail(title, value)),
            record.service_parts?.trim() && h("div", { className: "cash-field-wide cash-service-parts" },
                h("dt", null, "Peças"), h("dd", null, record.service_parts)),
            (record.trade_in_details?.trim() || record.trade_in > 0) && h("div", { className: "cash-trade-pair cash-field-wide" },
                record.trade_in_details?.trim() && detail("Aparelho recebido na troca", record.trade_in_details),
                record.trade_in > 0 && detail("Valor do aparelho", brl(record.trade_in))),
            record.note?.trim() && h("div", { className: "cash-field-wide" },
                h("dt", null, "Observação"), h("dd", null, record.note))));
}
const emptyExpense = { description: "", payment_method: "Dinheiro", amount: 0, note: "" };
const emptyMovement = { amount: 0, note: "" };
function CaixaPage() {
    const qc = useQueryClient();
    const [date, setDate] = useState(todayISO());
    const sales = useQuery({ queryKey: ["sales", date], queryFn: () => fetchSales(date, date) });
    const expenses = useQuery({ queryKey: ["expenses", date], queryFn: () => fetchExpenses(date, date) });
    const movements = useQuery({ queryKey: ["movements", date], queryFn: () => fetchMovements(date, date) });
    const closing = useQuery({ queryKey: ["closing", date], queryFn: () => fetchClosing(date) });
    const [sale, setSale] = useState({ ...emptySale });
    const [saleText, setSaleText] = useState("");
    const [saleTextError, setSaleTextError] = useState("");
    const [serviceText, setServiceText] = useState("");
    const [serviceParts, setServiceParts] = useState("");
    const [serviceTextError, setServiceTextError] = useState("");
    const [saleChatStatus, setSaleChatStatus] = useState("");
    const [saleModal, setSaleModal] = useState(null);
    const [saleFormError, setSaleFormError] = useState("");
    const editingSale = saleModal?.mode === "edit" ? saleModal.record.id : null;
    useEffect(() => {
        const dialog = document.getElementById("cash-sale-dialog");
        if (dialog && !dialog.open) dialog.showModal();
    }, [saleModal]);
    const [expense, setExpense] = useState({ ...emptyExpense });
    const [editingExpense, setEditingExpense] = useState(null);
    const [movement, setMovement] = useState({ ...emptyMovement });
    const [editingMovement, setEditingMovement] = useState(null);
    const [paymentFilters, setPaymentFilters] = useState([]);
    const [saleFiltersOpen, setSaleFiltersOpen] = useState(false);
    const activeSaleFilters = paymentFilters.length;
    const [opening, setOpening] = useState(null);
    const [counted, setCounted] = useState(null);
    const [editingOpening, setEditingOpening] = useState(false);
    const refresh = () => {
        qc.invalidateQueries({ queryKey: ["sales"] });
        qc.invalidateQueries({ queryKey: ["expenses"] });
        qc.invalidateQueries({ queryKey: ["movements"] });
        qc.invalidateQueries({ queryKey: ["closing"] });
        qc.invalidateQueries({ queryKey: ["audit"] });
    };
    const userId = async () => {
        const { data } = await cashStore.auth.getSession();
        if (!data.session) throw new Error("Entre novamente para salvar.");
        return data.session.user.id;
    };
    function showSaleModal(mode, record = null) {
        setSaleFormError("");
        setSaleModal({ mode, record });
    }
    function closeSaleModal() {
        document.getElementById("cash-sale-dialog")?.close();
        setSaleModal(null);
    }
    function fillSale(fields, kind, parts) {
        fields = { ...fields, kind, ...(kind === "SERVICO" ? { service_parts: parts } : {}) };
        setSale({ ...emptySale, ...fields });
        showSaleModal("review", fields);
    }
    const interpretAI = useMutation({
        mutationFn: async ({ text, kind, parts, setError }) => {
            const { data } = await cashStore.auth.getSession();
            if (!data.session) throw new Error("Entre novamente para usar a IA.");
            const response = await fetch("/api/interpretar-venda", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + data.session.access_token },
                body: JSON.stringify({ text }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                setError((previous) => previous + " " + (result.error || "A IA está indisponível. Use o formato do exemplo ou lance manualmente."));
                return;
            }
            fillSale(result, kind, parts);
            setError("");
        },
        onError: (error) => toast.error(error.message || "A IA está indisponível."),
    });
    function reviewSale(text, kind = "PRODUTO", parts = "") {
        const setError = kind === "SERVICO" ? setServiceTextError : setSaleTextError;
        if (kind === "SERVICO" && (hasServiceAccessory(text.split("=")[0]) || hasServiceAccessory(parts))) {
            setError(serviceAccessoryMessage);
            return;
        }
        try {
            fillSale(interpretSale(text), kind, parts);
            setError("");
        } catch (error) {
            setError(error.message);
            interpretAI.mutate({ text, kind, parts, setError });
        }
    }
    const saveSale = useMutation({
        mutationFn: async () => {
            if (sale.kind === "SERVICO") {
                const previous = editingSale ? saleModal.record : {};
                const hasNewAccessory = ["product", "service_parts"].some((key) => {
                    const value = sale[key] ?? "";
                    return value !== (previous[key] ?? "") && hasServiceAccessory(value);
                });
                if (hasNewAccessory) throw new Error(serviceAccessoryMessage);
            }
            const total = Math.round(paymentTotal(sale) * 100) / 100;
            if (salePayments.some(([key]) => !Number.isFinite(sale[key]) || sale[key] < 0)) {
                throw new Error("Confira os valores dos pagamentos.");
            }
            if (!Number.isSafeInteger(sale.installments) || sale.installments < 0 || (sale.installments && sale.credit <= 0)) {
                throw new Error("Informe as parcelas junto com um valor no crédito.");
            }
            if (!sale.product.trim() || !Number.isFinite(total) || total <= 0) {
                throw new Error("Preencha o produto ou serviço e um valor de venda positivo.");
            }
            if (editingSale) {
                const { error } = await cashStore
                    .from("sales")
                    .update({ ...sale, total, sale_date: date })
                    .eq("id", editingSale);
                if (error)
                    throw error;
            }
            else {
                const { error } = await cashStore
                    .from("sales")
                    .insert({ ...sale, total, sale_date: date, user_id: await userId() });
                if (error)
                    throw error;
            }
        },
        onSuccess: () => {
            const editing = Boolean(editingSale);
            const service = sale.kind === "SERVICO";
            if (!editing && service) {
                setServiceText("");
                setServiceParts("");
                setServiceTextError("");
            } else if (!editing) {
                setSaleText("");
                setSaleChatStatus("Venda lançada. Pode enviar a próxima.");
                setSaleTextError("");
            }
            setSale({ ...emptySale });
            closeSaleModal();
            refresh();
            toast.success(service ? (editing ? "Serviço atualizado." : "Serviço lançado.") :
                (editing ? "Venda atualizada." : "Venda lançada."));
        },
        onError: (e) => setSaleFormError(e.message),
    });
    const saveExpense = useMutation({
        mutationFn: async () => {
            if (!expense.description.trim() || expense.amount <= 0) {
                throw new Error("Informe uma descrição e um valor maior que zero.");
            }
            if (editingExpense) {
                const { error } = await cashStore
                    .from("expenses")
                    .update({ ...expense, expense_date: date })
                    .eq("id", editingExpense);
                if (error)
                    throw error;
            }
            else {
                const { error } = await cashStore
                    .from("expenses")
                    .insert({ ...expense, expense_date: date, user_id: await userId() });
                if (error)
                    throw error;
            }
        },
        onSuccess: () => {
            const editing = Boolean(editingExpense);
            setExpense({ ...emptyExpense });
            setEditingExpense(null);
            refresh();
            toast.success(editing ? "Saída atualizada." : "Saída lançada.");
        },
        onError: (e) => toast.error(e.message),
    });
    const saveMovement = useMutation({
        mutationFn: async () => {
            if (movement.amount <= 0) throw new Error("Informe um valor maior que zero.");
            if (editingMovement) {
                const { error } = await cashStore
                    .from("cash_movements")
                    .update({ ...movement, movement_date: date })
                    .eq("id", editingMovement);
                if (error)
                    throw error;
            }
            else {
                const { error } = await cashStore
                    .from("cash_movements")
                    .insert({ ...movement, movement_date: date, user_id: await userId() });
                if (error)
                    throw error;
            }
        },
        onSuccess: () => {
            const editing = Boolean(editingMovement);
            setMovement({ ...emptyMovement });
            setEditingMovement(null);
            refresh();
            toast.success(editing ? "Movimentação atualizada." : "Movimentação registrada.");
        },
        onError: (e) => toast.error(e.message),
    });
    const remove = useMutation({
        mutationFn: async ({ table, id }) => {
            const { error } = await cashStore.from(table).delete().eq("id", id);
            if (error)
                throw error;
            return table;
        },
        onSuccess: (table) => {
            if (table === "sales") closeSaleModal();
            refresh();
            toast.success("Registro removido.");
        },
        onError: (e) => toast.error(e.message),
    });
    const saveClosing = useMutation({
        mutationFn: async () => {
            const { error } = await cashStore.from("day_closings").upsert({
                closing_date: date,
                opening_balance: openingValue,
                counted_cash: countedValue,
                user_id: await userId(),
            }, { onConflict: "user_id,closing_date" });
            if (error)
                throw error;
        },
        onSuccess: () => {
            refresh();
            toast.success("Fechamento salvo.");
        },
        onError: (e) => toast.error(e.message),
    });
    const saveOpening = useMutation({
        mutationFn: async () => {
            const { error } = await cashStore.from("day_closings").upsert({
                closing_date: date,
                opening_balance: openingValue,
                user_id: await userId(),
            }, { onConflict: "user_id,closing_date", defaultToNull: false });
            if (error)
                throw error;
        },
        onSuccess: () => {
            setOpening(null);
            setEditingOpening(false);
            refresh();
            toast.success("Saldo inicial confirmado.");
        },
        onError: (e) => toast.error(e.message),
    });
    const saleRows = sales.data ?? [];
    const expenseRows = expenses.data ?? [];
    const movementRows = movements.data ?? [];
    const visibleSales = saleRows.filter((s) => {
        if (s.kind === "SERVICO")
            return false;
        if (paymentFilters.length === 0)
            return true;
        const map = {
            DINHEIRO: s.cash,
            PIX: s.pix,
            DEBITO: s.debit,
            CREDITO: s.credit,
            TROCA: s.trade_in,
            PAYJOY: s.payjoy,
            OUTRAS_FINANCEIRAS: s.other_finance,
        };
        return paymentFilters.some((key) => map[key] > 0);
    });
    const services = saleRows.filter((record) => record.kind === "SERVICO");
    const openingValue = opening ?? closing.data?.opening_balance ?? 0;
    const countedValue = counted ?? closing.data?.counted_cash ?? 0;
    const openingConfirmed = closing.data != null && !editingOpening;
    function startEditSale(record) {
        const fields = Object.fromEntries(Object.keys(emptySale).map((key) => [key, record[key] ?? emptySale[key]]));
        if (record.kind === "SERVICO") fields.service_parts = record.service_parts ?? "";
        setSale(fields);
        showSaleModal("edit", record);
    }
    function startEditExpense(e) {
        setEditingExpense(e.id);
        setExpense({
            description: e.description ?? "",
            payment_method: e.payment_method ?? "Dinheiro",
            amount: e.amount,
            note: e.note ?? "",
        });
    }
    function startEditMovement(m) {
        setEditingMovement(m.id);
        setMovement({ amount: m.amount, note: m.note ?? "" });
    }
    const totals = useMemo(() => {
        const vendas = sum(saleRows, (s) => s.total);
        const dinheiro = sum(saleRows, (s) => s.cash);
        const pix = sum(saleRows, (s) => s.pix);
        const debito = sum(saleRows, (s) => s.debit);
        const credito = sum(saleRows, (s) => s.credit);
        const financeiras = sum(saleRows, (s) => s.payjoy + s.other_finance);
        const troca = sum(saleRows, (s) => s.trade_in);
        const saidas = sum(expenseRows, (e) => e.amount);
        const saidasDinheiro = sum(expenseRows.filter((e) => (e.payment_method ?? "").toLowerCase().includes("dinheiro")), (e) => e.amount);
        const retiradas = sum(movementRows, (m) => m.amount);
        const teorico = openingValue + dinheiro - saidasDinheiro - retiradas;
        return {
            vendas,
            dinheiro,
            pix,
            debito,
            credito,
            financeiras,
            troca,
            saidas,
            saidasDinheiro,
            retiradas,
            teorico,
            diferenca: countedValue - teorico,
            liquido: vendas - saidas,
        };
    }, [saleRows, expenseRows, movementRows, openingValue, countedValue]);
    const dailyQueries = [sales, expenses, movements, closing];
    const loadFailed = dailyQueries.some((query) => query.error);
    const dailyReady = dailyQueries.every((query) => !query.error && !query.isLoading);
    const balanceBusy = saveOpening.isPending || saveClosing.isPending;
    return {
        controls: {
            saleText, serviceText, serviceParts, saleTextError, serviceTextError, saleChatStatus,
            pending: interpretAI.isPending,
            changeSale(text) { setSaleText(text); setSaleTextError(""); setSaleChatStatus(""); },
            changeService(text) { setServiceText(text); setServiceTextError(""); },
            changeParts(text) { setServiceParts(text); setServiceTextError(""); },
            reviewSale() { if (saleText.trim() && !interpretAI.isPending) reviewSale(saleText); },
            reviewService() { if (serviceText.trim() && !interpretAI.isPending) reviewSale(serviceText, "SERVICO", serviceParts.trim()); },
            manualSale() { setSale({ ...emptySale }); showSaleModal("manual"); },
        },
        overview: h("div", { className: "cash-overview" },
          h("div", { className: "cash-overview-heading" },
            h("h1", null, "Caixa do dia"),
            h("input", { type: "date", value: date, onChange: (e) => {
                    setDate(e.target.value || todayISO());
                    setOpening(null);
                    setCounted(null);
                    setEditingOpening(false);
                    setSaleTextError("");
                    setServiceTextError("");
                    setSaleChatStatus("");
                }, disabled: interpretAI.isPending || balanceBusy, "aria-label": "Data do caixa", className: "cash-overview-date" })),
          loadFailed && h("p", { className: "cash-error", role: "alert" }, "Não foi possível atualizar todos os dados do dia. Confira a conexão antes de fechar o caixa."),
          h("section", { className: "cash-overview-panel", "aria-label": "Resumo do caixa" },
            h("div", { className: "cash-opening" },
                h("h2", { id: "cash-opening-title" }, "Saldo inicial"),
                openingConfirmed ? h("div", { className: "cash-opening-saved" },
                    h("strong", null, brl(openingValue)),
                    h("button", { type: "button", onClick: () => setEditingOpening(true), className: "cash-opening-edit", "aria-label": "Editar saldo inicial" },
                        h(Pencil, { className: "size-3.5" }), "Editar"))
                : h("div", { className: "cash-opening-form" },
                    h("label", { className: "cash-sr-only", htmlFor: "cash-opening-amount" }, "Valor do saldo inicial"),
                    h(MoneyInput, { value: openingValue, onChange: setOpening, id: "cash-opening-amount" }),
                    h("button", { type: "button", onClick: () => saveOpening.mutate(), disabled: balanceBusy || closing.isLoading || Boolean(closing.error), className: "cash-action cash-action-primary" }, "Confirmar"))),
            h("dl", { className: "cash-overview-metrics" },
                h(Stat, { title: "Vendas do dia", value: brl(totals.vendas), tone: "in" }),
                h(Stat, { title: "Saídas / despesas", value: brl(totals.saidas), tone: "out" }),
                h(Stat, { title: "Resultado", value: brl(totals.liquido) }),
                h(Stat, { title: "Caixa à vista", value: brl(totals.teorico) })))),
        sales: h("section", { className: card, "aria-labelledby": "cash-sales-title" },
            h("div", { className: "cash-sales-heading" },
                h("h2", { id: "cash-sales-title", className: "font-display text-lg font-semibold" }, "Vendas do dia"),
                h("button", { type: "button", className: "cash-action cash-filter-toggle", "aria-expanded": String(saleFiltersOpen),
                    "aria-controls": "cash-sale-filters", onClick: () => setSaleFiltersOpen((open) => !open) },
                    "Filtros", activeSaleFilters > 0 && h("span", { className: "cash-filter-count" }, activeSaleFilters),
                    h("span", { className: "cash-filter-chevron", "aria-hidden": "true" }))),
            h("div", { id: "cash-sale-filters", className: "cash-sale-filters", "data-expanded": String(saleFiltersOpen) },
                h("div", { className: "flex flex-wrap items-center gap-2" },
                    h("span", { className: label }, "Pagamento"),
                    h("button", { "aria-pressed": String(paymentFilters.length === 0), onClick: () => setPaymentFilters([]), className: `h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${paymentFilters.length === 0
                            ? "bg-primary text-primary-foreground"
                            : "border border-border text-muted-foreground hover:bg-secondary"}` }, "Todos"),
                    [
                        { key: "DINHEIRO", label: "À vista" },
                        { key: "PIX", label: "PIX" },
                        { key: "DEBITO", label: "Débito" },
                        { key: "CREDITO", label: "Crédito" },
                        { key: "TROCA", label: "Troca" },
                        { key: "PAYJOY", label: "PayJoy" },
                        { key: "OUTRAS_FINANCEIRAS", label: "Outras financeiras" },
                    ].map((f) => {
                        const active = paymentFilters.includes(f.key);
                        return (h("button", { key: f.key, "aria-pressed": String(active), onClick: () => setPaymentFilters((prev) => active ? prev.filter((k) => k !== f.key) : [...prev, f.key]), className: `h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${active
                                ? "bg-primary text-primary-foreground"
                                : "border border-border text-muted-foreground hover:bg-secondary"}` }, f.label));
                    }))),
            h("ul", { className: "cash-sale-list" },
                visibleSales.map((record) => h("li", { key: record.id },
                    h("button", { type: "button", className: "cash-sale-row", disabled: interpretAI.isPending,
                        onClick: () => showSaleModal("details", record) },
                        h("span", { className: "cash-sale-description" },
                            h("strong", null, record.product || "Venda sem descrição"),
                            h("span", { className: "cash-sale-payments" },
                                salePayments.filter(([key]) => record[key] > 0).map(([key, title]) => h("span", { key, className: "cash-sale-payment" },
                                    h("span", null, title),
                                    h("strong", null, salePaymentAmount(record, key)))))),
                        h("strong", { className: "cash-sale-amount" }, brl(record.total)),
                        h(ArrowRight, { className: "size-4", "aria-hidden": "true" })))),
                !visibleSales.length && h("li", { className: "cash-sale-empty" }, sales.isLoading ? "Carregando vendas…" : "Nenhuma venda para esta data e filtros."))),
        services: services.length > 0 && h("ul", { className: "cash-service-list", "aria-label": "Serviços lançados" },
                services.map((record) => h("li", { key: record.id },
                    h("button", { type: "button", className: "cash-service-record", disabled: interpretAI.isPending,
                        onClick: () => showSaleModal("details", record) },
                        h("span", { className: "cash-service-record-body" },
                            h("strong", null, record.product || "Serviço"),
                            record.service_parts?.trim() && h("span", { className: "cash-service-record-parts" },
                                "Peças · ", record.service_parts.trim().split(/\r?\n/).filter((part) => part.trim()).join(" · "))),
                        h("strong", { className: "cash-service-total" }, brl(record.total)),
                        h(ArrowRight, { className: "size-4", "aria-hidden": "true" }))))),
        dialog: saleModal && h("dialog", { id: "cash-sale-dialog", className: "cash-dialog", "aria-labelledby": "cash-sale-title",
            onCancel: (event) => {
                event.preventDefault();
                if (!saveSale.isPending && !remove.isPending) closeSaleModal();
            } },
            h("div", { className: "cash-dialog-header" },
                h("div", null,
                    h("h2", { id: "cash-sale-title" }, ((saleModal.mode === "details" ? saleModal.record : sale).kind === "SERVICO" ? {
                        review: "Confirme o serviço", edit: "Editar serviço", details: "Detalhes do serviço",
                    } : {
                        review: "Confirme a venda", manual: "Lançar venda manual", edit: "Editar venda", details: "Detalhes da venda",
                    })[saleModal.mode]),
                    saleModal.mode === "review" && h("p", null, "Confira os dados antes de registrar no caixa.")),
                h("button", { type: "button", className: "cash-dialog-close", "aria-label": "Fechar",
                    disabled: saveSale.isPending || remove.isPending, onClick: closeSaleModal }, h(X, { className: "size-5" }))),
            saleModal.mode === "details"
                ? h("div", null,
                    h("div", { className: "cash-dialog-body" }, h(SaleDetails, { record: saleModal.record })),
                    h("div", { className: "cash-dialog-footer" },
                        h("div", { className: "cash-dialog-total" }, h("span", null, "Total"), h("strong", null, brl(saleModal.record.total))),
                        h("div", { className: "cash-dialog-actions" },
                            h("button", { type: "button", className: "cash-action cash-danger", disabled: remove.isPending, onClick: () => {
                                if (window.confirm("Remover este lançamento do caixa?")) remove.mutate({ table: "sales", id: saleModal.record.id });
                            } }, "Remover"),
                            h("button", { type: "button", className: "cash-action cash-action-primary", disabled: remove.isPending,
                                onClick: () => startEditSale(saleModal.record) }, saleModal.record.kind === "SERVICO" ? "Editar serviço" : "Editar venda"))))
                : h("form", { onSubmit: (event) => {
                    event.preventDefault();
                    if (!saveSale.isPending) saveSale.mutate();
                } },
                    h("div", { className: "cash-dialog-body" },
                        h(SaleFields, { sale, setSale, recognized: saleModal.mode === "review" ? saleModal.record : null }),
                        saleFormError && h("p", { className: "cash-error", role: "alert" }, saleFormError)),
                    h("div", { className: "cash-dialog-footer" },
                        h("div", { className: "cash-dialog-total" }, h("span", null, "Total"), h("strong", null, brl(paymentTotal(sale)))),
                        h("div", { className: "cash-dialog-actions" },
                            h("button", { type: "button", className: "cash-action", disabled: saveSale.isPending, onClick: closeSaleModal }, "Cancelar"),
                            h("button", { type: "submit", className: "cash-action cash-action-primary", disabled: saveSale.isPending },
                                saveSale.isPending ? "Salvando…" : editingSale ? "Salvar alterações" : sale.kind === "SERVICO" ? "Confirmar serviço" : "Confirmar venda"))))),
        movements: h("div", { className: "grid gap-6 lg:grid-cols-2" },
            h("section", { className: card },
                h("div", { className: "flex flex-wrap items-center justify-between gap-3" },
                    h("h2", { className: "font-display text-lg font-semibold" }, editingExpense ? "Editar saída" : "Saídas e despesas"),
                    editingExpense && (h("button", { onClick: () => {
                            setEditingExpense(null);
                            setExpense({ ...emptyExpense });
                        }, className: "inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground" },
                        h(X, { className: "size-4" }),
                        " Cancelar"))),
                h("div", { className: "cash-expense-fields" },
                    h(Field, { label: "Descri\u00E7\u00E3o", className: "cash-field-wide" },
                        h("input", { className: input, value: expense.description, onChange: (e) => setExpense({ ...expense, description: e.target.value }) })),
                    h(Field, { label: "Valor" },
                        h(MoneyInput, { value: expense.amount, onChange: (n) => setExpense({ ...expense, amount: n }) })),
                    h(Field, { label: "Forma de pagamento" },
                        h("select", { className: input, value: expense.payment_method, onChange: (e) => setExpense({ ...expense, payment_method: e.target.value }) }, ["Dinheiro", "PIX", "Débito", "Crédito", "Outro"].map((m) => (h("option", { key: m }, m))))),
                    h(Field, { label: "Observa\u00E7\u00E3o", className: "cash-field-wide" },
                        h("input", { className: input, value: expense.note, onChange: (e) => setExpense({ ...expense, note: e.target.value }) }))),
                h("button", { onClick: () => saveExpense.mutate(), disabled: saveExpense.isPending, className: "mt-4 inline-flex h-11 items-center gap-2 rounded-lg border border-border px-5 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-60" },
                    h(Plus, { className: "size-4" }),
                    " ",
                    editingExpense ? "Salvar alterações" : "Lançar saída"),
                h("ul", { className: "mt-5 space-y-2" },
                    expenseRows.map((e) => (h("li", { key: e.id, className: "flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm" },
                        h("div", { className: "min-w-0 flex-1" },
                            h("p", { className: "truncate font-medium" }, e.description || "—"),
                            h("p", { className: "text-xs text-muted-foreground" },
                                e.payment_method,
                                e.note ? ` · ${e.note}` : "")),
                        h("span", { className: "font-semibold text-destructive" }, brl(e.amount)),
                        h(IconButton, { label: "Editar", onClick: () => startEditExpense(e) },
                            h(Pencil, { className: "size-4" })),
                        h(DeleteButton, { onClick: () => remove.mutate({ table: "expenses", id: e.id }) })))),
                    expenseRows.length === 0 && (h("li", { className: "py-4 text-center text-sm text-muted-foreground" }, "Nenhuma sa\u00EDda hoje.")))),
            h("section", { className: card },
                h("div", { className: "flex flex-wrap items-center justify-between gap-3" },
                    h("h2", { className: "font-display text-lg font-semibold" }, editingMovement ? "Editar movimentação" : "Depósitos e retiradas"),
                    editingMovement && (h("button", { onClick: () => {
                            setEditingMovement(null);
                            setMovement({ ...emptyMovement });
                        }, className: "inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground" },
                        h(X, { className: "size-4" }),
                        " Cancelar"))),
                h("div", { className: "mt-4 grid gap-3 sm:grid-cols-2" },
                    h(Field, { label: "Valor" },
                        h(MoneyInput, { value: movement.amount, onChange: (n) => setMovement({ ...movement, amount: n }) })),
                    h(Field, { label: "Destino / observa\u00E7\u00E3o" },
                        h("input", { className: input, value: movement.note, onChange: (e) => setMovement({ ...movement, note: e.target.value }) }))),
                h("button", { onClick: () => saveMovement.mutate(), disabled: saveMovement.isPending, className: "mt-4 inline-flex h-11 items-center gap-2 rounded-lg border border-border px-5 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-60" },
                    h(Plus, { className: "size-4" }),
                    " ",
                    editingMovement ? "Salvar alterações" : "Registrar"),
                h("ul", { className: "mt-5 space-y-2" },
                    movementRows.map((m) => (h("li", { key: m.id, className: "flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm" },
                        h("span", { className: "min-w-0 flex-1 truncate" }, m.note || "Retirada"),
                        h("span", { className: "font-semibold" }, brl(m.amount)),
                        h(IconButton, { label: "Editar", onClick: () => startEditMovement(m) },
                            h(Pencil, { className: "size-4" })),
                        h(DeleteButton, { onClick: () => remove.mutate({ table: "cash_movements", id: m.id }) })))),
                    movementRows.length === 0 && (h("li", { className: "py-4 text-center text-sm text-muted-foreground" }, "Nenhuma movimenta\u00E7\u00E3o hoje."))))),
        closing: h("section", { className: card },
            h("h2", { className: "font-display text-lg font-semibold" }, "Fechamento do caixa"),
            h("div", { className: "mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" },
                h(Field, { label: "Dinheiro contado" },
                    h(MoneyInput, { value: countedValue, onChange: setCounted })),
                h(Line, { title: "Entradas em dinheiro", value: brl(totals.dinheiro) }),
                h(Line, { title: "Sa\u00EDdas em dinheiro", value: brl(totals.saidasDinheiro + totals.retiradas) }),
                h(Line, { title: "Saldo à vista", value: brl(totals.teorico) }),
                h(Line, { title: "Diferen\u00E7a", value: brl(totals.diferenca), tone: totals.diferenca === 0 ? undefined : totals.diferenca > 0 ? "in" : "out" })),
            Math.abs(totals.diferenca) >= 0.01 && (h("div", { className: "mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive" },
                "Atenção: o dinheiro contado não bate com o saldo à vista. Diferença de",
                " ",
                brl(totals.diferenca),
                " (",
                totals.diferenca > 0 ? "sobra" : "falta",
                ").")),
            h("button", { onClick: () => {
                    if (Math.abs(totals.diferenca) >= 0.01) {
                        const ok = window.confirm(`O caixa não está batendo. Diferença de ${brl(totals.diferenca)} (${totals.diferenca > 0 ? "sobra" : "falta"}).\n\nTem certeza que deseja fechar o caixa com essa diferença?`);
                        if (!ok)
                            return;
                    }
                    saveClosing.mutate();
                }, disabled: balanceBusy || !dailyReady, className: "mt-5 h-11 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60" }, "Salvar fechamento")),
    };
}
function Field({ label: text, children, className, }) {
    return (h("div", { className: className },
        h("span", { className: label }, text),
        h("div", { className: "mt-1.5" }, children)));
}
function Stat({ title, value, tone }) {
    return h("div", null,
        h("dt", null, title),
        h("dd", { className: tone === "in" ? "text-positive" : tone === "out" ? "text-destructive" : "" }, value));
}
function Line({ title, value, tone }) {
    return (h("div", { className: "rounded-lg border border-border/70 px-3 py-3" },
        h("p", { className: label }, title),
        h("p", { className: `mt-1 text-lg font-semibold ${tone === "in" ? "text-positive" : tone === "out" ? "text-destructive" : ""}` }, value)));
}
function IconButton({ label: text, onClick, children, }) {
    return (h("button", { onClick: onClick, "aria-label": text, className: "rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" }, children));
}
function DeleteButton({ onClick }) {
    return (h("button", { onClick: onClick, "aria-label": "Remover", className: "rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive" },
        h(Trash2, { className: "size-4" })));
}

return { component: CaixaPage };
})();

mountPage(cash.component, bindCashForms);
