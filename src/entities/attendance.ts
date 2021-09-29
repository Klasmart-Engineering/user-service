import { Column, Entity, PrimaryColumn, Index } from 'typeorm'
import { CustomBaseEntity } from './customBaseEntity'

//Shared by kidsloop-live-server
// TODO: Create a shared repository
@Entity()
export class Attendance extends CustomBaseEntity {
    @PrimaryColumn()
    public session_id!: string

    @PrimaryColumn()
    public join_timestamp!: Date

    @PrimaryColumn()
    public leave_timestamp!: Date

    @Index()
    @Column()
    public room_id?: string

    @Index()
    @Column({ nullable: false })
    public user_id!: string
}
