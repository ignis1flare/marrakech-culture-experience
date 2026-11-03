import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marrakechAuthRouter from "./marrakech-auth";
import marrakechCultureRouter from "./marrakech-culture";
import marrakechPresentationRouter from "./marrakech-presentations";
import marrakechPollRouter from "./marrakech-polls";
import marrakechAudienceRouter from "./marrakech-audience";
import marrakechQuizRouter from "./marrakech-quiz";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marrakechAuthRouter);
router.use(marrakechCultureRouter);
router.use(marrakechPresentationRouter);
router.use(marrakechPollRouter);
router.use(marrakechAudienceRouter);
router.use(marrakechQuizRouter);

export default router;
