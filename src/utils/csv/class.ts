import { EntityManager, Not } from 'typeorm'
import { Organization } from '../../entities/organization';
import { Class } from '../../entities/class'
import { School } from '../../entities/school'
import { Program } from '../../entities/program'
import { generateShortCode } from '../shortcode'

export const processClassFromCSVRow = async (manager: EntityManager, {organization_name, class_name, class_shortcode, school_name, program_name}:any, rowCount: number) => {
    if(!organization_name || !class_name) {
        throw `missing organization_name or class_name at row ${rowCount}`
    }
    const org = await Organization.findOne({organization_name})
    if (!org) {
        throw `Organisation at row ${rowCount} doesn't exist`
    }
    // 
    if(class_shortcode && await Class.findOne({where:{shortcode: class_shortcode, organization: org, class_name: Not(class_name)}})) {
        throw `Duplicate class classShortCode ${class_name} at row ${rowCount}`
    } 

    // check if class exists in manager
    let classInManager = await manager.findOne(Class,{where:{class_name, organization: org}})
    let classInDB = await Class.findOne({where:{class_name, organization: org}})
    let c
    if (classInManager) {
        c = classInManager
    } else if(classInDB) {
        c = classInDB
    } else {
        c = new Class()
        c.class_name = class_name
        c.shortcode = class_shortcode || generateShortCode(class_name)
        c.organization = Promise.resolve(org)
    }
    
    let existingSchools = await c.schools || []
    if (school_name) {
        const school = await School.findOne({ 
            where: { school_name, organization: org}
        })
        if(!school) {
            throw `School at row ${rowCount} doesn't exist for Organisation ${organization_name}`
        }
        existingSchools.push(school)
    }
    c.schools = Promise.resolve(existingSchools)
    
    let existingPrograms = await c.programs || []
    let programToAdd
    if (program_name) {
        programToAdd = await Program.findOne({
            where:{name: program_name, organization:org}
        })
        if (!programToAdd) {
            throw `Program at row ${rowCount} not associated for Organisation ${organization_name}`
        }
        existingPrograms.push(programToAdd)
    } else {
        // get program with none specified 
        programToAdd = await Program.findOne({where:{name: 'None Specified'}}) 
        if (programToAdd) {
            existingPrograms.push(programToAdd)
        }
    }
    c.programs = Promise.resolve(existingPrograms)
    await manager.save(c)
}