# Puertos de autenticación
Application recibe estos contratos por inyección, sin importar adaptadores:
- repository: findByEmail(email), createSession({id,userId,expiresAt}), findSession(sid,userId), revokeSession(sid,userId), createCustomer({email,passwordHash}).
- hasher: hash(password), verify(hash,password), dummyHash (hash ficticio real para cuentas inexistentes).
- tokens: issue(user,sid), verify(token); issue devuelve {token,expiresAt}.
- limiter: begin(email,ip) devuelve finish(outcome), con outcome success/failure/error; el tiempo puede inyectarse.
- newId: genera ID; clock: fecha actual. Dominio no conoce HTTP, PostgreSQL ni bibliotecas de infraestructura.
