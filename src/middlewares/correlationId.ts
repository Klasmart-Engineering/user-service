import cuid from 'cuid'
import type express from 'express'

export const CORRELATION_ID_HEADER = 'Correlation-ID'

export function correlationIdMiddleware(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    const correlationId: string = req.header(CORRELATION_ID_HEADER) || cuid()
    req.correlationId = correlationId
    res.setHeader(CORRELATION_ID_HEADER, correlationId)
    next()
}
