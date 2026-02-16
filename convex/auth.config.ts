import { AuthConfig } from "convex/server";

export default {
	providers: [
		{
			type: "customJwt",
			issuer: "https://api.workos.com/",
			algorithm: "RS256",
			applicationID: process.env.WORKOS_CLIENT_ID!,
			jwks: `https://api.workos.com/sso/jwks/${process.env.WORKOS_CLIENT_ID}`,
		},
		{
			type: "customJwt",
			issuer: `https://api.workos.com/user_management/${process.env.WORKOS_CLIENT_ID}`,
			algorithm: "RS256",
			jwks: `https://api.workos.com/sso/jwks/${process.env.WORKOS_CLIENT_ID}`,
		},
	],
} satisfies AuthConfig;
