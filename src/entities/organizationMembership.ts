import {
    Entity,
    ManyToOne,
    PrimaryColumn,
    Column,
    CreateDateColumn,
    ManyToMany,
    BaseEntity,
    getRepository,
    getManager,
} from 'typeorm'
import { User } from './user'
import { Organization } from './organization'
import { Role } from './role'
import { GraphQLResolveInfo } from 'graphql'
import { Context } from '../main'
import { SchoolMembership } from './schoolMembership'
import { Status } from './status'
import { Class } from './class'

export const MEMBERSHIP_SHORTCODE_MAXLEN = 16
@Entity()
export class OrganizationMembership extends BaseEntity {
    @PrimaryColumn()
    public user_id!: string

    @PrimaryColumn()
    public organization_id!: string

    @Column({ type: 'enum', enum: Status, default: Status.ACTIVE })
    public status!: Status

    @CreateDateColumn()
    public join_timestamp?: Date

    @Column({ nullable: true, length: MEMBERSHIP_SHORTCODE_MAXLEN })
    public shortcode!: string

    @ManyToOne(() => User, (user) => user.memberships)
    public user?: Promise<User>

    @ManyToOne(() => Organization, (organization) => organization.memberships)
    public organization?: Promise<Organization>

    @ManyToMany(() => Role, (role) => role.memberships)
    public roles?: Promise<Role[]>

    @Column({ type: 'timestamp', nullable: true })
    public deleted_at?: Date

    public async schoolMemberships(
        { permission_name }: any,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        console.info(
            `Unauthenticated endpoint call schoolMemberships by ${context.permissions?.getUserId()}`
        )

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
            console.error(e)
        }
    }

    public async classesTeaching(context: any, info: GraphQLResolveInfo) {
        console.info(
            `Unauthenticated endpoint call classesTeaching by ${context.permissions?.getUserId()}`
        )

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
            console.error(e)
        }
    }

    public async checkAllowed(
        { permission_name }: any,
        context: any,
        info: GraphQLResolveInfo
    ) {
        const permisionContext = {
            organization_id: this.organization_id,
            user_id: this.user_id,
        }

        return await context.permissions.allowed(
            permisionContext,
            permission_name
        )
    }

    public async addRole(
        { role_id }: any,
        context: any,
        info: GraphQLResolveInfo
    ) {
        console.info(
            `Unauthenticated endpoint call organizationMembership addRole by ${context.permissions?.getUserId()}`
        )

        try {
            if (
                info.operation.operation !== 'mutation' ||
                this.status == Status.INACTIVE
            ) {
                return null
            }
            const role = await getRepository(Role).findOneOrFail({ role_id })
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
            console.error(e)
        }
    }

    public async addRoles(
        { role_ids }: any,
        context: any,
        info: GraphQLResolveInfo
    ) {
        console.info(
            `Unauthenticated endpoint call organizationMembership addRoles by ${context.permissions?.getUserId()}`
        )

        try {
            if (
                info.operation.operation !== 'mutation' ||
                this.status == Status.INACTIVE
            ) {
                return null
            }
            if (!(role_ids instanceof Array)) {
                return null
            }

            const rolePromises = role_ids.map(async (role_id) => {
                const role = await getRepository(Role).findOneOrFail({
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
            console.error(e)
        }
    }

    public async removeRole(
        { role_id }: any,
        context: any,
        info: GraphQLResolveInfo
    ) {
        console.info(
            `Unauthenticated endpoint call organizationMembership removeRole by ${context.permissions?.getUserId()}`
        )

        try {
            if (
                info.operation.operation !== 'mutation' ||
                this.status == Status.INACTIVE
            ) {
                return null
            }

            const role = await getRepository(Role).findOneOrFail({ role_id })
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
            console.error(e)
        }
    }
    public async leave(args: any, context: any, info: GraphQLResolveInfo) {
        console.info(
            `Unauthenticated endpoint call organizationMembership leave by ${context.permissions?.getUserId()}`
        )

        try {
            if (
                info.operation.operation !== 'mutation' ||
                this.status == Status.INACTIVE
            ) {
                return null
            }
            await this.inactivate(getManager())

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
}
