import {
    Column,
    Entity,
    getManager,
    JoinColumn,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn,
    RelationId,
} from 'typeorm'

import { Context } from '../main'
import { GraphQLResolveInfo } from 'graphql'
import { Organization } from './organization'
import { PermissionName } from '../permissions/permissionNames'
import { Status } from './status'
import { CustomBaseEntity } from './customBaseEntity'
import { Category } from './category'

@Entity()
export class Subcategory extends CustomBaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

    @Column({ nullable: false })
    public name!: string

    @Column({ nullable: false, default: false })
    public system!: boolean

    @ManyToOne(() => Organization, (organization) => organization.ageRanges)
    @JoinColumn({ name: 'organization_id' })
    public organization?: Promise<Organization>

    @RelationId((subcategory: Subcategory) => subcategory.organization)
    public organization_id?: string

    @ManyToMany(() => Category, (category) => category.subcategories)
    public categories?: Promise<Category[]>

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
