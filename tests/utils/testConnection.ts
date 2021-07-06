import { createConnection } from 'typeorm'

export const createTestConnection = (
    drop: boolean = false,
    name: string = 'default'
) => {
    return createConnection({
        name: name,
        type: 'postgres',
        url:
            process.env.DATABASE_URL ||
            'postgres://postgres:kidsloop@localhost/testdb',
        synchronize: drop,
        dropSchema: drop,
        entities: ['src/entities/*.ts'],
    })
}
