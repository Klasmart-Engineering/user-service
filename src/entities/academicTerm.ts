import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    RelationId,
} from 'typeorm'
import { Class } from './class'
import { CustomBaseEntity } from './customBaseEntity'
import { School } from './school'

@Entity()
export class AcademicTerm extends CustomBaseEntity {
    @PrimaryGeneratedColumn('uuid')
    public id!: string

    @Column({ nullable: false })
    public name!: string

    @Column({ type: 'timestamp', nullable: false, precision: 3 })
    public start_date!: Date

    @Column({ type: 'timestamp', nullable: false, precision: 3 })
    public end_date!: Date

    @ManyToOne(() => School, { nullable: false })
    @JoinColumn({ name: 'school_id' })
    public school!: Promise<School>

    @RelationId((term: AcademicTerm) => term.school)
    public readonly school_id!: string

    @OneToMany(() => Class, (c) => c.academicTerm)
    public classes?: Promise<Class[]>
}
