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
    @PrimaryColumn()
    public permission_name!: string

    @ManyToOne(() => Role, (role) => role.permission, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'role_id' })
    public role?: Promise<Role>

    @Column({ nullable: false })
    public allow!: boolean
}
