function notify(text, type) {
    const element = document.createElement("div");
    element.className = "notice " + type;
    element.setAttribute("role", "status");
    element.textContent = text;
    document.getElementById("notifications").append(element);
    setTimeout(() => element.remove(), 4500);
}
const toast = {
    success: (text) => notify(text, "success"),
    error: (text) => notify(text, "error"),
};
function applyTheme(value) {
    document.documentElement.classList.toggle("dark", value === "dark");
    document.documentElement.dataset.bsTheme = value;
    const button = document.getElementById("theme-toggle");
    if (button) {
        button.title = value === "dark" ? "Modo claro" : "Modo escuro";
        button.setAttribute("aria-label", button.title);
    }
}
const initialTheme = localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
applyTheme(initialTheme);
document.getElementById("theme-toggle")?.addEventListener("click", () => {
    const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
    localStorage.setItem("theme", next);
    applyTheme(next);
});
async function preparePage() {
    const status = document.getElementById("page-loading");
    const { data, error } = await cashStore.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError" && ![401, 403].includes(error.status)) {
        status.textContent = "Não foi possível conectar ao caixa. Confira a conexão e recarregue a página.";
        return false;
    }
    if (!data.user) {
        if (error?.status === 401 || error?.status === 403) await cashStore.auth.signOut({ scope: "local" });
        location.replace("../auth/");
        return false;
    }
    document.getElementById("user-email").textContent = data.user.email;
    document.getElementById("logout").addEventListener("click", async () => {
        const { error: signOutError } = await cashStore.auth.signOut({ scope: "local" });
        if (signOutError) {
            toast.error("Não foi possível sair. Tente novamente.");
            return;
        }
        location.replace("../auth/");
    });
    window.addEventListener("pageshow", async (event) => {
        if (!event.persisted) return;
        const { data } = await cashStore.auth.getUser();
        if (!data.user) {
            document.getElementById("protected-page").hidden = true;
            location.reload();
        }
    });
    document.getElementById("protected-page").hidden = false;
    status.hidden = true;
    return true;
}
