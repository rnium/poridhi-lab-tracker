import { env, createExecutionContext, waitOnExecutionContext, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

// ---------------------------------------------------------------------------
// GET /course/:courseId/modules
// ---------------------------------------------------------------------------
describe("GET /course/:courseId/modules", () => {
	it("returns 404 when course does not exist", async () => {
		const req = new IncomingRequest("http://example.com/course/no-such-course/modules");
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(res.status).toBe(404);
	});

	it("returns 200 with stored course modules", async () => {
		const courseId = "test-course-get";
		const modules = { "mod-a": true, "mod-b": false };
		await env.PORIDHI_LT.put(courseId, JSON.stringify(modules));

		const req = new IncomingRequest(`http://example.com/course/${courseId}/modules`);
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(modules);
	});

	it("returns 404 JSON body with error message", async () => {
		const req = new IncomingRequest("http://example.com/course/ghost/modules");
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);

		const body = await res.json() as { error?: string };
		expect(body).toHaveProperty("error");
	});
});

// ---------------------------------------------------------------------------
// GET /modules/:moduleId/labs
// ---------------------------------------------------------------------------
describe("GET /modules/:moduleId/labs", () => {
	it("returns 404 when module does not exist", async () => {
		const req = new IncomingRequest("http://example.com/modules/no-such-module/labs");
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(res.status).toBe(404);
	});

	it("returns 200 with stored module labs", async () => {
		const moduleId = "test-module-get";
		const labs = { "lab-1": true, "lab-2": false };
		await env.PORIDHI_LT.put(moduleId, JSON.stringify(labs));

		const req = new IncomingRequest(`http://example.com/modules/${moduleId}/labs`);
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(labs);
	});

	it("returns 404 JSON body with error message", async () => {
		const req = new IncomingRequest("http://example.com/modules/ghost-mod/labs");
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);

		const body = await res.json() as { error?: string };
		expect(body).toHaveProperty("error");
	});
});

// ---------------------------------------------------------------------------
// POST /modules/:moduleId/labs
// ---------------------------------------------------------------------------
describe("POST /modules/:moduleId/labs", () => {
	function postLabs(moduleId: string, body: unknown) {
		return new IncomingRequest(`http://example.com/modules/${moduleId}/labs`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	}

	it("returns 400 when courseId is missing from payload", async () => {
		const req = postLabs("mod-1", { labId: "lab-1", done: true });
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(res.status).toBe(400);
	});

	it("returns 400 when labId is missing from payload", async () => {
		const req = postLabs("mod-1", { courseId: "course-1", done: true });
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(res.status).toBe(400);
	});

	it("returns 400 when done is not a boolean", async () => {
		const req = postLabs("mod-1", { courseId: "course-1", labId: "lab-1", done: "yes" });
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(res.status).toBe(400);
	});

	it("returns 200 with { success: true } on valid update", async () => {
		const req = postLabs("mod-valid", { courseId: "course-valid", labId: "lab-1", done: true });
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ success: true });
	});

	it("persists lab completion status in KV", async () => {
		const moduleId = "mod-persist";
		const req = postLabs(moduleId, { courseId: "course-persist", labId: "lab-x", done: true });
		const ctx = createExecutionContext();
		await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);

		const raw = await env.PORIDHI_LT.get(moduleId);
		expect(raw).toBeTruthy();
		const stored = JSON.parse(raw!);
		expect(stored["lab-x"]).toBe(true);
	});

	it("marks module done on course when all labs are complete", async () => {
		const moduleId = "mod-all-done";
		const courseId = "course-all-done";
		// seed one lab already done
		await env.PORIDHI_LT.put(moduleId, JSON.stringify({ "lab-1": true }));

		const req = postLabs(moduleId, { courseId, labId: "lab-2", done: true });
		const ctx = createExecutionContext();
		await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);

		const courseRaw = await env.PORIDHI_LT.get(courseId);
		const courseModules = JSON.parse(courseRaw!);
		expect(courseModules[moduleId]).toBe(true);
	});

	it("marks module incomplete on course when not all labs are done", async () => {
		const moduleId = "mod-partial";
		const courseId = "course-partial";
		// seed one lab done, one undone
		await env.PORIDHI_LT.put(moduleId, JSON.stringify({ "lab-1": true }));

		const req = postLabs(moduleId, { courseId, labId: "lab-2", done: false });
		const ctx = createExecutionContext();
		await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);

		const courseRaw = await env.PORIDHI_LT.get(courseId);
		const courseModules = JSON.parse(courseRaw!);
		expect(courseModules[moduleId]).toBe(false);
	});

	it("registers course in KV when it does not yet exist", async () => {
		const moduleId = "mod-new-course";
		const courseId = "course-brand-new";

		const req = postLabs(moduleId, { courseId, labId: "lab-1", done: true });
		const ctx = createExecutionContext();
		await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);

		const courseRaw = await env.PORIDHI_LT.get(courseId);
		expect(courseRaw).toBeTruthy();
		const courseModules = JSON.parse(courseRaw!);
		expect(courseModules).toHaveProperty(moduleId);
	});

	it("updates an existing lab to done=false", async () => {
		const moduleId = "mod-update-false";
		const courseId = "course-update-false";
		await env.PORIDHI_LT.put(moduleId, JSON.stringify({ "lab-1": true }));

		const req = postLabs(moduleId, { courseId, labId: "lab-1", done: false });
		const ctx = createExecutionContext();
		await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);

		const raw = await env.PORIDHI_LT.get(moduleId);
		const labs = JSON.parse(raw!);
		expect(labs["lab-1"]).toBe(false);
	});
});
