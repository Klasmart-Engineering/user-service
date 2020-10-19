import { Column, PrimaryGeneratedColumn, Entity, OneToMany, getRepository, getManager, JoinColumn, ManyToMany, JoinTable, ManyToOne, BaseEntity } from 'typeorm';
import { GraphQLResolveInfo } from 'graphql';
import { User } from './user';
import { Class } from './class';
import { SchoolMembership } from './schoolMembership';
import { Organization } from './organization';

@Entity()
export class School extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    public readonly school_id!: string;
    
    @Column({nullable: true})
    public school_name?: string
    
    @OneToMany(() => SchoolMembership, membership => membership.school)
    @JoinColumn({name: "user_id", referencedColumnName: "user_id"})
    public memberships?: Promise<SchoolMembership[]>

    public async membership({user_id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            const membership = await getRepository(SchoolMembership).findOneOrFail({where: {user_id, school_id: this.school_id}})
            return membership
        } catch(e) {
            console.error(e)
        }
    }

    @ManyToOne(() => Organization, organization => organization.schools)
    @JoinColumn()
    public organization?: Promise<Organization>

    @ManyToMany(() => Class, class_ => class_.schools)
    @JoinColumn()
    public classes?: Promise<Class[]>

    public async addUser({user_id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }

            const membership = new SchoolMembership()
            membership.school_id = this.school_id
            membership.school = Promise.resolve(this)
            membership.user_id = user_id
            membership.user = getRepository(User).findOneOrFail(user_id)

            await getManager().save(membership)
            return membership
        } catch(e) {
            console.error(e)
        }
    }
}