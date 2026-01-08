export interface JwtPayload {
  /** User id. */
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}
