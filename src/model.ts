import {
    Client,
    mapping
} from 'cassandra-driver';
import { v4 } from 'uuid';
import { DeferredOrganization, Organization } from './organization';
import { DeferredUser, User, UserFields } from './user';
type Mapper = mapping.Mapper

export class Model {
    public static async create() {
        const client = new Client({
            contactPoints: [process.env.CASSANDRA_ENDPOINT||'localhost'],
            localDataCenter: process.env.CASSANDRA_DATACENTER||'datacenter1',
            keyspace: process.env.CASSANDRA_KEYSPACE||'simple',
            
        });
        const mapper = new mapping.Mapper(
            client,
            {
                models: {
                    'user': {
                        tables: [
                            
                            {name: 'users', isView: false},

                            {name: 'users_by_organization', isView: false},
                        ],
                        mappings: new mapping.DefaultTableMappings(),
                        columns: {
                          'user_id':'id',
                          'user_name':'name'
                        }
                    },
                    'organization': {
                        tables: [
                            {name: 'organizations', isView: false},
                            {name: 'users_by_organization', isView: false},
                            {name: 'organizations_by_user', isView: true},
                        ],
                        mappings: new mapping.DefaultTableMappings(),
                        columns: {
                          'organization_id':'id',
                          'organization_name':'name',
                          'short_code':'shortCode',
                        }
                    },
                    'organization_users': {
                        tables: [
                            {name: 'users_by_organization', isView: false},
                            {name: 'organizations_by_user', isView: true},
                        ],
                        mappings: new mapping.DefaultTableMappings(),
                        columns: {}
                    }
                }
            }
        )
        await client.connect()
        console.log("👁️  Connected to cassandraDB")

        await client.execute(create_users)
        await client.execute(create_organizations)
        await client.execute(create_users_by_organization)
        await client.execute(create_organizations_by_user)

        return new Model(client, mapper)
    }
    private client: Client
    private mapper: Mapper
    constructor(client: Client, mapper: Mapper) {
        this.client = client
        this.mapper = mapper
    }

    public async newUser({name, email, avatar}: UserFields) {
        const newUser = {id: v4(), name, email, avatar}
        await this.mapper.forModel("user").insert(newUser)
        return new DeferredUser(this.mapper, newUser.id, newUser)
    }
    public async setUser({id, name, email, avatar}: User) {
        const user = {id, name, email, avatar}
        await this.mapper.forModel("user").update(user)
        return new DeferredUser(this.mapper, id, user)
    }
    public getUser(id: string) { return new DeferredUser(this.mapper, id) }
    public async getUsers() {
        const users = await this.mapper.forModel("user").findAll() 
        return users.toArray().map((user) => new DeferredUser(this.mapper,user.id, user))
    }

    public async newOrganization({name, address1, address2, phone, shortCode}:Organization) {
        const newOrganization = {id: v4(), name, address1, address2, phone, shortCode}
        await this.mapper.forModel("organization").insert(newOrganization)
        return new DeferredOrganization(this.mapper, newOrganization.id, newOrganization)
    }

    public async setOrganization({id, name, address1, address2, phone, shortCode}:Organization) {
        const organization = {id, name, address1, address2, phone, shortCode}
        await new Promise((resolve) => setTimeout(resolve, 5000))
        await this.mapper.forModel("organization").update(organization)
        return new DeferredOrganization(this.mapper, id, organization)
    }
    public getOrganization(id: string) { return new DeferredOrganization(this.mapper, id) }
    public async getOrganizations() {
        const organizations = await this.mapper.forModel("organization").findAll()
        return organizations.toArray().map((organization) => new DeferredOrganization(this.mapper, organization.id, organization))
    }
}

const create_users =
`CREATE TABLE IF NOT EXISTS users (
    user_id uuid PRIMARY KEY,
    user_name text,
    email text,
    avatar text,
    inivitiation uuid,
)`


const create_organizations =
`CREATE TABLE IF NOT EXISTS organizations (
    organization_id uuid PRIMARY KEY,
    organization_name text,
    address1 text,
    address2 text,
    phone text,
    email text,
    short_code text,
)`

const create_users_by_organization =
`CREATE TABLE IF NOT EXISTS users_by_organization (
    user_id uuid,
    organization_id uuid,
    join_date timestamp,
    PRIMARY KEY(organization_id, user_id),
)
`

const create_organizations_by_user =
`CREATE MATERIALIZED VIEW IF NOT EXISTS organizations_by_user AS
    SELECT 
        user_id,
        organization_id,
        join_date
    FROM users_by_organization
    WHERE
        user_id IS NOT NULL AND
        organization_id IS NOT NULL
PRIMARY KEY (user_id, organization_id)
`