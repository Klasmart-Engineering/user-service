import { HttpQueryError, GraphQLResponse } from "apollo-server-core"

export async function gqlTry(gqlOperation: () => Promise<GraphQLResponse>) {
    try {
        const res = await gqlOperation();
        if (res.errors) {
            throw new Error(res.errors?.map(x => x.message).join('\n'));
        }
        return res;
    } catch (e) {
        if (e instanceof HttpQueryError) {
            throw new Error(JSON.parse(e.message).errors.map((x: { message: string; }) => x.message).join('\n'));
        } else {
            throw e;
        }
    }
}