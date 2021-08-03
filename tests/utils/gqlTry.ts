import { HttpQueryError, GraphQLResponse } from 'apollo-server-core'
import csvErrorConstants from '../../src/types/errors/csv/csvErrorConstants'
import { CustomError } from '../../src/types/csv/csvError'
import * as util from 'util'

export async function gqlTry(gqlOperation: () => Promise<GraphQLResponse>) {
    try {
        const res = await gqlOperation()
        if (res.errors) {
            if (res.errors[0].message == csvErrorConstants.ERR_CSV_BAD_INPUT) {
                throw new CustomError(res.errors[0]?.extensions?.exception?.errors)
            } else {
                throw new Error(res.errors?.map((x) => x.message).join('\n'))
            }
        }
        return res
    } catch (e) {
        if (e instanceof HttpQueryError) {
            throw new Error(
                JSON.parse(e.message)
                    .errors.map((x: { message: string }) => x.message)
                    .join('\n')
            )
        } else {
            throw e
        }
    }
}
