import type { ApiPermission } from "./constants.js";

export function hasPermission(
	grantedPermissions: string[],
	requiredPermission: ApiPermission,
): boolean {
	return grantedPermissions.includes(requiredPermission);
}

export function hasAnyPermission(
	grantedPermissions: string[],
	requiredPermissions: ApiPermission[],
): boolean {
	return requiredPermissions.some((p) => grantedPermissions.includes(p));
}

export function hasAllPermissions(
	grantedPermissions: string[],
	requiredPermissions: ApiPermission[],
): boolean {
	return requiredPermissions.every((p) => grantedPermissions.includes(p));
}
