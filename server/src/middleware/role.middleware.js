export function roleMiddleware(roles = []) {
  return async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({
        message: "Войдите в аккаунт."
      })
    }

    if (!roles.includes(req.user.role)) {
      return reply.status(403).send({
        message: "Недостаточно прав."
      })
    }
  }
}