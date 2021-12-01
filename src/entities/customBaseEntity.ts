import {
    BaseEntity,
    Column,
    CreateDateColumn,
    EntityManager,
    UpdateDateColumn,
} from 'typeorm'
import { Status } from './status'

export abstract class CustomBaseEntity extends BaseEntity {
    @CreateDateColumn({
        type: 'timestamp',
        nullable: false,
        precision: 3,
        default: () => 'now()',
    })
    public created_at!: Date

    @UpdateDateColumn({
        type: 'timestamp',
        nullable: false,
        precision: 3,
        default: () => 'now()',
    })
    public updated_at!: Date

    @Column({ type: 'timestamp', nullable: true, precision: 3 })
    public deleted_at?: Date

    @Column({ type: 'enum', enum: Status, default: Status.ACTIVE })
    public status!: Status

    public async inactivate(manager?: EntityManager) {
        if (this.status === Status.INACTIVE) return

        this.status = Status.INACTIVE
        this.deleted_at = new Date()

        if (manager) await manager.save(this)
    }
}
