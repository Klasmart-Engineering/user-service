import {
    Column,
    Entity,
    getManager,
    JoinColumn,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm'

import { Context } from '../main'
import { GraphQLResolveInfo } from 'graphql'
import { Organization } from './organization'
import { PermissionName } from '../permissions/permissionNames'
import { Status } from './status'
import { CustomBaseEntity } from './customBaseEntity'
import { Class } from './class'
import { Program } from './program'

@Entity()
export class Grade extends CustomBaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

    @Column({ nullable: false })
    public name?: string

    @Column({ nullable: false, default: false })
    public system?: boolean

    @ManyToOne(() => Grade, (grade) => grade.id)
    @JoinColumn({ name: 'progress_from_grade_id' })
    public progress_from_grade?: Promise<Grade>

    @ManyToOne(() => Grade, (grade) => grade.id)
    @JoinColumn({ name: 'progress_to_grade_id' })
    public progress_to_grade?: Promise<Grade>

    @ManyToOne(() => Organization, (organization) => organization.ageRanges)
    @JoinColumn({ name: 'organization_id' })
    public organization?: Promise<Organization>

    @ManyToMany(() => Class, (class_) => class_.grades)
    public classes?: Promise<Class[]>

    @ManyToMany(() => Program, (program) => program.grades)
    public programs?: Promise<Program[]>

    public async delete(
        args: Record<string, unknown>,
        context: Context,
        info: GraphQLResolveInfo
    ) {
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

        const permissionContext = {
            organization_ids: organization_id ? [organization_id] : undefined,
        }
        await context.permissions.rejectIfNotAllowed(
            permissionContext,
            PermissionName.delete_grade_20443
        )

        await getManager().transaction(async (manager) => {
            await this.inactivate(manager)
        })

        return true
    }
}
