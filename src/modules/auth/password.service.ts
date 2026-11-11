import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id password hashing (slow + memory-hard + salted).
 * Same parameters as the FastAPI version (pwdlib "recommended":
 * m=64MiB, t=3, p=4), and the same PHC string format, so a password set in
 * either API works in the other.
 */
const OPTIONS = { memoryCost: 65_536, timeCost: 3, parallelism: 4 };

@Injectable()
export class PasswordService {
  private dummyHash?: Promise<string>;

  hash(password: string): Promise<string> {
    return hash(password, OPTIONS);
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false; // malformed hash
    }
  }

  /**
   * Check a login. When the account doesn't exist we STILL verify against a
   * dummy hash, so "unknown user" takes as long as "wrong password" and
   * usernames can't be discovered by timing.
   */
  async check(password: string, passwordHash: string | undefined): Promise<boolean> {
    this.dummyHash ??= this.hash(randomUUID());
    const ok = await this.verify(password, passwordHash ?? (await this.dummyHash));
    return ok && passwordHash !== undefined;
  }
}
