import { IRequest, error } from "itty-router";

export function withAuthenticate(request: IRequest, env: Env): Response | null {
    const authToken = request.headers.get("x-api-key");
    if (!authToken || authToken !== env.API_KEY) {
        return error(401, "Unauthorized"); 
    }
    return null;
}