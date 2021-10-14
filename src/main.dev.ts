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

import createServer from 'https-localhost'
import { getCerts } from 'https-localhost/certs'
import logger from './logging'

createServer()

// The frontend uses port 8080, so use 3000 instead
const port = 3000

initApp()
    .then(async (app) => {
        const certs = await getCerts()

        https.createServer(certs, app.expressApp).listen(port, () => {
            logger.info(
                '🌎 Development server ready at https://fe.alpha.kidsloop.net:%s%s',
                port,
                app.apolloServer.graphqlPath
            )
        })
    })
    .catch((e) => {
        logger.fatal(e)
        process.exit(-1)
    })
