import faker from "faker";
import { Category } from "../../src/entities/category";
import { createOrganization } from "./organization.factory";
import { Organization } from "../../src/entities/organization";
import { Subcategory } from "../../src/entities/subcategory";
import { Subject } from "../../src/entities/subject";

export function createSubject(org: Organization = createOrganization(), categories: Category[] = [] ,subcategories: Subcategory[] = []) {
    const subject = new Subject();

    subject.name = faker.random.word();
    subject.organization = Promise.resolve(org)
    subject.categories = Promise.resolve(categories)
    subject.subcategories = Promise.resolve(subcategories)
    subject.system = false

    return subject;
}

