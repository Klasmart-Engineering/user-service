import { createConnection } from "typeorm";

export const createTestConnection = (drop: boolean = false) => {
    return createConnection({
        name: "default",
        type: "postgres",
        host: "localhost",
        port: 5432,
        username: "postgres",
        password: "kidsloop",
        database: "testdb",
        synchronize: drop,
        dropSchema: drop,
        entities: ["src/entities/*.ts"]
    });
};