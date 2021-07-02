import fs from 'fs'
import { Connection } from 'typeorm'

const yaml = require('js-yaml')

// Seeding data for testing, especially is users
export async function loadFixtures(
    name: string,
    dbConnection: Connection
): Promise<any> {
    let items: any[] = []
    try {
        const file: any = yaml.safeLoad(
            fs.readFileSync(
                __dirname + `/../fixtures/data/${name}.yml`,
                'utf-8'
            )
        )
        items = file['fixtures']
    } catch (e) {
        console.log('seeding data error', e)
    }

    if (!items) {
        return
    }

    items.forEach(async (item: any) => {
        const entityName = Object.keys(item)[0]
        const data = item[entityName]
        await dbConnection
            .createQueryBuilder()
            .insert()
            .into(entityName)
            .values(data)
            .execute()
    })
}
