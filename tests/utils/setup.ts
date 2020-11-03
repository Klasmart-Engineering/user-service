import { createTestConnection } from "./testConnection";

export const mochaGlobalSetup = async () => {
    console.log("mochaGlobalSetup");
};
  
export const mochaGlobalTeardown = async () => {
    console.log("mochaGlobalTeardown");
};

export const mochaHooks = {
    async beforeAll() {
        console.log("mochaHooks.beforeAll");
        const conn = await createTestConnection(true);
        await conn.close();
    },
    beforeEach() {
        console.log("mochaHooks.beforeEach");
    }
};