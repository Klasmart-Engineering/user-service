import axios from 'axios'
import csvParser from 'csv-parser'
import fs from 'fs'
import path from 'path'

const PERMISSIONS_CSV_URL =
    'https://docs.google.com/spreadsheets/d/1C1g-Q3UUsBBnDTXIFq75FSNdRN9Mr1qbJzyTYlpTePU/export?format=csv'
const PERMISSIONS_CSV_INFO_URL =
    'https://docs.google.com/spreadsheets/d/1C1g-Q3UUsBBnDTXIFq75FSNdRN9Mr1qbJzyTYlpTePU/export?format=csv&gid=680886613'
const PERMISSION_FILE = path.join(__dirname, '../fixtures/permissions.csv')
const PERMISSION_INFO_FILE = path.join(
    __dirname,
    '../../src/permissions/permissionInfo.csv'
)

interface PermissionInfo {
    name: string
    superAdmin: boolean
    orgAdmin: boolean
    teacher: boolean
    schoolAdmin: boolean
    parent: boolean
    student: boolean
}

export const latestPermissions = async (forceDownload = false) => {
    const permissions: Map<string, PermissionInfo> = new Map()

    if (forceDownload) {
        const permissions = await axios.get(PERMISSIONS_CSV_URL, {
            responseType: 'stream',
        })

        await permissions.data.pipe(fs.createWriteStream(PERMISSION_FILE))

        const permissionInfo = await axios.get(PERMISSIONS_CSV_INFO_URL, {
            responseType: 'stream',
        })

        await permissionInfo.data.pipe(
            fs.createWriteStream(PERMISSION_INFO_FILE)
        )
    }

    const readStream = await fs.createReadStream(PERMISSION_FILE)
    const csvPermissions = await new Promise((resolve) =>
        readStream
            .pipe(csvParser())
            .on('data', (row: any) => {
                const key: string = row['Code']

                permissions.set(key, {
                    name: row['Permission'],
                    superAdmin: row['Super Admin'] == 'x',
                    orgAdmin: row['Organization Admin (Seed Admin)'] == 'x',
                    teacher: row['Teacher'] == 'x',
                    schoolAdmin: row['School Admin'] == 'x',
                    parent: row['Parent'] == 'x',
                    student: row['Student'] == 'x',
                })

                return row
            })
            .on('end', resolve)
    )

    return permissions
}
