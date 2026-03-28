import { AutoRouter } from "itty-router"; 
import { handleGetCourseModules, handleGetModuleLabs, handleUpdateModuleLab } from "./handlers";

const router = AutoRouter();

router.get("/course/:courseId/modules", handleGetCourseModules);
router.post("/modules/:moduleId/labs", handleUpdateModuleLab);
router.get("/modules/:moduleId/labs", handleGetModuleLabs);

export default router;