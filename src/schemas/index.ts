import { GraphQLSchema } from 'graphql'
import { buildSubgraphSchema } from '@apollo/subgraph'

import directives from './directives'
import ageRange from './ageRange'
import category from './category'
import _class from './class'
import { module as complexity } from './complexity'
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
import organizationMembership from './organizationMembership'
import myUser from './myUser'
import schoolMembership from './schoolMembership'
import enums from './enums'
import scalars from './scalars'
import { Model } from '../model'
import { Context } from '../main'
import { GraphQLSchemaModule } from '../types/schemaModule'
import academicTerm from './academicTerm'

export default function getDefault(
    model: Model,
    context?: Context
): GraphQLSchema {
    const modules: GraphQLSchemaModule[] = [
        utils(model, context),
        pagination,
        filtering(model, context),
        academicTerm(),
        ageRange(model, context),
        category(model, context),
        _class(model, context),
        complexity,
        grade(model, context),
        organization(model, context),
        permission(model, context),
        program(model, context),
        role(model, context),
        school(model, context),
        subcategory(model, context),
        subject(model, context),
        user(model, context),
        myUser(model),
        schoolMembership(model),
        organizationMembership(model, context),
        ...enums,
        ...directives,
        ...scalars,
    ]

    const federatedSchema = buildSubgraphSchema(modules)
    return federatedSchema
}
