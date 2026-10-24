const { getAuth, clerkClient } = require("@clerk/express");
const { getOrCreateUser } = require("./user");

async function getAuthenticatedUser(req) {
  const { isAuthenticated, userId } = getAuth(req);

  if (!isAuthenticated) {
    return null;
  }

  const clerkUser = await clerkClient.users.getUser(userId);

  const primaryEmail = clerkUser.emailAddresses.find(
    (email) => email.id === clerkUser.primaryEmailAddressId
  );

  return await getOrCreateUser({
    id: clerkUser.id,
    name:
      [clerkUser.firstName, clerkUser.lastName]
        .filter(Boolean)
        .join(" ") || null,
    email: primaryEmail?.emailAddress || null,
  });
}

module.exports = {
  getAuthenticatedUser,
};