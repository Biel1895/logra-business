const format=(()=>{
const brl = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(value) ? value : 0);
const brlCompact = (value) => new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
}).format(Number.isFinite(value) ? value : 0);
/** Converte texto digitado ("1.234,50", "1234.5", "") em número. */
function parseMoney(input) {
    if (!input)
        return 0;
    const cleaned = input
        .replace(/[^\d,.-]/g, "")
        .replace(/\.(?=\d{3}\b)/g, "")
        .replace(",", ".");
    const n = Number.parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
}
const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function isoToDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function addDays(iso, days) {
    const d = isoToDate(iso);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const formatDayLong = (iso) => isoToDate(iso).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
});
const formatDayShort = (iso) => isoToDate(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

return {brl,brlCompact,parseMoney,todayISO,isoToDate,addDays,formatDayLong,formatDayShort};})();
