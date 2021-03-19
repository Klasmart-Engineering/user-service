import { expect } from "chai";
import { validateEmail, validatePhone} from "../../../src/entities/organization"
import { MEMBERSHIP_SHORTCODE_MAXLEN } from "../../../src/entities/organizationMembership";

describe("validateEmail", () => {
    it("is a valid email", async () => {
        [
            "email@example.com",
            "firstname.lastname@example.com",
            "email@subdomain.example.com",
            "firstname+lastname@example.com",
            "\"email\"@example.com",
            "1234567890@example.com",
            "あいうえお@example.com",
            "email@example-one.com",
            "_______@example.com",
            "email@example.name",
            "email@example.museum",
            "email@example.co.jp",
            "firstname-lastname@example.com",
        ].every(function(address){
            const res = validateEmail(address)
            expect(res).to.equal(true)
            return res
        })
    });

    it("is an invalid email", async () => {
        [
            "#@%^%#$@#$@#.com",
            "@example.com",
            "Joe Smith <email@example.com>",
            "email.example.com",
            "email@example@example.com",
            ".email@example.com",
            "email.@example.com",
            "email..email@example.com",            
            "email@example.com (Joe Smith)",
            "email@example",
            "email@111.222.333.44444",
            "email@example..com",
            "Abc..123@example.com]",
            "\”(),:;<>[\\]@example.com",
        ].forEach(function(address){
            const res = !validateEmail(address)
            expect(res).to.equal(true)
            return res
            
        })
    });
  });

  describe("validatePhone", () => {
    it("is a valid phone", async () => {
        [
            "+61291920995",   //Australia Test line
            "+6498876986",    //NZ Test line
            "+442071838750",
            "+14155552671",
            "+442077325637",
            "+442087599036",  //BT line test
            "+18004444444",   //MCI. Caller ID readback
            "+12027621401",   //Speaking Clock
            "+12136210002",   //Milliwatt test tone
            "+19142329901"    //Pleasantville DMS 100
        ].every(function(phone){
            const res = validatePhone(phone)
            expect(res).to.equal(true)
            return res
        })

    });

    it("is an invalid phone", async () => {
        [
            "02077325632",
            "+44(0)20-7732 5637"
        ].every(function(phone){
            const res = !validatePhone(phone)
            expect(res).to.equal(true)
            return res
        })
    });
  });

