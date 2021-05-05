import Dataloader from "dataloader";
import { User } from "./entities/user";

export const orgsForUsers = async(keys: string[]) => {
    const users = await User.createQueryBuilder('user')
        .leftJoinAndSelect('user.memberships', 'memberships')
        .where("user.user_id IN (:...ids)", {ids: keys})
        .getMany();
    
    return users.map((user) => user.memberships);
};

export const orgsForUserLoader = new Dataloader(orgsForUsers as any);

export const schoolsForUsers = async(keys: string[]) => {
    const users = await User.createQueryBuilder('user')
        .leftJoinAndSelect('user.school_memberships', 'memberships')
        .where("user.user_id IN (:...ids)", {ids: keys})
        .getMany();
    
    return users.map((user) => user.school_memberships);
};

export const schoolsForUserLoader = new Dataloader(schoolsForUsers as any);
