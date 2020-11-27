import { expect } from "chai";
import { latestPermissions } from "../../utils/latestPermissions";
import { PermissionName } from "../../../src/permissions/permissionNames";

describe("PermissionName", () => {
  it("contains all the expected permissions", async () => {
    const expectedPermissions = await latestPermissions();
    for(const [ permissionCode , permissionInfo ] of expectedPermissions.entries()) {
      const key = permissionCode as keyof typeof PermissionName;

      if(!permissionCode) { continue }

      expect(PermissionName[key]).to.eq(permissionCode)
    }

  });
});
