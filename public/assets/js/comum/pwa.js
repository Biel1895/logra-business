if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("PWA:", error.message));
}

const installButton = document.getElementById("install-caixa");
if (installButton) {
    let installPrompt;
    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        installPrompt = event;
        installButton.hidden = false;
    });
    installButton.addEventListener("click", async () => {
        if (!installPrompt) return;
        const prompt = installPrompt;
        installPrompt = null;
        installButton.hidden = true;
        await prompt.prompt();
    });
    window.addEventListener("appinstalled", () => {
        installButton.hidden = true;
        installPrompt = null;
    });
}
