const money=(()=>{const {brl,brlCompact,parseMoney,todayISO,isoToDate,addDays,formatDayLong,formatDayShort}=Object.assign({},format);
const show = (n) => n === 0 ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function MoneyInput({ value, onChange, placeholder = "0,00", className, id, autoFocus }) {
    const [text, setText] = useState(show(value));
    const [focused, setFocused] = useState(false);
    useEffect(() => {
        if (!focused)
            setText(show(value));
    }, [value, focused]);
    return (h("div", { className: cn("relative", className) },
        h("span", { className: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground" }, "R$"),
        h("input", { id: id, autoFocus: autoFocus, inputMode: "decimal", value: text, placeholder: placeholder, onFocus: () => setFocused(true), onChange: (e) => {
                setText(e.target.value);
                onChange(parseMoney(e.target.value));
            }, onBlur: () => {
                setFocused(false);
                setText(show(parseMoney(text)));
            }, className: "num h-11 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-right text-sm font-medium outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20" })));
}

return {MoneyInput};})();
