import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader'
import { loadTypedefsSync } from '@graphql-tools/load'
import { ApolloServer } from 'apollo-server-express'
import { Context } from '../main'
import { Model } from '../model'
import { checkToken } from '../token'
import { UserPermissions } from '../permissions/userPermissions'
import { IsAdminDirective } from '../directives/isAdmin'
import { IsAuthenticatedDirective } from '../directives/isAuthenticated'
import { IsMIMETypeDirective } from '../directives/isMIMEType'

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
                role: (_parent, args, _context, _info) => model.getRole(args),
                users_v1: (_parent, args, ctx, _info) =>
                    model.v1_getUsers(ctx, args),
                usersConnection: (_parent, args, ctx, _info) =>
                    model.usersConnection(ctx, args),
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
                grade: (_parent, args, ctx, _info) => model.getGrade(args, ctx),
                category: (_parent, args, ctx, _info) =>
                    model.getCategory(args, ctx),
                subcategory: (_parent, args, ctx, _info) =>
                    model.getSubcategory(args, ctx),
                subject: (_parent, args, ctx, _info) =>
                    model.getSubject(args, ctx),
                program: (_parent, args, ctx, _info) =>
                    model.getProgram(args, ctx),
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
                role: (_parent, args, _context, _info) => model.getRole(args),
                classes: () => model.getClasses(),
                class: (_parent, args, _context, _info) => model.getClass(args),
                school: (_parent, args, _context, _info) =>
                    model.getSchool(args),
                age_range: (_parent, args, ctx, _info) =>
                    model.getAgeRange(args, ctx),
                grade: (_parent, args, ctx, _info) => model.getGrade(args, ctx),
                category: (_parent, args, ctx, _info) =>
                    model.getCategory(args, ctx),
                subcategory: (_parent, args, ctx, _info) =>
                    model.getSubcategory(args, ctx),
                subject: (_parent, args, ctx, _info) =>
                    model.getSubject(args, ctx),
                program: (_parent, args, ctx, _info) =>
                    model.getProgram(args, ctx),
                createOrUpateSystemEntities: (_parent, _args, _ctx, _info) =>
                    model.createOrUpdateSystemEntities(),
                uploadOrganizationsFromCSV: (_parent, args, ctx, info) =>
                    model.uploadOrganizationsFromCSV(args, ctx, info),
                uploadUsersFromCSV: (_parent, args, ctx, info) =>
                    model.uploadUsersFromCSV(args, ctx, info),
                uploadClassesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadClassesFromCSV(args, ctx, info),
                uploadGradesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadGradesFromCSV(args, ctx, info),
                uploadSchoolsFromCSV: (_parent, args, ctx, info) =>
                    model.uploadSchoolsFromCSV(args, ctx, info),
                uploadSubCategoriesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadSubCategoriesFromCSV(args, ctx, info),
                uploadRolesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadRolesFromCSV(args, ctx, info),
                uploadCategoriesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadCategoriesFromCSV(args, ctx, info),
                uploadSubjectsFromCSV: (_parent, args, ctx, info) =>
                    model.uploadSubjectsFromCSV(args, ctx, info),
                uploadProgramsFromCSV: (_parent, args, ctx, info) =>
                    model.uploadProgramsFromCSV(args, ctx, info),
                uploadAgeRangesFromCSV: (_parent, args, ctx, info) =>
                    model.uploadAgeRangesFromCSV(args, ctx, info),
            },
        },
        schemaDirectives: {
            isAdmin: IsAdminDirective,
            isAuthenticated: IsAuthenticatedDirective,
            isMIMEType: IsMIMETypeDirective,
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
        uploads: false,
    })
