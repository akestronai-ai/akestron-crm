export class AccountNotFoundError extends Error {}

export async function resetAccountPassword(db, email, passwordHash) {
  await db.$transaction(async tx => {
    const [user] = await tx.$queryRaw`SELECT id FROM app_users WHERE email = ${email} FOR UPDATE`;
    if (!user) throw new AccountNotFoundError("No account exists for that email.");
    await tx.appSession.deleteMany({ where: { userId: user.id } });
    await tx.appUser.update({ where: { id: user.id }, data: { passwordHash } });
  });
}
