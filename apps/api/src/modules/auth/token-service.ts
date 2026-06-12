import { createHash, randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'

export class TokenService {
  private readonly secret: Uint8Array

  constructor(secret: string) {
    this.secret = new TextEncoder().encode(secret)
  }

  async createAccessToken(userId: string) {
    return new SignJWT({ sub: userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(this.secret)
  }

  async verifyAccessToken(token: string) {
    const result = await jwtVerify(token, this.secret, {
      algorithms: ['HS256'],
    })

    if (!result.payload.sub) throw new Error('Access token has no subject')
    return { userId: result.payload.sub }
  }

  createRefreshToken() {
    return randomBytes(32).toString('base64url')
  }

  hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }

  hashVerificationCode(email: string, code: string) {
    return createHash('sha256').update(`${email}:${code}`).digest('hex')
  }
}
