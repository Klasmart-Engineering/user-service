import {createConnection, Connection, getManager, EntityManager, getRepository, Repository} from "typeorm";
import { User } from '../entities/user';
import { Organization } from "../entities/organization";
import { Role } from "../entities/role";
import { Class } from "../entities/class";
import { Context } from "../main";

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
            console.log("🐘 Connected to postgres")
            return model
        } catch(e) {
            console.log("❌ Failed to connect or initialize postgres")
            throw e
        }
    }
    
    private connection: Connection
    private manager: EntityManager
    private userRepository: Repository<User>
    private organizationRepository: Repository<Organization>
    private roleRepository: Repository<Role>
    private classRepository: Repository<Class>

    constructor(connection: Connection) {
        this.connection = connection
        this.manager = getManager(connection.name)
        this.userRepository = getRepository(User, connection.name)
        this.organizationRepository = getRepository(Organization, connection.name)
        this.roleRepository = getRepository(Role, connection.name)
        this.classRepository = getRepository(Class, connection.name)
    }

    public async getMyUser({token}: Context) {
        try {
            if(!token) {return null}
            let user = (await this.userRepository.findOne({ user_id: token.id })) || new User()
            
            let modified = false
            if(user.user_id !== token.id)     { user.user_id = token.id;     modified = true }
            if(user.user_name !== token.name) { user.user_name = token.name; modified = true }
            if(user.email !== token.email)    { user.email = token.email;    modified = true }
            
            if(modified) { await this.manager.save(user) }
                
            return user
        } catch(e) {
            console.error(e)
        }
    }
    public async newUser({user_name, email, avatar}: User) {
        const newUser = new User()
        newUser.user_name = user_name
        newUser.email = email
        newUser.avatar = avatar

        await this.manager.save(newUser)
        return newUser
    }
    public async setUser({user_id, user_name, email, avatar}: User) {
        const user = await this.userRepository.findOneOrFail(user_id)

        if(user_name !== undefined) {user.user_name = user_name}
        if(email !== undefined) { user.email = email }
        if(avatar !== undefined) { user.avatar = avatar }

        await this.manager.save(user)
        return user
    }
    public async getUser(user_id: string) {
        const user = await this.userRepository.findOneOrFail(user_id)
        return user
    }    
    public async getUsers() {
        return this.userRepository.find()
    }

    public async setOrganization({organization_id, organization_name, address1, address2, phone, shortCode}:Organization) {
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
        const organization = await this.organizationRepository.findOne(organization_id)
        return organization
    }
    public async getOrganizations(organization_ids: string[]) {
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
        try {
            const role = await this.roleRepository.findOneOrFail(role_id)

            if(role_name !== undefined) { role.role_name = role_name } 
            
            return role
        } catch(e) {
            console.error(e)
        }
    }
    public async getRole({role_id}: Role) {
        try {
            const role = await this.roleRepository.findOneOrFail({role_id})
            return role
        } catch(e) {
            console.error(e)
        }
    }
    public async getRoles() {
        try {
            const roles = await this.roleRepository.find()
            return roles
        } catch(e) {
            console.error(e)
        }
    }

    public async getClass({class_id}: Class) {
        try {
            const _class = await this.classRepository.findOneOrFail({class_id})
            return _class
        } catch(e) {
            console.error(e)
        }
    }
    public async getClasses() {
        try {
            const classes = await this.classRepository.find()
            return classes
        } catch(e) {
            console.error(e)
        }
    }
}