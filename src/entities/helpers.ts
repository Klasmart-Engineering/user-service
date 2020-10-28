import { Repository } from 'typeorm'
import { ValidationError } from 'class-validator'
import { AWSS3 } from './s3'
import { DefaultAvatarKeys } from './const'
import { Organization } from './organization'

export namespace OrganizationHelpers {
    export const GetShortCode = async (client: Repository<Organization>, {name}: {name: string}): Promise<string> => {

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        let cleanedName = name.replace(/[^a-zA-Z]/g, "").toUpperCase().substring(0,5)
        if (cleanedName.length<5) {
            for(let i = 4 - cleanedName.length; i >= 0; i--) {
                cleanedName += chars.charAt(Math.floor(Math.random() * chars.length))
            }
        }
        const foundOrg = await client
            .createQueryBuilder("organization")
            .where("organization.shortCode LIKE :name", {name: `${cleanedName}%`})
            .orderBy("organization.shortCode", "DESC")
            .getOne();

        if(!foundOrg) {
            cleanedName = cleanedName+'000'
        } else if (foundOrg && foundOrg.shortCode && foundOrg.shortCode.substr(foundOrg.shortCode.length - 3) === "999") {
            const lastLetter = String.fromCharCode(name.charCodeAt(name.length - 1) + 1)
            if('Z' === lastLetter) {
                cleanedName = cleanedName.substring(0, cleanedName.length - 1) + 'A'
            } else {
                cleanedName = cleanedName.substring(0, cleanedName.length - 1)
                + String.fromCharCode(cleanedName.charCodeAt(cleanedName.length - 1) + 1)
            }
            cleanedName = await GetShortCode(client, {name: cleanedName})
        } else {
            const value = foundOrg.shortCode as string
            const count = Number(value.substr(5)) + 1
            cleanedName = cleanedName + count.toString().padStart(3,'0')  
        }

        return cleanedName
    }

}

export namespace UserHelpers {

    export const GetDefaultAvatars = async () => {

        const s3 = AWSS3.getInstance({ 
            accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
            destinationBucketName: process.env.AWS_DEFAULT_BUCKET as string,
            region: process.env.AWS_DEFAULT_REGION as string,
        })
    
        return DefaultAvatarKeys.map( (key: string) => {
            return {
                "url": s3.getSignedUrl(key),
                "key": key
            }
        })
    }
}

export interface BasicValidationError {
    property: string;
    value: string | null | undefined;
    constraint: string[];
}

export namespace ErrorHelpers {

    export const GetValidationError = (errors: ValidationError[]): BasicValidationError[] => {
        return errors.map(error => {
            const err: BasicValidationError = {
                "property": error.property,
                "value": error.value,
                "constraint": Object.values(error.constraints as object)
            }
            return err
        })
    }
}
