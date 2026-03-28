import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import {
	getCourseModules,
	setCourseModules,
	updateCourseModule,
} from "../../src/services/course";

describe("getCourseModules", () => {
	it("returns null when key does not exist", async () => {
		const result = await getCourseModules(env, "non-existent-course");
		expect(result).toBeNull();
	});

	it("returns the parsed modules object when key exists", async () => {
		const courseId = "gc-course-1";
		const modules = { "mod-1": true, "mod-2": false };
		await env.PORIDHI_LT.put(courseId, JSON.stringify(modules));

		const result = await getCourseModules(env, courseId);
		expect(result).toEqual(modules);
	});

	it("returns an empty object when stored value is {}", async () => {
		const courseId = "gc-course-empty";
		await env.PORIDHI_LT.put(courseId, JSON.stringify({}));

		const result = await getCourseModules(env, courseId);
		expect(result).toEqual({});
	});
});

describe("setCourseModules", () => {
	it("persists the modules object in KV", async () => {
		const courseId = "sc-course-1";
		const modules = { "mod-a": true };
		await setCourseModules(env, courseId, modules);

		const raw = await env.PORIDHI_LT.get(courseId);
		expect(JSON.parse(raw!)).toEqual(modules);
	});

	it("overwrites an existing KV entry", async () => {
		const courseId = "sc-course-overwrite";
		await env.PORIDHI_LT.put(courseId, JSON.stringify({ "mod-old": true }));

		const newModules = { "mod-new": false };
		await setCourseModules(env, courseId, newModules);

		const raw = await env.PORIDHI_LT.get(courseId);
		expect(JSON.parse(raw!)).toEqual(newModules);
	});
});

describe("updateCourseModule", () => {
	it("creates a new entry when course does not exist", async () => {
		const courseId = "uc-course-new";
		const result = await updateCourseModule(env, courseId, "mod-1", true);

		expect(result).toEqual({ "mod-1": true });

		const raw = await env.PORIDHI_LT.get(courseId);
		expect(JSON.parse(raw!)).toEqual({ "mod-1": true });
	});

	it("adds a new module key to an existing course", async () => {
		const courseId = "uc-course-add";
		await env.PORIDHI_LT.put(courseId, JSON.stringify({ "mod-1": true }));

		const result = await updateCourseModule(env, courseId, "mod-2", false);

		expect(result).toEqual({ "mod-1": true, "mod-2": false });
	});

	it("updates an existing module key from false to true", async () => {
		const courseId = "uc-course-update";
		await env.PORIDHI_LT.put(courseId, JSON.stringify({ "mod-1": false }));

		const result = await updateCourseModule(env, courseId, "mod-1", true);

		expect(result["mod-1"]).toBe(true);
	});

	it("returns the full updated modules map", async () => {
		const courseId = "uc-course-full";
		await env.PORIDHI_LT.put(
			courseId,
			JSON.stringify({ "mod-a": true, "mod-b": false })
		);

		const result = await updateCourseModule(env, courseId, "mod-b", true);

		expect(result).toEqual({ "mod-a": true, "mod-b": true });
	});
});
