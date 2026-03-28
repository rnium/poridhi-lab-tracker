declare module "cloudflare:test" {
	interface ProvidedEnv extends Env {
		  PORIDHI_LT: KVNamespace;
	}
}

interface CourseModules extends Record<string, boolean> {
}

interface ModulesLabs extends Record<string, boolean> {
}
