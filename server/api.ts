import { Router } from "express";
import { dashboardRouter } from "./routes/dashboard.ts";
import { subtopicsRouter, syllabusRouter } from "./routes/syllabus.ts";
import { questionsRouter } from "./routes/questions.ts";
import { attemptsRouter } from "./routes/attempts.ts";
import { tasksRouter } from "./routes/tasks.ts";
import { sessionsRouter } from "./routes/sessions.ts";
import { settingsRouter } from "./routes/settings.ts";
import { themeRouter } from "./routes/theme.ts";
import { aiRouter } from "./routes/ai.ts";

export const apiRouter = Router();

apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/syllabus", syllabusRouter);
apiRouter.use("/chapters", syllabusRouter);
apiRouter.use("/subtopics", subtopicsRouter);
apiRouter.use("/questions", questionsRouter);
apiRouter.use("/attempts", attemptsRouter);
apiRouter.use("/tasks", tasksRouter);
apiRouter.use("/sessions", sessionsRouter);
apiRouter.use("/settings", settingsRouter);
apiRouter.use("/theme", themeRouter);
apiRouter.use("/ai", aiRouter);
