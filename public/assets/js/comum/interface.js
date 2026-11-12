/* Estado e atualização das áreas interativas. */
let classMap = {};
let current;
let pending = false;
let effects = [];
let page;
let afterRender;

const instances = new Map();
const cache = new Map();
const Fragment = Symbol("fragment");
const cn = (...classes) => classes.filter(Boolean).join(" ");

function schedule() {
    if (pending) return;
    pending = true;
    queueMicrotask(() => {
        pending = false;
        render();
    });
}

function useState(initial) {
    const scope = current;
    const index = scope.cursor++;
    if (!(index in scope.slots)) scope.slots[index] = typeof initial === "function" ? initial() : initial;
    return [scope.slots[index], (value) => {
        scope.slots[index] = typeof value === "function" ? value(scope.slots[index]) : value;
        schedule();
    }];
}

function useMemo(compute) {
    current.cursor++;
    return compute();
}

function useEffect(apply, dependencies) {
    const scope = current;
    const index = scope.cursor++;
    const previous = scope.slots[index];
    if (!previous || !dependencies || dependencies.some((value, i) => value !== previous.dependencies[i])) {
        effects.push(() => {
            previous?.cleanup?.();
            scope.slots[index] = { dependencies, cleanup: apply() };
        });
    }
}

function invalidate() {
    for (const query of cache.values()) query.stale = true;
    schedule();
}

const queryClient = { invalidateQueries: invalidate };
const useQueryClient = () => queryClient;

function useQuery({ queryKey, queryFn }) {
    const key = JSON.stringify(queryKey);
    if (!cache.has(key)) cache.set(key, { data: undefined, isLoading: true, stale: true });
    const query = cache.get(key);
    if (query.stale && !query.fetching) {
        query.fetching = true;
        query.stale = false;
        queryFn()
            .then((data) => { query.data = data; query.error = null; })
            .catch((error) => { query.error = error; })
            .finally(() => {
                query.fetching = false;
                query.isLoading = false;
                schedule();
            });
    }
    return query;
}

function useMutation({ mutationFn, onSuccess, onError }) {
    const [isPending, setPending] = useState(false);
    return {
        isPending,
        async mutate(args) {
            setPending(true);
            try {
                const result = await mutationFn(args);
                onSuccess?.(result);
            } catch (error) {
                onError?.(error);
            } finally {
                setPending(false);
            }
        },
    };
}

function h(type, props, ...children) {
    return { type, props: props || {}, children: children.flat(Infinity) };
}

const attributeNames = {
    strokeWidth: "stroke-width", strokeLinecap: "stroke-linecap", strokeLinejoin: "stroke-linejoin",
    strokeDasharray: "stroke-dasharray", textAnchor: "text-anchor", fontSize: "font-size",
    colSpan: "colspan", autoComplete: "autocomplete", inputMode: "inputmode",
    minLength: "minlength", tabIndex: "tabindex", htmlFor: "for",
};

function setProperty(element, type, props, key, value) {
    if (value == null || ["key", "children", "autoFocus"].includes(key)) return;
    if (key === "className") {
        element.setAttribute("class", String(value).split(/\s+/).map((name) => classMap[name] || name).join(" "));
    } else if (key === "style") {
        for (const [property, setting] of Object.entries(value)) {
            const needsUnit = typeof setting === "number" && !["opacity", "zIndex", "fontWeight", "flex", "flexGrow", "flexShrink"].includes(property);
            element.style[property] = needsUnit ? setting + "px" : setting;
        }
    } else if (key.startsWith("on")) {
        const event = key === "onChange"
            ? (type === "select" || props.type === "checkbox" ? "change" : "input")
            : key.slice(2).toLowerCase();
        element.addEventListener(event, value);
        (element._events ??= {})[event] = value;
    } else if (key === "value") {
        element.value = value;
    } else if (["checked", "disabled", "required"].includes(key)) {
        element[key] = Boolean(value);
        if (value) element.setAttribute(key, "");
    } else {
        element.setAttribute(attributeNames[key] || key, String(value));
    }
}

