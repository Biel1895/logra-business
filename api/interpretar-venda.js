import { interpretRequest } from "../lib/interpretar.js";

export default { fetch: (request) => interpretRequest(request) };
