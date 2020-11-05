import { expect } from "chai";
import { Connection } from "typeorm"
import { createTestClient } from "apollo-server-testing"
import { Model } from "../../src/model";
import { createTestConnection } from "../utils/testConnection";
import { createServer } from "../../src/utils/createServer";
import { Role } from "../../src/entities/role";

const GET_ROLES = `
    query getRoles {
        roles {
            role_id
            role_name
        }
    }
`;

describe("getRoles", () => {
    let connection: Connection;

    before(async () => {
        connection = await createTestConnection();
    });
    
    after(async () => {
        await connection?.close();
    });

    it("should get roles", async () => {
        const server = createServer(new Model(connection), () => { });
        const { query } = createTestClient(server);

        const res = await query({
            query: GET_ROLES,
        });

        expect(res.errors).to.be.undefined;
        const roles = res.data.roles as Role[];
        expect(roles).to.exist;
    });
});