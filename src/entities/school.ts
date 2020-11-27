import { 
    Column, 
    PrimaryGeneratedColumn, 
    Entity, 
    OneToMany, 
    getRepository, 
    getManager, 
    JoinColumn, 
    ManyToMany, 
    JoinTable, 
    ManyToOne, 
    BaseEntity,
    CreateDateColumn,
    Not
} from 'typeorm';
import { GraphQLResolveInfo } from 'graphql';
import { Length, IsEmail, IsHexColor, IsOptional, IsDateString, Matches, validate } from 'class-validator'
import { User } from './user';
import { Class } from './class';
import { SchoolMembership } from './schoolMembership';
import { Organization } from './organization';
import { Context } from '../main';
import { PermissionName } from '../permissions/permissionNames';
import { ErrorHelpers, BasicValidationError } from '../entities/helpers'
import { EntityId } from './organization'
import { AWSS3 } from './s3';
import { ApolloServerFileUploads } from './types';
import { UniqueOnDatabase } from '../decorators/unique';

export interface SchoolInput {
    school_name: string
    address: string
    phone: string
    email: string
    startDate: Date
    endDate: Date
    grades: string[]
    color: string
    logo?: ApolloServerFileUploads.File
}

@Entity()
export class School extends BaseEntity {
    private _errors: null | undefined | BasicValidationError[]

    @PrimaryGeneratedColumn("uuid")
    public readonly school_id!: string;

    @Column({nullable: true})
    @Length(1, 35)
    public school_name?: string

    @Column({nullable: true})
    @Length(15, 60)
    public address?: string

    @Column({nullable: true})
    @Matches(/^[0-9]{10,15}$/)
    public phone?: string

    @Column({nullable: true})
    @IsEmail()
    @Length(1, 50)
    @UniqueOnDatabase(School, (self: EntityId) => (self.school_id ? { school_id: Not(self.school_id as string) } : {}))
    public email?: string

    @Column({nullable: true})
    @IsOptional()
    @IsDateString()
    public startDate?: Date

    @Column({nullable: true})
    @IsOptional()
    @IsDateString()
    public endDate?: Date

    @Column("varchar",{ nullable: true, array: true})
    @IsOptional()
    public grades?: string[]

    @Column({nullable: true})
    public logoKey?: string

    public async logo() {
        if(this.logoKey) {
            const s3 = AWSS3.getInstance({ 
                accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
                destinationBucketName: process.env.AWS_DEFAULT_BUCKET as string,
                region: process.env.AWS_DEFAULT_REGION as string,
            })
            
            return s3.getSignedUrl(this.logoKey as string)
        }
        return ''
    }

    @Column({nullable: true})
    @IsHexColor()
    public color?: string

    @CreateDateColumn()
    public createdAt?: Date

    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
    public updatedAt?: Date

    // pass arguments for validation of UniqueOnDatabase  
    // constraint columns on updating the entity
    public __req__: EntityId | null = {}

    public async errors() {
        if(undefined !== this._errors) { return this._errors }

        const info: EntityId = {
            school_id: this.school_id
        }
        this.__req__ = info
        
        this._errors = null
        const errs = await validate(this)
        if(errs.length > 0) {
            this._errors = ErrorHelpers.GetValidationError(errs)
        }
        return this._errors
    }

    public async isValid() {
        await this.errors()
        return (this._errors === null)
    }

    @OneToMany(() => SchoolMembership, membership => membership.school)
    @JoinColumn({name: "user_id", referencedColumnName: "user_id"})
    public memberships?: Promise<SchoolMembership[]>

    public async membership({user_id}: any, context: Context, info: GraphQLResolveInfo) {
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
    @JoinTable()
    public classes?: Promise<Class[]>

    public async set({
        school_name,
        address,
        phone,
        email,
        startDate,
        endDate,
        grades,
        color,
        logo
    }: SchoolInput, context: Context, info: GraphQLResolveInfo) {
        try {

            const permisionContext = {
              organization_id: (await this.organization as Organization).organization_id,
              school_id: this.school_id
            }

            await context.permissions.rejectIfNotAllowed(

              permisionContext,

              PermissionName.edit_school_20330

            )

            if(info.operation.operation !== "mutation") { return null }

            await getManager().transaction(async (manager) => {

                if(typeof school_name === "string") { this.school_name = school_name }
                if(typeof address === "string")     { this.address = address }
                if(typeof email === "string")       { this.email = email.trim().toLowerCase() }
                if(typeof phone === "string")       { this.phone = phone }
                if(startDate instanceof Date)       { this.startDate = startDate }
                if(endDate instanceof Date)         { this.endDate = endDate }
                if(Array.isArray(grades))           { this.grades = grades }
                if(typeof color === "string")       { this.color = color }

                if(!await this.isValid()) {
                    return this
                }

                if (undefined !== logo && null !== logo && typeof logo === 'object') {
                    const s3 = AWSS3.getInstance({ 
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
                        destinationBucketName: process.env.AWS_DEFAULT_BUCKET as string,
                        region: process.env.AWS_DEFAULT_REGION as string,
                    })    
                    const upload = await s3.singleFileUpload({file: logo as ApolloServerFileUploads.File, path: 'school/' + this.school_id, type: 'image'})
    
                    this.logoKey = upload.key
                }

                await manager.save(this)
            })

            return this
        } catch(e) {
            console.error(e)
        }
    }

    public async addUser({user_id}: any, context: Context, info: GraphQLResolveInfo) {
        try {
            const permisionContext = {
              organization_id: (await this.organization as Organization).organization_id,
              school_id: this.school_id
            }

            await context.permissions.rejectIfNotAllowed(

              permisionContext,

              PermissionName.edit_school_20330

            )

            if(info.operation.operation !== "mutation") { return null }

            const user = await getRepository(User).findOneOrFail(user_id)
            const membership = new SchoolMembership()
            membership.school_id = this.school_id
            membership.school = Promise.resolve(this)
            membership.user_id = user_id
            membership.user = Promise.resolve(user)

            await getManager().save(membership)
            return membership
        } catch(e) {
            console.error(e)
        }
    }
}
