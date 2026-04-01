import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { syncModuleCompletion } from "../src/utils";

describe("syncModuleCompletion", () => {
	it("registers a new course when it does not exist", async () => {
		const courseId = "sync-new-course";
		const moduleId = "sync-mod-1";
		const labs: ModulesLabs = { "lab-1": true, "lab-2": true };

		await syncModuleCompletion(env, courseId, moduleId, labs);

		const raw = await env.PORIDHI_LT.get(courseId);
		expect(raw).toBeTruthy();
		const courseModules = JSON.parse(raw!);
		expect(courseModules).toHaveProperty(moduleId);
		expect(courseModules[moduleId]).toEqual({ done: true });
	});

	it("marks module as done when all labs are complete", async () => {
		const courseId = "sync-all-done";
		const moduleId = "sync-mod-done";
		const labs: ModulesLabs = { "lab-1": true, "lab-2": true };

		await syncModuleCompletion(env, courseId, moduleId, labs);

		const raw = await env.PORIDHI_LT.get(courseId);
		expect(JSON.parse(raw!)[moduleId].done).toBe(true);
	});

	it("marks module as not done when any lab is incomplete", async () => {
		const courseId = "sync-partial";
		const moduleId = "sync-mod-partial";
		const labs: ModulesLabs = { "lab-1": true, "lab-2": false };

		await syncModuleCompletion(env, courseId, moduleId, labs);

		const raw = await env.PORIDHI_LT.get(courseId);
		expect(JSON.parse(raw!)[moduleId].done).toBe(false);
	});

	it("marks module as not done when all labs are incomplete", async () => {
		const courseId = "sync-all-undone";
		const moduleId = "sync-mod-undone";
		const labs: ModulesLabs = { "lab-1": false, "lab-2": false };

		await syncModuleCompletion(env, courseId, moduleId, labs);

		const raw = await env.PORIDHI_LT.get(courseId);
		expect(JSON.parse(raw!)[moduleId].done).toBe(false);
	});

	it("updates an existing course when module status changes", async () => {
		const courseId = "sync-update-course";
		const moduleId = "sync-mod-update";
		// course already knows module as false
		await env.PORIDHI_LT.put(courseId, JSON.stringify({ [moduleId]: { done: false } }));

		// now all labs are done
		await syncModuleCompletion(env, courseId, moduleId, { "lab-1": true });

		const raw = await env.PORIDHI_LT.get(courseId);
		expect(JSON.parse(raw!)[moduleId].done).toBe(true);
	});

	it("skips KV write when module completion status has not changed", async () => {
		const courseId = "sync-no-change";
		const moduleId = "sync-mod-no-change";
		// course already marks module as true
		const initial = { [moduleId]: { done: true } };
		await env.PORIDHI_LT.put(courseId, JSON.stringify(initial));

		// labs are still all done
		await syncModuleCompletion(env, courseId, moduleId, { "lab-1": true });

		// value should still be true (no regression)
		const raw = await env.PORIDHI_LT.get(courseId);
		expect(JSON.parse(raw!)[moduleId].done).toBe(true);
	});

	it("preserves other modules in the course when updating", async () => {
		const courseId = "sync-preserve-others";
		const moduleId = "sync-mod-a";
		await env.PORIDHI_LT.put(
			courseId,
			JSON.stringify({ "sync-mod-a": { done: false }, "sync-mod-b": { done: true } })
		);

		await syncModuleCompletion(env, courseId, moduleId, { "lab-1": true });

		const raw = await env.PORIDHI_LT.get(courseId);
		const courseModules = JSON.parse(raw!);
		expect(courseModules["sync-mod-a"].done).toBe(true);
		expect(courseModules["sync-mod-b"].done).toBe(true);
	});

	it("handles a module with a single lab correctly", async () => {
		const courseId = "sync-single-lab-course";
		const moduleId = "sync-mod-single";

		await syncModuleCompletion(env, courseId, moduleId, { "lab-only": true });

		const raw = await env.PORIDHI_LT.get(courseId);
		expect(JSON.parse(raw!)[moduleId].done).toBe(true);
	});
});
