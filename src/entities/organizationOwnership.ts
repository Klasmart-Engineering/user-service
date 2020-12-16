import {
    BaseEntity,
    Column,
    Entity,
    getManager,
    JoinColumn,
    OneToOne,
    PrimaryColumn,
} from "typeorm";

import { Organization } from './organization';
import { Status } from "./status";
import { User } from './user';

@Entity()
export class OrganizationOwnership extends BaseEntity {
    @PrimaryColumn()
    public user_id!: string

    @OneToOne(() => User, user => user.user_id)
    @JoinColumn({name: "user_id", referencedColumnName: "user_id"})
    public user!: Promise<User>

    @PrimaryColumn()
    public organization_id!: string

    @OneToOne(() => Organization, org => org.organization_id)
    @JoinColumn({name: "organization_id", referencedColumnName: "organization_id"})
    public organization!: Promise<Organization>

    @Column({type: "enum", enum: Status, default: Status.ACTIVE})
    public status! : Status

    @Column({ type: 'timestamp', nullable: true})
    public deleted_at?: Date

    public async inactivate(manager : any){
        if(this.status != Status.ACTIVE) { return }

        this.status = Status.INACTIVE
        this.deleted_at = new Date()

        await manager.save(this)
    }
}
