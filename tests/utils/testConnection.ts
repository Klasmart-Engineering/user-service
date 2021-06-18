import { createConnection } from 'typeorm'

export const createTestConnection = (
    drop: boolean = false,
    name: string = 'default'
) => {
    return createConnection({
        name: name,
        type: 'postgres',
        host: process.env.DATABASE_HOST || 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'kidsloop',
        database: 'testdb',
        synchronize: drop,
        dropSchema: drop,
        entities: ['src/entities/*.ts'],
    })
}
