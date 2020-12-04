import { expect } from "chai";
import { HttpQueryError, GraphQLResponse } from "apollo-server-core"

export async function gqlTry(gqlOperation: () => Promise<GraphQLResponse>) {
    try {
        const res = await gqlOperation();
        expect(res.errors, res.errors?.map(x => x.message).join('\n')).to.be.undefined;
        return res;
    } catch (e) {
        if (e instanceof HttpQueryError) {
            throw new Error(JSON.parse(e.message).errors.map((x: { message: string; }) => x.message).join('\n'));
        } else {
            throw e;
        }
    }
}