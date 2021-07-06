import { mergeRawSchemas } from './helpers/mergeRawSchemas'
import gql from 'graphql-tag'
import directives from './directives'
import ageRange from './ageRange'
import category from './category'
import _class from './class'
import utils from './utils'
import grade from './grade'
import organization from './organization'
import permission from './permission'
import pagination from './pagination'
import filtering from './filtering'
import program from './program'
import role from './roles'
import school from './school'
import subcategory from './subcategory'
import subject from './subject'
import user from './user'
import enums from './enums'
import scalars from './scalars'
import { Model } from '../model'
import { IsAdminDirective } from '../directives/isAdmin'
import { IsAuthenticatedDirective } from '../directives/isAuthenticated'
import { IsMIMETypeDirective } from '../directives/isMIMEType'
import { Context } from '../main'

export default function getDefault(model: Model, context?: Context) {
    const schemas = mergeRawSchemas(
        utils(model, context),
        pagination(model, context),
        filtering(model, context),
        ageRange(model, context),
        category(model, context),
        _class(model, context),
        grade(model, context),
        organization(model, context),
        permission(model, context),
        program(model, context),
        role(model, context),
        school(model, context),
        subcategory(model, context),
        subject(model, context),
        user(model, context)
    )
    const schema = mergeRawSchemas(
        {
            typeDefs: [
                // we create empty main types, we can later extend them in the shards
                gql`
                    type Query {
                        _empty: String
                    }
                    type Mutation {
                        _empty: String
                    }
                `,
            ]
                .concat(enums)
                .concat(directives),
            schemaDirectives: {
                isAdmin: IsAdminDirective,
                isAuthenticated: IsAuthenticatedDirective,
                isMIMEType: IsMIMETypeDirective,
            },
            resolvers: {},
        },
        schemas,
        scalars
    )
    return schema
}
