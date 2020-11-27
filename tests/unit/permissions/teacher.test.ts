import { expect } from "chai";
import { latestPermissions } from "../../utils/latestPermissions";
import { teacherRole } from "../../../src/permissions/teacher";

describe("teacherRole", () => {
  const { permissions } = teacherRole;

  it("contains all the expected permissions", async () => {
    const expectedPermissions = await latestPermissions();

    for(const [ permissionCode , permissionInfo ] of expectedPermissions.entries()) {
      if(permissionInfo.teacher) {
        expect(permissions).to.include(permissionCode)
      } else {
        expect(permissions).not.to.include(permissionCode)
      }

    }

  });
});

