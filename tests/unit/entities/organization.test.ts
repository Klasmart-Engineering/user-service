import { expect } from "chai";
import { validateEmail, validatePhone} from "../../../src/entities/organization"

describe("validateEmail", () => {
    it("is a valid email", async () => {
        [
            "email@example.com",
            "firstname.lastname@example.com",
            "email@subdomain.example.com",
            "firstname+lastname@example.com",
            "email@123.123.123.123",
            "email@[123.123.123.123]",
            "\"email\"@example.com",
            "1234567890@example.com",
            "email@example-one.com",
            "_______@example.com",
            "email@example.name",
            "email@example.museum",
            "email@example.co.jp",
            "firstname-lastname@example.com",
            "much.\”more\ unusual\”@example.com",
            "very.unusual.\”@\”.unusual.com@example.com",
            "very.\”(),:;<>[]\”.VERY.\”very@\\ \"very\”.unusual@strange.example.com"

        ].forEach(function(address){
            expect(validateEmail(address))
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
            "あいうえお@example.com",
            "email@example.com (Joe Smith)",
            "email@example",
            "email@-example.com",
            "email@example.web",
            "email@111.222.333.44444",
            "email@example..com",
            "Abc..123@example.com]",
            "\”(),:;<>[\\]@example.com",
            "just\”not\”right@example.com",
            "this\ is\"really\"not\allowed@example.com"
        ].forEach(function(address){
            expect(!validateEmail(address))
        })
    });
  });

  describe("validatePhone", () => {
    it("is a valid phone", async () => {
        [
            "+442077325637",
        ].forEach(function(phone){
            expect(validatePhone(phone))
        })

    });
  
    it("is an invalid phone", async () => {
        [
            "02077325632",
            "+44(0)20-7732 5637" 
        ].forEach(function(phone){
            expect(!validateEmail(phone))
        })
    });
  });
  
  