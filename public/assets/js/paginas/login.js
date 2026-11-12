const form = document.getElementById("login-form");
const submit = form.querySelector("button");
cashStore.auth.getSession().then(({ data }) => {
    if (data.session) location.replace("../caixa/");
});
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    submit.textContent = "Aguarde…";
    try {
        const values = new FormData(form);
        const { error } = await cashStore.auth.signInWithPassword({
            email: values.get("email"),
            password: values.get("password"),
        });
        if (error) throw error;
        location.replace("../caixa/");
    } catch (error) {
        toast.error(error.status === 400 || error.status === 401
            ? "Confira o e-mail e a senha."
            : "Não foi possível entrar. Confira a conexão e tente novamente.");
        submit.disabled = false;
        submit.textContent = "Entrar";
    }
});
