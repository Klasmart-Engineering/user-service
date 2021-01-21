import csvParser from 'csv-parser'
import fs from 'fs'
import path from 'path'

const PERMISSION_INFO_FILE = path.join(__dirname, './permissionInfo.csv')

interface PermissionDetails {
    name: string
    category: string
    section: string
    description: string
}

export const permissionInfo = async () => {
    const permissionsInfo: Map<string, PermissionDetails> = new Map()

    const readStream = await fs.createReadStream(PERMISSION_INFO_FILE)
    await new Promise((resolve) =>
        readStream
            .pipe(csvParser())
            .on('data', (row: any) => {
                const key: string = row['Permission Name (BE)']

                permissionsInfo.set(key, {
                    name: row['Permission Name (BE)'],
                    category:
                        row[
                            'Permission Category (BE)\n(Accounts, Live, Library, Assessments, Schedule, Reports, General)'
                        ],
                    section:
                        row[
                            'Permission Level \n(Super Admin, Org Admin, School Admin, Teacher, Parent, Student, Operational)'
                        ],
                    description: row['Description'],
                })

                return row
            })
            .on('end', resolve)
    )

    return permissionsInfo
}
