import { IsHexColor, IsOptional, Length } from "class-validator";
import { GraphQLResolveInfo } from "graphql";
import { BaseEntity, Column, CreateDateColumn, Entity, getRepository, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Organization } from "./organization";
import { School } from "./school";
import { User } from "./user";

export interface ClassInput {
    class_name: string,
    status: boolean,
    program: string,
    schools: string[],
    subjects: string[],
    grades: string[],
    startDate: string,
    endDate: string,
    createdAt: string,
    color: string,
}

@Entity()
export class Class extends BaseEntity {    

    @PrimaryGeneratedColumn("uuid")
    public class_id!: string

    @Column()
    public class_name?: String

    @Column({nullable: false, default: true})
    @IsOptional()
    public status?: boolean

    @Column({nullable: true})
    @IsOptional()
    public program?: string

    @Column("varchar",{ nullable: true, array: true})
    @IsOptional()
    public subjects?: string[]

    @Column("varchar",{ nullable: true, array: true})
    @IsOptional()
    public grades?: string[]

    @Column({nullable: true})
    @IsOptional()
    public startDate?: string

    @Column({nullable: true})
    @IsOptional()
    public endDate?: string

    @CreateDateColumn()
    public createdAt?: Date

    @Column({nullable: true})
    @IsOptional()
    @IsHexColor()
    public color?: string

    @ManyToOne(() => Organization, organization => organization.classes)
    public organization?: Promise<Organization>

    @ManyToMany(() => School, school => school.classes)
    public schools?: Promise<School[]>

    @ManyToMany(() => User, user => user.classesTeaching)
    public teachers?: Promise<User[]>

    @ManyToMany(() => User, user => user.classesStudying)
    public students?: Promise<User[]>

    public async addTeacher({user_id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            const user = await getRepository(User).findOneOrFail({user_id})
            const classes  = (await user.classesTeaching) || []
            classes.push(this)
            user.classesTeaching = Promise.resolve(classes)
            await user.save()

            return user
        } catch(e) {
            console.error(e)
        }
    }

    public async addStudent({user_id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            const user = await getRepository(User).findOneOrFail({user_id})
            const classes  = (await user.classesStudying) || []
            classes.push(this)
            user.classesStudying = Promise.resolve(classes)
            await user.save()

            return user
        } catch(e) {
            console.error(e)
        }
    }

    public async addSchool({school_id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            const school = await getRepository(School).findOneOrFail({school_id})
            const classes  = (await school.classes) || []
            classes.push(this)
            school.classes = Promise.resolve(classes)
            await school.save()

            return school
        } catch(e) {
            console.error(e)
        }
    }

    public async delete({}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            await this.remove()
            return true
        } catch(e) {
            console.error(e)
        }
        return false
    }

}