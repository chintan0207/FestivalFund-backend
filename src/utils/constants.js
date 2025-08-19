export const DB_NAME = "Festivalfund";

export const GlobalRoleEnum = {
  ADMIN: "admin",
  VIEWER: "viewer",
};

export const AvailableGlobalRoles = Object.values(GlobalRoleEnum);

export const ContributionStatusEnum = {
  DEPOSITED: "deposited",
  PENDING: "pending",
  CANCELLED: "cancelled",
};

export const AvailableContributionStatuses = Object.values(ContributionStatusEnum);

export const ContributionTypeEnum = {
  CASH: "cash",
  ITEM: "item",
};

export const AvailableContributionTypes = Object.values(ContributionTypeEnum);

export const ExpenseCategoryEnum = {
  MAHAPRASAD: "Mahaprasad",
  DECORATION: "Decoration",
  MANDAP: "Mandap",
  SOUND: "Sound",
  OTHER: "Other",
};

export const AvailableExpenseCategories = Object.values(ExpenseCategoryEnum);

export const ContributorCategoryEnum = {
  PARENT: "Parents",
  BOY: "Boys",
  GIRL: "Girls",
};

export const AvailableContributorCategories = Object.values(ContributorCategoryEnum);
