//
// Development version of main.ts, not to be used in production.
//
// Uses https-localhost to start an HTTPS dev server that a local frontend can connect to.
// In order to access https://fe.kidsloop.net:8080, the host file on the machine must
// be updated to point to localhost.
//

import './utils/dotenv'

import { initApp } from './app'
import https from 'https'

// don't bother with types as this is just a dev tool
// eslint-disable-next-line @typescript-eslint/no-var-requires
const httpsLocalhost = require('https-localhost')()

// The frontend uses port 8080, so use 3000 instead
const port = 3000

initApp()
    .then(async (app) => {
        const certs = await httpsLocalhost.getCerts()

        https.createServer(certs, app.expressApp).listen(port, () => {
            console.log(
                `🌎 Development server ready at https://fe.kidsloop.net:${port}${app.apolloServer.graphqlPath}`
            )
        })
    })
    .catch((e) => {
        console.error(e)
        process.exit(-1)
    })
