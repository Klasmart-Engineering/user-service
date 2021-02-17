import { Class } from '../entities/class'
import { Organization } from '../entities/organization'
import { Role } from '../entities/role'
import { User } from '../entities/user'
import { Paginated } from './paginated.interface'

export class UserConnection extends Paginated<User, string> {}
export class OrganizationConnection extends Paginated<Organization, string> {}
export class RoleConnection extends Paginated<Role, string> {}
export class ClassConnection extends Paginated<Class, string> {}
