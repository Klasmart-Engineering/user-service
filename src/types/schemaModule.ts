import { GraphQLFieldResolver, GraphQLScalarType, DocumentNode } from 'graphql'
import { Context } from '../main'

/**
 * This custom type relaxes the requirement on
 * `GraphQLFieldResolver<TSource, TContext TArgs>`
 * by passing `TArgs = any` to overwrite the default
 * `TArgs = { [argument: string]: any }` value.
 *
 * This issue was raised and fixed in graphql v16,
 * but we're using graphql v15 atm
 * https://github.com/graphql/graphql-js/pull/3328
 *
 * Once it's fixed and used in apollo we'll import like this instead:
 * import { GraphQLSchemaModule } from 'apollo-graphql'
 *
 */
/* eslint-disable  @typescript-eslint/no-explicit-any */
export interface GraphQLSchemaModule {
    typeDefs: DocumentNode
    resolvers?: GraphQLResolverMap<any>
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
export interface GraphQLResolverMap<TContext = Context> {
    [typeName: string]:
        | {
              [fieldName: string]:
                  | GraphQLFieldResolver<any, TContext, any>
                  | {
                        requires?: string
                        resolve: GraphQLFieldResolver<any, TContext, any>
                    }
          }
        | GraphQLScalarType
        | {
              [enumValue: string]: string | number
          }
}
