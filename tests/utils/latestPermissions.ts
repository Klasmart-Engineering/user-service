import axios from 'axios';
import csvParser from 'csv-parser'
import fs from 'fs'
import path from 'path'

const PERMISSIONS_CSV_URL = "https://docs.google.com/spreadsheets/d/1C1g-Q3UUsBBnDTXIFq75FSNdRN9Mr1qbJzyTYlpTePU/export?format=csv"
const PERMISSION_FILE = path.join(__dirname, "../fixtures/permissions.csv");

interface PermissionInfo {
  name: String,
  superAdmin: boolean,
  orgAdmin: boolean,
  teacher: boolean,
  schoolAdmin: boolean,
  parent: boolean,
  student: boolean
};

export const latestPermissions = async (forceDownload : boolean = false) => {
  let permissions : Map<string, PermissionInfo> = new Map();

  if(forceDownload) {
    const { data } = await axios.get(
      PERMISSIONS_CSV_URL,
      { responseType: 'stream' }
    );

    await data.pipe(fs.createWriteStream(PERMISSION_FILE));
  }

  const readStream = await fs.createReadStream(PERMISSION_FILE);
  const csvPermissions = await new Promise( resolve =>
    readStream
    .pipe(csvParser())
    .on("data", (row : any) => {
      const key : string = row["Code"];

      permissions.set(key, {
        name: row["Permission"],
        superAdmin: row["Super Admin"] == "x",
        orgAdmin: row["Organization Admin (Seed Admin)"] == "x",
        teacher: row["Teacher"] == "x",
        schoolAdmin: row["School Admin"] == "x",
        parent: row["Parent"] == "x",
        student: row["Student"] == "x"
      });

      return row;
    })
    .on("end", resolve)
  );

  return permissions
};
