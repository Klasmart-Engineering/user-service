import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    getManager,
    ManyToMany,
    JoinColumn,
    JoinTable,
    OneToMany,
    ManyToOne,
    getRepository,
    BaseEntity,
} from 'typeorm'
import { GraphQLResolveInfo } from 'graphql'
import { OrganizationMembership } from './organizationMembership'
import { Permission } from './permission'
import { permissionInfo } from '../permissions/permissionInfo'
import { Organization } from './organization'
import { SchoolMembership } from './schoolMembership'
import { Context } from '../main'
import { PermissionName } from '../permissions/permissionNames'

@Entity()
export class Role extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public role_id!: string

    @Column({ nullable: true })
    public role_name?: string

    @Column({ nullable: false, default: 'System Default Role' })
    public role_description?: string

    @ManyToOne(() => Organization, (organization) => organization.roles)
    public organization?: Promise<Organization>

    @ManyToMany(() => OrganizationMembership, (membership) => membership.roles)
    @JoinTable()
    public memberships?: Promise<OrganizationMembership[]>

    @ManyToMany(() => SchoolMembership, (membership) => membership.roles)
    @JoinTable()
    public schoolMemberships?: Promise<SchoolMembership[]>

    @OneToMany(() => Permission, (permission) => permission.role)
    @JoinColumn()
    public permissions?: Promise<Permission[]>

    public async set(
        { role_name, role_description }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (info.operation.operation !== 'mutation' || !organization_id) {
            return null
        }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.edit_groups_30330
        )

        try {
            if (typeof role_name === 'string') {
                this.role_name = role_name
            }

            if (typeof role_description === 'string') {
                this.role_description = role_description
            }

            await this.save()

            return this
        } catch (e) {
            console.error(e)
        }
    }

    public async permission(
        { permission_name }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (!organization_id) {
            return null
        }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.view_role_permissions_30112
        )

        try {
            const permission = await getRepository(Permission).findOneOrFail({
                role_id: this.role_id,
                permission_name,
            })
            return permission
        } catch (e) {
            console.error(e)
        }
    }
    public async grant(
        { permission_name }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (info.operation.operation !== 'mutation' || !organization_id) {
            return null
        }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.edit_role_permissions_30332
        )

        try {
            const permission = await getRepository(Permission).save({
                role_id: this.role_id,
                permission_name,
                allow: true,
            })
            return permission
        } catch (e) {
            console.error(e)
        }
    }
    public async revoke(
        { permission_name }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (info.operation.operation !== 'mutation' || !organization_id) {
            return null
        }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.edit_role_permissions_30332
        )

        try {
            await Permission.delete({ role_id: this.role_id, permission_name })
            return true
        } catch (e) {
            console.error(e)
        }
        return false
    }
    public async deny(
        { permission_name }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (info.operation.operation !== 'mutation' || !organization_id) {
            return null
        }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.edit_role_permissions_30332
        )

        try {
            const permission = await getRepository(Permission).save({
                role_id: this.role_id,
                permission_name,
                allow: false,
            })
            return permission
        } catch (e) {
            console.error(e)
        }
    }

    public async edit_permissions(
        { permission_names }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (info.operation.operation !== 'mutation' || !organization_id) {
            return null
        }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.edit_role_permissions_30332
        )

        const permissionDetails = await permissionInfo()
        const oldPermissions = (await this.permissions) || []

        const permissionEntities = [] as Permission[]
        for (const permission_name of permission_names) {
            const permission = new Permission()
            const permissionInf = permissionDetails.get(permission_name)

            permission.permission_name = permission_name
            permission.permission_id = permission_name
            permission.permission_category = permissionInf?.category
            permission.permission_section = permissionInf?.section
            permission.permission_description = permissionInf?.description
            permission.allow = true
            permission.role = Promise.resolve(this)
            permissionEntities.push(permission)
        }

        try {
            await getManager().transaction(async (manager) => {
                await manager.remove(oldPermissions)
                await manager.save(permissionEntities)
            })

            return permissionEntities
        } catch (e) {
            console.error(e)
        }
    }

    public async delete_role(
        args: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (info.operation.operation !== 'mutation' || !organization_id) {
            return null
        }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.delete_groups_30440
        )

        try {
            await this.remove()
            return true
        } catch (e) {
            console.error(e)
        }
        return false
    }
}
