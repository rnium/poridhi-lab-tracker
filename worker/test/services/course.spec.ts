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
		const modules = { "mod-1": { done: true }, "mod-2": { done: false } };
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
		const modules = { "mod-a": { done: true } };
		await setCourseModules(env, courseId, modules);

		const raw = await env.PORIDHI_LT.get(courseId);
		expect(JSON.parse(raw!)).toEqual(modules);
	});

	it("overwrites an existing KV entry", async () => {
		const courseId = "sc-course-overwrite";
		await env.PORIDHI_LT.put(courseId, JSON.stringify({ "mod-old": { done: true } }));

		const newModules = { "mod-new": { done: false } };
		await setCourseModules(env, courseId, newModules);

		const raw = await env.PORIDHI_LT.get(courseId);
		expect(JSON.parse(raw!)).toEqual(newModules);
	});
});

describe("updateCourseModule", () => {
	it("creates a new entry when course does not exist", async () => {
		const courseId = "uc-course-new";
		const result = await updateCourseModule(env, courseId, "mod-1", { done: true });

		expect(result).toEqual({ done: true });

		const raw = await env.PORIDHI_LT.get(courseId);
		expect(JSON.parse(raw!)).toEqual({ "mod-1": { done: true } });
	});

	it("adds a new module key to an existing course", async () => {
		const courseId = "uc-course-add";
		await env.PORIDHI_LT.put(courseId, JSON.stringify({ "mod-1": { done: true, titleKey: "intro" } }));

		const result = await updateCourseModule(env, courseId, "mod-2", { done: false, titleKey: "advanced" });

		expect(result).toEqual({ done: false, titleKey: "advanced" });

		const raw = await env.PORIDHI_LT.get(courseId);
		expect(JSON.parse(raw!)).toEqual({
			"mod-1": { done: true, titleKey: "intro" },
			"mod-2": { done: false, titleKey: "advanced" },
		});
	});

	it("updates an existing module key from false to true", async () => {
		const courseId = "uc-course-update";
		await env.PORIDHI_LT.put(courseId, JSON.stringify({ "mod-1": { done: false, titleKey: "t1" } }));

		const result = await updateCourseModule(env, courseId, "mod-1", { done: true });

		expect(result).toEqual({ done: true, titleKey: "t1" });
	});

	it("returns only the updated module info", async () => {
		const courseId = "uc-course-full";
		await env.PORIDHI_LT.put(
			courseId,
			JSON.stringify({ "mod-a": { done: true }, "mod-b": { done: false, titleKey: "before" } })
		);

		const result = await updateCourseModule(env, courseId, "mod-b", { done: true, titleKey: "after" });

		expect(result).toEqual({ done: true, titleKey: "after" });
	});
});
