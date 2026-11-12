cashStore.auth.getSession().then(({ data }) => {
    if (!data.session) return;
    for (const link of document.querySelectorAll("[data-cash-entry]")) {
        link.href = "./caixa/";
        const label = link.querySelector("span") || link;
        label.textContent = label === link ? "Abrir o sistema" : "Ir para o caixa";
    }
});
