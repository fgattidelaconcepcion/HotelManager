import bcrypt from "bcrypt";

/**
 * Here I define how many salt rounds I use for hashing passwords.
 * A higher value increases security but also increases CPU cost.
 */
const SALT_ROUNDS = 10;

/**
 * Here I hash a plain text password before storing it in the database.
 * I never save raw passwords for security reasons.
 */
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Here I compare a plain text password with its hashed version.
 * This is used during login to verify user credentials.
 */
export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};
