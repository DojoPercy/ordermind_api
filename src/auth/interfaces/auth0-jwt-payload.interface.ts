export interface Auth0JwtPayload {
  sub: string; // auth0 user ID
  email?: string;
  name?: string;
  org_id?: string;
  [key: string]: unknown; // For custom claims
}
