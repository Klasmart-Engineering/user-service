import { latestPermissions } from './utils/latestPermissions'
import * as fs from 'fs'

async function update() {
    const latestPerms = await latestPermissions()
    const permissionNames = Array.from(latestPerms.keys())
        .map((name) => `    ${name} = '${name}',`)
        .join('\n')
    const template = `export enum PermissionName {
${permissionNames}
}
`
    fs.writeFileSync(`./src/permissions/permissionNames.ts`, template)
}

void update()