function build(view, path = "0", svg = false) {
    if (view == null || typeof view === "boolean") return document.createTextNode("");
    if (Array.isArray(view)) {
        const fragment = document.createDocumentFragment();
        view.forEach((item, index) => fragment.append(build(item, path + "." + index, svg)));
        return fragment;
    }
    if (typeof view !== "object") return document.createTextNode(String(view));
    const { type, props, children } = view;
    if (type === Fragment) return build(children, path, svg);
    if (typeof type === "function") {
        const id = path + ":" + type.name;
        const scope = instances.get(id) ?? { slots: [], cursor: 0 };
        instances.set(id, scope);
        scope.cursor = 0;
        const parent = current;
        current = scope;
        const result = type({ ...props, children });
        current = parent;
        return build(result, path + ".r", svg);
    }
    svg = svg || type === "svg";
    const element = svg ? document.createElementNS("http://www.w3.org/2000/svg", type) : document.createElement(type);
    for (const [key, value] of Object.entries(props)) setProperty(element, type, props, key, value);
    children.forEach((child, index) => element.append(build(child, path + "." + (child?.props?.key ?? index), svg)));
    if (type === "select" && props.value !== undefined) element.value = props.value;
    return element;
}

function morph(element, next) {
    if (element.nodeType !== next.nodeType || element.nodeName !== next.nodeName) {
        element.replaceWith(next);
        return;
    }
    if (element.nodeType === 3) {
        if (element.textContent !== next.textContent) element.textContent = next.textContent;
        return;
    }
    for (const { name } of Array.from(element.attributes)) {
        // The browser owns the open state of dialogs opened with showModal().
        if (!next.hasAttribute(name) && !(element.tagName === "DIALOG" && name === "open")) element.removeAttribute(name);
    }
    for (const { name, value } of Array.from(next.attributes)) {
        if (element.getAttribute(name) !== value) element.setAttribute(name, value);
    }
    for (const [event, listener] of Object.entries(element._events || {})) element.removeEventListener(event, listener);
    element._events = next._events;
    for (const [event, listener] of Object.entries(element._events || {})) element.addEventListener(event, listener);
    if (["INPUT", "SELECT", "TEXTAREA"].includes(element.tagName)) {
        if (element.value !== next.value) element.value = next.value;
        element.checked = next.checked;
        element.disabled = next.disabled;
    }
    const children = Array.from(element.childNodes);
    const nextChildren = Array.from(next.childNodes);
    for (let index = 0; index < Math.max(children.length, nextChildren.length); index++) {
        if (!nextChildren[index]) children[index].remove();
        else if (!children[index]) element.append(nextChildren[index]);
        else morph(children[index], nextChildren[index]);
    }
}

function paint(target, node, key) {
    const next = build(node, key);
    if (target.firstChild) morph(target.firstChild, next);
    else target.append(next);
}
function render() {
    if (!page) return;
    effects = [];
    const regions = document.querySelectorAll("[data-page-view]");
    if (!regions.length) {
        paint(document.getElementById("app"), h(page, {}), "page");
    } else {
        const scope = instances.get("page") ?? { slots: [], cursor: 0 };
        instances.set("page", scope);
        scope.cursor = 0;
        current = scope;
        const views = page();
        current = null;
        for (const region of regions) {
            const name = region.dataset.pageView;
            paint(region, views[name], name);
        }
        afterRender?.(views.controls);
    }
    effects.forEach((apply) => apply());
}
async function mountPage(component, bind) {
    try {
        if (!await preparePage()) return;
        const response = await fetch(new URL("../../class-map.json", document.querySelector('script[src$="interface.js"]').src));
        if (!response.ok) throw new Error("Os estilos do caixa não puderam ser carregados.");
        classMap = await response.json();
        page = component;
        afterRender = bind;
        window.addEventListener("focus", invalidate);
        render();
    } catch (error) {
        toast.error(error.message);
    }
}

