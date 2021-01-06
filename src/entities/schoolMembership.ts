import {
    Entity,
    ManyToOne,
    PrimaryColumn,
    Column,
    CreateDateColumn,
    ManyToMany,
    BaseEntity,
    getRepository,
    createQueryBuilder,
    getManager,
} from 'typeorm'
import { User } from './user'
import { Role } from './role'
import { GraphQLResolveInfo } from 'graphql'
import { School } from './school'
import { Status } from './status'
import { Permission } from './permission'

@Entity()
export class SchoolMembership extends BaseEntity {
    @PrimaryColumn()
    public user_id!: string

    @PrimaryColumn()
    public school_id!: string

    @Column({ type: 'enum', enum: Status, default: Status.ACTIVE })
    public status!: Status

    @CreateDateColumn()
    public join_timestamp?: Date

    @ManyToOne(() => User, (user) => user.school_memberships)
    public user?: Promise<User>

    @ManyToOne(() => School, (school) => school.memberships)
    public school?: Promise<School>

    @ManyToMany(() => Role, (role) => role.schoolMemberships)
    public roles?: Promise<Role[]>

    @Column({ type: 'timestamp', nullable: true })
    public deleted_at?: Date

    public async checkAllowed(
        { permission_name }: any,
        context: any,
        info: GraphQLResolveInfo
    ) {
        try {
            let results = await createQueryBuilder('SchoolMembership')
                .innerJoinAndSelect('SchoolMembership.school', 'School')
                .innerJoinAndSelect('School.organization', 'SchoolOrganization')
                .innerJoinAndSelect(
                    'SchoolOrganization.memberships',
                    'OrgMembership'
                )
                .innerJoinAndSelect('OrgMembership.roles', 'Role')
                .innerJoinAndSelect('Role.permissions', 'Permission')
                .where(
                    'OrgMembership.user_id = :user_id AND SchoolMembership.user_id = :user_id',
                    { user_id: this.user_id }
                )
                .andWhere('SchoolMembership.school_id = :school_id', {
                    school_id: this.school_id,
                })
                .andWhere('Permission.permission_name = :permission_name', {
                    permission_name,
                })
                .getRawMany()

            if (results.length === 0) {
                results = await createQueryBuilder('SchoolMembership')
                    .innerJoinAndSelect('SchoolMembership.roles', 'Role')
                    .innerJoinAndSelect('Role.permissions', 'Permission')
                    .where('SchoolMembership.user_id = :user_id', {
                        user_id: this.user_id,
                    })
                    .andWhere('SchoolMembership.school_id = :school_id', {
                        school_id: this.school_id,
                    })
                    .andWhere('Permission.permission_name = :permission_name', {
                        permission_name,
                    })
                    .getRawMany()
            }

            if (results.length === 0) {
                return false
            }

            return results.every((v) => v.Permission_allow)
        } catch (e) {
            console.error(e)
        }
    }

    public async addRole(
        { role_id }: any,
        context: any,
        info: GraphQLResolveInfo
    ) {
        console.info(
            `Unauthenticated endpoint call schoolMembership addRole by ${context.token?.id}`
        )

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
            console.error(e)
        }
    }

    public async addRoles(
        { role_ids }: any,
        context: any,
        info: GraphQLResolveInfo
    ) {
        console.info(
            `Unauthenticated endpoint call schoolMembership addRoles by ${context.token?.id}`
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
                const schoolMemberships = (await role.schoolMemberships) || []
                schoolMemberships.push(this)
                role.schoolMemberships = Promise.resolve(schoolMemberships)
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
            `Unauthenticated endpoint call schoolMembership removeRole by ${context.token?.id}`
        )

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
            console.error(e)
        }
    }

    public async leave({}: any, context: any, info: GraphQLResolveInfo) {
        console.info(
            `Unauthenticated endpoint call school leave by ${context.token?.id}`
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
