import type { ComponentType } from "svelte";

export interface NavItem {
	title: string;
	href: string;
	icon: ComponentType;
	badge?: string;
}

export interface NavGroup {
	label: string;
	items: NavItem[];
}
