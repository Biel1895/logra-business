const period=(()=>{const {brl,brlCompact,parseMoney,todayISO,isoToDate,addDays,formatDayLong,formatDayShort}=Object.assign({},format);
const PERIODS = [
    { key: "day", label: "Diário", days: 1 },
    { key: "week", label: "Semanal", days: 7 },
    { key: "fortnight", label: "Quinzenal", days: 15 },
    { key: "month", label: "Mensal", days: 30 },
];
function periodRange(period, endISO = todayISO()) {
    const days = PERIODS.find((p) => p.key === period)?.days ?? 1;
    return { start: addDays(endISO, -(days - 1)), end: endISO, days };
}
/** Período anterior de mesmo tamanho, para comparação. */
function previousRange(period, endISO = todayISO()) {
    const { start, days } = periodRange(period, endISO);
    return { start: addDays(start, -days), end: addDays(start, -1), days };
}
function eachDay(startISO, endISO) {
    const out = [];
    let cur = startISO;
    const guard = 400;
    for (let i = 0; i < guard; i++) {
        out.push(cur);
        if (cur === endISO || isoToDate(cur) >= isoToDate(endISO))
            break;
        cur = addDays(cur, 1);
    }
    return out;
}

return {PERIODS,periodRange,previousRange,eachDay};})();
