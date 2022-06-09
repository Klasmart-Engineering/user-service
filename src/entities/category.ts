import {
    Column,
    Entity,
    getManager,
    In,
    JoinColumn,
    JoinTable,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn,
    RelationId,
} from 'typeorm'

import { Context } from '../main'
import { GraphQLResolveInfo } from 'graphql'
import { Organization } from './organization'
import { PermissionName } from '../permissions/permissionNames'
import { Subcategory } from './subcategory'
import { Status } from './status'
import { CustomBaseEntity } from './customBaseEntity'
import { Subject } from './subject'

@Entity()
export class Category extends CustomBaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

    @Column({ nullable: false })
    public name!: string

    @Column({ nullable: false, default: false })
    public system!: boolean

    @ManyToOne(() => Organization)
    @JoinColumn({ name: 'organization_id' })
    public organization?: Promise<Organization>

    @RelationId((cat: Category) => cat.organization)
    public readonly organization_id?: string

    @ManyToMany(() => Subcategory, (subcategory) => subcategory.categories)
    @JoinTable()
    public subcategories?: Promise<Subcategory[]>

    @ManyToMany(() => Subject, (subject) => subject.categories)
    public subjects?: Promise<Subject[]>

    public async editSubcategories(
        { subcategory_ids }: { subcategory_ids: string[] },
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            !organization_id ||
            this.status !== Status.ACTIVE
        ) {
            return null
        }

        const permissionContext = { organization_ids: [organization_id] }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.edit_subjects_20337
        )

        const validSubcategories: Subcategory[] = await this.getSubcategories(
            subcategory_ids
        )
        this.subcategories = Promise.resolve(validSubcategories)

        await this.save()

        return validSubcategories
    }

    private async getSubcategories(ids: string[]) {
        if (ids.length === 0) {
            return []
        }

        return await Subcategory.find({
            where: { id: In(ids) },
        })
    }

    public async delete(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            this.status !== Status.ACTIVE
        ) {
            return false
        }

        if (this.system) {
            context.permissions.rejectIfNotAdmin()
        }

        const permissionContext = {
            organization_ids: organization_id ? [organization_id] : undefined,
        }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.delete_subjects_20447
        )

        await getManager().transaction(async (manager) => {
            await this.inactivate(manager)
        })

        return true
    }
}
