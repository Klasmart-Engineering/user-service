import {
    Entity,
    ManyToOne,
    PrimaryColumn,
    Column,
    CreateDateColumn,
    ManyToMany,
    getRepository,
    getManager,
    EntityManager,
} from 'typeorm'
import { User } from './user'
import { Organization } from './organization'
import { Role } from './role'
import { GraphQLResolveInfo } from 'graphql'
import { Context } from '../main'
import { SchoolMembership } from './schoolMembership'
import { Status } from './status'
import { Class } from './class'
import { PermissionName } from '../permissions/permissionNames'
import { CustomBaseEntity } from './customBaseEntity'
import { config } from '../config/config'
import logger from '../logging'
import { reportError } from '../utils/resolvers/errors'

@Entity()
export class OrganizationMembership extends CustomBaseEntity {
    @PrimaryColumn()
    public user_id!: string

    @PrimaryColumn()
    public organization_id!: string

    @CreateDateColumn()
    public join_timestamp?: Date

    @Column({
        nullable: true,
        length: config.limits.SHORTCODE_MAX_LENGTH,
    })
    public shortcode!: string

    @ManyToOne(() => User, (user) => user.memberships)
    public user?: Promise<User>

    @ManyToOne(() => Organization, (organization) => organization.memberships)
    public organization?: Promise<Organization>

    @ManyToMany(() => Role, (role) => role.memberships)
    public roles?: Promise<Role[]>

    @Column({ type: 'timestamp', nullable: true, precision: 3 })
    public status_updated_at?: Date

    public async schoolMemberships(
        { permission_name }: { permission_name: string },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        try {
            if (permission_name === undefined) {
                return await getRepository(SchoolMembership)
                    .createQueryBuilder()
                    .innerJoin('SchoolMembership.school', 'School')
                    .innerJoin('School.organization', 'SchoolOrganization')
                    .where('SchoolMembership.user_id = :user_id', {
                        user_id: this.user_id,
                    })
                    .andWhere(
                        'SchoolOrganization.organization_id = :organization_id',
                        { organization_id: this.organization_id }
                    )
                    .getMany()
            } else {
                let results = await getRepository(SchoolMembership)
                    .createQueryBuilder()
                    .innerJoin('SchoolMembership.school', 'School')
                    .innerJoin('School.organization', 'SchoolOrganization')
                    .innerJoin(
                        'SchoolOrganization.memberships',
                        'OrgMembership'
                    )
                    .innerJoin('OrgMembership.roles', 'OrgRole')
                    .innerJoin('OrgRole.permissions', 'OrgPermission')
                    .groupBy(
                        'OrgMembership.user_id, SchoolMembership.school_id, OrgPermission.permission_name, SchoolMembership.user_id'
                    )
                    .where(
                        'OrgMembership.user_id = :user_id AND SchoolMembership.user_id = :user_id',
                        { user_id: this.user_id }
                    )
                    .andWhere(
                        'OrgMembership.organization_id = :organization_id',
                        { organization_id: this.organization_id }
                    )
                    .andWhere(
                        'OrgPermission.permission_name = :permission_name',
                        { permission_name }
                    )
                    .having('bool_and(OrgPermission.allow) = :allowed', {
                        allowed: true,
                    })
                    .getMany()

                if (results.length === 0) {
                    results = await getRepository(SchoolMembership)
                        .createQueryBuilder()
                        .innerJoin('SchoolMembership.school', 'School')
                        .innerJoin('School.organization', 'SchoolOrganization')
                        .innerJoin('SchoolMembership.roles', 'Role')
                        .innerJoin('Role.permissions', 'Permission')
                        .groupBy(
                            'SchoolMembership.school_id, Permission.permission_name, SchoolMembership.user_id'
                        )
                        .where('SchoolMembership.user_id = :user_id', {
                            user_id: this.user_id,
                        })
                        .andWhere(
                            'SchoolOrganization.organization_id = :organization_id',
                            { organization_id: this.organization_id }
                        )
                        .andWhere(
                            'Permission.permission_name = :permission_name',
                            { permission_name }
                        )
                        .having('bool_and(Permission.allow) = :allowed', {
                            allowed: true,
                        })
                        .getMany()
                }

                return results
            }
        } catch (e) {
            reportError(e)
        }
    }

