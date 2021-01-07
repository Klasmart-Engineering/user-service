import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader'
import { loadTypedefsSync } from '@graphql-tools/load'
import { ApolloServer } from 'apollo-server-express'
import { Context } from '../main'
import { Model } from '../model'
import { checkToken } from '../token'
import { UserPermissions } from '../permissions/userPermissions'

export const createServer = (model: Model, context?: any) =>
    new ApolloServer({
        typeDefs: loadTypedefsSync('./schema.graphql', {
            loaders: [new GraphQLFileLoader()],
        })[0].document,
        resolvers: {
            Query: {
                me: (_parent, _args, _context, _info) =>
                    model.getMyUser(context),
                users: () => model.getUsers(),
                user: (_parent, { user_id }, _context, _info) =>
                    model.getUser(user_id),
                organizations: (
                    _parent,
                    { organization_ids },
                    _context,
                    _info
                ) => model.getOrganizations(organization_ids),
                organization: (_parent, { organization_id }, _context, _info) =>
                    model.getOrganization(organization_id),
                roles: () => model.getRoles(),
                role: (_parent, args, _context, _info) => model.setRole(args),
                classes: () => model.getClasses(),
                class: (_parent, args, _context, _info) => model.getClass(args),
                school: (_parent, args, _context, _info) =>
                    model.getSchool(args),
            },
            Mutation: {
                me: (_parent, _args, _context, _info) =>
                    model.getMyUser(context),
                user: (_parent, args, _context, _info) => model.setUser(args),
                newUser: (_parent, args, _context, _info) =>
                    model.newUser(args),
                organization: (_parent, args, _context, _info) =>
                    model.setOrganization(args),
                roles: () => model.getRoles(),
                role: (_parent, args, _context, _info) => model.setRole(args),
                classes: () => model.getClasses(),
                class: (_parent, args, _context, _info) => model.getClass(args),
                school: (_parent, args, _context, _info) =>
                    model.getSchool(args),
            },
        },
        subscriptions: {
            keepAlive: 1000,
            onConnect: async (
                { authToken, sessionId }: any,
                websocket,
                connectionData: any
            ): Promise<Context> => {
                const token = await checkToken(authToken)
                const permissions = new UserPermissions(token && token.id)
                return { sessionId, token, websocket, permissions }
            },
        },
        context:
            context ??
            (async ({ req, connection }) => {
                if (connection) {
                    return connection.context
                }
                const encodedToken =
                    req.headers.authorization || req.cookies.access
                const token = (await checkToken(encodedToken)) as any
                const permissions = new UserPermissions(token)

                if (!token) {
                    console.log('User not authenticated')
                }

                return { token, permissions }
            }),
        playground: {
            settings: {
                'request.credentials': 'include',
            },
        },
    })
