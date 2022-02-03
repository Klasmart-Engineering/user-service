// TypeORM config for use with the CLI, NOT the runtime application

import { ConnectionOptions } from 'typeorm'
import { getEnv } from './src/config/config'

const config: ConnectionOptions = {
    name: 'default',
    type: 'postgres',
    host: getEnv({ name: 'POSTGRES_HOST', orDefault: 'localhost' }),
    username: getEnv({ name: 'POSTGRES_USERNAME', orDefault: 'postgres' }),
    password: getEnv({ name: 'POSTGRES_PASSWORD', orDefault: 'kidsloop' }),
    url: getEnv({
        name: 'DATABASE_URL',
        orDefault: 'postgres://postgres:kidsloop@localhost/postgres',
    }),
    entities: ['src/entities/*{.ts,.js}'],
    migrations: ['migrations/*{.ts,.js}'],
    cli: {
        migrationsDir: 'migrations',
    },
}

export = config
