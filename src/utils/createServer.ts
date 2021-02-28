import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader'
import { loadTypedefsSync } from '@graphql-tools/load'
import { ApolloServer } from 'apollo-server-express'
import { Context } from '../main'
import { Model } from '../model'
import { checkToken } from '../token'
import { UserPermissions } from '../permissions/userPermissions'
import { IsAdminDirective } from '../directives/isAdmin'
import { IsAuthenticatedDirective } from '../directives/isAuthenticated'

export const createServer = (model: Model, context?: any) =>
    new ApolloServer({
        typeDefs: loadTypedefsSync('./schema.graphql', {
            loaders: [new GraphQLFileLoader()],
        })[0].document,
        resolvers: {
            Query: {
                me: (_parent, _args, ctx, _info) => model.getMyUser(ctx),
                users: (_parent, _args, ctx, _info) => model.getUsers(),
                user: (_parent, { user_id }, _context, _info) =>
                    model.getUser(user_id),
                my_users: (_parent, _args, ctx, info) =>
                    model.myUsers({}, ctx, info),
                organizations: (_parent, args, _context, _info) =>
                    model.getOrganizations(args),
                organization: (_parent, { organization_id }, _context, _info) =>
                    model.getOrganization(organization_id),
                roles: () => model.getRoles(),
                role: (_parent, args, _context, _info) => model.setRole(args),
                users_v1: (_parent, args, ctx, _info) =>
                    model.v1_getUsers(ctx, args),
                roles_v1: (_parent, args, ctx, _info) =>
                    model.v1_getRoles(ctx, args),
                permissions: (_parent, args, ctx, _info) =>
                    model.getPermissions(ctx, args),
                organizations_v1: (_parent, args, ctx, _info) =>
                    model.v1_getOrganizations(ctx, args),
                class: (_parent, args, _context, _info) => model.getClass(args),
                classes: () => model.getClasses(),
                classes_v1: (_parent, args, ctx, _info) =>
                    model.v1_getClasses(ctx, args),
                school: (_parent, args, _context, _info) =>
                    model.getSchool(args),
                age_range: (_parent, args, ctx, _info) =>
                    model.getAgeRange(args, ctx),
            },
            Mutation: {
                me: (_parent, _args, ctx, _info) => model.getMyUser(ctx),
                user: (_parent, args, _context, _info) => model.setUser(args),
                switch_user: (_parent, args, ctx, info) =>
                    model.switchUser(args, ctx, info),
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
                age_range: (_parent, args, ctx, _info) =>
                    model.getAgeRange(args, ctx),
                createOrUpateSystemEntities: (_parent, _args, _ctx, _info) =>
                    model.createOrUpdateSystemEntities(),
            },
        },
        schemaDirectives: {
            isAdmin: IsAdminDirective,
            isAuthenticated: IsAuthenticatedDirective,
        },
        subscriptions: {
            keepAlive: 1000,
            onConnect: async (
                { authToken, sessionId, req }: any,
                websocket,
                connectionData: any
            ): Promise<Context> => {
                const token = await checkToken(authToken)
                const permissions = new UserPermissions(
                    token && token.id,
                    req.cookies
                )
                return { sessionId, token, websocket, permissions }
            },
        },
        context:
            context ??
            (async ({ res, req, connection }) => {
                if (connection) {
                    return connection.context
                }
                const encodedToken =
                    req.headers.authorization || req.cookies.access
                const token = (await checkToken(encodedToken)) as any
                const permissions = new UserPermissions(token, req.cookies)

                return { token, permissions, res, req }
            }),
        playground: {
            settings: {
                'request.credentials': 'include',
            },
        },
    })
