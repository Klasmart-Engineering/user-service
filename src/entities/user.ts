import {Entity, PrimaryGeneratedColumn, Column, OneToMany, getRepository, BaseEntity, ManyToMany, getManager, JoinColumn, JoinTable, OneToOne} from "typeorm";
import { GraphQLResolveInfo } from 'graphql';
import { OrganizationMembership } from "./organizationMembership";
import { Organization } from "./organization";
import { Class } from "./class";
import { SchoolMembership } from "./schoolMembership";
import { ContentControl} from "./contentControl";
import { v5 } from "uuid";
import { createHash } from "crypto"

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

    public async school_membership({school_id}: any, context: any, info: GraphQLResolveInfo) {
        try {
            const membership = await getRepository(OrganizationMembership).findOneOrFail({where: {user_id: this.user_id, school_id}})
            return membership
        } catch(e) {
            console.error(e)
        }
    }

    @ManyToMany(() => Class, class_ => class_.teachers)
    @JoinTable()
    public classesTeaching?: Promise<Class[]>
    
    @ManyToMany(() => Class, class_ => class_.students)
    @JoinTable()
    public classesStudying?: Promise<Class[]>

    @OneToOne(() => Organization, organization => organization.owner)
    @JoinColumn()
    public my_organization?: Promise<Organization>

    @OneToMany(() => ContentControl, contentControl => contentControl.user)
    @JoinColumn({
        name: "content_controls",
    })
    public contentControls?: Promise<ContentControl[]>

    public async organizationsWithPermission({permission_name}: any, context: any, info: GraphQLResolveInfo) {
        try {
            return await getRepository(OrganizationMembership)
                .createQueryBuilder()
                .innerJoin("OrganizationMembership.roles","Role")
                .innerJoin("Role.permissions","Permission")
                .groupBy("OrganizationMembership.organization_id, Permission.permission_name, OrganizationMembership.user_id")
                .where("OrganizationMembership.user_id = :user_id", this)
                .andWhere("Permission.permission_name = :permission_name", {permission_name})
                .having("bool_and(Permission.allow) = :allowed", {allowed: true})
                .getMany()
        } catch(e) {
            console.error(e)
        }
    }

    public async schoolsWithPermission({permission_name}: any, context: any, info: GraphQLResolveInfo) {
        try {
            return await getRepository(SchoolMembership)
                .createQueryBuilder()
                .innerJoin("SchoolMembership.roles","Role")
                .innerJoin("Role.permissions","Permission")
                .groupBy("SchoolMembership.school_id, Permission.permission_name, SchoolMembership.user_id")
                .where("SchoolMembership.user_id = :user_id", this)
                .andWhere("Permission.permission_name = :permission_name", {permission_name})
                .having("bool_and(Permission.allow) = :allowed", {allowed: true})
                .getMany()
        } catch(e) {
            console.error(e)
        }
    }

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
    public async createOrganization({organization_name, address1, address2, phone, shortCode}: any, context: any, info: GraphQLResolveInfo) {
        try {
            if(info.operation.operation !== "mutation") { return null }
            const my_organization = await this.my_organization
            if(my_organization) { throw new Error("Only one organization per user") }
            
            const organization = new Organization()

            organization.organization_name = organization_name
            organization.address1 = address1
            organization.address2 = address2
            organization.phone = phone
            organization.shortCode = shortCode
            organization.owner = Promise.resolve(this)
            organization.primary_contact = Promise.resolve(this)

            const membership = new OrganizationMembership()
            membership.user = Promise.resolve(this)
            membership.user_id = this.user_id
            membership.organization = Promise.resolve(organization)
            membership.organization_id = organization.organization_id
            organization.memberships = Promise.resolve([membership])
            
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

    public async setContentControl({ documentId, accessLevel}: any, context: any, info: GraphQLResolveInfo) {
        if(info.operation.operation !== "mutation") { return null }
        try {
            let contentControl = await getRepository(ContentControl).findOne({
                where: [
                  { user: this.user_id, documentId },
                ]
              })

            if (!contentControl) {
                contentControl = new ContentControl()
                contentControl.user = await getRepository(User).findOneOrFail(this.user_id)
            }
            contentControl.documentId = documentId
            contentControl.accessLevel = accessLevel
            await getManager().save(contentControl)
            return contentControl
        } catch(e) {
            console.error(e)
        }
    }
}

const accountNamespace = v5("kidsloop.net", v5.DNS)
export function accountUUID(email?: string) {
    const hash = createHash('sha256');
    if(email) { hash.update(email) }
    return v5(hash.digest(), accountNamespace)
}