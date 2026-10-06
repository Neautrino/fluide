/* Generated from the apps/web check fixtures (/tmp/webcheck/fixtures, the landing's sample world, today =
   29 Sep 2026). Wire shapes, exactly as the API returns them after apps/web's query unwrapping. Values are
   unchanged; only the transaction list is trimmed to the newest 50 rows (the Transactions view's first
   page), with the full count and the Latest card's summary computed over all 538 rows. */
import type { AccountBalance, Category, CashFlow, ConnectionSummary, ChatThreadSummary, GateSettings, LedgerRow, PostingAccount, ReviewItem, TransferGroup } from '@repo/ui/types'

export const accountBalances: AccountBalance[] = [
 {
  "id": "ac000000-0000-4000-8000-000000000001",
  "name": "Everyday Checking",
  "currency": "USD",
  "kind": "cash",
  "balance": 8412.37,
  "bankBalance": 8412.37,
  "bankBalanceAt": "2026-09-29T12:02:41.000Z",
  "bankBalanceIsFallback": false,
  "ledgerBalance": 8412.37,
  "pendingBalance": -152.21,
  "bankCountsPending": true,
  "mismatch": false,
  "mask": "4821",
  "subtype": "checking",
  "officialName": "Ally Interest Checking",
  "excludeFromNetWorth": false,
  "institutionName": "Ally",
  "connectionStatus": "active",
  "lastSyncedAt": "2026-09-29T12:02:41.000Z",
  "availableBalance": 8260.16,
  "creditLimit": null,
  "countsTowardTotals": true,
  "replacedByConnectorId": null,
  "countedUntil": null
 },
 {
  "id": "ac000000-0000-4000-8000-000000000002",
  "name": "High-Yield Savings",
  "currency": "USD",
  "kind": "cash",
  "balance": 24150,
  "bankBalance": 24150,
  "bankBalanceAt": "2026-09-29T12:02:41.000Z",
  "bankBalanceIsFallback": false,
  "ledgerBalance": 24150,
  "pendingBalance": 0,
  "bankCountsPending": true,
  "mismatch": false,
  "mask": "0917",
  "subtype": "savings",
  "officialName": "Ally Online Savings",
  "excludeFromNetWorth": false,
  "institutionName": "Ally",
  "connectionStatus": "active",
  "lastSyncedAt": "2026-09-29T12:02:41.000Z",
  "availableBalance": 24150,
  "creditLimit": null,
  "countsTowardTotals": true,
  "replacedByConnectorId": null,
  "countedUntil": null
 },
 {
  "id": "ac000000-0000-4000-8000-000000000003",
  "name": "Sapphire Card",
  "currency": "USD",
  "kind": "credit",
  "balance": -1284.55,
  "bankBalance": -1284.55,
  "bankBalanceAt": "2026-09-20T09:10:12.000Z",
  "bankBalanceIsFallback": false,
  "ledgerBalance": -1284.55,
  "pendingBalance": -18.2,
  "bankCountsPending": true,
  "mismatch": false,
  "mask": "3390",
  "subtype": "credit card",
  "officialName": "Chase Sapphire Preferred",
  "excludeFromNetWorth": false,
  "institutionName": "Chase",
  "connectionStatus": "reauth_required",
  "lastSyncedAt": "2026-09-20T09:10:12.000Z",
  "availableBalance": 10715.45,
  "creditLimit": 12000,
  "countsTowardTotals": true,
  "replacedByConnectorId": null,
  "countedUntil": null
 }
]

export const connections: ConnectionSummary[] = [
 {
  "id": "c0000000-0000-4000-8000-000000000001",
  "provider": "plaid",
  "institutionName": "Ally",
  "status": "active",
  "statusReason": null,
  "statusChangedAt": "2026-03-12T15:20:44.000Z",
  "lastSyncedAt": "2026-09-29T12:02:41.000Z",
  "validUntil": null,
  "createdAt": "2026-03-12T15:20:44.000Z",
  "replacedByConnectorId": null,
  "countedUntil": null,
  "accounts": [
   {
    "name": "Everyday Checking",
    "mask": "4821",
    "kind": "cash"
   },
   {
    "name": "High-Yield Savings",
    "mask": "0917",
    "kind": "cash"
   }
  ]
 },
 {
  "id": "c0000000-0000-4000-8000-000000000002",
  "provider": "plaid",
  "institutionName": "Chase",
  "status": "reauth_required",
  "statusReason": "ITEM_LOGIN_REQUIRED: the login details of this item have changed",
  "statusChangedAt": "2026-09-20T09:14:03.000Z",
  "lastSyncedAt": "2026-09-20T09:10:12.000Z",
  "validUntil": null,
  "createdAt": "2026-03-12T15:31:09.000Z",
  "replacedByConnectorId": null,
  "countedUntil": null,
  "accounts": [
   {
    "name": "Sapphire Card",
    "mask": "3390",
    "kind": "credit"
   }
  ]
 }
]

