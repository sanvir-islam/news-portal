import express from "express";
import apiRoutes from "./api";

const router = express.Router();

router.use("/", apiRoutes);

export default router;