    public async classesTeaching(context: Context, info: GraphQLResolveInfo) {
        try {
            return await getRepository(Class)
                .createQueryBuilder()
                .innerJoin('Class.teachers', 'Teacher')
                .innerJoin('Class.organization', 'Organization')
                .where('Teacher.user_id = :user_id', { user_id: this.user_id })
                .andWhere('Organization.organization_id = :organization_id', {
                    organization_id: this.organization_id,
                })
                .getMany()
        } catch (e) {
            reportError(e)
        }
    }

    public async checkAllowed(
        { permission_name }: { permission_name: PermissionName },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const permissionContext = {
            organization_ids: [this.organization_id],
            user_id: this.user_id,
        }

        return await context.permissions.allowed(
            permissionContext,
            permission_name
        )
    }

    public async addRole(
        { role_id }: { role_id: string },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        try {
            if (
                info.operation.operation !== 'mutation' ||
                this.status !== Status.ACTIVE
            ) {
                return null
            }
            const role = await getRepository(Role).findOneByOrFail({ role_id })
            const memberships = (await role.memberships) || []
            const roleOrganization = await role.organization
            if (
                !role.system_role &&
                roleOrganization?.organization_id !== this.organization_id
            ) {
                throw new Error(
                    `Can not assign Organization(${roleOrganization?.organization_id}).Role(${role_id}) to membership in Organization(${this.organization_id})`
                )
            }
            memberships.push(this)
            role.memberships = Promise.resolve(memberships)
            await role.save()
            return role
        } catch (e) {
            logger.warn(e)
        }
    }

    public async addRoles(
        { role_ids }: { role_ids: string[] },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        try {
            if (
                info.operation.operation !== 'mutation' ||
                this.status !== Status.ACTIVE
            ) {
                return null
            }
            if (!(role_ids instanceof Array)) {
                return null
            }

            const rolePromises = role_ids.map(async (role_id) => {
                const role = await getRepository(Role).findOneByOrFail({
                    role_id,
                })

                const memberships = (await role.memberships) || []
                const roleOrganization = await role.organization
                if (
                    !role.system_role &&
                    roleOrganization?.organization_id !== this.organization_id
                ) {
                    throw new Error(
                        `Can not assign Organization(${roleOrganization?.organization_id}).Role(${role_id}) to membership in Organization(${this.organization_id})`
                    )
                }
                memberships.push(this)
                role.memberships = Promise.resolve(memberships)
                return role
            })
            const roles = await Promise.all(rolePromises)
            await getManager().save(roles)
            return roles
        } catch (e) {
            logger.warn(e)
        }
    }

    public async removeRole(
        { role_id }: { role_id: string },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        try {
            if (
                info.operation.operation !== 'mutation' ||
                this.status !== Status.ACTIVE
            ) {
                return null
            }

            const role = await getRepository(Role).findOneByOrFail({ role_id })
            const memberships = await role.memberships
            if (memberships) {
                const newMemberships = memberships.filter(
                    (membership) => membership.user_id !== this.user_id
                )
                role.memberships = Promise.resolve(newMemberships)
                await role.save()
            }
            return this
        } catch (e) {
            logger.warn(e)
        }
    }
    public async leave(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        try {
            if (
                info.operation.operation !== 'mutation' ||
                this.status !== Status.ACTIVE
            ) {
                return null
            }
            await this.inactivate(getManager())

            return true
        } catch (e) {
            reportError(e)
        }
        return false
    }

    public async inactivate(manager?: EntityManager) {
        if (this.status !== Status.ACTIVE) return

        this.status = Status.INACTIVE
        this.status_updated_at = new Date()

        if (manager) await manager.save(this)
    }
}
