import {
    Column,
    Entity,
    getManager,
    JoinColumn,
    JoinTable,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm'
import { Status } from './status'
import { Organization } from './organization'
import { Context } from '../main'
import { GraphQLResolveInfo } from 'graphql'
import { PermissionName } from '../permissions/permissionNames'
import { Subject } from './subject'
import { AgeRange } from './ageRange'
import { Grade } from './grade'
import { School } from './school'
import { Class } from './class'
import { CustomBaseEntity } from './customBaseEntity'

@Entity()
export class Program extends CustomBaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

    @Column({ nullable: false })
    public name?: string

    @Column({ nullable: false, default: false })
    public system!: boolean

    @Column({ type: 'enum', enum: Status, default: Status.ACTIVE })
    public status!: Status

    @ManyToMany(() => AgeRange, (ageRange) => ageRange.programs)
    @JoinTable()
    public age_ranges?: Promise<AgeRange[]>

    @ManyToMany(() => Grade, (grade) => grade.programs)
    @JoinTable()
    public grades?: Promise<Grade[]>

    @ManyToMany(() => Subject, (subject) => subject.programs)
    @JoinTable()
    public subjects?: Promise<Subject[]>

    @ManyToOne(() => Organization, (organization) => organization.programs)
    @JoinColumn({ name: 'organization_id' })
    public organization?: Promise<Organization>

    @ManyToMany(() => School, (school) => school.programs)
    public schools?: Promise<School>

    @ManyToMany(() => Class, (class_) => class_.programs)
    public classes?: Promise<Class>
}
