import express from "express"
import { ApolloServer } from "apollo-server-express";
import * as Sentry from "@sentry/node";
import WebSocket from "ws";
import { checkToken } from "./token";
import { Model } from "./model";
import { loadTypedefsSync } from '@graphql-tools/load';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import cookieParser from 'cookie-parser'
import cors, { CorsOptions } from "cors"
import * as dotenv from "dotenv";
dotenv.config({ path: __dirname+'/../.env' });


const routePrefix = process.env.ROUTE_PREFIX || ""

Sentry.init({
    dsn: "https://b78d8510ecce48dea32a0f6a6f345614@o412774.ingest.sentry.io/5388815",
    environment: process.env.NODE_ENV || "not-specified",
    release: "kidsloop-users-gql@" + process.env.npm_package_version,
});

export interface Context {
    token?: any
    sessionId?: string
    websocket?: WebSocket
}


async function main() {
    try {
        const model = await Model.create()
        const server = new ApolloServer({
            typeDefs: loadTypedefsSync('./schema.graphql', { loaders: [new GraphQLFileLoader()] })[0].document,
            subscriptions: {
                keepAlive: 1000,
                onConnect: async ({ authToken, sessionId }: any, websocket, connectionData: any): Promise<Context> => {
                    const token = await checkToken(authToken)
                    return { sessionId, token, websocket };
                },
                onDisconnect: (websocket, connectionData) => {  }
            },
            resolvers: {
                Query: {
                    me: (_parent, _args, context, _info) => model.getMyUser(context),
                    users: () => model.getUsers(),
                    user: (_parent, { user_id }, _context, _info) => model.getUser(user_id),
                    organizations: (_parent, { organization_ids }, _context, _info) => model.getOrganizations(organization_ids),
                    organization: (_parent, { organization_id }, _context, _info) => model.getOrganization(organization_id),
                    roles: () => model.getRoles(),
                    role: (_parent, args, _context, _info) => model.setRole(args),
                    classes: () => model.getClasses(),
                    class: (_parent, args, _context, _info) => model.getClass(args),
                    shortCode: (_parent, args, _context, _info) => model.GetShortCode(args),

                },
                Mutation: {
                    me: (_parent, _args, context, _info) => model.getMyUser(context),
                    user: (_parent, args, _context, _info) => model.setUser(args),
                    newUser: (_parent, args, _context, _info) => model.newUser(args),
                    organization: (_parent, args, _context, _info) => model.setOrganization(args),
                    roles: () => model.getRoles(),
                    role: (_parent, args, _context, _info) => model.setRole(args),
                    classes: () => model.getClasses(),
                    class: (_parent, args, _context, _info) => model.getClass(args)
                },
                OrganizationResult: {
                    __resolveType(obj: any) {
                        if(obj.errors){
                            return 'ValidationErrors'
                        }
                        if(obj.shortCode){
                            return "Organization"
                        }
                        return null;
                    }
                }
            },
            context: async ({ req, connection }) => {
                if (connection) { return connection.context }
                const encodedToken = req.headers.authorization||req.cookies.access
                const token = await checkToken(encodedToken)
                return { token };
            },
            playground: {
                settings: {
                    "request.credentials": "include"
                }
            },
        });

        const app = express()
        const corsConfiguration: CorsOptions = {
            allowedHeaders: ["Authorization","Content-Type"],
            credentials: true,
            preflightContinue: false,
            origin: true
        }
        app.options('*',cors(corsConfiguration))
        app.use(cookieParser())
        server.applyMiddleware({
            app,
            cors: corsConfiguration,
            path: routePrefix
        })
        const port = process.env.PORT || 8080;
        app.listen(port, () => console.log(`🌎 Server ready at http://localhost:${port}${server.graphqlPath}`));
    } catch (e) {
        console.error(e);
        process.exit(-1);
    }
}
main();
