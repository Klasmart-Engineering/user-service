import { expect } from 'chai'
import http from 'http'
import request from 'supertest'
import { createExpressApp, DOMAIN } from '../../../src/app'
import { DEFAULT_CORRELATION_HEADER } from 'kidsloop-nodejs-logger'

context('cors', () => {
    let server: http.Server

    before(() => {
        const app = createExpressApp({ routePrefix: 'user/' })
        server = http.createServer(app)
    })

    after(async () => {
        await new Promise<void>((resolve) => {
            server.close(() => resolve())
        })
    })

    it('does not provide Access-Control-Allow-Origin for CORS requests on other domain', async () => {
        const res = await request(server)
            .options('')
            .set('Origin', 'https://some.other.domain')
            .expect(204)
        expect(res.headers).to.not.have.key('Access-Control-Allow-Origin')
    })
    ;[
        { origin: `https://subdomain.${DOMAIN}`, type: 'a subdomain' },
        {
            origin: `https://subdomain.${DOMAIN}:3000`,
            type: 'a subdomain on a specific port',
        },
        { origin: `https://${DOMAIN}`, type: 'the same domain' },
    ].forEach(({ origin, type }) =>
        it(`supplies Access-Control-Allow-Origin header if CORS request from ${type}`, async () => {
            await request(server)
                .options('')
                .set('Origin', origin)
                .expect(204)
                .expect('Access-Control-Allow-Origin', origin)
        })
    )

    it('reflects the CORS settings in the response headers', async () => {
        await request(server)
            .options('')
            .expect(
                'Access-Control-Allow-Headers',
                `Authorization,Content-Type,${DEFAULT_CORRELATION_HEADER}`
            )
            .expect('Access-Control-Allow-Credentials', 'true')
            .expect('Access-Control-Max-Age', `${60 * 60 * 24}`)
    })
})
