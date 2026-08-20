import { Router } from "express";
import * as usersController from "../controllers/users.controller.js";

export const usersRouter = Router();

usersRouter.get("/me", usersController.getMe);
usersRouter.patch("/me", usersController.updateMe);
usersRouter.get("/users", usersController.listUsers);
usersRouter.post("/users", usersController.createEmployee);
usersRouter.get("/users/:id/hr-overview", usersController.getHrOverview);
usersRouter.get("/users/:id", usersController.getUser);
usersRouter.patch("/users/:id", usersController.updateUser);
usersRouter.get("/skills", usersController.listSkills);
usersRouter.post("/skills", usersController.addSkill);
