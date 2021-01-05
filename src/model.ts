import {createConnection, Connection, getManager, EntityManager, getRepository, Repository} from "typeorm";
import { User, accountUUID } from './entities/user';
import { Organization } from "./entities/organization";
import { Role } from "./entities/role";
import { Class } from "./entities/class";
import { Context } from "./main";
import { School } from "./entities/school";
import { OrganizationOwnership } from "./entities/organizationOwnership";

export class Model {
    public static async create() {
        try {
            const connection = await createConnection({
                name: "default",
                type: "postgres",
                url: process.env.DATABASE_URL || "postgres://postgres:kidsloop@localhost",
                synchronize: true,
                logging: Boolean(process.env.DATABASE_LOGGING),
                entities: ["src/entities/*.ts"],
            })
            const model = new Model(connection)
            await getManager(connection.name).query("CREATE EXTENSION IF NOT EXISTS pg_trgm")
            console.log("🐘 Connected to postgres")
            return model
        } catch(e) {
            console.log("❌ Failed to connect or initialize postgres")
            throw e
        }
    }

    public static readonly SIMILARITY_THRESHOLD = process.env.POSTGRES_TRGM_LIMIT || 0.1;

    private connection: Connection
    private manager: EntityManager
    private userRepository: Repository<User>
    private organizationRepository: Repository<Organization>
    private roleRepository: Repository<Role>
    private classRepository: Repository<Class>
    private schoolRepository: Repository<School>

    constructor(connection: Connection) {
        this.connection = connection
        this.manager = getManager(connection.name)
        this.userRepository = getRepository(User, connection.name)
        this.organizationRepository = getRepository(Organization, connection.name)
        this.roleRepository = getRepository(Role, connection.name)
        this.classRepository = getRepository(Class, connection.name)
        this.schoolRepository = getRepository(School, connection.name)
    }

    public async getMyUser({token}: Context) {
        try {
            if(!token) {return null}
            let user = (await this.userRepository.findOne({ user_id: token.id })) || new User()

            let modified = false

            //Ensure fields match
            if(user.user_id !== token.id)
            { user.user_id = token.id; modified = true }

            if(user.email !== token.email)
            { user.email = token.email; modified = true }

            if(user.phone !== token.phone)
            { user.phone = token.phone; modified = true }

            if(!user.given_name && token.given_name)
            { user.given_name = token.given_name; modified = true }

            if(!user.family_name && token.family_name)
            { user.family_name = token.family_name; modified = true }

            if(modified) { await this.manager.save(user) }

            return user
        } catch(e) {
            console.error(e)
        }
    }
    public async newUser({given_name, family_name, email, phone, avatar}: any) {
        console.info("Unauthenticated endpoint call newUser")

        const newUser = new User()
        let hashSource = email ?? phone
        newUser.user_id = accountUUID(hashSource)
        newUser.given_name = given_name
        newUser.family_name = family_name
        newUser.email = email
        newUser.phone = phone
        newUser.avatar = avatar

        await this.manager.save(newUser)
        return newUser
    }


    // This is temporary function for migrating ownerships. Once is done it will dissappear
    public async newOrganizationOwnership({user_id, organization_id}: any) {
        console.info("Unauthenticated endpoint call newOrganizationOwnership")

        const user = User.findOneOrFail(user_id)
        const organization = Organization.findOneOrFail(organization_id)

        const organizationOwnership = new OrganizationOwnership()
        organizationOwnership.user_id = user_id
        organizationOwnership.organization_id = organization_id
        await this.manager.save(organizationOwnership)

        return organizationOwnership
    }

    public async setUser({user_id, given_name, family_name, email, avatar}: any) {
        console.info("Unauthenticated endpoint call setUser")

        const user = await this.userRepository.findOneOrFail(user_id)

        if(given_name !== undefined) { user.given_name = given_name }
        if(family_name !== undefined) { user.family_name = family_name }
        if(email !== undefined) { user.email = email }
        if(avatar !== undefined) { user.avatar = avatar }

        await this.manager.save(user)
        return user
    }
    public async getUser(user_id: string) {
        console.info("Unauthenticated endpoint call getUser")

        const user = await this.userRepository.findOneOrFail(user_id)
        return user
    }
    public async getUsers() {
        console.log("Unauthenticated endpoint call getUsers")

        return await this.userRepository.find()
    }

    public async setOrganization({organization_id, organization_name, address1, address2, phone, shortCode}:Organization) {
        console.info("Unauthenticated endpoint call setOrganization")

        const organization = await this.organizationRepository.findOneOrFail(organization_id)

        if(organization_name !== undefined) { organization.organization_name = organization_name }
        if(address1 !== undefined) { organization.address1 = address1 }
        if(address2 !== undefined) { organization.address2 = address2 }
        if(phone !== undefined) { organization.phone = phone }
        if(shortCode !== undefined) { organization.shortCode = shortCode }

        await this.manager.save(organization)
        return organization
    }
    public async getOrganization(organization_id: string) {
        console.info("Unauthenticated endpoint call getOrganization")

        const organization = await this.organizationRepository.findOne(organization_id)
        return organization
    }
    public async getOrganizations(organization_ids: string[]) {
        console.info("Unauthenticated endpoint call getOrganizations")

        try {
            if (organization_ids) {
                return await this.organizationRepository.findByIds(organization_ids)
            } else {
                return await this.organizationRepository.find()
            }
        } catch(e) {
            console.error(e)
        }
    }

    public async setRole({role_id, role_name}: Role) {
        console.info("Unauthenticated endpoint call setRole")

        try {
            const role = await this.roleRepository.findOneOrFail(role_id)

            if(role_name !== undefined) { role.role_name = role_name }

            return role
        } catch(e) {
            console.error(e)
        }
    }
    public async getRole({role_id}: Role) {
        console.info("Unauthenticated endpoint call getRole")

        try {
            const role = await this.roleRepository.findOneOrFail({role_id})
            return role
        } catch(e) {
            console.error(e)
        }
    }
    public async getRoles() {
        console.info("Unauthenticated endpoint call getRoles")

        try {
            const roles = await this.roleRepository.find()
            return roles
        } catch(e) {
            console.error(e)
        }
    }

    public async getClass({class_id}: Class) {
        console.info("Unauthenticated endpoint call getClass")

        try {
            const _class = await this.classRepository.findOneOrFail({class_id})
            return _class
        } catch(e) {
            console.error(e)
        }
    }
    public async getClasses() {
        console.info("Unauthenticated endpoint call getClasses")

        try {
            const classes = await this.classRepository.find()
            return classes
        } catch(e) {
            console.error(e)
        }
    }

    public async getSchool({school_id}: School) {
        console.info("Unauthenticated endpoint call getSchool")

        try {
            const school = await this.schoolRepository.findOneOrFail({school_id})
            return school
        } catch(e) {
            console.error(e)
        }
    }
}
