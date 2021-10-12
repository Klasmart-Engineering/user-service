declare namespace Express {
    interface Request {
        correlationId: string
        logger: import('../../src/logging').Logger
    }
}
