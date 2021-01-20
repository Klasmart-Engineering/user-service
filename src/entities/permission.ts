import {
    BaseEntity,
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryColumn,
} from 'typeorm'
import { Role } from './role'

@Entity()
export class Permission extends BaseEntity {
    @PrimaryColumn()
    public role_id!: string
    @PrimaryColumn({ name: 'permission_id' })
    public permission_name!: string

    // This is done to do a renaming without breaking the frontend. Will be
    // updated once both coloumns are backfiled
    @Column({ name: 'permission_name', nullable: true })
    public permission_id?: string

    @ManyToOne(() => Role, (role) => role.permission, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'role_id' })
    public role?: Promise<Role>

    @Column({ nullable: false })
    public allow!: boolean

    @Column({ nullable: true })
    public permission_category?: string

    @Column({ nullable: true })
    public permission_section?: string

    @Column({ nullable: true })
    public permission_description?: string
}
