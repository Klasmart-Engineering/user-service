import { Entity, PrimaryGeneratedColumn, Column, OneToMany, getConnection, getRepository, BaseEntity, ManyToMany, getManager, JoinColumn, JoinTable, OneToOne, EntityManager } from "typeorm";
import { GraphQLResolveInfo } from 'graphql';
import { OrganizationMembership } from "./organizationMembership";
import { Organization } from "./organization";
import { Class } from "./class";
import { SchoolMembership } from "./schoolMembership";
import { OrganizationOwnership } from './organizationOwnership';
import { v5 } from "uuid";
import { createHash } from "crypto"
import { School } from "./school";
import { Status } from "./status";

@Entity()
export class User extends BaseEntity {

    @PrimaryGeneratedColumn("uuid")
    public user_id!: string

    public user_name = () => `${this.given_name} ${this.family_name}`

    @Column({ nullable: true })
    public given_name?: string

    @Column({ nullable: true })
    public family_name?: string

    @Column({ nullable: true })
    public email?: string

    @Column({ nullable: true })
    public phone?: string

    @Column({ nullable: true })
    public avatar?: string

    @Column({ type: "enum", enum: Status, default: Status.ACTIVE })
    public status!: Status

    @Column({ type: 'timestamp', nullable: true })
    public deleted_at?: Date

    @OneToMany(() => OrganizationMembership, membership => membership.user)
    @JoinColumn({ name: "organization_id", referencedColumnName: "organization_id" })
    public memberships?: Promise<OrganizationMembership[]>

    public async membership({ organization_id }: any, context: any, info: GraphQLResolveInfo) {
        try {
            const membership = await getRepository(OrganizationMembership).findOneOrFail({ where: { user_id: this.user_id, organization_id } })
            return membership
        } catch (e) {
            console.error(e)
        }
    }

    @OneToMany(() => SchoolMembership, schoolMembership => schoolMembership.user)
    @JoinColumn({ name: "school_id", referencedColumnName: "school_id" })
    public school_memberships?: Promise<SchoolMembership[]>

