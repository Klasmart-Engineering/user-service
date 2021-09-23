declare module 'https-localhost' {
    import type { Express } from 'express'

    export default function createServer(domain?: string): Express
}

declare module 'https-localhost/certs' {
    import type { ServerOptions } from 'https'
    export function getCerts(customDomain?: string): Promise<ServerOptions>
}
