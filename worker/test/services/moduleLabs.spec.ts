import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { getModuleLabs, updateModuleLabs } from "../../src/services/moduleLabs";

describe("getModuleLabs", () => {
	it("returns null when module does not exist", async () => {
		const result = await getModuleLabs(env, "no-such-module");
		expect(result).toBeNull();
	});

	it("returns the parsed labs object when key exists", async () => {
		const moduleId = "gml-mod-1";
		const labs = { "lab-1": true, "lab-2": false };
		await env.PORIDHI_LT.put(moduleId, JSON.stringify(labs));

		const result = await getModuleLabs(env, moduleId);
		expect(result).toEqual(labs);
	});

	it("returns an empty object when stored value is {}", async () => {
		const moduleId = "gml-mod-empty";
		await env.PORIDHI_LT.put(moduleId, JSON.stringify({}));

		const result = await getModuleLabs(env, moduleId);
		expect(result).toEqual({});
	});
});

describe("updateModuleLabs", () => {
	it("creates a new entry when module does not exist", async () => {
		const moduleId = "uml-mod-new";
		const result = await updateModuleLabs(env, moduleId, [{ labId: "lab-1", done: true }]);

		expect(result).toEqual({ "lab-1": true });

		const raw = await env.PORIDHI_LT.get(moduleId);
		expect(JSON.parse(raw!)).toEqual({ "lab-1": true });
	});

	it("adds a new lab key to an existing module", async () => {
		const moduleId = "uml-mod-add";
		await env.PORIDHI_LT.put(moduleId, JSON.stringify({ "lab-1": true }));

		const result = await updateModuleLabs(env, moduleId, [{ labId: "lab-2", done: false }]);

		expect(result).toEqual({ "lab-1": true, "lab-2": false });
	});

	it("updates an existing lab from false to true", async () => {
		const moduleId = "uml-mod-update";
		await env.PORIDHI_LT.put(moduleId, JSON.stringify({ "lab-1": false }));

		const result = await updateModuleLabs(env, moduleId, [{ labId: "lab-1", done: true }]);

		expect(result["lab-1"]).toBe(true);
	});

	it("updates an existing lab from true to false", async () => {
		const moduleId = "uml-mod-revert";
		await env.PORIDHI_LT.put(moduleId, JSON.stringify({ "lab-1": true }));

		const result = await updateModuleLabs(env, moduleId, [{ labId: "lab-1", done: false }]);

		expect(result["lab-1"]).toBe(false);
	});

	it("preserves other labs when updating one", async () => {
		const moduleId = "uml-mod-preserve";
		await env.PORIDHI_LT.put(
			moduleId,
			JSON.stringify({ "lab-1": true, "lab-2": true })
		);

		const result = await updateModuleLabs(env, moduleId, [{ labId: "lab-2", done: false }]);

		expect(result).toEqual({ "lab-1": true, "lab-2": false });
	});

	it("persists the update to KV", async () => {
		const moduleId = "uml-mod-persist";
		await updateModuleLabs(env, moduleId, [{ labId: "lab-x", done: true }]);

		const raw = await env.PORIDHI_LT.get(moduleId);
		expect(raw).toBeTruthy();
		expect(JSON.parse(raw!)["lab-x"]).toBe(true);
	});
});