export const categories: Category[] = [
 {
  "id": "ca000000-0000-4000-8000-000000000001",
  "tenantId": null,
  "primary": "INCOME",
  "detailed": "INCOME_WAGES",
  "label": "Salary & Wages",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000002",
  "tenantId": null,
  "primary": "INCOME",
  "detailed": "INCOME_INTEREST_EARNED",
  "label": "Interest Earned",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000003",
  "tenantId": null,
  "primary": "INCOME",
  "detailed": "INCOME_TAX_REFUND",
  "label": "Tax Refund",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000004",
  "tenantId": null,
  "primary": "INCOME",
  "detailed": "INCOME_OTHER_INCOME",
  "label": "Other Income",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000005",
  "tenantId": null,
  "primary": "TRANSFER_IN",
  "detailed": "TRANSFER_IN_DEPOSIT",
  "label": "Deposit",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000006",
  "tenantId": null,
  "primary": "TRANSFER_IN",
  "detailed": "TRANSFER_IN_ACCOUNT_TRANSFER",
  "label": "Transfer In (Account)",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000007",
  "tenantId": null,
  "primary": "TRANSFER_IN",
  "detailed": "TRANSFER_IN_CASH_ADVANCES_AND_LOANS",
  "label": "Loan/Advance Received",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000008",
  "tenantId": null,
  "primary": "TRANSFER_OUT",
  "detailed": "TRANSFER_OUT_WITHDRAWAL",
  "label": "Withdrawal",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000009",
  "tenantId": null,
  "primary": "TRANSFER_OUT",
  "detailed": "TRANSFER_OUT_ACCOUNT_TRANSFER",
  "label": "Transfer Out (Account)",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-00000000000a",
  "tenantId": null,
  "primary": "TRANSFER_OUT",
  "detailed": "TRANSFER_OUT_SAVINGS",
  "label": "Transfer to Savings",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-00000000000b",
  "tenantId": null,
  "primary": "LOAN_PAYMENTS",
  "detailed": "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT",
  "label": "Credit Card Payment",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-00000000000c",
  "tenantId": null,
  "primary": "LOAN_PAYMENTS",
  "detailed": "LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT",
  "label": "Personal Loan Payment",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-00000000000d",
  "tenantId": null,
  "primary": "LOAN_PAYMENTS",
  "detailed": "LOAN_PAYMENTS_OTHER_PAYMENT",
  "label": "Other Loan Payment",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-00000000000e",
  "tenantId": null,
  "primary": "BANK_FEES",
  "detailed": "BANK_FEES_ATM_FEES",
  "label": "ATM Fees",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-00000000000f",
  "tenantId": null,
  "primary": "BANK_FEES",
  "detailed": "BANK_FEES_OTHER_BANK_FEES",
  "label": "Other Bank Fees",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000010",
  "tenantId": null,
  "primary": "ENTERTAINMENT",
  "detailed": "ENTERTAINMENT_TV_AND_MOVIES",
  "label": "TV & Movies",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000011",
  "tenantId": null,
  "primary": "ENTERTAINMENT",
  "detailed": "ENTERTAINMENT_VIDEO_GAMES",
  "label": "Video Games",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000012",
  "tenantId": null,
  "primary": "ENTERTAINMENT",
  "detailed": "ENTERTAINMENT_OTHER_ENTERTAINMENT",
  "label": "Other Entertainment",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000013",
  "tenantId": null,
  "primary": "FOOD_AND_DRINK",
  "detailed": "FOOD_AND_DRINK_GROCERIES",
  "label": "Groceries",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000014",
  "tenantId": null,
  "primary": "FOOD_AND_DRINK",
  "detailed": "FOOD_AND_DRINK_RESTAURANT",
  "label": "Restaurant",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000015",
  "tenantId": null,
  "primary": "FOOD_AND_DRINK",
  "detailed": "FOOD_AND_DRINK_FAST_FOOD",
  "label": "Fast Food",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000016",
  "tenantId": null,
  "primary": "FOOD_AND_DRINK",
  "detailed": "FOOD_AND_DRINK_COFFEE",
  "label": "Coffee",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000017",
  "tenantId": null,
  "primary": "GENERAL_MERCHANDISE",
  "detailed": "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES",
  "label": "Online Marketplaces",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000018",
  "tenantId": null,
  "primary": "GENERAL_MERCHANDISE",
  "detailed": "GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES",
  "label": "Clothing & Accessories",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000019",
  "tenantId": null,
  "primary": "GENERAL_MERCHANDISE",
  "detailed": "GENERAL_MERCHANDISE_ELECTRONICS",
  "label": "Electronics",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-00000000001a",
  "tenantId": null,
  "primary": "GENERAL_MERCHANDISE",
  "detailed": "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE",
  "label": "Other Merchandise",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-00000000001b",
  "tenantId": null,
  "primary": "HOME_IMPROVEMENT",
  "detailed": "HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT",
  "label": "Home Improvement",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-00000000001c",
  "tenantId": null,
  "primary": "MEDICAL",
  "detailed": "MEDICAL_PHARMACIES_AND_SUPPLEMENTS",
  "label": "Pharmacy & Supplements",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-00000000001d",
  "tenantId": null,
  "primary": "MEDICAL",
  "detailed": "MEDICAL_PRIMARY_CARE",
  "label": "Primary Care",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-00000000001e",
  "tenantId": null,
  "primary": "MEDICAL",
  "detailed": "MEDICAL_OTHER_MEDICAL",
  "label": "Other Medical",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-00000000001f",
  "tenantId": null,
  "primary": "PERSONAL_CARE",
  "detailed": "PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS",
  "label": "Gym & Fitness",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000020",
  "tenantId": null,
  "primary": "PERSONAL_CARE",
  "detailed": "PERSONAL_CARE_HAIR_AND_BEAUTY",
  "label": "Hair & Beauty",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000021",
  "tenantId": null,
  "primary": "PERSONAL_CARE",
  "detailed": "PERSONAL_CARE_OTHER_PERSONAL_CARE",
  "label": "Other Personal Care",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000022",
  "tenantId": null,
  "primary": "GENERAL_SERVICES",
  "detailed": "GENERAL_SERVICES_EDUCATION",
  "label": "Education",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000023",
  "tenantId": null,
  "primary": "GENERAL_SERVICES",
  "detailed": "GENERAL_SERVICES_INSURANCE",
  "label": "Insurance",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000024",
  "tenantId": null,
  "primary": "GENERAL_SERVICES",
  "detailed": "GENERAL_SERVICES_OTHER_GENERAL_SERVICES",
  "label": "Other Services",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000025",
  "tenantId": null,
  "primary": "GOVERNMENT_AND_NON_PROFIT",
  "detailed": "GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT",
  "label": "Tax Payment",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000026",
  "tenantId": null,
  "primary": "GOVERNMENT_AND_NON_PROFIT",
  "detailed": "GOVERNMENT_AND_NON_PROFIT_DONATIONS",
  "label": "Donations",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000027",
  "tenantId": null,
  "primary": "TRANSPORTATION",
  "detailed": "TRANSPORTATION_GAS",
  "label": "Fuel",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000028",
  "tenantId": null,
  "primary": "TRANSPORTATION",
  "detailed": "TRANSPORTATION_TAXIS_AND_RIDE_SHARES",
  "label": "Taxis & Ride Shares",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000029",
  "tenantId": null,
  "primary": "TRANSPORTATION",
  "detailed": "TRANSPORTATION_PUBLIC_TRANSIT",
  "label": "Public Transit",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-00000000002a",
  "tenantId": null,
  "primary": "TRANSPORTATION",
  "detailed": "TRANSPORTATION_OTHER_TRANSPORTATION",
  "label": "Other Transportation",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-00000000002b",
  "tenantId": null,
  "primary": "TRAVEL",
  "detailed": "TRAVEL_FLIGHTS",
  "label": "Flights",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-00000000002c",
  "tenantId": null,
  "primary": "TRAVEL",
  "detailed": "TRAVEL_LODGING",
  "label": "Lodging",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-00000000002d",
  "tenantId": null,
  "primary": "TRAVEL",
  "detailed": "TRAVEL_OTHER_TRAVEL",
  "label": "Other Travel",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-00000000002e",
  "tenantId": null,
  "primary": "RENT_AND_UTILITIES",
  "detailed": "RENT_AND_UTILITIES_RENT",
  "label": "Rent",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-00000000002f",
  "tenantId": null,
  "primary": "RENT_AND_UTILITIES",
  "detailed": "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY",
  "label": "Electricity & Gas",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000030",
  "tenantId": null,
  "primary": "RENT_AND_UTILITIES",
  "detailed": "RENT_AND_UTILITIES_INTERNET_AND_CABLE",
  "label": "Internet & Cable",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000031",
  "tenantId": null,
  "primary": "RENT_AND_UTILITIES",
  "detailed": "RENT_AND_UTILITIES_TELEPHONE",
  "label": "Phone Bill",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000032",
  "tenantId": null,
  "primary": "RENT_AND_UTILITIES",
  "detailed": "RENT_AND_UTILITIES_WATER",
  "label": "Water Bill",
  "isSystem": true,
  "createdAt": "2026-03-12T15:02:11.482Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000033",
  "tenantId": "00000000-0000-4000-8000-000000000001",
  "primary": "GENERAL_MERCHANDISE",
  "detailed": "CUSTOM_SHOPPING",
  "label": "Shopping",
  "isSystem": false,
  "createdAt": "2026-03-12T16:40:05.117Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000034",
  "tenantId": "00000000-0000-4000-8000-000000000001",
  "primary": "FOOD_AND_DRINK",
  "detailed": "CUSTOM_DINING",
  "label": "Dining",
  "isSystem": false,
  "createdAt": "2026-03-12T16:40:05.117Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000035",
  "tenantId": "00000000-0000-4000-8000-000000000001",
  "primary": "RENT_AND_UTILITIES",
  "detailed": "CUSTOM_UTILITIES",
  "label": "Utilities",
  "isSystem": false,
  "createdAt": "2026-03-12T16:40:05.117Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000036",
  "tenantId": "00000000-0000-4000-8000-000000000001",
  "primary": "TRANSPORTATION",
  "detailed": "CUSTOM_TRANSPORT",
  "label": "Transport",
  "isSystem": false,
  "createdAt": "2026-03-12T16:40:05.117Z"
 },
 {
  "id": "ca000000-0000-4000-8000-000000000037",
  "tenantId": "00000000-0000-4000-8000-000000000001",
  "primary": "ENTERTAINMENT",
  "detailed": "CUSTOM_SUBSCRIPTIONS",
  "label": "Subscriptions",
  "isSystem": false,
  "createdAt": "2026-03-12T16:40:05.117Z"
 }
]

