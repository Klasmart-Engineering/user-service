import {
    Entity,
    ManyToOne,
    PrimaryColumn,
    CreateDateColumn,
    ManyToMany,
    getRepository,
    getManager,
} from 'typeorm'
import { User } from './user'
import { Role } from './role'
import { GraphQLResolveInfo } from 'graphql'
import { School } from './school'
import { Status } from './status'
import { Context } from 'mocha'
import { CustomBaseEntity } from './customBaseEntity'
import logger from '../logging'

@Entity()
export class SchoolMembership extends CustomBaseEntity {
    @PrimaryColumn()
    public user_id!: string

    @PrimaryColumn()
    public school_id!: string

    @CreateDateColumn()
    public join_timestamp?: Date

    @ManyToOne(() => User, (user) => user.school_memberships)
    public user?: Promise<User>

    @ManyToOne(() => School, (school) => school.memberships)
    public school?: Promise<School>

    @ManyToMany(() => Role, (role) => role.schoolMemberships)
    public roles?: Promise<Role[]>

    public async checkAllowed(
        { permission_name }: { permission_name: string },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const school = await this.school
        const schoolOrg = await school?.organization

        const permisionContext = {
            organization_id: schoolOrg?.organization_id,
            school_ids: [this.school_id],
            user_id: this.user_id,
        }

        return await context.permissions.allowed(
            permisionContext,
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
                this.status == Status.INACTIVE
            ) {
                return null
            }
            const role = await getRepository(Role).findOneOrFail({ role_id })
            const memberships = (await role.schoolMemberships) || []
            memberships.push(this)
            role.schoolMemberships = Promise.resolve(memberships)
            await role.save()
            return role
        } catch (e) {
            logger.error(e)
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
                const schoolMemberships = (await role.schoolMemberships) || []
                schoolMemberships.push(this)
                role.schoolMemberships = Promise.resolve(schoolMemberships)
                return role
            })
            const roles = await Promise.all(rolePromises)
            await getManager().save(roles)
            return roles
        } catch (e) {
            logger.error(e)
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
                this.status == Status.INACTIVE
            ) {
                return null
            }
            const role = await getRepository(Role).findOneOrFail({ role_id })
            const memberships = await role.schoolMemberships
            if (memberships) {
                const newMemberships = memberships.filter(
                    (membership) => membership.user_id !== this.user_id
                )
                role.schoolMemberships = Promise.resolve(newMemberships)
                await role.save()
            }
            return this
        } catch (e) {
            logger.error(e)
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
                this.status == Status.INACTIVE
            ) {
                return null
            }

            await this.inactivate(getManager())

            return true
        } catch (e) {
            logger.error(e)
        }
        return false
    }
}

export async function getSchoolMemberships(
    organizationId: string,
    userId: string
) {
    return await SchoolMembership.createQueryBuilder()
        .innerJoinAndSelect('SchoolMembership.school', 'School')
        .where('School.organization = :organization_id', {
            organization_id: organizationId,
        })
        .andWhere('SchoolMembership.user_id = :user_id', {
            user_id: userId,
        })
        .getMany()
}
