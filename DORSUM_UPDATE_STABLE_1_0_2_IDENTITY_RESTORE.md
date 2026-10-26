# Dorsum stable 1.0.2

- Creating a client/specialist with the phone of an archived account now safely reactivates that same account/profile instead of creating a duplicate.
- Existing profile IDs and all historical appointments/finance remain linked.
- Reactivation updates password and entered profile data.
- ADMIN can edit full name and phone for active clients and specialists.
- Phone uniqueness is checked server-side.
- User.phone and ClientProfile.phone are updated atomically for clients.
- No Prisma migration required.
