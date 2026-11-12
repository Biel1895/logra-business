function bindCashForms(controls) {
    const get = (id) => document.getElementById(id);
    function bindText(id, value, update) {
        const field = get(id);
        if (field.value !== value) field.value = value;
        field.disabled = controls.pending;
        field.oninput = () => update(field.value);
    }
    function bindSubmit(formId, buttonId, action, disabled) {
        get(formId).onsubmit = (event) => {
            event.preventDefault();
            if (!disabled) action();
        };
        get(buttonId).disabled = disabled;
    }
    bindText("sale-text", controls.saleText, controls.changeSale);
    bindText("service-text", controls.serviceText, controls.changeService);
    bindText("service-parts", controls.serviceParts, controls.changeParts);
    bindSubmit("sale-form", "sale-submit", controls.reviewSale, controls.pending || !controls.saleText.trim());
    bindSubmit("service-form", "service-submit", controls.reviewService, controls.pending || !controls.serviceText.trim());

    const manual = get("manual-sale");
    manual.disabled = controls.pending;
    manual.onclick = controls.manualSale;
    const saleStatus = get("sale-status");
    saleStatus.textContent = controls.pending && controls.saleTextError ? "Organizando a venda…" :
        controls.saleTextError || controls.saleChatStatus;
    saleStatus.classList.toggle("cash-error", Boolean(controls.saleTextError) && !controls.pending);
    get("service-status").textContent = controls.pending && controls.serviceTextError ? "Organizando o serviço…" : controls.serviceTextError;
}