/** The newest 50 ledger rows, newest first. */
export const transactions: LedgerRow[] = [
 {
  "id": "7a000000-0000-4000-8000-00000000021a",
  "date": "2026-09-29T00:00:00.000Z",
  "description": "SPOTIFY USA",
  "status": "pending",
  "posting": {
   "id": "7b000000-0000-4000-8000-00000000021a",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-11.99000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000037",
   "counterpartyRaw": "Spotify"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Subscriptions",
   "detailed": "CUSTOM_SUBSCRIPTIONS"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000219",
  "date": "2026-09-29T00:00:00.000Z",
  "description": "LYFT *RIDE TUE 8AM",
  "status": "pending",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000219",
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "amount": "-18.20000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000036",
   "counterpartyRaw": "Lyft"
  },
  "account": {
   "name": "Sapphire Card",
   "type": "liability"
  },
  "category": {
   "label": "Transport",
   "detailed": "CUSTOM_TRANSPORT"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000218",
  "date": "2026-09-29T00:00:00.000Z",
  "description": "SQ *BLUE BOTTLE 0423",
  "status": "pending",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000218",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-18.75000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000034",
   "counterpartyRaw": "Blue Bottle Coffee"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Dining",
   "detailed": "CUSTOM_DINING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000217",
  "date": "2026-09-29T00:00:00.000Z",
  "description": "WHOLEFDS MKT #10248",
  "status": "pending",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000217",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-103.47000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000013",
   "counterpartyRaw": "Whole Foods"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Groceries",
   "detailed": "FOOD_AND_DRINK_GROCERIES"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000216",
  "date": "2026-09-28T00:00:00.000Z",
  "description": "PAYPAL *STEAMGAMES",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000216",
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "amount": "-59.99000000",
   "currency": "USD",
   "categoryId": null,
   "counterpartyRaw": "Steam"
  },
  "account": {
   "name": "Sapphire Card",
   "type": "liability"
  },
  "category": null,
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000215",
  "date": "2026-09-28T00:00:00.000Z",
  "description": "ACH DEP GUSTO PAYROLL",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000215",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "3120.00000000",
   "currency": "USD",
   "categoryId": null,
   "counterpartyRaw": "Gusto Payroll"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": null,
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000214",
  "date": "2026-09-28T00:00:00.000Z",
  "description": "TRADER JOE S #540",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000214",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-62.18000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000013",
   "counterpartyRaw": "Trader Joe's"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Groceries",
   "detailed": "FOOD_AND_DRINK_GROCERIES"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000213",
  "date": "2026-09-27T00:00:00.000Z",
  "description": "TST* CORNER DELI 88",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000213",
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "amount": "-24.60000000",
   "currency": "USD",
   "categoryId": null,
   "counterpartyRaw": "Corner Deli 88"
  },
  "account": {
   "name": "Sapphire Card",
   "type": "liability"
  },
  "category": null,
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000212",
  "date": "2026-09-27T00:00:00.000Z",
  "description": "AMZN MKTP US*2X4L9",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000212",
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "amount": "-203.75000000",
   "currency": "USD",
   "categoryId": null,
   "counterpartyRaw": "Amazon"
  },
  "account": {
   "name": "Sapphire Card",
   "type": "liability"
  },
  "category": null,
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000211",
  "date": "2026-09-27T00:00:00.000Z",
  "description": "LYFT *RIDE SUN 7PM",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000211",
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "amount": "-25.40000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000036",
   "counterpartyRaw": "Lyft"
  },
  "account": {
   "name": "Sapphire Card",
   "type": "liability"
  },
  "category": {
   "label": "Transport",
   "detailed": "CUSTOM_TRANSPORT"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000210",
  "date": "2026-09-27T00:00:00.000Z",
  "description": "CON ED OF NY PAYMENT",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000210",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-176.32000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000035",
   "counterpartyRaw": "Con Edison"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Utilities",
   "detailed": "CUSTOM_UTILITIES"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-00000000020f",
  "date": "2026-09-27T00:00:00.000Z",
  "description": "TRADER JOE S #540",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-00000000020f",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-48.07000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000013",
   "counterpartyRaw": "Trader Joe's"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Groceries",
   "detailed": "FOOD_AND_DRINK_GROCERIES"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-00000000020e",
  "date": "2026-09-27T00:00:00.000Z",
  "description": "WHOLEFDS MKT #10248",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-00000000020e",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-71.84000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000013",
   "counterpartyRaw": "Whole Foods"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Groceries",
   "detailed": "FOOD_AND_DRINK_GROCERIES"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-00000000020d",
  "date": "2026-09-24T00:00:00.000Z",
  "description": "SQ *BLUE BOTTLE 0423",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-00000000020d",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-12.65000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000034",
   "counterpartyRaw": "Blue Bottle Coffee"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Dining",
   "detailed": "CUSTOM_DINING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-00000000020c",
  "date": "2026-09-23T00:00:00.000Z",
  "description": "AMZN MKTP US*23H7Q2",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-00000000020c",
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "amount": "-20.99000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000033",
   "counterpartyRaw": "Amazon"
  },
  "account": {
   "name": "Sapphire Card",
   "type": "liability"
  },
  "category": {
   "label": "Shopping",
   "detailed": "CUSTOM_SHOPPING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-00000000020b",
  "date": "2026-09-22T00:00:00.000Z",
  "description": "AUTOMATIC PAYMENT - THANK YOU",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-00000000020b",
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "amount": "1412.08000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-00000000000b",
   "counterpartyRaw": null
  },
  "account": {
   "name": "Sapphire Card",
   "type": "liability"
  },
  "category": {
   "label": "Credit Card Payment",
   "detailed": "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-00000000020a",
  "date": "2026-09-22T00:00:00.000Z",
  "description": "CHASE CREDIT CRD AUTOPAY",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-00000000020a",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-1412.08000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-00000000000b",
   "counterpartyRaw": null
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Credit Card Payment",
   "detailed": "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000209",
  "date": "2026-09-22T00:00:00.000Z",
  "description": "SQ *BLUE BOTTLE 0423",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000209",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-13.45000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000034",
   "counterpartyRaw": "Blue Bottle Coffee"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Dining",
   "detailed": "CUSTOM_DINING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000208",
  "date": "2026-09-21T00:00:00.000Z",
  "description": "SQ *BLUE BOTTLE 0423",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000208",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-12.60000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000034",
   "counterpartyRaw": "Blue Bottle Coffee"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Dining",
   "detailed": "CUSTOM_DINING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000207",
  "date": "2026-09-20T00:00:00.000Z",
  "description": "TRADER JOE S #540",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000207",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-55.39000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000013",
   "counterpartyRaw": "Trader Joe's"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Groceries",
   "detailed": "FOOD_AND_DRINK_GROCERIES"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000206",
  "date": "2026-09-20T00:00:00.000Z",
  "description": "TARGET 00023481",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000206",
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "amount": "-115.12000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000033",
   "counterpartyRaw": "Target"
  },
  "account": {
   "name": "Sapphire Card",
   "type": "liability"
  },
  "category": {
   "label": "Shopping",
   "detailed": "CUSTOM_SHOPPING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000205",
  "date": "2026-09-19T00:00:00.000Z",
  "description": "SWEETGREEN NOHO",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000205",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-24.62000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000034",
   "counterpartyRaw": "Sweetgreen"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Dining",
   "detailed": "CUSTOM_DINING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000204",
  "date": "2026-09-18T00:00:00.000Z",
  "description": "SQ *BLUE BOTTLE 0423",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000204",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-12.85000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000034",
   "counterpartyRaw": "Blue Bottle Coffee"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Dining",
   "detailed": "CUSTOM_DINING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000203",
  "date": "2026-09-18T00:00:00.000Z",
  "description": "AMZN MKTP US*18H7Q2",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000203",
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "amount": "-31.22000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000033",
   "counterpartyRaw": "Amazon"
  },
  "account": {
   "name": "Sapphire Card",
   "type": "liability"
  },
  "category": {
   "label": "Shopping",
   "detailed": "CUSTOM_SHOPPING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000202",
  "date": "2026-09-16T00:00:00.000Z",
  "description": "NETFLIX.COM",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000202",
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "amount": "-15.49000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000037",
   "counterpartyRaw": "Netflix"
  },
  "account": {
   "name": "Sapphire Card",
   "type": "liability"
  },
  "category": {
   "label": "Subscriptions",
   "detailed": "CUSTOM_SUBSCRIPTIONS"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000201",
  "date": "2026-09-16T00:00:00.000Z",
  "description": "SQ *BLUE BOTTLE 0423",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000201",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-11.95000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000034",
   "counterpartyRaw": "Blue Bottle Coffee"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Dining",
   "detailed": "CUSTOM_DINING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-000000000200",
  "date": "2026-09-15T00:00:00.000Z",
  "description": "TRANSFER FROM CHECKING ••4821",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-000000000200",
   "accountId": "ac000000-0000-4000-8000-000000000002",
   "amount": "500.00000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000006",
   "counterpartyRaw": null
  },
  "account": {
   "name": "High-Yield Savings",
   "type": "asset"
  },
  "category": {
   "label": "Transfer In (Account)",
   "detailed": "TRANSFER_IN_ACCOUNT_TRANSFER"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001ff",
  "date": "2026-09-15T00:00:00.000Z",
  "description": "TRANSFER TO SAVINGS ••0917",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001ff",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-500.00000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-00000000000a",
   "counterpartyRaw": null
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Transfer to Savings",
   "detailed": "TRANSFER_OUT_SAVINGS"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001fe",
  "date": "2026-09-15T00:00:00.000Z",
  "description": "LYFT *RIDE SUN 7PM",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001fe",
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "amount": "-22.80000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000036",
   "counterpartyRaw": "Lyft"
  },
  "account": {
   "name": "Sapphire Card",
   "type": "liability"
  },
  "category": {
   "label": "Transport",
   "detailed": "CUSTOM_TRANSPORT"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001fd",
  "date": "2026-09-14T00:00:00.000Z",
  "description": "ACH DEP GUSTO PAYROLL",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001fd",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "3120.00000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000001",
   "counterpartyRaw": "Gusto Payroll"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Salary & Wages",
   "detailed": "INCOME_WAGES"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001fc",
  "date": "2026-09-14T00:00:00.000Z",
  "description": "SQ *BLUE BOTTLE 0423",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001fc",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-12.30000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000034",
   "counterpartyRaw": "Blue Bottle Coffee"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Dining",
   "detailed": "CUSTOM_DINING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001fb",
  "date": "2026-09-13T00:00:00.000Z",
  "description": "WHOLEFDS MKT #10248",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001fb",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-88.15000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000013",
   "counterpartyRaw": "Whole Foods"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Groceries",
   "detailed": "FOOD_AND_DRINK_GROCERIES"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001fa",
  "date": "2026-09-12T00:00:00.000Z",
  "description": "JOE'S PIZZA BROADWAY",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001fa",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-38.50000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000034",
   "counterpartyRaw": "Joe's Pizza"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Dining",
   "detailed": "CUSTOM_DINING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001f9",
  "date": "2026-09-12T00:00:00.000Z",
  "description": "AMZN MKTP US*12H7Q2",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001f9",
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "amount": "-19.99000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000033",
   "counterpartyRaw": "Amazon"
  },
  "account": {
   "name": "Sapphire Card",
   "type": "liability"
  },
  "category": {
   "label": "Shopping",
   "detailed": "CUSTOM_SHOPPING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001f8",
  "date": "2026-09-11T00:00:00.000Z",
  "description": "CVS/PHARMACY #02791",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001f8",
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "amount": "-42.17000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-00000000001c",
   "counterpartyRaw": "CVS Pharmacy"
  },
  "account": {
   "name": "Sapphire Card",
   "type": "liability"
  },
  "category": {
   "label": "Pharmacy & Supplements",
   "detailed": "MEDICAL_PHARMACIES_AND_SUPPLEMENTS"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001f7",
  "date": "2026-09-11T00:00:00.000Z",
  "description": "SQ *BLUE BOTTLE 0423",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001f7",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-13.10000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000034",
   "counterpartyRaw": "Blue Bottle Coffee"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Dining",
   "detailed": "CUSTOM_DINING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001f6",
  "date": "2026-09-10T00:00:00.000Z",
  "description": "TRADER JOE S #540",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001f6",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-51.12000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000013",
   "counterpartyRaw": "Trader Joe's"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Groceries",
   "detailed": "FOOD_AND_DRINK_GROCERIES"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001f5",
  "date": "2026-09-09T00:00:00.000Z",
  "description": "LYFT *RIDE SUN 7PM",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001f5",
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "amount": "-16.45000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000036",
   "counterpartyRaw": "Lyft"
  },
  "account": {
   "name": "Sapphire Card",
   "type": "liability"
  },
  "category": {
   "label": "Transport",
   "detailed": "CUSTOM_TRANSPORT"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001f4",
  "date": "2026-09-09T00:00:00.000Z",
  "description": "SQ *BLUE BOTTLE 0423",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001f4",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-12.95000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000034",
   "counterpartyRaw": "Blue Bottle Coffee"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Dining",
   "detailed": "CUSTOM_DINING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001f3",
  "date": "2026-09-08T00:00:00.000Z",
  "description": "SQ *BLUE BOTTLE 0423",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001f3",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-11.60000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000034",
   "counterpartyRaw": "Blue Bottle Coffee"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Dining",
   "detailed": "CUSTOM_DINING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001f2",
  "date": "2026-09-08T00:00:00.000Z",
  "description": "AMZN MKTP US*8H7Q2",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001f2",
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "amount": "-27.48000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000033",
   "counterpartyRaw": "Amazon"
  },
  "account": {
   "name": "Sapphire Card",
   "type": "liability"
  },
  "category": {
   "label": "Shopping",
   "detailed": "CUSTOM_SHOPPING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001f1",
  "date": "2026-09-07T00:00:00.000Z",
  "description": "SQ *BLUE BOTTLE 0423",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001f1",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-12.75000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000034",
   "counterpartyRaw": "Blue Bottle Coffee"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Dining",
   "detailed": "CUSTOM_DINING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001f0",
  "date": "2026-09-06T00:00:00.000Z",
  "description": "TARGET 00023481",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001f0",
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "amount": "-128.36000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000033",
   "counterpartyRaw": "Target"
  },
  "account": {
   "name": "Sapphire Card",
   "type": "liability"
  },
  "category": {
   "label": "Shopping",
   "detailed": "CUSTOM_SHOPPING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001ef",
  "date": "2026-09-05T00:00:00.000Z",
  "description": "WHOLEFDS MKT #10248",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001ef",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-92.60000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000013",
   "counterpartyRaw": "Whole Foods"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Groceries",
   "detailed": "FOOD_AND_DRINK_GROCERIES"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001ee",
  "date": "2026-09-05T00:00:00.000Z",
  "description": "SPECTRUM 855-707-7328",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001ee",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-69.99000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000035",
   "counterpartyRaw": "Spectrum"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Utilities",
   "detailed": "CUSTOM_UTILITIES"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001ed",
  "date": "2026-09-04T00:00:00.000Z",
  "description": "SQ *BLUE BOTTLE 0423",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001ed",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-13.20000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000034",
   "counterpartyRaw": "Blue Bottle Coffee"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Dining",
   "detailed": "CUSTOM_DINING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001ec",
  "date": "2026-09-03T00:00:00.000Z",
  "description": "AMZN MKTP US*3H7Q2",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001ec",
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "amount": "-34.99000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000033",
   "counterpartyRaw": "Amazon"
  },
  "account": {
   "name": "Sapphire Card",
   "type": "liability"
  },
  "category": {
   "label": "Shopping",
   "detailed": "CUSTOM_SHOPPING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001eb",
  "date": "2026-09-03T00:00:00.000Z",
  "description": "EQUINOX #142 NEW YORK",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001eb",
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "amount": "-185.00000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-00000000001f",
   "counterpartyRaw": "Equinox"
  },
  "account": {
   "name": "Sapphire Card",
   "type": "liability"
  },
  "category": {
   "label": "Gym & Fitness",
   "detailed": "PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001ea",
  "date": "2026-09-02T00:00:00.000Z",
  "description": "SQ *BLUE BOTTLE 0423",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001ea",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-11.85000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000034",
   "counterpartyRaw": "Blue Bottle Coffee"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Dining",
   "detailed": "CUSTOM_DINING"
  },
  "countsTowardTotals": true
 },
 {
  "id": "7a000000-0000-4000-8000-0000000001e9",
  "date": "2026-09-01T00:00:00.000Z",
  "description": "SQ *BLUE BOTTLE 0423",
  "status": "cleared",
  "posting": {
   "id": "7b000000-0000-4000-8000-0000000001e9",
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "amount": "-12.40000000",
   "currency": "USD",
   "categoryId": "ca000000-0000-4000-8000-000000000034",
   "counterpartyRaw": "Blue Bottle Coffee"
  },
  "account": {
   "name": "Everyday Checking",
   "type": "asset"
  },
  "category": {
   "label": "Dining",
   "detailed": "CUSTOM_DINING"
  },
  "countsTowardTotals": true
 }
]

