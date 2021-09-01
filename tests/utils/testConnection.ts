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

export const createMigrationsTestConnection = (
    drop: boolean = false,
    synchronize: boolean = false,
    name: string = 'default'
) => {
    return createConnection({
        name: name,
        type: 'postgres',
        url:
            process.env.DATABASE_URL ||
            'postgres://postgres:kidsloop@localhost/testdb',
        synchronize,
        dropSchema: drop,
        migrations: ['migrations/*.ts'],
        entities: ['src/entities/*.ts'],
    })
}
