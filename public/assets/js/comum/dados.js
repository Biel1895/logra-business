const db=(()=>{
const num = (v) => Number(v ?? 0);
async function fetchRange(table, dateField, start, end) {
    const pageSize = 500;
    const records = [];
    for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await cashStore.from(table).select("*")
            .gte(dateField, start).lte(dateField, end)
            .order(dateField).order("created_at").order("id")
            .range(offset, offset + pageSize - 1);
        if (error) throw error;
        records.push(...data);
        if (data.length < pageSize) return records;
    }
}
async function fetchSales(start, end) {
    const records = await fetchRange("sales", "sale_date", start, end);
    return records.map((r) => ({
        ...r,
        total: num(r.total),
        cash: num(r.cash),
        pix: num(r.pix),
        debit: num(r.debit),
        credit: num(r.credit),
        installments: num(r.installments),
        trade_in: num(r.trade_in),
        payjoy: num(r.payjoy),
        other_finance: num(r.other_finance),
        pending_amount: num(r.pending_amount),
    }));
}
async function fetchExpenses(start, end) {
    const records = await fetchRange("expenses", "expense_date", start, end);
    return records.map((r) => ({ ...r, amount: num(r.amount) }));
}
async function fetchMovements(start, end) {
    const records = await fetchRange("cash_movements", "movement_date", start, end);
    return records.map((r) => ({ ...r, amount: num(r.amount) }));
}
const normalizeClosing = (r) => ({ ...r, opening_balance: num(r.opening_balance), counted_cash: num(r.counted_cash) });
async function fetchClosings(start, end) {
    const records = await fetchRange("day_closings", "closing_date", start, end);
    return records.map(normalizeClosing);
}
async function fetchClosing(date) {
    const { data, error } = await cashStore
        .from("day_closings")
        .select("*")
        .eq("closing_date", date)
        .maybeSingle();
    if (error)
        throw error;
    if (!data)
        return null;
    return normalizeClosing(data);
}
async function fetchAuditLogs(limit = 300, date) {
    let query = cashStore
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
    if (date) {
        const start = new Date(`${date}T00:00:00`);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        query = query.gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
    }
    const { data, error } = await query;
    if (error)
        throw error;
    return (data ?? []);
}
const paymentTotal = (s) => s.cash + s.pix + s.debit + s.credit + s.trade_in + s.payjoy + s.other_finance;
const sum = (rows, pick) => rows.reduce((acc, row) => acc + pick(row), 0);

return {fetchSales,fetchExpenses,fetchMovements,fetchClosing,fetchClosings,fetchAuditLogs,paymentTotal,sum};})();