/** Rows in the whole ledger, and how many of them have no category. */
export const transactionCount = 538
export const uncategorizedCount = 5

/** September 2026 to date against the average month. */
export const cashflow: CashFlow = {
 "month": "2026-09",
 "currency": "USD",
 "currencies": [
  "USD"
 ],
 "partial": true,
 "daysElapsed": 29,
 "daysInMonth": 30,
 "compare": "average",
 "baselineMonths": 11,
 "accounts": [
  {
   "id": "ac000000-0000-4000-8000-000000000001",
   "name": "Everyday Checking",
   "kind": "cash",
   "mask": "4821",
   "connectorId": "c0000000-0000-4000-8000-000000000001"
  },
  {
   "id": "ac000000-0000-4000-8000-000000000002",
   "name": "High-Yield Savings",
   "kind": "cash",
   "mask": "0917",
   "connectorId": "c0000000-0000-4000-8000-000000000001"
  },
  {
   "id": "ac000000-0000-4000-8000-000000000003",
   "name": "Sapphire Card",
   "kind": "credit",
   "mask": "3390",
   "connectorId": "c0000000-0000-4000-8000-000000000002"
  }
 ],
 "totals": {
  "moneyIn": 6240,
  "moneyOut": 3918.64,
  "spending": 3918.64,
  "debtPayments": 0,
  "kept": 2321.36,
  "savingsRate": 0.37201282051282053,
  "invested": 0,
  "movedToSavings": 500,
  "vs": {
   "moneyIn": {
    "baseline": 6250.445455,
    "change": -0.0016711536921971328
   },
   "moneyOut": {
    "baseline": 3598.456364,
    "change": 0.08897805158990105
   },
   "kept": {
    "baseline": 2651.989091,
    "change": -0.12467211577983063
   },
   "savingsRate": {
    "baseline": 0.424288,
    "change": -0.12320683000032871
   }
  }
 },
 "notCounted": [
  {
   "kind": "card_payoffs",
   "count": 1,
   "total": 1412.08
  },
  {
   "kind": "savings",
   "count": 1,
   "total": 500
  }
 ],
 "otherCurrencies": [],
 "possibleTransfers": {
  "count": 0,
  "total": 0
 },
 "sankey": {
  "sources": [
   {
    "id": "source:Gusto Payroll",
    "label": "Gusto Payroll",
    "amount": 6240,
    "kind": "payer"
   }
  ],
  "targets": [
   {
    "id": "category:Rent",
    "label": "Rent",
    "amount": 1850,
    "group": "spending",
    "kind": "category",
    "fromBank": false
   },
   {
    "id": "category:Shopping",
    "label": "Shopping",
    "amount": 581.9,
    "group": "spending",
    "kind": "category",
    "fromBank": false
   },
   {
    "id": "category:Groceries",
    "label": "Groceries",
    "amount": 572.82,
    "group": "spending",
    "kind": "category",
    "fromBank": false
   },
   {
    "id": "category:Utilities",
    "label": "Utilities",
    "amount": 246.31,
    "group": "spending",
    "kind": "category",
    "fromBank": false
   },
   {
    "id": "category:Dining",
    "label": "Dining",
    "amount": 245.52,
    "group": "spending",
    "kind": "category",
    "fromBank": false
   },
   {
    "id": "category:Gym & Fitness",
    "label": "Gym & Fitness",
    "amount": 185,
    "group": "spending",
    "kind": "category",
    "fromBank": false
   },
   {
    "id": "other_categories",
    "label": "Other",
    "amount": 237.09,
    "group": "spending",
    "kind": "other_categories",
    "otherCount": 5
   },
   {
    "id": "notcounted:savings",
    "label": "Moved to savings",
    "amount": 500,
    "group": "kept",
    "kind": "savings"
   },
   {
    "id": "stayed_in_cash",
    "label": "Stayed in cash",
    "amount": 1821.36,
    "group": "kept",
    "kind": "stayed_in_cash"
   }
  ],
  "moneyIn": 6240
 },
 "transfers": [
  {
   "kind": "savings",
   "total": 500,
   "count": 1,
   "accounts": [
    "Everyday Checking",
    "High-Yield Savings"
   ]
  },
  {
   "kind": "card_payoffs",
   "total": 1412.08,
   "count": 1,
   "accounts": [
    "Everyday Checking",
    "Sapphire Card"
   ]
  }
 ],
 "months": [
  {
   "month": "2025-10",
   "moneyIn": 6314.3,
   "moneyOut": 3438.01,
   "net": 2876.29,
   "partial": false
  },
  {
   "month": "2025-11",
   "moneyIn": 6321.16,
   "moneyOut": 3360.7,
   "net": 2960.46,
   "partial": false
  },
  {
   "month": "2025-12",
   "moneyIn": 6319.98,
   "moneyOut": 3954.57,
   "net": 2365.41,
   "partial": false
  },
  {
   "month": "2026-01",
   "moneyIn": 6317.38,
   "moneyOut": 3528.64,
   "net": 2788.74,
   "partial": false
  },
  {
   "month": "2026-02",
   "moneyIn": 6319.91,
   "moneyOut": 3492.52,
   "net": 2827.39,
   "partial": false
  },
  {
   "month": "2026-03",
   "moneyIn": 6321.9,
   "moneyOut": 3583.74,
   "net": 2738.16,
   "partial": false
  },
  {
   "month": "2026-04",
   "moneyIn": 6315.06,
   "moneyOut": 3286.1,
   "net": 3028.96,
   "partial": false
  },
  {
   "month": "2026-05",
   "moneyIn": 6314.36,
   "moneyOut": 3494.47,
   "net": 2819.89,
   "partial": false
  },
  {
   "month": "2026-06",
   "moneyIn": 6314.78,
   "moneyOut": 3304.03,
   "net": 3010.75,
   "partial": false
  },
  {
   "month": "2026-07",
   "moneyIn": 6357.37,
   "moneyOut": 3468.3,
   "net": 2889.07,
   "partial": false
  },
  {
   "month": "2026-08",
   "moneyIn": 6321.79,
   "moneyOut": 4671.94,
   "net": 1649.85,
   "partial": false
  },
  {
   "month": "2026-09",
   "moneyIn": 6240,
   "moneyOut": 3918.64,
   "net": 2321.36,
   "partial": true
  }
 ],
 "averages": {
  "moneyIn": 6321.635455,
  "moneyOut": 3598.456364
 },
 "pace": [
  {
   "day": 1,
   "current": 1862.4,
   "baseline": 1862.474545
  },
  {
   "day": 2,
   "current": 1874.25,
   "baseline": 1870.268182
  },
  {
   "day": 3,
   "current": 2094.24,
   "baseline": 2081.519091
  },
  {
   "day": 4,
   "current": 2107.44,
   "baseline": 2118.892727
  },
  {
   "day": 5,
   "current": 2270.03,
   "baseline": 2230.930909
  },
  {
   "day": 6,
   "current": 2398.39,
   "baseline": 2326.888182
  },
  {
   "day": 7,
   "current": 2411.14,
   "baseline": 2350.614545
  },
  {
   "day": 8,
   "current": 2450.22,
   "baseline": 2381.534545
  },
  {
   "day": 9,
   "current": 2479.62,
   "baseline": 2422.762727
  },
  {
   "day": 10,
   "current": 2530.74,
   "baseline": 2508.668182
  },
  {
   "day": 11,
   "current": 2586.01,
   "baseline": 2541.277273
  },
  {
   "day": 12,
   "current": 2644.5,
   "baseline": 2629.418182
  },
  {
   "day": 13,
   "current": 2732.65,
   "baseline": 2663.987273
  },
  {
   "day": 14,
   "current": 2744.95,
   "baseline": 2684.4
  },
  {
   "day": 15,
   "current": 2767.75,
   "baseline": 2717.300909
  },
  {
   "day": 16,
   "current": 2795.19,
   "baseline": 2781.791818
  },
  {
   "day": 17,
   "current": 2795.19,
   "baseline": 2814.132727
  },
  {
   "day": 18,
   "current": 2839.26,
   "baseline": 2888.576364
  },
  {
   "day": 19,
   "current": 2863.88,
   "baseline": 2948.774545
  },
  {
   "day": 20,
   "current": 3034.39,
   "baseline": 2997.64
  },
  {
   "day": 21,
   "current": 3046.99,
   "baseline": 3027.558182
  },
  {
   "day": 22,
   "current": 3060.44,
   "baseline": 3055.791818
  },
  {
   "day": 23,
   "current": 3081.43,
   "baseline": 3114.803636
  },
  {
   "day": 24,
   "current": 3094.08,
   "baseline": 3283.637273
  },
  {
   "day": 25,
   "current": 3094.08,
   "baseline": 3310.283636
  },
  {
   "day": 26,
   "current": 3094.08,
   "baseline": 3386.816364
  },
  {
   "day": 27,
   "current": 3644.06,
   "baseline": 3574.770909
  },
  {
   "day": 28,
   "current": 3766.23,
   "baseline": 3582.851818
  },
  {
   "day": 29,
   "current": 3918.64,
   "baseline": 3598.456364
  },
  {
   "day": 30,
   "current": null,
   "baseline": 3598.456364
  }
 ],
 "categories": [
  {
   "label": "Rent",
   "amount": 1850,
   "shareOfSpending": 0.47210256619643554,
   "shareOfIncome": 0.296474358974359,
   "baseline": 1850,
   "change": 0,
   "fromBank": false
  },
  {
   "label": "Shopping",
   "amount": 581.9,
   "shareOfSpending": 0.14849539636200315,
   "shareOfIncome": 0.09325320512820512,
   "baseline": 421.5,
   "change": 0.38054567022538555,
   "fromBank": false
  },
  {
   "label": "Groceries",
   "amount": 572.82,
   "shareOfSpending": 0.1461782659289958,
   "shareOfIncome": 0.09179807692307693,
   "baseline": 490.280909,
   "change": 0.1683506118326138,
   "fromBank": false
  },
  {
   "label": "Utilities",
   "amount": 246.31,
   "shareOfSpending": 0.06285599085396974,
   "shareOfIncome": 0.03947275641025641,
   "baseline": 219.596364,
   "change": 0.12164880835640798,
   "fromBank": false
  },
  {
   "label": "Dining",
   "amount": 245.52,
   "shareOfSpending": 0.06265439029867506,
   "shareOfIncome": 0.03934615384615385,
   "baseline": 209.413636,
   "change": 0.17241648963107642,
   "fromBank": false
  },
  {
   "label": "Gym & Fitness",
   "amount": 185,
   "shareOfSpending": 0.04721025661964355,
   "shareOfIncome": 0.029647435897435896,
   "baseline": 185,
   "change": 0,
   "fromBank": false
  },
  {
   "label": "Transport",
   "amount": 82.85,
   "shareOfSpending": 0.021142539248310638,
   "shareOfIncome": 0.013277243589743588,
   "baseline": 97.645455,
   "change": -0.15152220858615492,
   "fromBank": false
  },
  {
   "label": "Entertainment",
   "amount": 59.99,
   "shareOfSpending": 0.015308882673580632,
   "shareOfIncome": 0.009613782051282051,
   "baseline": 0,
   "change": null,
   "fromBank": true
  },
  {
   "label": "Pharmacy & Supplements",
   "amount": 42.17,
   "shareOfSpending": 0.010761386603515506,
   "shareOfIncome": 0.006758012820512821,
   "baseline": 9.186364,
   "change": 3.5904995708857177,
   "fromBank": false
  },
  {
   "label": "Subscriptions",
   "amount": 27.48,
   "shareOfSpending": 0.007012637037339485,
   "shareOfIncome": 0.004403846153846154,
   "baseline": 27.48,
   "change": 0,
   "fromBank": false
  },
  {
   "label": "Uncategorized",
   "amount": 24.6,
   "shareOfSpending": 0.00627768817753098,
   "shareOfIncome": 0.003942307692307693,
   "baseline": 0,
   "change": null,
   "fromBank": false
  }
 ],
 "merchants": [
  {
   "name": "Hudson Property",
   "amount": 1850,
   "count": 1,
   "average": 1850,
   "isNew": false
  },
  {
   "name": "Whole Foods",
   "amount": 356.06,
   "count": 4,
   "average": 89.015,
   "isNew": false
  },
  {
   "name": "Amazon",
   "amount": 338.42,
   "count": 6,
   "average": 56.403333,
   "isNew": false
  },
  {
   "name": "Target",
   "amount": 243.48,
   "count": 2,
   "average": 121.74,
   "isNew": false
  },
  {
   "name": "Trader Joe's",
   "amount": 216.76,
   "count": 4,
   "average": 54.19,
   "isNew": false
  },
  {
   "name": "Equinox",
   "amount": 185,
   "count": 1,
   "average": 185,
   "isNew": false
  },
  {
   "name": "Blue Bottle Coffee",
   "amount": 182.4,
   "count": 14,
   "average": 13.028571,
   "isNew": false
  },
  {
   "name": "Con Edison",
   "amount": 176.32,
   "count": 1,
   "average": 176.32,
   "isNew": false
  }
 ],
 "sources": [
  {
   "name": "Gusto Payroll",
   "amount": 6240,
   "regularity": "monthly",
   "kind": "payer",
   "share": 1
  }
 ],
 "largest": [
  {
   "transactionId": "7a000000-0000-4000-8000-0000000001e8",
   "date": "2026-09-01T00:00:00.000Z",
   "description": "HUDSON PROPERTY MGMT ACH",
   "accountName": "Everyday Checking",
   "amount": -1850,
   "currency": "USD",
   "category": "Rent",
   "fromBank": false,
   "pending": false
  },
  {
   "transactionId": "7a000000-0000-4000-8000-000000000212",
   "date": "2026-09-27T00:00:00.000Z",
   "description": "AMZN MKTP US*2X4L9",
   "accountName": "Sapphire Card",
   "amount": -203.75,
   "currency": "USD",
   "category": "Shopping",
   "fromBank": false,
   "pending": false
  },
  {
   "transactionId": "7a000000-0000-4000-8000-0000000001eb",
   "date": "2026-09-03T00:00:00.000Z",
   "description": "EQUINOX #142 NEW YORK",
   "accountName": "Sapphire Card",
   "amount": -185,
   "currency": "USD",
   "category": "Gym & Fitness",
   "fromBank": false,
   "pending": false
  },
  {
   "transactionId": "7a000000-0000-4000-8000-000000000210",
   "date": "2026-09-27T00:00:00.000Z",
   "description": "CON ED OF NY PAYMENT",
   "accountName": "Everyday Checking",
   "amount": -176.32,
   "currency": "USD",
   "category": "Utilities",
   "fromBank": false,
   "pending": false
  },
  {
   "transactionId": "7a000000-0000-4000-8000-0000000001f0",
   "date": "2026-09-06T00:00:00.000Z",
   "description": "TARGET 00023481",
   "accountName": "Sapphire Card",
   "amount": -128.36,
   "currency": "USD",
   "category": "Shopping",
   "fromBank": false,
   "pending": false
  }
 ]
}

