import { latestPermissions, PermissionInfo } from './utils/latestPermissions'
import * as fs from 'fs'

const roleInfos: {
    typeName: string
    roleName: string
    csvColumn: keyof PermissionInfo
    file: string
}[] = [
    {
        typeName: 'organizationAdminRole',
        roleName: 'Organization Admin',
        csvColumn: 'orgAdmin',
        file: 'organizationAdmin',
    },
    {
        typeName: 'parentRole',
        roleName: 'Parent',
        csvColumn: 'parent',
        file: 'parent',
    },
    {
        typeName: 'schoolAdminRole',
        roleName: 'School Admin',
        csvColumn: 'schoolAdmin',
        file: 'schoolAdmin',
    },
    {
        typeName: 'studentRole',
        roleName: 'Student',
        csvColumn: 'student',
        file: 'student',
    },
    {
        typeName: 'teacherRole',
        roleName: 'Teacher',
        csvColumn: 'teacher',
        file: 'teacher',
    },
    {
        typeName: 'superAdminRole',
        roleName: 'Super Admin',
        csvColumn: 'superAdmin',
        file: 'superAdmin',
    },
]

async function update() {
    const latestPerms = await latestPermissions()
    for (const roleInfo of roleInfos) {
        const rolePermissions = []
        for (const [permissionName, permissionInfo] of latestPerms.entries()) {
            if (permissionInfo[roleInfo.csvColumn]) {
                rolePermissions.push(
                    `        PermissionName.${permissionName},`
                )
            }
        }
        const template = `import { PermissionName } from './permissionNames'

export const ${roleInfo.typeName} = {
    role_name: '${roleInfo.roleName}',
    permissions: [
${rolePermissions.join('\n')}
    ],
}
`
        fs.writeFileSync(`./src/permissions/${roleInfo.file}.ts`, template)
    }
}

void update()
