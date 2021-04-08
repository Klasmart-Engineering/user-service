import chaiAsPromised from "chai-as-promised";
import { Connection } from "typeorm";
import { expect, use } from "chai";

import { Model } from "../../../../src/model";
import { createServer } from "../../../../src/utils/createServer";
import { ApolloServerTestClient, createTestClient } from "../../../utils/createTestClient";
import { createTestConnection } from "../../../utils/testConnection";
import { Organization } from "../../../../src/entities/organization";
import { Subcategory } from "../../../../src/entities/subcategory";
import { createOrganization } from "../../../factories/organization.factory";
import { processSubCategoriesFromCSVRow } from "../../../../src/utils/csv/subCategories";
import { SubCategoryRow } from "../../../../src/types/csv/subCategoryRow";

use(chaiAsPromised);

describe("processSubCategoriesFromCSVRow", ()=> {
    let connection: Connection;
    let testClient: ApolloServerTestClient;
    let row: SubCategoryRow;
    let expectedOrg: Organization

    const orgName: string = "my-org";
    before(async () => {
        connection = await createTestConnection();
        const server = createServer(new Model(connection));
        testClient = createTestClient(server);
    });

    beforeEach(async () => {
        expectedOrg = createOrganization()
        expectedOrg.organization_name = orgName
        await connection.manager.save(expectedOrg)
    })

    after(async () => {
        await connection?.close();
    });

    it('should create a class with school and program when present', async()=>{
        row = {organization_name: orgName, subcategory_name: 'sc1'}
        await processSubCategoriesFromCSVRow(connection.manager, row, 1)

        await Subcategory.findOneOrFail({where:{name:"sc1", organization:expectedOrg}});
    })
    
    it('should throw an error (missing org/sub category) and rollback when all transactions', async()=>{
        row = {organization_name: '' , subcategory_name: 'sc1'}
        const fn = () => processSubCategoriesFromCSVRow(connection.manager, row, 1);

        expect(fn()).to.be.rejected
        const dbSubCategories = await Subcategory.find()
        expect(dbSubCategories.length).to.equal(0)
    })

    it('should throw an error missing sub category and rollback when all transactions', async()=>{
        row = {organization_name: 'test' , subcategory_name: ''}
        const fn = () => processSubCategoriesFromCSVRow(connection.manager, row, 1);

        expect(fn()).to.be.rejected
        const dbSubCategories = await Subcategory.find()
        expect(dbSubCategories.length).to.equal(0)
    })
})