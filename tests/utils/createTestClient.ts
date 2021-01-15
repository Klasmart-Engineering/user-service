/**
 * The following file is an amalgamation of [Apollo Server Testing](https://github.com/apollographql/apollo-server/blob/main/packages/apollo-server-testing/src/createTestClient.ts)
 * and [apollo-server-integration-testing](https://github.com/zapier/apollo-server-integration-testing),
 * this allows the use of `headers` while making a request
 *
 * Credits to the original authors
 */

import express from 'express';
import { convertNodeHttpToRequest, runHttpQuery } from 'apollo-server-core';
import { ApolloServer } from 'apollo-server-express';
import { GraphQLResponse } from 'apollo-server-types';
import { print, DocumentNode } from 'graphql';
import httpMocks, { RequestOptions, ResponseOptions, Headers } from 'node-mocks-http';

type StringOrAst = string | DocumentNode;

/**
 * Tweak the `Request` object being used to run the operation
 * @param options The `RequestOptions`
 */
const mockRequest = (options: RequestOptions = {}) =>
  httpMocks.createRequest({
    method: 'POST',
    ...options,
  });

/**
 * Tweak the `Response` object being recieved from the operation
 * @param options The `ResponseOptions`
 */
const mockResponse = (options: ResponseOptions = {}) => httpMocks.createResponse(options);

/** A query must not come with a mutation */
type Query = {
  query: StringOrAst;
  mutation?: undefined;
  variables?: {
    [name: string]: unknown;
  };
  operationName?: string;
  headers?: Headers;
};

/** A mutation must not come with a query */
type Mutation = {
  mutation: StringOrAst;
  query?: undefined;
  variables?: {
    [name: string]: unknown;
  };
  operationName?: string;
  headers?: Headers;
};

/**
 * The interface to represent how a TestClient
 * should look like
 */
export interface ApolloServerTestClient {
  /**
   * Run a `GraphQL Query`
   * @returns Promise<GraphQLResponse>;
   */
  query: (query: Query) => Promise<GraphQLResponse>;
  /**
   * Run a `GraphQL Mutation`
   * @returns Promise<GraphQLResponse>;
   */
  mutate: (mutation: Mutation) => Promise<GraphQLResponse>;
}

/**
 * Create a Test Client to run operations
 * against your Apollo GraphQL Server
 *
 * **Prerequisites**
 * 1. Only works with [Apollo-Server-Express](https://www.npmjs.com/package/apollo-server-express) for the
 *    moment
 *
 * **Example Usage**
 * 1. Setup the `Apollo Server`
 * ```javascript
 * const apolloServer = new ApolloServer({
 *  schema,
 * });
 * ```
 * 2. Pass the `Apollo Server` to the `createTestClient` function
 * ```javascript
 * const { query, mutation } = createTestClient(apolloServer);
 * ```
 *
 * 3. Run Queries and Mutations as you would
 * ```javascript
 * const QUERY = gql`
 * ...[SOME_QUERY]
 * `;
 * const response = await query({
 *   query: QUERY,
 *   headers: {
 * ...[SOME_HEADERS]
 *   },
 * })
 * ```
 *
 * 4. Assert against the response
 * ```javascript
 * expect(response.data).not.toBeNull()
 * ```
 * | *[Jest](https://jestjs.io/) is used here as an example*
 *
 * @param server The `Apollo Server`
 * @returns `ApolloServerTestClient`
 */
export const createTestClient = (server: ApolloServer): ApolloServerTestClient => {
    const app = express();
    server.applyMiddleware({ app });

    const test = async ({ query, mutation, ...args }: Query | Mutation): Promise<GraphQLResponse> => {
        const operation = query || mutation;

        if (!operation || (query && mutation)) {
            throw new Error('Either `query` or `mutation` must be passed, but not both.');
        }

        /**
         * Set the `Headers` for the `Request`
         */
        const req = mockRequest({
            headers: args.headers,
        });
        const res = mockResponse();

        let variables;
        if (args.variables) {
            variables = args.variables;
        }

        const graphQLOptions = await server.createGraphQLServerOptions(req, res);

        const { graphqlResponse } = await runHttpQuery([req, res], {
            method: 'POST',
            options: graphQLOptions,
            query: {
                // operation can be a string or an AST, but `runHttpQuery` only accepts a string
                query: typeof operation === 'string' ? operation : print(operation),
                variables,
            },
            request: convertNodeHttpToRequest(req),
        });

        let gqlResponse = JSON.parse(graphqlResponse)
        gqlResponse.extensions = { cookies: res.cookies }

        return gqlResponse as GraphQLResponse;
    };

    return { query: test, mutate: test };
};
