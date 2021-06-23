export interface CustomError {
    code: string
    message: string
    params: Record<string, unknown>
}
