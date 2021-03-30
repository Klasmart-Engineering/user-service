import { Organization } from '../../entities/organization';
import { Class } from '../../entities/class'
import { School } from '../../entities/school'
import { Program } from '../../entities/program'
import { generateShortCode } from '../shortcode'

export const getClassFromCsvRow = async ({organization_name, class_name, class_shortcode, school_name, program_name}:any, rowCount: number) => {
    if(!organization_name || !class_name) {
        throw `missing organization_name or class_name at row ${rowCount}`
    }
    const org = await Organization.findOne({organization_name})
    if (!org) {
        throw `Organisation at row ${rowCount} doesn't exist`
    }
    const classExits = await Class.findOne({where:{class_name, organization: org}})
    if (classExits) {
        throw `Duplicate class name ${class_name} at row ${rowCount}`
    }
    if(class_shortcode && await Class.findOne({where:{shortcode: class_shortcode, organization: org}})) {
        throw `Duplicate class classShortCode ${class_name} at row ${rowCount}`
    } 
    const c = new Class();
    c.class_name = class_name
    const gShortCode = generateShortCode(class_name)
    c.shortcode = class_shortcode || gShortCode
    c.organization = Promise.resolve(org)
    
    if (school_name) {
        const school = await School.findOne({ 
            where: { school_name, organization: org}
        })
        if(!school) {
            throw `School at row ${rowCount} doesn't exist for Organisation ${organization_name}`
        }
        c.schools = school_name && Promise.resolve([school])
    }
    if (program_name) {
        const program = await Program.findOne({
            where:{name: program_name, organization:org}
        })
        if (!program) {
            throw `Program at row ${rowCount} not associated for Organisation ${organization_name}`
        }
        c.programs = Promise.resolve([program])

    } else {
        // get program with none specified 
        const noneProgram = await Program.findOne({where:{name: 'None Specified'}})
        c.programs = noneProgram && Promise.resolve([noneProgram])
    }
    return c;
}