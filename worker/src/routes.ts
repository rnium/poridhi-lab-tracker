import { AutoRouter } from "itty-router"; 
import { handleGetCourseModules, handleGetModuleLabs, handleUpdateModuleLabs } from "./handlers";
import { withAuthenticate } from "./middleware";

const router = AutoRouter().all("*", withAuthenticate);

router.get("/course/:courseId/modules", handleGetCourseModules);
router.post("/course/:courseId/modules/:moduleId/labs", handleUpdateModuleLabs);
router.get("/modules/:moduleId/labs", handleGetModuleLabs);

export default router;