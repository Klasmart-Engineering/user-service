// TypeORM config for use with the CLI, NOT the runtime application

import { ConnectionOptions } from 'typeorm'
import { getEnvVar } from './src/config/config'

const config: ConnectionOptions = {
    name: 'default',
    type: 'postgres',
    host: getEnvVar('POSTGRES_HOST', 'localhost'),
    username: getEnvVar('POSTGRES_USERNAME', 'postgres'),
    password: getEnvVar('POSTGRES_PASSWORD', 'kidsloop'),
    url: getEnvVar(
        'DATABASE_URL',
        'postgres://postgres:kidsloop@localhost/postgres'
    ),
    entities: ['src/entities/*{.ts,.js}'],
    migrations: ['migrations/*{.ts,.js}'],
}

export = config
