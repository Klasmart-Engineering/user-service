import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    getManager,
    ManyToMany,
    JoinTable,
    ManyToOne,
    getRepository,
    BaseEntity,
} from 'typeorm'
import { GraphQLResolveInfo } from 'graphql'
import { OrganizationMembership } from './organizationMembership'
import { Permission } from './permission'
import { Organization } from './organization'
import { SchoolMembership } from './schoolMembership'
import { Status } from './status'
import { Context } from '../main'
import { PermissionName } from '../permissions/permissionNames'
import {
    CursorObject,
    Paginatable,
    toCursorHash,
} from '../utils/paginated.interface'

@Entity()
export class Role extends BaseEntity implements Paginatable<Role, string> {
    @PrimaryGeneratedColumn('uuid')
    public role_id!: string

    @Column({ nullable: true })
    public role_name?: string

    @Column({ type: 'enum', enum: Status, default: Status.ACTIVE })
    public status!: Status

    @Column({ type: 'timestamp', nullable: true })
    public deleted_at?: Date

    @Column({ nullable: false, default: 'System Default Role' })
    public role_description?: string

    @Column({ nullable: false, default: false })
    public system_role?: boolean

    @ManyToOne(() => Organization, (organization) => organization.roles)
    public organization?: Promise<Organization>

    @ManyToMany(() => OrganizationMembership, (membership) => membership.roles)
    @JoinTable()
    public memberships?: Promise<OrganizationMembership[]>

    @ManyToMany(() => SchoolMembership, (membership) => membership.roles)
    @JoinTable()
    public schoolMemberships?: Promise<SchoolMembership[]>

    @ManyToMany(() => Permission, (permission) => permission.roles)
    public permissions?: Promise<Permission[]>

    public async set(
        { role_name, role_description, system_role }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (info.operation.operation !== 'mutation' || !organization_id) {
            return null
        }

        if (this.system_role || system_role) {
            context.permissions.rejectIfNotAdmin()
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

            if (system_role) {
                this.system_role = system_role
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

        if (this.system_role) {
            context.permissions.rejectIfNotAdmin()
        }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.edit_role_permissions_30332
        )

        try {
            const permission = await getRepository(Permission).findOneOrFail({
                where: {
                    permission_name: permission_name,
                },
            })

            let roles = (await permission.roles) || []
            roles = roles.filter((role) => {
                return role.role_id != this.role_id
            })
            permission.roles = Promise.resolve([...roles, this])
            permission.allow = true

            await permission.save()

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

        if (this.system_role) {
            context.permissions.rejectIfNotAdmin()
        }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.edit_role_permissions_30332
        )

        try {
            const permission = await getRepository(Permission).findOneOrFail({
                where: {
                    permission_name: permission_name,
                },
            })

            let roles = (await permission.roles) || []
            roles = roles.filter((role) => {
                return role.role_id != this.role_id
            })
            permission.roles = Promise.resolve(roles)

            await permission.save()

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
            const permission = await getRepository(Permission).findOneOrFail({
                where: {
                    permission_name: permission_name,
                },
            })

            permission.allow = false
            await permission.save()

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

        if (this.system_role) {
            context.permissions.rejectIfNotAdmin()
        }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.edit_role_permissions_30332
        )

        const permissionEntities = [] as Permission[]

        for (const permission_name of permission_names) {
            const permission = await getRepository(Permission).findOneOrFail({
                where: {
                    permission_name: permission_name,
                },
            })
            permissionEntities.push(permission)
        }

        try {
            await getManager().transaction(async (manager) => {
                this.permissions = Promise.resolve([])
                await manager.save(this)
                this.permissions = Promise.resolve(permissionEntities)
                await manager.save(this)
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
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status == Status.INACTIVE
        ) {
            return null
        }

        if (this.system_role) {
            context.permissions.rejectIfNotAdmin()
        }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.delete_groups_30440
        )

        try {
            await getManager().transaction(async (manager) => {
                await this.inactivate(manager)
            })

            return true
        } catch (e) {
            console.error(e)
        }
        return false
    }

    public async inactivate(manager: any) {
        this.status = Status.INACTIVE
        this.deleted_at = new Date()

        await manager.save(this)
    }

    public compareKey(key: string): number {
        return key > this.role_id ? 1 : key < this.role_id ? -1 : 0
    }

    public compare(other: Role): number {
        return other.role_id > this.role_id
            ? 1
            : other.role_id < this.role_id
            ? -1
            : 0
    }
    public generateCursor(total?: number, timestamp?: number): string {
        return toCursorHash(new CursorObject(this.role_id, total, timestamp))
    }
}