    public async school_membership({ school_id }: any, context: any, info: GraphQLResolveInfo) {
        try {
            const membership = await getRepository(SchoolMembership).findOneOrFail({ where: { user_id: this.user_id, school_id } })
            return membership
        } catch (e) {
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

    @OneToMany(() => OrganizationOwnership, orgOwnership => orgOwnership.user)
    @JoinColumn({name: "user_id", referencedColumnName: "user_id"})
    public organization_ownerships?: Promise<OrganizationOwnership[]>

    public async organizationsWithPermission({permission_name}: any, context: any, info: GraphQLResolveInfo) {
        try {
            return await getRepository(OrganizationMembership)
                .createQueryBuilder()
                .innerJoin("OrganizationMembership.roles", "Role")
                .innerJoin("Role.permissions", "Permission")
                .groupBy("OrganizationMembership.organization_id, Permission.permission_name, OrganizationMembership.user_id")
                .where("OrganizationMembership.user_id = :user_id", { user_id: this.user_id })
                .andWhere("Permission.permission_name = :permission_name", { permission_name })
                .having("bool_and(Permission.allow) = :allowed", { allowed: true })
                .getMany()
        } catch (e) {
            console.error(e)
        }
    }

    public async schoolsWithPermission({ permission_name }: any, context: any, info: GraphQLResolveInfo) {
        try {
            const schoolPermissionPromise = await getRepository(SchoolMembership)
                .createQueryBuilder()
                .innerJoin("SchoolMembership.roles", "Role")
                .innerJoin("Role.permissions", "Permission")
                .groupBy("SchoolMembership.school_id, Permission.permission_name, SchoolMembership.user_id")
                .where("SchoolMembership.user_id = :user_id", { user_id: this.user_id })
                .andWhere("Permission.permission_name = :permission_name", { permission_name })
                .having("bool_and(Permission.allow) = :allowed", { allowed: true })
                .getMany()

            const organizationPermissionPromise = await getRepository(SchoolMembership)
                .createQueryBuilder()
                .innerJoin("SchoolMembership.school", "School")
                .innerJoin("School.organization", "SchoolOrganization")
                .innerJoin("SchoolOrganization.memberships", "OrgMembership")
                .innerJoin("OrgMembership.roles","OrgRole")
                .innerJoin("OrgRole.permissions", "OrgPermission")
                .groupBy("OrgMembership.user_id, SchoolMembership.school_id, OrgPermission.permission_name, SchoolMembership.user_id")
                .where("OrgMembership.user_id = :user_id AND SchoolMembership.user_id = :user_id", {user_id: this.user_id})
                .andWhere("OrgPermission.permission_name = :permission_name", {permission_name})
                .having("bool_and(OrgPermission.allow) = :allowed", {allowed: true})
                .getMany()

            const [schoolPermissionResults, organizationPermissionResults] = await Promise.all([schoolPermissionPromise, organizationPermissionPromise]);

            return schoolPermissionResults.concat(
                organizationPermissionResults.filter(
                    a => {
                        return !schoolPermissionResults.find(b => b.school_id === a.school_id);
                    }
                )
            );
        } catch(e) {
            console.error(e)
        }
    }


    public async set({
        given_name,
        family_name,
        avatar,
    }: any, context: any, info: GraphQLResolveInfo) {
        try {
            if (info.operation.operation !== "mutation") { return null }

            if (typeof given_name === "string") { this.given_name = given_name }
            if (typeof family_name === "string") { this.family_name = family_name }
            if (typeof avatar === "string") { this.avatar = avatar }

            await this.save()
            return this
        } catch (e) {
            console.error(e)
        }
    }
    public async createOrganization({organization_name, address1, address2, phone, shortCode}: any, context: any, info: GraphQLResolveInfo) {
        const active_organizations = await OrganizationOwnership.find({
            where: { user_id: this.user_id, status: Status.ACTIVE }
        })
        if(active_organizations.length) { throw new Error("Only one active organization per user") }

        try {
            if (info.operation.operation !== "mutation") { return null }
            const my_organization = await this.my_organization
            if (my_organization) { throw new Error("Only one organization per user") }

            const organization = new Organization()
            await getManager().transaction(async (manager) => {
                organization.organization_name = organization_name
                organization.address1 = address1
                organization.address2 = address2
                organization.phone = phone
                organization.shortCode = shortCode
                organization.owner = Promise.resolve(this)
                organization.primary_contact = Promise.resolve(this)
                await manager.save(organization)

                const roles = await organization._createDefaultRoles(manager)
                const adminRoles = roles.get("Organization Admin")

                const membership = new OrganizationMembership()
                membership.user = Promise.resolve(this)
                membership.user_id = this.user_id
                membership.organization = Promise.resolve(organization)
                membership.organization_id = organization.organization_id
                if (adminRoles) { membership.roles = Promise.resolve(adminRoles) }
                organization.memberships = Promise.resolve([membership])
                await manager.save(membership)

                const organizationOwnership = new OrganizationOwnership()
                organizationOwnership.user_id = this.user_id
                organizationOwnership.organization_id = organization.organization_id
                await manager.save(organizationOwnership)

            })

            return organization
        } catch (e) {
            console.error(e)
        }
    }

    public async addOrganization({ organization_id }: any, context: any, info: GraphQLResolveInfo) {
        try {
            if (info.operation.operation !== "mutation") { return null }

            const organization = await getRepository(Organization).findOneOrFail(organization_id)
            const membership = new OrganizationMembership()
            membership.organization_id = organization_id
            membership.organization = Promise.resolve(organization)
            membership.user_id = this.user_id
            membership.user = Promise.resolve(this)
            await getManager().save(membership)
            return membership
        } catch (e) {
            console.error(e)
        }
    }

    public async addSchool({ school_id }: any, context: any, info: GraphQLResolveInfo) {
        try {
            if (info.operation.operation !== "mutation") { return null }

            const school = await getRepository(School).findOneOrFail(school_id)
            const membership = new SchoolMembership()
            membership.school_id = school_id
            membership.school = Promise.resolve(school)
            membership.user_id = this.user_id
            membership.user = Promise.resolve(this)
            await getManager().save(membership)
            return membership
        } catch (e) {
            console.error(e)
        }
    }

    public async merge({ other_id }: any, context: any, info: GraphQLResolveInfo) {
        if (info.operation.operation !== "mutation") { return null }
        if (other_id != undefined) {
            let dberr: any
            const ourid = this.user_id
            let ouruser = this
            let otherUser = await getRepository(User).findOne({ user_id: other_id })
            if (otherUser !== undefined) {
                let success = true
                const connection = getConnection();
                const queryRunner = connection.createQueryRunner();
                await queryRunner.connect();
                let otherMemberships = await otherUser.memberships
                let ourMemberships = await ouruser.memberships
                let otherSchoolMemberships = await otherUser.school_memberships
                let ourSchoolMemberships = await ouruser.school_memberships
                let otherClassesStudying = await otherUser.classesStudying
                let otherClassesTeaching = await otherUser.classesTeaching
                let ourClassesStudying = await this.classesStudying
                let ourClassesTeaching = await this.classesTeaching

                await queryRunner.startTransaction();
                try {
                    let classesStudying: Class[] = []
                    if (ourClassesStudying !== undefined) {
                        classesStudying = ourClassesStudying
                    }
                    let classesTeaching: Class[] = []
                    if (ourClassesTeaching !== undefined) {
                        classesTeaching = ourClassesTeaching
                    }
                    let memberships: OrganizationMembership[] = []
                    if (ourMemberships !== undefined) {
                        memberships = ourMemberships
                    }
                    let schoolmemberships: SchoolMembership[] = []
                    if (ourSchoolMemberships !== undefined) {
                        schoolmemberships = ourSchoolMemberships
                    }
                    if (otherMemberships !== undefined) {
                        otherMemberships.forEach(async function (otherMembership) {
                            let found = false
                            memberships.some(async function (membership) {
                                if (membership.organization_id === otherMembership.organization_id) {
                                    found = true
                                }
                                return found
                            })
                            if (!found) {
                                let membership = new OrganizationMembership()
                                membership.organization_id = otherMembership.organization_id
                                membership.user_id = ourid
                                membership.user = Promise.resolve(ouruser)
                                membership.organization = otherMembership.organization
                                if (otherMembership.roles !== undefined) {
                                    membership.roles = Promise.resolve(otherMembership.roles)
                                }
                                memberships.push(membership)
                            }
                        })
                    }

                    if (otherSchoolMemberships !== undefined) {
                        otherSchoolMemberships.forEach(async function (otherSchoolMembership) {
                            let found = false
                            schoolmemberships.some(async function (schoolmembership) {
                                if (schoolmembership.school_id === otherSchoolMembership.school_id) {
                                    found = true
                                }
                                return found
                            })
                            if (!found) {
                                let schoolMembership = new SchoolMembership()
                                schoolMembership.user_id = ourid
                                schoolMembership.user = Promise.resolve(ouruser)

                                schoolMembership.school_id = otherSchoolMembership.school_id
                                schoolMembership.school = otherSchoolMembership.school
                                if (otherSchoolMembership.roles !== undefined) {
                                    schoolMembership.roles = Promise.resolve(otherSchoolMembership.roles)
                                }
                                schoolmemberships.push(schoolMembership)

                            }
                        })
                    }
                    if (memberships.length > 0) {
                        ouruser.memberships = Promise.resolve(memberships)
                    }
                    if (schoolmemberships.length > 0) {
                        ouruser.school_memberships = Promise.resolve(schoolmemberships)
                    }
                    if (memberships.length > 0) {
                        ouruser.memberships = Promise.resolve(memberships)
                        await queryRunner.manager.save([ouruser, ...memberships])
                    }
                    else {
                        ouruser.memberships = undefined
                    }

                    if (schoolmemberships.length > 0) {
                        ouruser.school_memberships = Promise.resolve(schoolmemberships)
                        await queryRunner.manager.save([ouruser, ...schoolmemberships])
                    }
                    else {
                        ouruser.school_memberships = undefined
                    }
                    if (memberships.length > 0) {
                        ouruser.memberships = Promise.resolve(memberships)
                    }
                    if (schoolmemberships.length > 0) {
                        ouruser.school_memberships = Promise.resolve(schoolmemberships)
                    }
                    if (memberships.length > 0) {
                        ouruser.memberships = Promise.resolve(memberships)
                        await queryRunner.manager.save([ouruser, ...memberships])
                    }
                    else {
                        ouruser.memberships = undefined
                    }

                    if (schoolmemberships.length > 0) {
                        ouruser.school_memberships = Promise.resolve(schoolmemberships)
                        await queryRunner.manager.save([ouruser, ...schoolmemberships])
                    }
                    else {
                        ouruser.school_memberships = undefined
                    }
                    if (memberships.length > 0) {
                        ouruser.memberships = Promise.resolve(memberships)
                    }
                    if (schoolmemberships.length > 0) {
                        ouruser.school_memberships = Promise.resolve(schoolmemberships)
                    }
                    if (memberships.length > 0) {
                        ouruser.memberships = Promise.resolve(memberships)
                        await queryRunner.manager.save([ouruser, ...memberships])
                    }
                    else{
                        ouruser.memberships = undefined
                    }

                    if (schoolmemberships.length > 0) {
                        ouruser.school_memberships = Promise.resolve(schoolmemberships)
                        await queryRunner.manager.save([ouruser, ...schoolmemberships])
                    }
                    else{
                        ouruser.school_memberships = undefined
                    }


                    if (otherClassesStudying !== undefined) {
                        let changed = false
                        otherClassesStudying.forEach(async function (otherClassStudying) {
                            let found = false
                            classesStudying.some(async function (classStudying) {
                                if (classStudying.class_id === otherClassStudying.class_id) {
                                    found = true
                                }
                                return found
                            })
                            if (!found) {
                                changed = true
                                classesStudying.push(otherClassStudying)
                            }
                        })
                        if (changed) {
                            ouruser.classesStudying = Promise.resolve(classesStudying)
                            await queryRunner.manager.save([ouruser, ...classesStudying])
                        }
                    }
                    if (otherClassesTeaching !== undefined) {
                        let changed = false
                        otherClassesTeaching.forEach(async function (otherClassTeaching) {

                            let found = false
                            classesTeaching.some(async function (classTeaching) {
                                if (classTeaching.class_id === otherClassTeaching.class_id) {
                                    found = true
                                }
                                return found
                            })
                            if (!found) {
                                changed = true
                                classesTeaching.push(otherClassTeaching)
                            }
                        })
                        if (changed) {
                            ouruser.classesTeaching = Promise.resolve(classesTeaching)
                            await queryRunner.manager.save([ouruser, ...classesTeaching])
                        }
                    }
                    await otherUser.inactivate(queryRunner.manager)
                    queryRunner.commitTransaction();

                } catch (err) {
                    success = false
                    console.log(err)
                    dberr = err
                    await queryRunner.rollbackTransaction();
                } finally {
                    await queryRunner.release();
                }
                if (success) {
                    console.log("success")
                    
                    return this
                }
                else {
                    throw (dberr)
                }

            }
        }
        return null
    }
   
    private async inactivateOrganizationMemberships(manager: any) {
        const organizationMemberships = await this.memberships || []

        for (const organizationMembership of organizationMemberships) {
            await organizationMembership.inactivate(manager)
        }
        
        return organizationMemberships
    }

    private async inactivateSchoolMemberships(manager: any) {
        const schoolMemberships = await this.school_memberships || []

        for (const schoolMembership of schoolMemberships) {
            await schoolMembership.inactivate(manager)
        }
        
        return schoolMemberships
    }

    public async inactivate(manager: any) {
        this.status = Status.INACTIVE
        this.deleted_at = new Date()
        await this.inactivateOrganizationMemberships(manager)
        await this.inactivateSchoolMemberships(manager)
        await manager.save(this)
    }

}



const accountNamespace = v5("kidsloop.net", v5.DNS)
export function accountUUID(email?: string) {
    const hash = createHash('sha256');
    if (email) { hash.update(email) }
    return v5(hash.digest(), accountNamespace)
}
