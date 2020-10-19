import { BaseEntity, Column, Entity, PrimaryColumn } from "typeorm";


@Entity()
export class Attendance extends BaseEntity {    
    @PrimaryColumn()
    public user_id!: string

    @PrimaryColumn()
    public room_id!: string

    @PrimaryColumn()
    public session_id!: string

    @Column()
    public join_timestamp!: Date
    
    @Column()
    public leave_timestamp!: Date

}