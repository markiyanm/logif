/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apiKeys from "../apiKeys.js";
import type * as audit from "../audit.js";
import type * as billing from "../billing.js";
import type * as cards from "../cards.js";
import type * as crons from "../crons.js";
import type * as customers from "../customers.js";
import type * as email from "../email.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as lib_cardNumber from "../lib/cardNumber.js";
import type * as lib_codeGenerator from "../lib/codeGenerator.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_currency from "../lib/currency.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_middleware from "../lib/middleware.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_validators from "../lib/validators.js";
import type * as merchants from "../merchants.js";
import type * as partners from "../partners.js";
import type * as reports from "../reports.js";
import type * as transactions from "../transactions.js";
import type * as users from "../users.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  apiKeys: typeof apiKeys;
  audit: typeof audit;
  billing: typeof billing;
  cards: typeof cards;
  crons: typeof crons;
  customers: typeof customers;
  email: typeof email;
  files: typeof files;
  http: typeof http;
  "lib/cardNumber": typeof lib_cardNumber;
  "lib/codeGenerator": typeof lib_codeGenerator;
  "lib/constants": typeof lib_constants;
  "lib/crypto": typeof lib_crypto;
  "lib/currency": typeof lib_currency;
  "lib/errors": typeof lib_errors;
  "lib/middleware": typeof lib_middleware;
  "lib/permissions": typeof lib_permissions;
  "lib/validators": typeof lib_validators;
  merchants: typeof merchants;
  partners: typeof partners;
  reports: typeof reports;
  transactions: typeof transactions;
  users: typeof users;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
