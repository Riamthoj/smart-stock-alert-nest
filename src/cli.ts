import 'reflect-metadata';
import { createInterface } from 'node:readline/promises';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppConfigModule } from './config/app-config.js';
import { DatabaseModule } from './database/database.module.js';
import { UsersRepository } from './database/repositories/accounts.repository.js';
import { InfrastructureModule } from './infrastructure/infrastructure.module.js';
import { PasswordService } from './modules/auth/password.service.js';
import { RevocationService } from './modules/auth/revocation.service.js';

/**
 * Terminal tools. Every API route needs a token, so on an EMPTY database the
 * first admin is created here:
 *
 *   npm run build && npm run cli -- create-user <username>
 *   npm run cli -- reset-password <username>
 *
 * The password is asked interactively (not stored in shell history), or read
 * from the CLI_PASSWORD environment variable for automation.
 */
@Module({
  imports: [AppConfigModule, DatabaseModule, InfrastructureModule],
  providers: [PasswordService, RevocationService],
})
class CliModule {}

async function askPassword(): Promise<string> {
  const fromEnv = process.env.CLI_PASSWORD;
  if (fromEnv) return fromEnv;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const password = await rl.question('Password (min 8 chars): ');
    if (password.length < 8) throw new Error('Password must be at least 8 characters');
    if (password !== (await rl.question('Repeat password: '))) throw new Error('Passwords do not match');
    return password;
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const [command, username] = process.argv.slice(2);
  if (!['create-user', 'reset-password'].includes(command) || !username) {
    console.log('Usage: npm run cli -- create-user <username> | reset-password <username>');
    process.exitCode = 2;
    return;
  }

  const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'warn'] });
  try {
    const users = app.get(UsersRepository);
    const passwords = app.get(PasswordService);
    const existing = await users.getByUsername(username);

    if (command === 'create-user') {
      if (existing) throw new Error(`User '${username}' already exists`);
      const user = await users.insert({ username, password_hash: await passwords.hash(await askPassword()) });
      console.log(`Created user '${user.username}' (id ${user.id}). Log in at POST /api/v1/auth/users/login`);
    } else {
      if (!existing) throw new Error(`User '${username}' not found`);
      await users.update(existing.id, { password_hash: await passwords.hash(await askPassword()) });
      await app.get(RevocationService).revokeAll('user', existing.id, { required: false }); // log out all devices
      console.log(`Password updated for '${username}' (existing logins revoked)`);
    }
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
