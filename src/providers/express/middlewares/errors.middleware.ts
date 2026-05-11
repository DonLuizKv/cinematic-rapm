import { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { ErrorManager } from "../../../errors/ErrorManager";
import { Logger } from "../../logs/logger";

export const errorsMiddleware: ErrorRequestHandler = (err: ErrorManager, req: Request, res: Response, next: NextFunction) => {
    let error = err;

    if (!(err instanceof ErrorManager)) {
        error = new ErrorManager("Internal server error", 500, false);
    }

    const { statusCode, message, isOperational } = error;
    
    if (!isOperational) {
        Logger.error(`UNEXPECTED ERROR: ${err}`);
    }

    Logger.error(err);

    res.status(statusCode).json({ message });
};