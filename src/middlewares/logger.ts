import type express from 'express'
import { Logger } from '../logging'

export function loggerMiddlewareFactory(logger: Logger) {
    return function loggerMiddleware(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) {
        req.logger = logger.child({ correlationId: req.correlationId })
        next()
    }
}
