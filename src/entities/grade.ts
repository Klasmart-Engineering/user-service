import {
    BaseEntity,
    Column,
    Entity,
    getManager,
    JoinColumn,
    OneToOne,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm'

import { AgeRange } from './ageRange'
import { Context } from '../main'
import { GraphQLResolveInfo } from 'graphql'
import { Organization } from './organization'
import { PermissionName } from '../permissions/permissionNames'
import { Status } from './status'

@Entity()
export class Grade extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

    @Column({ nullable: false })
    public name?: string

    @Column({ nullable: false, default: false })
    public system?: boolean

    @OneToOne(() => AgeRange, (ageRange) => ageRange.id)
    @JoinColumn({ name: 'age_range_id' })
    public age_range?: Promise<AgeRange>

    @OneToOne(() => Grade, (grade) => grade.id)
    @JoinColumn({ name: 'progress_fom_grade_id' })
    public progress_from_grade?: Promise<Grade>

    @OneToOne(() => Grade, (grade) => grade.id)
    @JoinColumn({ name: 'progress_to_grade_id' })
    public progress_to_grade?: Promise<Grade>

    @ManyToOne(() => Organization, (organization) => organization.ageRanges)
    @JoinColumn({ name: 'organization_id' })
    public organization?: Promise<Organization>

    @Column({ type: 'enum', enum: Status, default: Status.ACTIVE })
    public status!: Status

    @Column({ type: 'timestamp', nullable: false, default: () => 'now()' })
    public created_at!: Date

    @Column({ type: 'timestamp', nullable: true })
    public deleted_at?: Date

    public async delete(args: any, context: Context, info: GraphQLResolveInfo) {
        const organization_id = (await this.organization)?.organization_id
        if (
            info.operation.operation !== 'mutation' ||
            this.status == Status.INACTIVE
        ) {
            return false
        }

        if (this.system) {
            context.permissions.rejectIfNotAdmin()
        }

        const permisionContext = { organization_id: organization_id }
        await context.permissions.rejectIfNotAllowed(
            permisionContext,
            PermissionName.delete_grade_20443
        )

        await getManager().transaction(async (manager) => {
            await this.inactivate(manager)
        })

        return true
    }

    public async inactivate(manager: any) {
        this.status = Status.INACTIVE
        this.deleted_at = new Date()

        await manager.save(this)
    }
}