export const reviewQueue: ReviewItem[] = [
 {
  "id": "e0000000-0000-4000-8000-000000000001",
  "postingId": "7b000000-0000-4000-8000-000000000215",
  "suggestedCategoryId": "ca000000-0000-4000-8000-000000000001",
  "confidenceBand": "medium",
  "source": "jev",
  "confidence": "0.710",
  "reason": "A credit of the same size arrived from the same payer last month, but Fluide has only seen this payer twice.",
  "status": "pending",
  "createdAt": "2026-09-29T09:12:37.000Z",
  "posting": {
   "amount": "3120.00000000",
   "currency": "USD",
   "counterpartyRaw": "Gusto Payroll",
   "description": "ACH DEP GUSTO PAYROLL",
   "date": "2026-09-28T00:00:00.000Z"
  }
 },
 {
  "id": "e0000000-0000-4000-8000-000000000002",
  "postingId": "7b000000-0000-4000-8000-000000000216",
  "suggestedCategoryId": "ca000000-0000-4000-8000-000000000011",
  "confidenceBand": "medium",
  "source": "jev",
  "confidence": "0.540",
  "reason": "The PayPal descriptor hides the merchant. Only the token STEAMGAMES points anywhere, and nothing has been filed under Video Games before.",
  "status": "pending",
  "createdAt": "2026-09-29T09:12:37.000Z",
  "posting": {
   "amount": "-59.99000000",
   "currency": "USD",
   "counterpartyRaw": "Steam",
   "description": "PAYPAL *STEAMGAMES",
   "date": "2026-09-28T00:00:00.000Z"
  }
 },
 {
  "id": "e0000000-0000-4000-8000-000000000003",
  "postingId": "7b000000-0000-4000-8000-000000000212",
  "suggestedCategoryId": "ca000000-0000-4000-8000-000000000033",
  "confidenceBand": "medium",
  "source": "jev",
  "confidence": "0.620",
  "reason": "The model files this merchant under Shopping every time it sees it, but $203.75 is far above the $26.93 this card usually spends there, so the amount check held it back.",
  "status": "pending",
  "createdAt": "2026-09-29T09:12:37.000Z",
  "posting": {
   "amount": "-203.75000000",
   "currency": "USD",
   "counterpartyRaw": "Amazon",
   "description": "AMZN MKTP US*2X4L9",
   "date": "2026-09-27T00:00:00.000Z"
  }
 },
 {
  "id": "e0000000-0000-4000-8000-000000000004",
  "postingId": "7b000000-0000-4000-8000-000000000213",
  "suggestedCategoryId": null,
  "confidenceBand": "low",
  "source": "jev",
  "confidence": "0.430",
  "reason": "Below 0.50 the gate throws the guess away rather than show it. Pick a category and Fluide files it and saves a rule.",
  "status": "pending",
  "createdAt": "2026-09-29T09:12:37.000Z",
  "posting": {
   "amount": "-24.60000000",
   "currency": "USD",
   "counterpartyRaw": "Corner Deli 88",
   "description": "TST* CORNER DELI 88",
   "date": "2026-09-27T00:00:00.000Z"
  }
 }
]

