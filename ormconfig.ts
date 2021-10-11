// TypeORM config for use with the CLI, NOT the runtime application

import { ConnectionOptions } from 'typeorm'

const config: ConnectionOptions = {
    name: 'default',
    type: 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    username: process.env.POSTGRES_USERNAME || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'kidsloop',
    url:
        process.env.DATABASE_URL ||
        'postgres://postgres:kidsloop@localhost/postgres',
    entities: ['src/entities/*{.ts,.js}'],
    migrations: ['migrations/*{.ts,.js}'],
    cli: {
        migrationsDir: 'migrations',
    },
}

export = config
