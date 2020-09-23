import { ApolloServer } from "apollo-server";
import * as Sentry from "@sentry/node";
import WebSocket from "ws";
import { checkToken } from "./token";
import { importSchema } from 'graphql-import'
import { Model } from "./model";

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
        const typeDefs = importSchema('./schema.graphql')
        const model = await Model.create()
        const server = new ApolloServer({
            typeDefs,
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
                    users: () => model.getUsers(),
                    organizations: () => model.getOrganizations(),
                    user: (_parent, {id}, _context, _info) => model.getUser(id),
                    organization: (_parent, {id}, _context, _info) => model.getOrganization(id),
                },
                Mutation: {
                    user: (_parent, args, _context, _info) => model.setUser(args),
                    newUser: (_parent, args, _context, _info) => model.newUser(args),
                    organization: (_parent, args, _context, _info) => model.setOrganization(args),
                    newOrganization: (_parent, args, _context, _info) => model.newOrganization(args),
                },
            },
            context: async ({ req, connection }) => {
                if (connection) { return connection.context }
                const token = await checkToken(req.headers.authorization)
                return { token: req.headers.authorization };
            }
        });

        const port = process.env.PORT || 8080;
        server.listen({ port }, () => console.log(`🌎 Server ready at http://localhost:${port}${server.graphqlPath}`));
    } catch (e) {
        console.error(e);
        process.exit(-1);
    }
}
main();
