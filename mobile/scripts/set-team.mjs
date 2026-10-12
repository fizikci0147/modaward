#!/usr/bin/env node
/**
 * Sets the Apple developer team that signs the iOS app, without needing Xcode's Signing screen:
 *
 *   npm run team -- ABCDE12345
 *
 * The Team ID is the 10-character code under "Membership details" at https://developer.apple.com/account
 * (also shown by Xcode next to the team name in Xcode > Settings > Accounts, under "Manage Certificates").
 * It is saved in ios/App/App.xcodeproj/project.pbxproj for both Debug and Release.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const id = (process.argv[2] || '').trim().toUpperCase();
if (!/^[A-Z0-9]{10}$/.test(id)) {
  console.error('Give your 10-character Apple Team ID, for example:  npm run team -- ABCDE12345');
  process.exit(1);
}
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
let text = fs.readFileSync(file, 'utf8');
// replace a team that is already there, otherwise add one next to the signing style of each build configuration
text = text.replace(/DEVELOPMENT_TEAM = [^;]*;/g, `DEVELOPMENT_TEAM = ${id};`);
if (!text.includes('DEVELOPMENT_TEAM =')) {
  text = text.replace(/(\t+)CODE_SIGN_STYLE = Automatic;/g, (_, tabs) => `${tabs}CODE_SIGN_STYLE = Automatic;\n${tabs}DEVELOPMENT_TEAM = ${id};`);
}
const count = (text.match(new RegExp(`DEVELOPMENT_TEAM = ${id};`, 'g')) || []).length;
if (!count) {
  console.error('Could not find where to put the team in the project file. Set it in Xcode instead (Signing & Capabilities).');
  process.exit(1);
}
fs.writeFileSync(file, text);
console.log(`Team ${id} set for the iOS app (${count} build settings). Reopen the project in Xcode.`);
