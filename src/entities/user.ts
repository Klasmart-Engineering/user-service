import {Entity, PrimaryGeneratedColumn, Column, OneToMany, getRepository, BaseEntity, ManyToMany, getManager, JoinColumn, JoinTable, OneToOne} from "typeorm";
import { GraphQLResolveInfo } from 'graphql';
import { OrganizationMembership } from "./organizationMembership";
import { AWSS3 } from "../entities/s3";
import { Role } from "./role";
import { Organization, OrganizationInput, OrganizationStatus } from "./organization";
import { Class } from "./class";
import { SchoolMembership } from "./schoolMembership";
import { ApolloServerFileUploads } from "../entities/types";

export const UserStatus = {
    "PENDING": "PENDING",
    "ACTIVE": "ACTIVE",
    "SUSPENDED": "SUSPENDED",
    "INACTIVE": "INACTIVE",
} 

@Entity()
export class User extends BaseEntity {

    @PrimaryGeneratedColumn("uuid")
    public user_id!: string

    @Column({nullable: true})
    public user_name?: string

    @Column({nullable: true})
    public given_name?: string

    @Column({nullable: true})
    public family_name?: string

    @Column({nullable: true})
    public email?: string

    @Column({nullable: true})
    public avatar?: string

    @OneToMany(() => OrganizationMembership, membership => membership.user)
    @JoinColumn({name: "organization_id", referencedColumnName: "organization_id"})
    public memberships?: Promise<OrganizationMembership[]>
    public async membership({organization_id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            const membership = await getRepository(OrganizationMembership).findOneOrFail({where: {user_id: this.user_id, organization_id}})
            return membership
        } catch(e) {
            console.error(e)
        }
    }

    @OneToMany(() => SchoolMembership, schoolMembership => schoolMembership.user)
    @JoinColumn({name: "school_id", referencedColumnName: "school_id"})
    public school_memberships?: Promise<SchoolMembership[]>

    @ManyToMany(() => Class, class_ => class_.teachers)
    @JoinTable()
    public classesTeaching?: Promise<Class[]>
    
    @ManyToMany(() => Class, class_ => class_.students)
    @JoinTable()
    public classesStudying?: Promise<Class[]>

    @OneToOne(() => Organization, organization => organization.owner)
    @JoinColumn()
    public my_organization?: Promise<Organization>

    public async set({
        user_name,
        given_name,
        family_name,
        avatar,
    }: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }

            if(typeof user_name === "string")   { this.user_name = user_name }
            if(typeof given_name === "string")  { this.given_name = given_name }
            if(typeof family_name === "string") { this.family_name = family_name }
            if(typeof avatar === "string")      { this.avatar = avatar }
            
            await this.save()
            return this
        } catch(e) {
            console.error(e)
        }
    }
    public async createOrganization({organization_name, address1, address2, email, phone, shortCode, color, logo}: OrganizationInput, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            const my_organization = await this.my_organization
            if(my_organization) { throw new Error("Only one organization per user") }
            
            const organization = new Organization()

            organization.organization_name = organization_name
            organization.address1 = address1
            organization.address2 = address2
            organization.email = email.trim().toLowerCase()
            organization.phone = phone
            organization.shortCode = shortCode
            organization.color = color
            organization.status = OrganizationStatus.ACTIVE
            organization.owner = Promise.resolve(this)
            organization.primary_contact = Promise.resolve(this)

            if(!await organization.isValid()) {
                return organization
            }

            await getManager().save(organization)

            const s3 = AWSS3.getInstance({ 
                accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
                destinationBucketName: process.env.AWS_DEFAULT_BUCKET as string,
                region: process.env.AWS_DEFAULT_REGION as string,
            })
            const upload = await s3.singleFileUpload({file: logo as ApolloServerFileUploads.File, path: organization.organization_id, type: 'image'})
        
            organization.logoKey = upload.key
            await getManager().save(organization)
    
            return organization
        } catch(e) {
            console.error(e)
        }
    }

    public async addOrganization({ organization_id }: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            const membership = new OrganizationMembership()
            membership.organization_id = organization_id
            membership.organization = getRepository(Organization).findOneOrFail(organization_id)
            membership.user_id = this.user_id
            membership.user = Promise.resolve(this)
            await getManager().save(membership)
            return membership
        } catch(e) {
            console.error(e)
        }
    }
}
