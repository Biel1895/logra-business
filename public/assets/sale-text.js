function interpretSale(text) {
    const [description, payments, scheduledPayment, ...extra] = text.split("=");
    const amount = "(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d{1,2})?";
    const money = "(?:r\\$\\s*)?(" + amount + ")";
    const scheduledCard = scheduledPayment?.trim().match(new RegExp(
        "^(?:.+?\\s+)?vai\\s+passar\\s+(?:o\\s+)?cart[aã]o(?:\\s+de\\s+cr[eé]dito)?\\s+(?:em\\s+)?(\\d+)\\s*x\\s*(?:de\\s+)?" + money + "$", "i"));
    if (!description.trim() || !payments?.trim() || extra.length || (scheduledPayment !== undefined && !scheduledCard)) {
        throw new Error("Escreva a descrição, o sinal = e os pagamentos separados por +.");
    }
    const methods = {
        pix: "pix", dinheiro: "cash", "a vista": "cash", av: "cash", especie: "cash", debito: "debit",
        credito: "credit", "cartao de credito": "credit", payjoy: "payjoy", "pay joy": "payjoy",
        pendente: "pending_amount", "a receber": "pending_amount",
        parcelex: "other_finance", odreas: "other_finance", financiamento: "other_finance", "outras financeiras": "other_finance",
    };
    const names = "(" + Object.keys(methods).join("|") + ")";
    const amountFirst = new RegExp("^" + money + "\\s*(?:a\\s+)?(?:cair\\s+)?(?:(?:no|na|via)\\s+)?" + names + "$");
    const methodFirst = new RegExp("^" + names + "\\s*(?:de\\s+|:\\s*)?" + money + "$");
    const amountOnly = new RegExp("^" + money + "$");
    const tradePattern = new RegExp("^(.+?)\\s*\\(\\s*" + money + "\\s*\\)$", "i");
    const sale = { product: description.trim().replace(/\s*\+\s*/g, " + "), installments: 0 };
    const amounts = {};
    const tradeDetails = [];
    const notes = new Set();
    function toCents(value) {
        return Math.round(Number(value.replace(/\./g, "").replace(",", ".")) * 100);
    }
    function addAmount(field, value) {
        const cents = toCents(value);
        const total = (amounts[field] ?? 0) + cents;
        if (!Number.isSafeInteger(total) || cents <= 0) throw new Error("Use valores positivos em reais.");
        amounts[field] = total;
    }

    // Split only outside parentheses, and only on the payments side.
    let depth = 0;
    let start = 0;
    const segments = [];
    for (let i = 0; i < payments.length; i++) {
        if (payments[i] === "(") depth++;
        if (payments[i] === ")") depth--;
        if (depth < 0) throw new Error("Confira os parênteses do valor da troca.");
        if (payments[i] === "+" && depth === 0) {
            segments.push(payments.slice(start, i));
            start = i + 1;
        }
    }
    if (depth) throw new Error("Confira os parênteses do valor da troca.");
    segments.push(payments.slice(start));

    if (scheduledCard) {
        const installmentCount = Number(scheduledCard[1]);
        const pendingCents = installmentCount * toCents(scheduledCard[2]);
        if (!Number.isSafeInteger(pendingCents) || pendingCents <= 0) {
            throw new Error("Confira o valor e a quantidade de parcelas pendentes.");
        }
        const devices = segments.map((segment) => segment.trim());
        const isDevice = (device) => /\p{L}/u.test(device) || /^\d{1,2}\s+\d{2,4}$/.test(device);
        if (!devices.every((device) => isDevice(device.match(tradePattern)?.[1].trim() ?? device))) {
            throw new Error("Descreva os aparelhos recebidos na troca.");
        }
        const valuedDevices = devices.map((device) => device.match(tradePattern));
        if (valuedDevices.every(Boolean)) {
            for (const device of valuedDevices) addAmount("trade_in", device[2]);
            sale.trade_in = amounts.trade_in / 100;
            sale.trade_in_details = valuedDevices.map((device) => device[1].trim()).join(" + ");
        } else {
            sale.trade_in_details = devices.join(" + ");
        }
        sale.pending_amount = pendingCents / 100;
        sale.note = scheduledPayment.trim();
        return sale;
    }

    for (const segment of segments) {
        const original = segment.trim();
        let normalized = original.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
        const installment = normalized.match(/^(.+?)\s+(?:em\s+)?(\d+)\s*x$/);
        if (installment) normalized = installment[1];
        const first = normalized.match(amountFirst);
        const second = normalized.match(methodFirst);
        const installmentAmount = installment && normalized.match(amountOnly);
        if (first || second || installmentAmount) {
            const method = first ? first[2] : second ? second[1] : "credito";
            const field = methods[method];
            if (installment) {
                const count = Number(installment[2]);
                if (field !== "credit" || count < 1 || !Number.isSafeInteger(count) || (sale.installments && sale.installments !== count)) {
                    throw new Error("Confira a quantidade de parcelas no crédito.");
                }
                sale.installments = count;
            }
            addAmount(field, first ? first[1] : second ? second[2] : installmentAmount[1]);
            if (method === "parcelex") notes.add(/\bcair\b/.test(normalized) ? "Parcelex a receber" : "Parcelex");
            if (method === "odreas") notes.add(/\bcair\b/.test(normalized) ? "Odreas a receber" : "Odreas");
            continue;
        }
        const trade = original.match(tradePattern);
        if (trade && /\p{L}/u.test(trade[1])) {
            addAmount("trade_in", trade[2]);
            tradeDetails.push(trade[1].trim().replace(/^troca\s*:\s*/i, ""));
            continue;
        }
        throw new Error(original ? "Pagamento não reconhecido: " + original : "Há um pagamento vazio entre os sinais de +.");
    }
    for (const [field, cents] of Object.entries(amounts)) sale[field] = cents / 100;
    sale.trade_in_details = tradeDetails.join(" + ");
    sale.note = [...notes].join(" / ");
    return sale;
}
