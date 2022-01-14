import {
    Column,
    PrimaryGeneratedColumn,
    Check,
    Entity,
    OneToMany,
    getRepository,
    getManager,
    In,
    JoinColumn,
    ManyToMany,
    JoinTable,
    ManyToOne,
    EntityManager,
} from 'typeorm'
import { GraphQLResolveInfo } from 'graphql'
import { User } from './user'
import { Class } from './class'
import { SchoolMembership } from './schoolMembership'
import { Organization } from './organization'
import { Context } from '../main'
import { PermissionName } from '../permissions/permissionNames'
import { Status } from './status'
import { OrganizationMembership } from './organizationMembership'
import { Program } from './program'
import { SHORTCODE_DEFAULT_MAXLEN, validateShortCode } from '../utils/shortcode'
import { CustomBaseEntity } from './customBaseEntity'
import logger from '../logging'

@Entity()
@Check(`"school_name" <> ''`)
export class School extends CustomBaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public school_id!: string

    @Column({ nullable: false })
    public school_name!: string

    @Column({ nullable: true, length: SHORTCODE_DEFAULT_MAXLEN })
    public shortcode?: string

    @OneToMany(() => SchoolMembership, (membership) => membership.school)
    @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
    public memberships?: Promise<SchoolMembership[]>

    public async membership(
        { user_id }: { user_id: string },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        try {
            const membership = await getRepository(
                SchoolMembership
            ).findOneOrFail({ where: { user_id, school_id: this.school_id } })
            return membership
        } catch (e) {
            logger.error(e)
        }
    }

    @ManyToOne(() => Organization, (organization) => organization.schools)
    @JoinColumn()
    public organization?: Promise<Organization>

    @ManyToMany(() => Class, (class_) => class_.schools)
    @JoinTable()
    public classes?: Promise<Class[]>

    @ManyToMany(() => Program, (program) => program.schools)
    @JoinTable()
    public programs?: Promise<Program[]>

    public async set(
        { school_name, shortcode }: { school_name: string; shortcode: string },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (
            info.operation.operation !== 'mutation' ||
            this.status == Status.INACTIVE
        ) {
            return null
        }

        const organizationId = (await this.organization)?.organization_id
        const permissionContext = {
            organization_ids: organizationId ? [organizationId] : undefined,
            school_ids: [this.school_id],
        }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.edit_school_20330
        )

        try {
            if (typeof school_name === 'string') {
                this.school_name = school_name
            }
            if (typeof shortcode === 'string') {
                shortcode = shortcode.toUpperCase()
                if (validateShortCode(shortcode)) {
                    this.shortcode = shortcode
                }
            }

            await this.save()

            return this
        } catch (e) {
            logger.error(e)
        }
    }

    public async addUser(
        { user_id }: { user_id: string },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (
            info.operation.operation !== 'mutation' ||
            this.status == Status.INACTIVE
        ) {
            return null
        }

        const organizationId = (await this.organization)?.organization_id
        const permissionContext = {
            organization_ids: organizationId ? [organizationId] : undefined,
            school_ids: [this.school_id],
        }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.edit_school_20330
        )

        try {
            const user = await getRepository(User).findOneOrFail(user_id)

            await OrganizationMembership.findOneOrFail({
                where: { organization_id: organizationId, user_id: user_id },
            })

            const membership = new SchoolMembership()
            membership.school_id = this.school_id
            membership.school = Promise.resolve(this)
            membership.user_id = user_id
            membership.user = Promise.resolve(user)

            await getManager().save(membership)
            return membership
        } catch (e) {
            logger.error(e)
        }
    }

    public async editPrograms(
        { program_ids }: { program_ids: string[] },
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

        const permissionContext = { organization_ids: [organization_id] }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.edit_school_20330
        )

        const validPrograms: Program[] = await this.getPrograms(program_ids)
        this.programs = Promise.resolve(validPrograms)

        await this.save()

        return validPrograms
    }

    private async getPrograms(ids: string[]) {
        if (ids.length === 0) {
            return []
        }

        return await Program.find({
            where: { id: In(ids) },
        })
    }

    public async delete(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        if (
            info.operation.operation !== 'mutation' ||
            this.status == Status.INACTIVE
        ) {
            return null
        }

        const organizationId = (await this.organization)?.organization_id
        const permissionContext = {
            organization_ids: organizationId ? [organizationId] : undefined,
            school_ids: [this.school_id],
        }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.delete_school_20440
        )

        try {
            await getManager().transaction(async (manager) => {
                await this.inactivate(manager)
            })

            return true
        } catch (e) {
            logger.error(e)
        }
        return false
    }

    private async inactivateSchoolMemberships(manager: EntityManager) {
        const schoolMemberships = (await this.memberships) || []

        for (const schoolMembership of schoolMemberships) {
            await schoolMembership.inactivate(manager)
        }

        return schoolMemberships
    }

    private async inactivateClasses(manager: EntityManager) {
        const classes = (await this.classes) || []

        for (const cls of classes) {
            await cls.inactivate(manager)
        }

        return classes
    }

    public async inactivate(manager: EntityManager) {
        await super.inactivate(manager)

        await this.inactivateClasses(manager)
        await this.inactivateSchoolMemberships(manager)
        await manager.save(this)
    }
}
