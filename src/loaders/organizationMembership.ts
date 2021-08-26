import DataLoader from 'dataloader'
import { User } from '../entities/user'

export interface IOrganizationMembershipLoaders {
    user: DataLoader<string, User | undefined>
}