export const gate: GateSettings = {
 "highConfidence": 0.75,
 "lowConfidence": 0.5,
 "amountRangeTolerance": 0.5,
 "updatedAt": "2026-04-04T18:30:02.000Z"
}

export const transfers: TransferGroup[] = [
 {
  "currency": "USD",
  "rows": [
   {
    "transactionId": "7a000000-0000-4000-8000-0000000001de",
    "date": "2026-08-24T00:00:00.000Z",
    "description": "ONLINE TRANSFER TO XXXXXX7702 REF #IB0F8KZ2",
    "accountName": "Everyday Checking",
    "amount": -1200,
    "currency": "USD"
   }
  ]
 }
]

/** Saved conversations, newest first. */
export const threads: ChatThreadSummary[] = [
 {
  "id": "d0000000-0000-4000-8000-000000000001",
  "title": "How much did I earn vs spend this month?",
  "updatedAt": "2026-09-29T10:42:18.000Z",
  "questions": 2
 },
 {
  "id": "d0000000-0000-4000-8000-000000000002",
  "title": "Who did I pay the most this month?",
  "updatedAt": "2026-09-27T20:15:02.000Z",
  "questions": 1
 },
 {
  "id": "d0000000-0000-4000-8000-000000000003",
  "title": "Why is Shopping higher than usual?",
  "updatedAt": "2026-09-22T08:31:40.000Z",
  "questions": 3
 }
]

/** Posting id → account, for the review items (apps/web reads it off the full transaction list). */
export const postingAccountList: [string, PostingAccount][] = [
 [
  "7b000000-0000-4000-8000-000000000215",
  {
   "accountId": "ac000000-0000-4000-8000-000000000001",
   "name": "Everyday Checking"
  }
 ],
 [
  "7b000000-0000-4000-8000-000000000216",
  {
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "name": "Sapphire Card"
  }
 ],
 [
  "7b000000-0000-4000-8000-000000000212",
  {
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "name": "Sapphire Card"
  }
 ],
 [
  "7b000000-0000-4000-8000-000000000213",
  {
   "accountId": "ac000000-0000-4000-8000-000000000003",
   "name": "Sapphire Card"
  }
 ]
]
