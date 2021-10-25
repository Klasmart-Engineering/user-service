import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    getManager,
    ManyToMany,
    JoinTable,
    ManyToOne,
    getRepository,
    Brackets,
} from 'typeorm'
import { GraphQLResolveInfo } from 'graphql'
import { OrganizationMembership } from './organizationMembership'
import { Permission } from './permission'
import { Organization } from './organization'
import { SchoolMembership } from './schoolMembership'
import { Status } from './status'
import { Context } from '../main'
import { PermissionName } from '../permissions/permissionNames'
import { CustomBaseEntity } from './customBaseEntity'
import { APIError, APIErrorCollection } from '../types/errors/apiError'
import { customErrors } from '../types/errors/customError'

@Entity()
export class Role extends CustomBaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public role_id!: string

    @Column({ nullable: true })
    public role_name?: string

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
        { role_name, role_description, system_role }: Partial<Role>,
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
            PermissionName.edit_role_and_permissions_30332
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
            context.logger?.error(e)
        }
    }

    public async permission(
        { permission_name }: { permission_name: PermissionName },
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
            context.logger?.error(e)
        }
    }

    public async grant(
        { permission_name }: { permission_name: PermissionName },
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
            PermissionName.edit_role_and_permissions_30332
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
            context.logger?.error(e)
        }
    }
    public async revoke(
        { permission_name }: { permission_name: PermissionName },
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
            PermissionName.edit_role_and_permissions_30332
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
            context.logger?.error(e)
        }
        return false
    }
    public async deny(
        { permission_name }: { permission_name: PermissionName },
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
            PermissionName.edit_role_and_permissions_30332
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
            context.logger?.error(e)
        }
    }

    public async edit_permissions(
        { permission_names }: { permission_names: PermissionName[] },
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
            PermissionName.edit_role_and_permissions_30332
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
            context.logger?.error(e)
        }
    }

    public async delete_role(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (this.system_role) context.permissions.rejectIfNotAdmin()
        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.delete_role_30440
        )

        const errors: APIError[] = []

        if (!organization_id)
            errors.push(
                new APIError({
                    code: customErrors.missing_required_entity_attribute.code,
                    message:
                        customErrors.missing_required_entity_attribute.message,
                    variables: ['role_id', 'organization_id'],
                    entity: 'Role',
                    attribute: 'organization_id',
                })
            )

        if (info.operation.operation !== 'mutation')
            errors.push(
                new APIError({
                    code: customErrors.invalid_operation_type.code,
                    message: customErrors.invalid_operation_type.message,
                    variables: [],
                    attribute: info.operation.operation,
                    otherAttribute: 'mutation',
                })
            )

        if (this.status == Status.INACTIVE)
            errors.push(
                new APIError({
                    code: customErrors.inactive_status.code,
                    message: customErrors.inactive_status.message,
                    variables: ['role_id'],
                    entity: 'Role',
                    entityName: this.role_id,
                })
            )

        const hasMembership =
            (await getRepository(Role)
                .createQueryBuilder()
                .where('Role.role_id = :role_id', {
                    role_id: this.role_id,
                })
                .leftJoin('Role.memberships', 'OrganisationMembership')
                .leftJoin('Role.schoolMemberships', 'SchoolMembership')
                .andWhere(
                    new Brackets((qb) => {
                        qb.where('OrganisationMembership.user_id IS NOT NULL')
                        qb.orWhere('SchoolMembership.user_id IS NOT NULL')
                    })
                )
                .getCount()) > 0
        if (hasMembership) {
            errors.push(
                new APIError({
                    code: customErrors.delete_rejected_entity_in_use.code,
                    message: customErrors.delete_rejected_entity_in_use.message,
                    variables: ['role_id'],
                    entity: 'Role',
                    entityName: this.role_id,
                })
            )
        }

        if (errors.length > 0) throw new APIErrorCollection(errors)

        try {
            await getManager().transaction(async (manager) => {
                await this.inactivate(manager)
            })
            return true
        } catch (e) {
            context.logger?.error(e)
        }
        return false
    }
}
