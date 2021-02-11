import {
    BaseEntity,
    Column,
    Entity,
    JoinColumn,
    JoinTable,
    ManyToOne,
    ManyToMany,
    PrimaryGeneratedColumn,
} from 'typeorm'
import { Role } from './role'

@Entity()
export class Permission extends BaseEntity {
    @PrimaryGeneratedColumn()
    public id!: number

    @Column({ name: 'role_id', nullable: false })
    public role_id!: string

    @Column({ name: 'permission_id', nullable: false })
    public permission_name!: string

    // This is done to do a renaming without breaking the frontend. Will be
    // updated once both coloumns are backfiled
    @Column({ name: 'permission_name', nullable: true })
    public permission_id?: string

    @ManyToOne(() => Role, (role) => role.permission, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'role_id' })
    public role?: Promise<Role>

    @ManyToMany(() => Role, (role) => role.permissions)
    @JoinTable()
    public roles?: Promise<Role[]>

    @Column({ nullable: false })
    public allow!: boolean

    @Column({ nullable: true })
    public permission_category?: string

    @Column({ nullable: true })
    public permission_group?: string

    @Column({ nullable: true })
    public permission_level?: string

    @Column({ nullable: true })
    public permission_description?: string
}
