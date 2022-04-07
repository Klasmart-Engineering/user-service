import fs from 'fs'
import { DataSource } from 'typeorm'
import yaml from 'js-yaml'
import logger from '../../src/logging'

// Seeding data for testing, especially is users
export async function loadFixtures(
    name: string,
    dbDataSource: DataSource
): Promise<any> {
    let items: any[] = []
    try {
        const file: any = yaml.load(
            fs.readFileSync(
                __dirname + `/../fixtures/data/${name}.yml`,
                'utf-8'
            )
        )
        items = file['fixtures']
    } catch (e) {
        logger.error(e as string, 'seeding data error')
    }

    if (!items) {
        return
    }

    for (const item of items) {
        const entityName = Object.keys(item)[0]
        const data = item[entityName]
        await dbDataSource
            .createQueryBuilder()
            .insert()
            .into(entityName)
            .values(data)
            .execute()
    }
}
